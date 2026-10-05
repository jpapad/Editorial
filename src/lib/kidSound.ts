"use client";

// Sounds and a voice for the children's side. Sounds are synthesised with
// Web Audio (no audio files to download); the voice is the browser's own
// speech synthesis, in the UI language. Both are off-switchable per device
// and fail silently where the browser has neither.

const SOUND_KEY = "pagewright-kid-sound";

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // not remembered in private mode
  }
  if (!on) window.speechSynthesis?.cancel();
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** One soft note: frequency glide, quick attack, gentle decay. */
function tone(freq: number, start: number, duration: number, { to, type = "sine", volume = 0.18 }: { to?: number; type?: OscillatorType; volume?: number } = {}) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Paint bucket: a little "bloop". */
export function playFill() {
  tone(520, 0, 0.16, { to: 880, volume: 0.14 });
}

/** A tap on a picture / button. */
export function playTap() {
  tone(660, 0, 0.07, { type: "triangle", volume: 0.1 });
}

/** Wrong pictures: two low notes. */
export function playOops() {
  tone(330, 0, 0.14, { type: "triangle", volume: 0.12 });
  tone(247, 0.15, 0.2, { type: "triangle", volume: 0.12 });
}

/** "I'm done!" — a rising arpeggio. */
export function playCheer() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.28, { type: "triangle", volume: 0.16 }));
}

/** Reads `text` aloud in the UI language (Greek or English voice when the device has one). */
export function speak(text: string, lang: "el" | "en") {
  if (typeof window === "undefined" || !soundOn() || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "el" ? "el-GR" : "en-US";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  utterance.pitch = 1.1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** Names for the kids' palette, read aloud when a color is picked. Keys are i18n keys. */
export const COLOR_NAMES: Record<string, string> = {
  "#e5484d": "Red",
  "#f08c2e": "Orange",
  "#f5c518": "Yellow",
  "#3cb371": "Green",
  "#2f80ed": "Blue",
  "#8e5ad6": "Purple",
  "#e05a9b": "Pink",
  "#8a5a3c": "Brown",
  "#e4b7a0": "Peach",
  "#8fae8b": "Sage green",
  "#7b8fa8": "Gray blue",
  "#111827": "Black",
};
