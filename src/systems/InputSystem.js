import { bus } from "../core/EventBus.js";
import { TIMING } from "../core/Constants.js";
const keyActions = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowDown: "down",
  KeyS: "down",
  ArrowUp: "rotate",
  KeyX: "rotate",
  KeyW: "rotate",
  KeyZ: "rotateBack",
  Space: "drop",
  ShiftLeft: "hold",
  ShiftRight: "hold",
  KeyC: "hold",
};
export class InputSystem {
  constructor(state) {
    this.state = state;
    this.pressed = new Map();
    this.sequence = 0;
    this.lifecycle = new AbortController();
    const { signal } = this.lifecycle;
    document.addEventListener("keydown", (e) => this.keyDown(e), { signal });
    document.addEventListener("keyup", (e) => this.keyUp(e), { signal });
    window.addEventListener("blur", () => this.clear(), { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.clear();
      },
      { signal },
    );
    this.off = bus.on("game:pause", () => this.clear());
    document.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.dataset.action;
      button.addEventListener(
        "pointerdown",
        (event) => {
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          this.begin(`touch-${action}`, action);
        },
        { signal },
      );
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(
          name,
          () => this.pressed.delete(`touch-${action}`),
          { signal },
        );
      button.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!e.repeat) bus.emit("input:action", action);
          }
        },
        { signal },
      );
    });
  }
  keyDown(event) {
    if (
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      document.querySelector("dialog[open]")
    )
      return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.matches('input,textarea,select,[contenteditable="true"]')
    )
      return;
    if (
      event.code === "Enter" &&
      (this.state.status === "ready" || this.state.status === "over") &&
      !(target instanceof HTMLElement && target.closest("button,a"))
    ) {
      event.preventDefault();
      if (!event.repeat) bus.emit("input:action", "start");
      return;
    }
    if (event.code === "KeyP" || event.code === "Escape") {
      event.preventDefault();
      if (!event.repeat) bus.emit("input:action", "pause");
      return;
    }
    const action = keyActions[event.code];
    if (!action) return;
    if (
      event.code === "Space" &&
      target instanceof HTMLElement &&
      target.closest("button")
    )
      return;
    event.preventDefault();
    if (!event.repeat && !this.pressed.has(event.code))
      this.begin(event.code, action);
  }
  begin(code, action) {
    this.pressed.set(code, {
      action,
      time: 0,
      next: action === "down" ? TIMING.SOFT_REPEAT : TIMING.DAS,
      order: ++this.sequence,
    });
    bus.emit("input:action", action);
  }
  keyUp(event) {
    this.pressed.delete(event.code);
  }
  update(delta) {
    if (this.state.status !== "playing") {
      this.clear();
      return;
    }
    let lastHorizontal = null;
    for (const key of this.pressed.values())
      if (
        (key.action === "left" || key.action === "right") &&
        (!lastHorizontal || key.order > lastHorizontal.order)
      )
        lastHorizontal = key;
    for (const key of this.pressed.values()) {
      if (!["left", "right", "down"].includes(key.action)) continue;
      if (key.action !== "down" && key !== lastHorizontal) continue;
      key.time += delta;
      while (key.time >= key.next) {
        key.next += key.action === "down" ? TIMING.SOFT_REPEAT : TIMING.ARR;
        bus.emit("input:action", key.action);
      }
    }
  }
  clear() {
    this.pressed.clear();
  }
  dispose() {
    this.lifecycle.abort();
    this.off();
    this.clear();
  }
}
