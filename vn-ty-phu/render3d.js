// Dựng xúc xắc 3D và nhân vật 3D low-poly bằng Three.js (WebGL thật, không phải CSS).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ============== XÚC XẮC 3D ==============
function makeDieFaceTexture(pips) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fbf3dd';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, size - 6, size - 6);
  ctx.fillStyle = '#26201a';
  const layouts = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
    6: [[0.27, 0.24], [0.73, 0.24], [0.27, 0.5], [0.73, 0.5], [0.27, 0.76], [0.73, 0.76]],
  };
  const r = size * 0.09;
  for (const [px, py] of layouts[pips]) {
    ctx.beginPath();
    ctx.arc(px * size, py * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Thứ tự material theo BoxGeometry: [+X, -X, +Y, -Y, +Z, -Z]
const FACE_VALUES = [1, 6, 2, 5, 3, 4];
// Góc xoay (radian) để đưa đúng mặt có số "value" hướng ra phía camera (+Z)
const SETTLE_EULER = {
  3: [0, 0, 0],
  4: [0, Math.PI, 0],
  1: [0, Math.PI / 2, 0],
  6: [0, -Math.PI / 2, 0],
  2: [-Math.PI / 2, 0, 0],
  5: [Math.PI / 2, 0, 0],
};

export function createDiceScene(container, count = 2) {
  const width = container.clientWidth || 160;
  const height = container.clientHeight || 90;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 50);
  camera.position.set(0, 2.2, 4.4);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(2, 4, 3);
  scene.add(dir);

  function makeDie() {
    const materials = FACE_VALUES.map(v => new THREE.MeshStandardMaterial({ map: makeDieFaceTexture(v) }));
    return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
  }

  const dice = [];
  for (let i = 0; i < count; i++) {
    const d = makeDie();
    d.position.x = (i - (count - 1) / 2) * 1.5;
    scene.add(d);
    dice.push(d);
  }

  let tumbling = false;
  const vel = dice.map(() => ({
    x: 0.18 + Math.random() * 0.12,
    y: 0.22 + Math.random() * 0.12,
    z: 0.12 + Math.random() * 0.1,
  }));

  (function animate() {
    if (tumbling) {
      dice.forEach((d, i) => {
        d.rotation.x += vel[i].x;
        d.rotation.y += vel[i].y;
        d.rotation.z += vel[i].z;
      });
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  })();

  return {
    shake() { tumbling = true; },
    settle(values) {
      tumbling = false;
      values.forEach((v, i) => {
        const e = SETTLE_EULER[v] || [0, 0, 0];
        if (dice[i]) dice[i].rotation.set(e[0], e[1], e[2]);
      });
    },
  };
}

// ============== NHÂN VẬT 3D LOW-POLY ==============
export function createCharacterCanvas(character, pxSize = 64) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const h = Math.round(pxSize * 1.35);
  renderer.setSize(pxSize, h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, pxSize / h, 0.1, 20);
  camera.position.set(0, 1.05, 3.4);
  camera.lookAt(0, 0.35, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(2, 3, 2);
  scene.add(dir);

  const group = new THREE.Group();
  const color = new THREE.Color(character.color);
  const bodyMat = new THREE.MeshStandardMaterial({ color });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd9b0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.14, 20), bodyMat);
  base.position.y = -0.55;
  group.add(base);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.68, 16), bodyMat);
  body.position.y = -0.12;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), skinMat);
  head.position.y = 0.48;
  group.add(head);

  // Phụ kiện riêng cho từng nhân vật — gợi lại đúng đặc điểm trong tranh gốc
  if (character.id === 'nam') { // mũ lưỡi trai
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
    cap.position.y = 0.6;
    group.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), bodyMat);
    brim.position.set(0, 0.52, 0.32);
    brim.rotation.x = Math.PI / 2.4;
    group.add(brim);
  } else if (character.id === 'lan') { // mũ bucket
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.22, 20), bodyMat);
    hat.position.y = 0.76;
    group.add(hat);
  } else if (character.id === 'minh') { // tai nghe
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), bodyMat);
      ear.position.set(0.36 * s, 0.5, 0);
      group.add(ear);
    });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 20, Math.PI), bodyMat);
    band.rotation.z = Math.PI;
    band.position.y = 0.74;
    group.add(band);
  } else if (character.id === 'ha') { // nón lá
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.26, 24), bodyMat);
    hat.position.y = 0.72;
    group.add(hat);
  }

  scene.add(group);

  (function animate() {
    group.rotation.y += 0.016;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  })();

  return canvas;
}