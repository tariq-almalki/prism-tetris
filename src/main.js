import "./style.css";
import { Game } from "./core/Game.js";
let game;
try {
  game = new Game();
  if (import.meta.env.DEV) window.prism = game;
} catch (error) {
  console.error(error);
  document.getElementById("overlay-title").textContent = "Graphics unavailable";
  document.getElementById("overlay-copy").textContent =
    "Enable hardware acceleration in your browser, then reload to play.";
  document.getElementById("play-button").hidden = true;
  document.getElementById("overlay-hint").hidden = true;
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    game?.dispose();
    delete window.prism;
  });
