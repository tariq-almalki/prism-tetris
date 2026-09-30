import * as THREE from "three";
import { BOARD } from "../core/Constants.js";
export function buildBoard(scene) {
  const points = [];
  for (let x = 0; x <= BOARD.WIDTH; x++)
    points.push(
      x - BOARD.WIDTH / 2,
      -BOARD.HEIGHT / 2,
      -0.29,
      x - BOARD.WIDTH / 2,
      BOARD.HEIGHT / 2,
      -0.29,
    );
  for (let y = 0; y <= BOARD.HEIGHT; y++)
    points.push(
      -BOARD.WIDTH / 2,
      y - BOARD.HEIGHT / 2,
      -0.29,
      BOARD.WIDTH / 2,
      y - BOARD.HEIGHT / 2,
      -0.29,
    );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3),
  );
  scene.add(
    new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0x293652,
        transparent: true,
        opacity: 0.65,
      }),
    ),
  );
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD.WIDTH, BOARD.HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x131c2e }),
  );
  surface.position.z = -0.35;
  scene.add(surface);
}
