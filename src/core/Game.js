import { GameState } from "./GameState.js";
import { bus } from "./EventBus.js";
import { TIMING } from "./Constants.js";
import { Tetris } from "../gameplay/Tetris.js";
import { InputSystem } from "../systems/InputSystem.js";
import { Renderer3D } from "../systems/Renderer3D.js";
import { AudioSystem } from "../systems/AudioSystem.js";
import { HUD } from "../ui/HUD.js";
export class Game {
  constructor() {
    let best = 0;
    try {
      best = Math.max(0, Number(localStorage.getItem("prism-best")) || 0);
    } catch {}
    this.state = new GameState(best);
    this.gameplay = new Tetris(this.state);
    this.renderer = new Renderer3D(document.getElementById("canvas-host"));
    this.input = new InputSystem(this.state);
    this.audio = new AudioSystem(this.state);
    this.ui = new HUD(this.state);
    this.renderer.demo();
    this.previousTime = null;
    this.offs = [
      bus.on("input:clear", () => this.input.clear()),
      bus.on("game:render-error", () => this.renderError()),
    ];
    this.onBlur = () => {
      this.input.clear();
      if (this.state.status === "playing") bus.emit("input:action", "pause");
    };
    this.onVisibility = () => {
      if (document.hidden) this.onBlur();
      this.previousTime = null;
    };
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.renderer.renderer.setAnimationLoop((time) => this.frame(time));
    this.registerTools();
  }
  frame(time) {
    const delta =
      this.previousTime === null
        ? 0
        : Math.min(time - this.previousTime, TIMING.MAX_DELTA);
    this.previousTime = time;
    this.input.update(delta);
    this.gameplay.update(delta);
    this.ui.updateTime(this.state);
    this.renderer.render(time);
  }
  renderError() {
    this.onBlur();
    document.getElementById("overlay").hidden = false;
    document.getElementById("overlay-title").textContent =
      "Graphics interrupted";
    document.getElementById("overlay-copy").textContent =
      "Reload the page to restore the game.";
    document.getElementById("play-button").hidden = true;
    document.getElementById("overlay-hint").hidden = true;
  }
  registerTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    this.toolsLifecycle = new AbortController();
    const read = () => ({
      status: this.state.status,
      score: this.state.score,
      lines: this.state.lines,
      level: this.state.level,
      hold: this.state.hold,
      next: [...this.state.queue],
    });
    const actions = [
      "start",
      "pause",
      "resume",
      "left",
      "right",
      "rotate",
      "rotateBack",
      "down",
      "drop",
      "hold",
    ];
    const tools = [
      {
        name: "read_tetris_game",
        description:
          "Read the Tetris score, level, status, held piece, and next pieces.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => read(),
      },
      {
        name: "control_tetris_game",
        description:
          "Start, pause, resume, or play Tetris using the same actions as the visible controls. Starting resets the current game.",
        inputSchema: {
          type: "object",
          properties: { action: { type: "string", enum: actions } },
          required: ["action"],
          additionalProperties: false,
        },
        execute: (input) => {
          if (
            !input ||
            typeof input !== "object" ||
            Object.keys(input).length !== 1 ||
            !actions.includes(input.action)
          )
            throw new Error("Provide one valid game action.");
          bus.emit("input:action", input.action);
          return read();
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: this.toolsLifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
  }
  dispose() {
    this.renderer.dispose();
    this.gameplay.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.ui.dispose();
    this.offs.forEach((off) => off());
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.toolsLifecycle?.abort();
  }
}
