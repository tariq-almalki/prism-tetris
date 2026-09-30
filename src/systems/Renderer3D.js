import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BOARD, COLORS, VISUAL, SHAPES } from "../core/Constants.js";
import { bus } from "../core/EventBus.js";
import { buildBoard } from "../level/LevelBuilder.js";
export class Renderer3D {
  constructor(host) {
    this.host = host;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, VISUAL.PIXEL_RATIO));
    this.renderer.setClearColor(0x131b2c, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.camera = new THREE.OrthographicCamera(-5, 5, 10, -10, 0.1, 100);
    this.camera.position.set(0.7, 1.7, 26);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.AmbientLight(0xd7e2ff, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(-5, 12, 18);
    this.scene.add(light);
    const fill = new THREE.DirectionalLight(0x799eff, 1);
    fill.position.set(6, -5, 10);
    this.scene.add(fill);
    buildBoard(this.scene);
    this.blocks = new THREE.Group();
    this.scene.add(this.blocks);
    this.geometry = new RoundedBoxGeometry(
      VISUAL.BLOCK_SIZE,
      VISUAL.BLOCK_SIZE,
      VISUAL.BLOCK_DEPTH,
      2,
      VISUAL.BEVEL,
    );
    this.materials = Object.fromEntries(
      Object.entries(COLORS).map(([type, color]) => [
        type,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.37,
          metalness: 0.1,
        }),
      ]),
    );
    this.ghostMaterials = Object.fromEntries(
      Object.entries(COLORS).map(([type, color]) => [
        type,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }),
      ]),
    );
    this.instances = Object.fromEntries(
      Object.keys(COLORS).map((type) => {
        const mesh = new THREE.InstancedMesh(
          this.geometry,
          this.materials[type],
          BOARD.WIDTH * BOARD.HEIGHT + 4,
        );
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.blocks.add(mesh);
        return [type, mesh];
      }),
    );
    this.dummy = new THREE.Object3D();
    this.counts = {};
    this.ghosts = [];
    this.ghostGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(VISUAL.BLOCK_SIZE, VISUAL.BLOCK_SIZE, 0.025),
    );
    for (let i = 0; i < 4; i++) {
      const ghost = new THREE.LineSegments(
        this.ghostGeometry,
        this.ghostMaterials.T,
      );
      ghost.visible = false;
      this.scene.add(ghost);
      this.ghosts.push(ghost);
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.offs = [
      bus.on("state:changed", (state) => this.draw(state)),
      bus.on("lines:clearing", (data) => this.clearEffect(data)),
      bus.on("piece:dropped", (data) => this.dropEffect(data)),
      bus.on("game:started", () => this.resetEffects()),
    ];
    this.motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionQuery.matches;
    this.onMotionChange = (event) => {
      this.reducedMotion = event.matches;
      if (this.reducedMotion) this.resetEffects();
    };
    this.motionQuery.addEventListener("change", this.onMotionChange);
    this.initEffects();
    this.lastTime = null;
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      bus.emit("game:render-error");
    });
  }
  resize() {
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    const aspect = width / height,
      halfW = Math.max(
        BOARD.WIDTH / 2 + 0.15,
        (VISUAL.WORLD_HEIGHT / 2) * aspect,
      ),
      halfH = halfW / aspect;
    Object.assign(this.camera, {
      left: -halfW,
      right: halfW,
      top: halfH,
      bottom: -halfH,
    });
    this.camera.updateProjectionMatrix();
  }
  add(x, y, type) {
    if (y < 0) return;
    this.dummy.position.set(
      x - BOARD.WIDTH / 2 + 0.5,
      BOARD.HEIGHT / 2 - y - 0.5,
      0.06,
    );
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    this.instances[type].setMatrixAt(this.counts[type]++, this.dummy.matrix);
  }
  draw(state) {
    for (const type of Object.keys(COLORS)) this.counts[type] = 0;
    for (const ghost of this.ghosts) ghost.visible = false;
    state.board.forEach((row, y) =>
      row.forEach((type, x) => {
        if (type) this.add(x, y, type);
      }),
    );
    if (state.active) {
      const p = state.active;
      let ghostIndex = 0;
      p.matrix.forEach((row, y) =>
        row.forEach((v, x) => {
          if (!v) return;
          this.add(p.x + x, p.y + y, p.type);
          if (
            state.ghostY !== undefined &&
            state.status === "playing" &&
            state.ghostY > p.y
          ) {
            const ghost = this.ghosts[ghostIndex++];
            ghost.visible = true;
            ghost.material = this.ghostMaterials[p.type];
            ghost.position.set(
              p.x + x - BOARD.WIDTH / 2 + 0.5,
              BOARD.HEIGHT / 2 - state.ghostY - y - 0.5,
              0.07,
            );
          }
        }),
      );
    }
    for (const type of Object.keys(COLORS)) {
      this.instances[type].count = this.counts[type];
      this.instances[type].instanceMatrix.needsUpdate = true;
    }
    this.playing = state.status === "playing";
  }
  initEffects() {
    this.flashGeometry = new THREE.PlaneGeometry(BOARD.WIDTH, 0.94);
    this.flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xd9e8ff,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.flashes = [];
    for (let i = 0; i < 4; i++) {
      const flash = new THREE.Mesh(this.flashGeometry, this.flashMaterial);
      flash.visible = false;
      this.scene.add(flash);
      this.flashes.push(flash);
    }
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    this.particleMesh = new THREE.InstancedMesh(
      this.geometry,
      this.particleMaterial,
      BOARD.WIDTH * 4 * VISUAL.PARTICLE_COUNT,
    );
    this.particleMesh.count = 0;
    this.particleMesh.frustumCulled = false;
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.particleMesh);
    this.particles = [];
    this.trailGeometry = new THREE.PlaneGeometry(0.3, 1);
    this.trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xadc4ff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.trails = [];
    for (let i = 0; i < 4; i++) {
      const trail = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
      trail.visible = false;
      this.scene.add(trail);
      this.trails.push(trail);
    }
    this.flashAge = VISUAL.FLASH_DURATION;
    this.dropAge = VISUAL.DROP_DURATION;
  }
  clearEffect({ rows, board }) {
    this.flashAge = 0;
    this.particles = [];
    this.flashes.forEach((flash, i) => {
      flash.visible = i < rows.length;
      if (flash.visible)
        flash.position.set(0, BOARD.HEIGHT / 2 - rows[i] - 0.5, 0.32);
    });
    if (this.reducedMotion) return;
    for (const y of rows)
      for (let x = 0; x < BOARD.WIDTH; x++)
        for (let i = 0; i < VISUAL.PARTICLE_COUNT; i++) {
          this.particles.push({
            x: x - BOARD.WIDTH / 2 + 0.5,
            y: BOARD.HEIGHT / 2 - y - 0.5,
            vx: (Math.random() - 0.5) * 5,
            vy: Math.random() * 4 + 1,
            age: 0,
          });
          this.particleMesh.setColorAt(
            this.particles.length - 1,
            new THREE.Color(COLORS[board[y][x]]),
          );
        }
    if (this.particleMesh.instanceColor)
      this.particleMesh.instanceColor.needsUpdate = true;
  }
  dropEffect({ piece, from, to }) {
    if (this.reducedMotion || from === to) return;
    this.dropAge = 0;
    this.trailMaterial.color.set(COLORS[piece.type]);
    let index = 0;
    piece.matrix.forEach((row, y) =>
      row.forEach((v, x) => {
        if (!v) return;
        const trail = this.trails[index++];
        trail.visible = true;
        trail.scale.y = to - from;
        trail.position.set(
          piece.x + x - BOARD.WIDTH / 2 + 0.5,
          BOARD.HEIGHT / 2 - (from + to) / 2 - y - 0.5,
          -0.03,
        );
      }),
    );
  }
  resetEffects() {
    this.particles = [];
    this.particleMesh.count = 0;
    this.flashes.forEach((f) => (f.visible = false));
    this.trails.forEach((t) => (t.visible = false));
    this.flashAge = VISUAL.FLASH_DURATION;
    this.dropAge = VISUAL.DROP_DURATION;
  }
  render(time = 0) {
    const delta =
      this.lastTime === null ? 0 : Math.min(time - this.lastTime, 100);
    this.lastTime = time;
    if (this.playing) {
      this.flashAge += delta;
      this.dropAge += delta;
    }
    this.flashMaterial.opacity =
      Math.max(0, 1 - this.flashAge / VISUAL.FLASH_DURATION) * 0.6;
    this.trailMaterial.opacity =
      Math.max(0, 1 - this.dropAge / VISUAL.DROP_DURATION) * 0.2;
    if (this.flashAge >= VISUAL.FLASH_DURATION)
      this.flashes.forEach((f) => (f.visible = false));
    if (this.dropAge >= VISUAL.DROP_DURATION)
      this.trails.forEach((t) => (t.visible = false));
    let active = 0;
    for (let index = 0; index < this.particles.length; index++) {
      const particle = this.particles[index];
      if (this.playing) particle.age += delta;
      const progress = particle.age / VISUAL.PARTICLE_LIFE;
      if (progress >= 1) {
        this.dummy.scale.setScalar(0);
      } else {
        const t = particle.age / 1000;
        this.dummy.position.set(
          particle.x + particle.vx * t,
          particle.y + particle.vy * t - 7 * t * t,
          0.6,
        );
        this.dummy.rotation.set(progress * 3, progress * 4, progress * 5);
        this.dummy.scale.setScalar(0.12 * (1 - progress));
        active++;
      }
      this.dummy.updateMatrix();
      this.particleMesh.setMatrixAt(index, this.dummy.matrix);
    }
    this.particleMesh.count = this.particles.length;
    if (this.particles.length)
      this.particleMesh.instanceMatrix.needsUpdate = true;
    if (!active && this.particles.length) {
      this.particles = [];
      this.particleMesh.count = 0;
    }
    this.renderer.render(this.scene, this.camera);
  }
  demo() {
    const board = Array.from({ length: BOARD.HEIGHT }, () =>
      Array(BOARD.WIDTH).fill(null),
    );
    const rows = [
      ["J", "J", "L", "L", null, "O", "O", "S", "S", "S"],
      ["J", "T", "T", null, null, "O", "O", "S", "I", "I"],
      ["T", "T", null, null, null, "Z", "Z", "L", "L", "L"],
    ];
    rows.forEach((row, i) => (board[BOARD.HEIGHT - 1 - i] = row));
    this.draw({
      board,
      active: { type: "T", matrix: SHAPES.T, x: 3, y: 3 },
      status: "ready",
    });
  }
  dispose() {
    this.offs.forEach((off) => off());
    this.resizeObserver.disconnect();
    this.motionQuery.removeEventListener("change", this.onMotionChange);
    this.renderer.setAnimationLoop(null);
    const geometries = new Set(),
      materials = new Set();
    this.scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
      if (object.isInstancedMesh) object.dispose();
    });
    geometries.forEach((g) => g.dispose());
    Object.values(this.materials).forEach((m) => materials.add(m));
    Object.values(this.ghostMaterials).forEach((m) => materials.add(m));
    materials.forEach((m) => m.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
