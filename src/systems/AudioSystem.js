import { bus } from "../core/EventBus.js";
const notes = {
  move: [170, 0.028],
  rotate: [330, 0.045],
  hold: [440, 0.08],
  drop: [95, 0.1],
  clear: [660, 0.18],
  start: [520, 0.13],
  over: [130, 0.28],
};
export class AudioSystem {
  constructor(state) {
    this.state = state;
    this.context = null;
    this.offs = [];
    this.button = document.getElementById("sound-button");
    this.lifecycle = new AbortController();
    try {
      state.muted = localStorage.getItem("prism-sound") !== "on";
    } catch {
      state.muted = true;
    }
    this.button.addEventListener(
      "click",
      () => {
        state.muted = !state.muted;
        try {
          localStorage.setItem("prism-sound", state.muted ? "off" : "on");
        } catch {}
        this.label();
        if (!state.muted) this.tone("start");
      },
      { signal: this.lifecycle.signal },
    );
    this.label();
    for (const [event, note] of [
      ["piece:moved", "move"],
      ["piece:rotated", "rotate"],
      ["piece:held", "hold"],
      ["piece:dropped", "drop"],
      ["lines:cleared", "clear"],
      ["game:started", "start"],
      ["game:over", "over"],
    ])
      this.offs.push(bus.on(event, () => this.tone(note)));
  }
  label() {
    this.button.setAttribute("aria-pressed", String(!this.state.muted));
    this.button.setAttribute(
      "aria-label",
      this.state.muted ? "Turn sound on" : "Turn sound off",
    );
    this.button.title = this.state.muted ? "Turn sound on" : "Turn sound off";
    this.button.innerHTML = this.state.muted
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 5 6m0-6-5 6"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5V4Zm5 4a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14"/></svg>';
  }
  tone(name) {
    if (this.state.muted) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      if (!this.context) this.context = new Context();
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
      const [frequency, duration] = notes[name],
        now = this.context.currentTime,
        oscillator = this.context.createOscillator(),
        gain = this.context.createGain();
      oscillator.type = name === "drop" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * (name === "over" ? 0.45 : 1.15),
        now + duration,
      );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {}
  }
  dispose() {
    this.lifecycle.abort();
    this.offs.forEach((off) => off());
    if (this.context) void this.context.close();
  }
}
