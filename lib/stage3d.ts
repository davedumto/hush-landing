// The stage, rendered live from a 3D model instead of a baked frame sequence.
// Mirrors FrameStage's contract (constructor(canvas, innerWidth, onReady), sizeStage(), draw(StageState))
// so PageShell's tick loop and the journey()/keyframe math don't need to change at all.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clamp, type StageState } from "./journey";

const MODEL_URL = "/models/jbl_tune_720bt.glb";
const NF = 297; // keeps the same frame-index numeric range the journey math already emits

// frame 0: near-front, both cups visible, frame ~144: side profile, frame 296: front-on.
// Calibrated empirically against this model: 0deg/180deg render front-on, 90deg is pure side profile.
const ROT_START = (30 * Math.PI) / 180;
const ROT_END = (180 * Math.PI) / 180;
// the model's own width-at-rotation is narrower than its height, unlike the reference's
// per-frame-cropped photography -- nudge the fit so it still reaches the gap's edges.
const SCALE_BOOST = 1.08;
// at this yaw the model's visual weight leans left of its measured center; nudge right,
// as a fraction of the target height so it scales with viewport size instead of a fixed px.
const X_NUDGE_FRAC = 0.06;

export class Stage3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private group: THREE.Group; // position + scale only (screen placement)
  private spinGroup: THREE.Group; // rotation only (the turntable spin), lights stay outside this
  private model: THREE.Object3D | null = null;
  private modelRadius = 1;
  private modelCenter = new THREE.Vector3();
  private dpr = 1;
  private canvas: HTMLCanvasElement;
  private lastSig = "";
  private ready = false;
  private onReady: () => void;
  private lastRecenterRotY: number | null = null;

  constructor(canvas: HTMLCanvasElement, innerWidth: number, onReady: () => void) {
    this.canvas = canvas;
    this.onReady = onReady;

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();

    // a camera whose world X/Y *are* screen pixels (left=0,right=w,top=0,bottom=h, y-down like
    // canvas/CSS), so placing the model is exactly "set group.position.x/y to the pixel target" --
    // no frustum panning math, no coordinate-system surprises. Z is only used for depth/lighting.
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -2000, 2000);
    this.camera.position.set(0, 0, 500);
    this.camera.lookAt(0, 0, 0);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // lights are children of the (non-spinning) position group so they stay at a fixed
    // angle relative to the screen, no matter where the model sits or how it's turned --
    // otherwise the lit side would spin with the model instead of reading as one studio setup.
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1, -1.3, 1.1);
    const fill = new THREE.DirectionalLight(0xffffff, 0.9);
    fill.position.set(-1.1, -0.26, 0.7);
    const rim = new THREE.DirectionalLight(0xffffff, 1.1);
    rim.position.set(-0.26, -0.8, -1.3);
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.group.add(key, fill, rim, ambient);

    this.spinGroup = new THREE.Group();
    this.group.add(this.spinGroup);

    this.sizeStage();
    this.load();
  }

  private load() {
    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        this.modelRadius = Math.max(size.x, size.y, size.z) / 2;
        this.modelCenter.copy(center);
        model.position.sub(center);
        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = false;
            obj.receiveShadow = false;
          }
        });
        this.spinGroup.add(model);
        this.model = model;
        this.ready = true;
        this.lastSig = "";
        this.onReady();
      },
      undefined,
      (err) => {
        console.error("stage3d: failed to load model", err);
      }
    );
  }

  // the model's visual center shifts horizontally as it turns (the earcup "bulk" swings to
  // one side), so a single neutral-pose centering isn't enough -- re-measure at the model's
  // current rotation and shift it back onto spinGroup's own origin, which stays our fixed
  // screen-space anchor. Cheap enough to run once per distinct rotation value, not per frame.
  private recenterForCurrentRotation() {
    if (!this.model) return;
    const rotY = this.spinGroup.rotation.y;
    if (rotY === this.lastRecenterRotY) return;
    this.lastRecenterRotY = rotY;
    // measure in world space, then bring the center back into spinGroup's local space
    // (model's own parent) before using it to nudge model.position -- mixing the two
    // spaces directly would apply a world-space offset as if it were already local.
    this.spinGroup.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(this.model);
    const worldCenter = box.getCenter(new THREE.Vector3());
    const localCenter = this.spinGroup.worldToLocal(worldCenter.clone());
    this.model.position.x -= localCenter.x;
    this.model.position.y -= localCenter.y;
  }

  sizeStage() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    // world X/Y now equal screen pixels: (0,0) top-left, (w,h) bottom-right, y-down
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = h;
    this.camera.updateProjectionMatrix();
    this.lastSig = "";
  }

  draw(st: StageState) {
    if (!this.ready || !this.model) return;
    const sig = st.x.toFixed(1) + "," + st.y.toFixed(1) + "," + st.h.toFixed(1) + "," + st.f.toFixed(3) + "," + st.o.toFixed(3);
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    if (st.o <= 0.003) {
      this.renderer.clear();
      return;
    }

    const f = clamp(st.f, 0, NF - 1);
    const t = f / (NF - 1);
    this.spinGroup.rotation.y = ROT_START + (ROT_END - ROT_START) * t;
    this.recenterForCurrentRotation();

    // scale so the model's bounding radius maps to half of st.h (mirrors FrameStage's
    // "bbox height -> h" scaling), then place it at the exact screen pixel (st.x, st.y).
    // negative Y-scale flips the model right-side up in our y-down pixel-space camera.
    const scale = (st.h / 2 / this.modelRadius) * SCALE_BOOST;
    this.group.scale.set(scale, -scale, scale);
    this.group.position.set(st.x + st.h * X_NUDGE_FRAC, st.y, 0);

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
          m.transparent = st.o < 1;
          m.opacity = st.o;
        }
      }
    });

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
