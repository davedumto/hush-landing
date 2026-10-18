// The shared ref bag for DOM nodes outside Experience's own markup that the single
// scroll ticker in Experience still needs to write to every frame (masthead,
// page island, modes canvas) — the reference touches all of these from one tick().
import type { RefObject } from "react";

export type MastheadRefs = {
  navSoundBtn: RefObject<HTMLButtonElement | null>;
  navSoundLabel: RefObject<HTMLSpanElement | null>;
};

export type ModesRefs = {
  keysCanvas: RefObject<HTMLCanvasElement | null>;
  keyhint: RefObject<HTMLDivElement | null>;
  keySoundBtn: RefObject<HTMLButtonElement | null>;
};

export type PageIslandRefs = {
  pisl: RefObject<HTMLButtonElement | null>;
  pbar: RefObject<HTMLElement | null>;
  flyer: RefObject<HTMLDivElement | null>;
  pmenu: RefObject<HTMLDivElement | null>;
  sOn: RefObject<HTMLButtonElement | null>;
  sOff: RefObject<HTMLButtonElement | null>;
  tDark: RefObject<HTMLButtonElement | null>;
  tLight: RefObject<HTMLButtonElement | null>;
};
