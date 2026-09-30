import {
  BOARD,
  TYPES,
  SHAPES,
  KICKS,
  TIMING,
  SCORING,
} from "../core/Constants.js";
import { bus as defaultBus } from "../core/EventBus.js";
import {
  cells,
  collides,
  landingY,
  rotateMatrix,
} from "../systems/PhysicsSystem.js";
export class Tetris {
  constructor(state, bus = defaultBus, random = Math.random) {
    this.state = state;
    this.bus = bus;
    this.random = random;
    this.off = bus.on("input:action", (action) => this.action(action));
    this.fillQueue();
  }
  shuffledBag() {
    const bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }
  fillQueue() {
    while (this.state.queue.length < BOARD.QUEUE) {
      if (!this.state.bag.length) this.state.bag = this.shuffledBag();
      this.state.queue.push(this.state.bag.pop());
    }
  }
  createPiece(type) {
    return {
      type,
      matrix: SHAPES[type].map((row) => [...row]),
      x: Math.floor((BOARD.WIDTH - SHAPES[type].length) / 2),
      y: type === "I" ? -1 : 0,
      rotation: 0,
    };
  }
  start() {
    this.state.reset();
    this.state.status = "playing";
    this.fillQueue();
    this.spawn();
    this.bus.emit("game:started");
    this.changed();
  }
  spawn(type = null) {
    const s = this.state;
    s.active = this.createPiece(type ?? s.queue.shift());
    this.fillQueue();
    s.canHold = true;
    s.gravityTimer = 0;
    s.lockTimer = 0;
    s.lockResets = 0;
    if (collides(s.board, s.active)) {
      this.gameOver();
      return false;
    }
    return true;
  }
  changed() {
    const s = this.state;
    s.best = Math.max(s.best, s.score);
    if (s.active) s.ghostY = landingY(s.board, s.active);
    this.bus.emit("state:changed", s);
  }
  action(action) {
    const s = this.state;
    if (action === "start") {
      this.start();
      return;
    }
    if (action === "pause") {
      if (s.status === "playing" || s.status === "paused") {
        s.status = s.status === "playing" ? "paused" : "playing";
        this.bus.emit("game:pause", s.status);
        this.changed();
      }
      return;
    }
    if (action === "resume") {
      if (s.status === "paused") {
        s.status = "playing";
        this.changed();
      }
      return;
    }
    if (s.status !== "playing" || s.clearing.length || !s.active) return;
    switch (action) {
      case "left":
        this.move(-1, 0);
        break;
      case "right":
        this.move(1, 0);
        break;
      case "down":
        this.move(0, 1, true);
        break;
      case "rotate":
        this.rotate(1);
        break;
      case "rotateBack":
        this.rotate(-1);
        break;
      case "drop":
        this.hardDrop();
        break;
      case "hold":
        this.hold();
        break;
    }
  }
  resetLock(wasGrounded) {
    const s = this.state;
    if (wasGrounded && s.lockResets < TIMING.MAX_RESETS) {
      s.lockTimer = 0;
      s.lockResets++;
    } else if (!wasGrounded) s.lockTimer = 0;
  }
  move(dx, dy, soft = false) {
    const s = this.state,
      p = s.active;
    if (!p) return false;
    const grounded = collides(s.board, { ...p, y: p.y + 1 }),
      candidate = { ...p, x: p.x + dx, y: p.y + dy };
    if (collides(s.board, candidate)) return false;
    s.active = candidate;
    if (soft) s.score += SCORING.SOFT;
    this.resetLock(grounded);
    if (dx) this.bus.emit("piece:moved");
    this.changed();
    return true;
  }
  rotate(direction) {
    const s = this.state,
      p = s.active;
    if (!p || p.type === "O") return false;
    const rotation = (p.rotation + direction + 4) % 4,
      matrix = rotateMatrix(p.matrix, direction);
    const offsets =
      KICKS[p.type === "I" ? "I" : "normal"][`${p.rotation}>${rotation}`];
    for (const [dx, dy] of offsets) {
      const candidate = { ...p, matrix, rotation, x: p.x + dx, y: p.y - dy };
      if (!collides(s.board, candidate)) {
        const grounded = collides(s.board, { ...p, y: p.y + 1 });
        s.active = candidate;
        this.resetLock(grounded);
        this.bus.emit("piece:rotated");
        this.changed();
        return true;
      }
    }
    return false;
  }
  hardDrop() {
    const s = this.state,
      p = s.active,
      y = landingY(s.board, p);
    s.score += (y - p.y) * SCORING.HARD;
    this.bus.emit("piece:dropped", { piece: { ...p }, from: p.y, to: y });
    p.y = y;
    this.lock();
  }
  hold() {
    const s = this.state;
    if (!s.canHold) return;
    const current = s.active.type,
      previous = s.hold;
    s.hold = current;
    this.spawn(previous);
    s.canHold = false;
    this.bus.emit("piece:held");
    this.changed();
  }
  lock() {
    const s = this.state,
      p = s.active,
      positions = cells(p);
    if (positions.some(({ y }) => y < 0)) {
      this.gameOver();
      return;
    }
    for (const { x, y } of positions) s.board[y][x] = p.type;
    s.active = null;
    s.clearing = [];
    s.board.forEach((row, y) => {
      if (row.every(Boolean)) s.clearing.push(y);
    });
    this.bus.emit("piece:locked", { positions, type: p.type });
    if (s.clearing.length) {
      s.clearTimer = TIMING.CLEAR_ANIMATION;
      this.bus.emit("lines:clearing", {
        rows: [...s.clearing],
        board: s.board.map((row) => [...row]),
      });
    } else {
      s.combo = -1;
      this.spawn();
    }
    this.changed();
  }
  finishClear() {
    const s = this.state,
      count = s.clearing.length,
      level = s.level;
    s.board = s.board.filter((_, y) => !s.clearing.includes(y));
    while (s.board.length < BOARD.HEIGHT)
      s.board.unshift(Array(BOARD.WIDTH).fill(null));
    s.combo++;
    const base = SCORING.LINES[count] * level,
      bonus = count === 4 && s.backToBack ? base / 2 : 0;
    s.score += base + bonus + Math.max(0, s.combo) * SCORING.COMBO * level;
    s.backToBack = count === 4;
    s.lines += count;
    s.level = 1 + Math.floor(s.lines / SCORING.LEVEL_LINES);
    s.clearing = [];
    s.clearTimer = 0;
    this.spawn();
    this.bus.emit("lines:cleared", {
      count,
      combo: s.combo,
      level: s.level,
      levelUp: s.level > level,
    });
    this.changed();
  }
  update(delta) {
    const s = this.state;
    if (s.status !== "playing") return;
    const dt = Math.min(delta, TIMING.MAX_DELTA);
    s.elapsed += dt;
    if (s.clearing.length) {
      s.clearTimer -= dt;
      if (s.clearTimer <= 0) this.finishClear();
      return;
    }
    if (!s.active) return;
    s.gravityTimer += dt;
    const gravity = Math.max(
      TIMING.MIN_GRAVITY,
      TIMING.GRAVITY * TIMING.SPEED_FACTOR ** (s.level - 1),
    );
    while (s.gravityTimer >= gravity) {
      s.gravityTimer -= gravity;
      if (!this.move(0, 1)) break;
    }
    if (collides(s.board, { ...s.active, y: s.active.y + 1 })) {
      s.lockTimer += dt;
      if (s.lockTimer >= TIMING.LOCK_DELAY) this.lock();
    } else s.lockTimer = 0;
  }
  gameOver() {
    this.state.status = "over";
    this.state.active = null;
    this.bus.emit("game:over", { score: this.state.score });
    this.changed();
  }
  dispose() {
    this.off();
  }
}
