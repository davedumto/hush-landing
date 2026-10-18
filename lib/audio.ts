// One AudioContext, created on the first click of a sound button. Ported from reference/index.html.

const FILES: Record<string, string> = {
  logo: "/sound/logo.wav",
  anc: "/sound/anc.wav",
  amb: "/sound/amb.wav",
  off: "/sound/off.wav",
  connect: "/sound/connect.wav",
  expand: "/sound/expand.wav",
  collapse: "/sound/collapse.wav",
  confirm: "/sound/confirm.wav",
  bed: "/sound/bed.wav",
};

let actx: AudioContext | null = null;
const buf: Record<string, AudioBuffer> = {};
let soundOn = false;
let bedGain: GainNode | null = null;

async function initAudio() {
  if (actx) return;
  actx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  await Promise.all(
    Object.entries(FILES).map(async ([k, u]) => {
      try {
        const ab = await (await fetch(u)).arrayBuffer();
        buf[k] = await new Promise<AudioBuffer>((res, rej) => actx!.decodeAudioData(ab, res, rej));
      } catch {
        // missing or undecodable file: skip it, play() will no-op for this key
      }
    })
  );
  if (buf.bed) {
    bedGain = actx.createGain();
    bedGain.gain.value = 0;
    bedGain.connect(actx.destination);
    const s = actx.createBufferSource();
    s.buffer = buf.bed;
    s.loop = true;
    s.connect(bedGain);
    s.start();
  }
}

export function play(k: string, v = 0.8) {
  if (!soundOn || !actx || !buf[k]) return;
  const s = actx.createBufferSource();
  const g = actx.createGain();
  g.gain.value = v;
  s.buffer = buf[k];
  s.connect(g);
  g.connect(actx.destination);
  s.start();
}

export function setBed(v: number) {
  if (bedGain && actx) bedGain.gain.setTargetAtTime(soundOn ? v : 0, actx.currentTime, 0.08);
}

export async function setSoundOn(on: boolean) {
  soundOn = on;
  if (on) {
    await initAudio();
    if (actx!.state === "suspended") await actx!.resume();
  }
  if (!on) setBed(0);
}

export function isSoundOn() {
  return soundOn;
}
