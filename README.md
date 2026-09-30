# Prism — Three.js Tetris

A playable Tetris frontend built with Three.js and Vite. Gameplay runs entirely in the browser, with keyboard and touch controls, responsive layouts, and optional audio.

Source: [tariq-almalki/prism-tetris](https://github.com/tariq-almalki/prism-tetris).

Play online: [prism-tetris.vercel.app](https://prism-tetris.vercel.app/).

## Run locally

From this directory:

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173/. The development server binds to this computer only.

## Play

| Action                  | Keyboard                     |
| ----------------------- | ---------------------------- |
| Start / play again      | Enter                        |
| Move                    | Left / right arrows or A / D |
| Rotate clockwise        | Up arrow, W, or X            |
| Rotate counterclockwise | Z                            |
| Soft drop               | Down arrow or S              |
| Hard drop               | Space                        |
| Hold                    | Shift or C                   |
| Pause / resume          | P or Escape                  |

Touch controls appear on small screens. Opening instructions pauses the game; closing them resumes it. Moving away from the window also pauses the game.

Features include a seven-piece bag randomizer, five-piece preview queue, standard rotation kicks, landing outline, lock delay, one hold per piece, line clearing, increasing speed, combo and consecutive four-line-clear bonuses, restart confirmation, optional synthesized audio, and reduced-motion support. Best score and sound preference stay saved on this device. Unfinished rounds are not saved across reloads.

## Build and test

```powershell
npm test
npm run build
```

Production output is `dist/`. Twenty automated gameplay tests cover collision, rotation, clearing, scoring, pause, hold, piece distribution, lock delay, top-out, and resets. Twenty browser checks exercised keyboard and touch controls, game states, persistence, responsive layouts, audio controls, and stable resources across repeated restarts. No browser console errors were observed.

## Vercel deployment

The production game is deployed at https://prism-tetris.vercel.app/. This GitHub repository is connected to Vercel, so pushes to `main` deploy automatically. `vercel.json` specifies the Vite framework, `npm run build`, and the `dist` output directory. No environment variables or backend are needed. Google Fonts supplies the typefaces, with local system fonts as a fallback.

## Source layout

- `src/core/`: configuration, shared state, event bus, and orchestrator.
- `src/gameplay/`: Tetris rules and scoring.
- `src/systems/`: input, collision, Three.js rendering, and audio.
- `src/level/`: the 10 × 20 board and grid.
- `src/ui/`: statistics, previews, dialogs, and overlays.
- `tests/`: gameplay tests using Node's built-in runner.

The renderer uses a fixed orthographic camera, beveled geometry, lighting, instanced blocks, landing outlines, drop trails, and short line-clear effects. The camera keeps the whole board visible on narrow screens. Graphics resources, audio, observers, and listeners are cleaned up during hot reload.

## Skills reviewed

Guidance was read and applied without installing global skills:

- [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design): hierarchy, typography, distinctive design, and restrained motion.
- [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines): native controls, keyboard access, focus, touch, and reduced motion.
- [Three.js game skill](https://www.skills.sh/playableintelligence/game-creator/threejs-game): game loop, modular state, input, resource cleanup, and performance.
- [Three.js documentation](https://threejs.org/docs/pages/WebGLRenderer.html): renderer and animation-loop APIs.

An optional browser tool adapter shares the visible game actions in browsers supporting `document.modelContext`. Normal play requires no such support.
