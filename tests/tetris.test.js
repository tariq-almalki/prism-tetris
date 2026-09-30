import test from "node:test";
import assert from "node:assert/strict";
import { GameState } from "../src/core/GameState.js";
import { EventBus } from "../src/core/EventBus.js";
import { Tetris } from "../src/gameplay/Tetris.js";
import { BOARD, SHAPES, TIMING, TYPES } from "../src/core/Constants.js";
import {
  cells,
  collides,
  landingY,
  rotateMatrix,
} from "../src/systems/PhysicsSystem.js";
function fixture() {
  const state = new GameState(1000),
    bus = new EventBus(),
    game = new Tetris(state, bus, () => 0.42);
  game.start();
  return { state, bus, game };
}
function advance(game, ms) {
  while (ms > 0) {
    const step = Math.min(ms, 100);
    game.update(step);
    ms -= step;
  }
}
test("seven-bag randomizer produces each piece once per bag and five previews", () => {
  const { game, state } = fixture(),
    sequence = [state.active.type];
  for (let i = 1; i < 14; i++) {
    game.spawn();
    sequence.push(state.active.type);
  }
  assert.deepEqual([...sequence.slice(0, 7)].sort(), [...TYPES].sort());
  assert.deepEqual([...sequence.slice(7)].sort(), [...TYPES].sort());
  assert.equal(state.queue.length, 5);
});
test("movement stops at walls and occupied cells", () => {
  const { game, state } = fixture();
  state.active = game.createPiece("O");
  for (let i = 0; i < 20; i++) game.move(-1, 0);
  assert.equal(state.active.x, 0);
  assert.equal(game.move(-1, 0), false);
  state.board[0][2] = "J";
  assert.equal(game.move(1, 0), false);
  assert.equal(state.active.x, 0);
});
test("landing preview accounts for obstacles and occupied shape cells", () => {
  const { game, state } = fixture();
  const p = game.createPiece("T");
  assert.equal(landingY(state.board, p), 18);
  state.board[15][4] = "O";
  assert.equal(landingY(state.board, p), 13);
  assert.equal(collides(state.board, { ...p, y: 14 }), true);
});
test("four clockwise rotations restore every shape", () => {
  for (const shape of Object.values(SHAPES)) {
    let matrix = shape;
    for (let i = 0; i < 4; i++) matrix = rotateMatrix(matrix);
    assert.deepEqual(matrix, shape);
    assert.deepEqual(rotateMatrix(rotateMatrix(shape, 1), -1), shape);
  }
});
test("I piece wall kick succeeds at the left boundary", () => {
  const { state, game } = fixture();
  state.active = {
    ...game.createPiece("I"),
    rotation: 1,
    matrix: rotateMatrix(SHAPES.I),
    x: -2,
    y: 3,
  };
  assert.equal(collides(state.board, state.active), false);
  assert.equal(game.rotate(1), true);
  assert.equal(state.active.rotation, 2);
  assert.equal(collides(state.board, state.active), false);
  assert.ok(cells(state.active).every((p) => p.x >= 0));
});
test("T piece rotates off the floor using a kick", () => {
  const { state, game } = fixture();
  state.active = { ...game.createPiece("T"), y: 18 };
  assert.equal(game.rotate(1), true);
  assert.equal(collides(state.board, state.active), false);
  assert.equal(state.active.rotation, 1);
});
test("a completely blocked rotation preserves the active piece", () => {
  const { state, game } = fixture();
  state.board = state.board.map((row) => row.map(() => "J"));
  state.active = { ...game.createPiece("T"), y: 8 };
  for (const { x, y } of cells(state.active)) state.board[y][x] = null;
  const before = structuredClone(state.active);
  assert.equal(game.rotate(1), false);
  assert.deepEqual(state.active, before);
});
test("hard drop locks exactly four cells, awards distance, and spawns the next piece", () => {
  const { state, game } = fixture();
  state.active = game.createPiece("O");
  const next = state.queue[0];
  game.hardDrop();
  assert.equal(state.score, 36);
  assert.equal(state.board.flat().filter(Boolean).length, 4);
  assert.equal(state.active.type, next);
  assert.equal(state.board[19][4], "O");
});
test("holding is limited to once per piece, then swaps an unrotated piece", () => {
  const { state, game } = fixture(),
    first = state.active.type,
    next = state.queue[0];
  game.hold();
  assert.equal(state.hold, first);
  assert.equal(state.active.type, next);
  game.hold();
  assert.equal(state.active.type, next);
  game.hardDrop();
  assert.equal(state.canHold, true);
  const before = state.active.type;
  game.rotate(1);
  game.hold();
  assert.equal(state.active.type, first);
  assert.equal(state.active.rotation, 0);
  assert.equal(state.hold, before);
  assert.equal(state.canHold, false);
});
for (const count of [1, 2, 3, 4])
  test(`${count}-line clear removes rows and awards the expected points`, () => {
    const { state, game } = fixture();
    for (let y = BOARD.HEIGHT - count; y < BOARD.HEIGHT; y++) {
      state.board[y] = Array(BOARD.WIDTH).fill("J");
      state.board[y][4] = null;
    }
    state.active = {
      type: "I",
      rotation: 1,
      matrix: rotateMatrix(SHAPES.I),
      x: 2,
      y: BOARD.HEIGHT - 4,
    };
    game.lock();
    assert.equal(state.clearing.length, count);
    advance(game, TIMING.CLEAR_ANIMATION);
    assert.equal(state.lines, count);
    assert.equal(state.score, [0, 100, 300, 500, 800][count]);
    assert.equal(state.board.filter((row) => row.every(Boolean)).length, 0);
    assert.equal(state.status, "playing");
  });
test("level advances after ten lines and scores at the level when the clear occurred", () => {
  const { state, game } = fixture();
  state.lines = 9;
  state.board[19] = Array(10).fill("O");
  state.clearing = [19];
  game.finishClear();
  assert.equal(state.level, 2);
  assert.equal(state.lines, 10);
  assert.equal(state.score, 100);
});
test("consecutive Tetrises receive back-to-back and combo bonuses", () => {
  const { state, game } = fixture();
  for (let cycle = 0; cycle < 2; cycle++) {
    state.clearing = [16, 17, 18, 19];
    for (const y of state.clearing) state.board[y] = Array(10).fill("I");
    game.finishClear();
  }
  assert.equal(state.score, 2050);
  assert.equal(state.combo, 1);
  assert.equal(state.lines, 8);
});
test("pause freezes gravity, score, and elapsed time and resume restores play", () => {
  const { state, game } = fixture();
  game.action("pause");
  const before = structuredClone(state);
  advance(game, 3000);
  game.action("drop");
  assert.deepEqual(structuredClone(state), before);
  game.action("resume");
  advance(game, 1000);
  assert.equal(state.status, "playing");
  assert.ok(state.elapsed >= 1000);
});
test("lock delay allows adjustment and locks after the delay", () => {
  const { state, game } = fixture();
  state.active = { ...game.createPiece("O"), y: 18 };
  advance(game, 300);
  assert.equal(state.board.flat().filter(Boolean).length, 0);
  game.move(-1, 0);
  advance(game, 400);
  assert.equal(state.board.flat().filter(Boolean).length, 0);
  advance(game, 100);
  assert.equal(state.board.flat().filter(Boolean).length, 4);
});
test("grounded adjustments cannot reset the lock indefinitely", () => {
  const { state, game } = fixture();
  state.active = { ...game.createPiece("O"), y: 18 };
  for (let i = 0; i < TIMING.MAX_RESETS; i++) {
    game.update(100);
    game.move(i % 2 ? 1 : -1, 0);
  }
  assert.equal(state.lockResets, TIMING.MAX_RESETS);
  advance(game, 400);
  game.move(1, 0);
  assert.equal(state.lockTimer, 400);
  advance(game, 100);
  assert.equal(state.board.flat().filter(Boolean).length, 4);
});
test("blocked spawn ends the game; restart clears all gameplay while preserving best and sound", () => {
  const { state, game } = fixture();
  state.score = 1200;
  state.muted = false;
  state.board[0] = Array(10).fill("O");
  state.board[1] = Array(10).fill("O");
  game.spawn("T");
  assert.equal(state.status, "over");
  assert.equal(state.best, 1200);
  game.start();
  assert.equal(state.status, "playing");
  assert.equal(state.board.flat().filter(Boolean).length, 0);
  assert.equal(state.score, 0);
  assert.equal(state.elapsed, 0);
  assert.equal(state.hold, null);
  assert.equal(state.best, 1200);
  assert.equal(state.muted, false);
});
test("locking partly above the board ends the game without indexing negative rows", () => {
  const { state, game } = fixture();
  state.active = { ...game.createPiece("O"), y: -1 };
  game.lock();
  assert.equal(state.status, "over");
  assert.equal(state.active, null);
});
