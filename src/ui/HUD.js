import { BOARD, COLORS, SHAPES, SCORING } from "../core/Constants.js";
import { bus } from "../core/EventBus.js";
const get = (id) => document.getElementById(id);
export function miniPiece(type) {
  const positions = [];
  SHAPES[type].forEach((row, y) =>
    row.forEach((v, x) => {
      if (v) positions.push([x, y]);
    }),
  );
  const minX = Math.min(...positions.map((p) => p[0])),
    minY = Math.min(...positions.map((p) => p[1]));
  const piece = document.createElement("div");
  piece.className = "mini-piece";
  piece.setAttribute("role", "img");
  piece.setAttribute("aria-label", `${type} piece`);
  piece.style.setProperty(
    "--cols",
    Math.max(...positions.map((p) => p[0])) - minX + 1,
  );
  piece.style.setProperty(
    "--rows",
    Math.max(...positions.map((p) => p[1])) - minY + 1,
  );
  piece.style.setProperty("--piece-color", COLORS[type]);
  for (const [x, y] of positions) {
    const cell = document.createElement("span");
    cell.className = "mini-cell";
    cell.style.gridColumn = x - minX + 1;
    cell.style.gridRow = y - minY + 1;
    piece.append(cell);
  }
  return piece;
}
export class HUD {
  constructor(state) {
    this.state = state;
    this.lastQueue = "";
    this.lastHold = undefined;
    this.savedBest = -1;
    this.previousStatus = "";
    this.elapsedSecond = -1;
    this.offs = [];
    this.lifecycle = new AbortController();
    const { signal } = this.lifecycle;
    get("play-button").addEventListener(
      "click",
      () => {
        bus.emit(
          "input:action",
          state.status === "paused" ? "resume" : "start",
        );
        get("play-button").blur();
      },
      { signal },
    );
    get("pause-button").addEventListener(
      "click",
      () => {
        bus.emit("input:action", "pause");
        get("pause-button").blur();
      },
      { signal },
    );
    get("help-button").addEventListener(
      "click",
      () => this.openDialog("help-dialog"),
      { signal },
    );
    get("restart-button").addEventListener(
      "click",
      () => this.openDialog("restart-dialog"),
      { signal },
    );
    get("confirm-restart").addEventListener(
      "click",
      () => {
        this.dialogResume = false;
        get("restart-dialog").close();
        bus.emit("input:action", "start");
        get("confirm-restart").blur();
      },
      { signal },
    );
    document
      .querySelectorAll("[data-close-dialog]")
      .forEach((button) =>
        button.addEventListener(
          "click",
          () => get(button.dataset.closeDialog).close(),
          { signal },
        ),
      );
    document.querySelectorAll("dialog").forEach((dialog) => {
      dialog.addEventListener(
        "close",
        () => {
          if (this.dialogResume) bus.emit("input:action", "resume");
          this.dialogResume = false;
        },
        { signal },
      );
      dialog.addEventListener(
        "click",
        (event) => {
          if (event.target === dialog) {
            const rect = dialog.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              dialog.close();
          }
        },
        { signal },
      );
    });
    this.offs.push(
      bus.on("state:changed", (s) => this.update(s)),
      bus.on("lines:cleared", (data) => this.announceClear(data)),
    );
    this.update(state);
  }
  openDialog(id) {
    this.dialogResume = this.state.status === "playing";
    if (this.dialogResume) bus.emit("input:action", "pause");
    bus.emit("input:clear");
    get(id).showModal();
  }
  update(s) {
    get("score").textContent = String(s.score).padStart(6, "0");
    get("best-score").textContent = new Intl.NumberFormat().format(s.best);
    get("level").textContent = String(s.level).padStart(2, "0");
    get("lines").textContent = String(s.lines).padStart(2, "0");
    const progress = s.lines % SCORING.LEVEL_LINES;
    get("level-progress").style.width =
      `${(progress / SCORING.LEVEL_LINES) * 100}%`;
    get("level-progress").parentElement.setAttribute("aria-valuenow", progress);
    get("lines-remaining").textContent = SCORING.LEVEL_LINES - progress;
    if (s.best !== this.savedBest) {
      try {
        localStorage.setItem("prism-best", String(s.best));
      } catch {}
      this.savedBest = s.best;
    }
    const queueKey = s.queue.join("");
    if (queueKey !== this.lastQueue) {
      this.lastQueue = queueKey;
      get("next-pieces").replaceChildren(
        ...s.queue.slice(0, BOARD.QUEUE).map((type) => {
          const row = document.createElement("div");
          row.className = "next-piece";
          row.append(miniPiece(type));
          return row;
        }),
      );
    }
    if (s.hold !== this.lastHold) {
      this.lastHold = s.hold;
      const slot = get("hold-piece");
      slot.replaceChildren();
      if (s.hold) slot.append(miniPiece(s.hold));
      else {
        const label = document.createElement("span");
        label.className = "hold-empty";
        label.innerHTML = "Save a piece<br>for later";
        slot.append(label);
      }
    }
    get("hold-piece").classList.toggle("unavailable", !s.canHold);
    get("hold-piece").setAttribute(
      "aria-label",
      s.hold
        ? `Held ${s.hold} piece${s.canHold ? "" : ", unavailable until next piece"}`
        : "No held piece",
    );
    get("pause-button").disabled = !["playing", "paused"].includes(s.status);
    get("restart-button").disabled = s.status === "ready";
    get("pause-button").setAttribute(
      "aria-label",
      s.status === "paused" ? "Resume game" : "Pause game",
    );
    get("pause-button").title =
      s.status === "paused" ? "Resume (P)" : "Pause (P)";
    get("pause-button").innerHTML =
      s.status === "paused"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14m8-14v14"/></svg>';
    get("game-status").textContent = {
      ready: "Ready to play",
      playing: "In the flow",
      paused: "Taking a breather",
      over: "Round complete",
    }[s.status];
    get("overlay").hidden = s.status === "playing";
    if (s.status !== this.previousStatus) {
      const states = {
        ready: [
          "One more round?",
          "Find your flow.",
          "Stack blocks. Clear lines.<br>See how far you can go.",
          "Play Tetris",
          "Enter",
        ],
        paused: [
          "Take your time",
          "A little breather.",
          "Your blocks will be right here<br>when you’re ready.",
          "Resume game",
          "P",
        ],
        over: [
          "Nice run",
          "Another round?",
          "You scored " +
            new Intl.NumberFormat().format(s.score) +
            " points.<br>There’s always a new way to play.",
          "Play again",
          "Enter",
        ],
      };
      if (states[s.status]) {
        const [eyebrow, title, copy, button, key] = states[s.status];
        get("overlay-eyebrow").textContent = eyebrow;
        get("overlay-title").textContent = title;
        get("overlay-copy").innerHTML = copy;
        get("play-button").innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>' +
          button;
        get("overlay-hint").innerHTML = "or press <kbd>" + key + "</kbd>";
      }
      get("live-status").textContent = {
        ready: "Ready. Press Enter or Play Tetris to start.",
        playing:
          "Game started. Use arrow keys to move and rotate. Space drops the piece.",
        paused: "Game paused.",
        over: `Game over. Final score ${s.score}. ${s.lines} lines cleared.`,
      }[s.status];
      this.previousStatus = s.status;
    }
    for (const button of document.querySelectorAll("[data-action]"))
      button.disabled =
        s.status !== "playing" ||
        s.clearing.length > 0 ||
        (button.dataset.action === "hold" && !s.canHold);
    this.updateTime(s);
  }
  updateTime(s) {
    const second = Math.floor(s.elapsed / 1000);
    if (second === this.elapsedSecond) return;
    this.elapsedSecond = second;
    get("elapsed").textContent =
      `${String(Math.floor(second / 60)).padStart(2, "0")}:${String(second % 60).padStart(2, "0")}`;
  }
  announceClear({ count, combo, level, levelUp }) {
    const message = levelUp
        ? `Level ${level}`
        : ["", "Single", "Double", "Triple", "Tetris!"][count],
      el = get("board-announcement");
    el.textContent = message;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    get("live-status").textContent =
      `${count} ${count === 1 ? "line" : "lines"} cleared.${combo > 0 ? ` Combo ${combo + 1}.` : ""}${levelUp ? ` Level ${level}.` : ""}`;
  }
  dispose() {
    this.lifecycle.abort();
    this.offs.forEach((off) => off());
  }
}
