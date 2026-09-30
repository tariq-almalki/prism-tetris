import { BOARD } from "./Constants.js";
export class GameState {
  constructor(best = 0) {
    this.best = best;
    this.muted = true;
    this.reset();
  }
  reset() {
    this.board = Array.from({ length: BOARD.HEIGHT }, () =>
      Array(BOARD.WIDTH).fill(null),
    );
    this.status = "ready";
    this.active = null;
    this.queue = [];
    this.bag = [];
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = -1;
    this.elapsed = 0;
    this.gravityTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.clearing = [];
    this.clearTimer = 0;
    this.ghostY = 0;
    this.backToBack = false;
  }
}
