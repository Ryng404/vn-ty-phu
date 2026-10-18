// Hiệu ứng đồ họa bằng Canvas (không phải CSS) — pháo giấy khi thắng, đồng xu bay khi nhận tiền.
// Canvas vẽ nhanh hơn và mượt hơn CSS cho nhiều hạt chuyển động cùng lúc.

let canvas, ctx;
let particles = [];
let rafId = null;

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999;';
  document.body.appendChild(canvas);
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function step() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.vr;
    p.life -= 1;
    const alpha = Math.max(0, Math.min(1, p.life / 25));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    if (p.type === 'coin') {
      ctx.font = `${p.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🪙', 0, 0);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    ctx.restore();
  }
  if (particles.length > 0) {
    rafId = requestAnimationFrame(step);
  } else {
    rafId = null;
  }
}

function ensureLoop() {
  ensureCanvas();
  if (!rafId) rafId = requestAnimationFrame(step);
}

const CONFETTI_COLORS = ['#e0462f', '#f0b429', '#2a6f97', '#2e7d4f', '#e05a92', '#7b4fa0'];

export function burstConfetti() {
  ensureCanvas();
  const w = window.innerWidth;
  for (let i = 0; i < 140; i++) {
    particles.push({
      type: 'confetti',
      x: Math.random() * w,
      y: -20 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 3.2,
      vy: Math.random() * 2 + 2,
      gravity: 0.07,
      rotation: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: 6 + Math.random() * 7,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      life: 220 + Math.random() * 70,
    });
  }
  ensureLoop();
}

export function burstCoins(x, y, count = 10) {
  ensureCanvas();
  for (let i = 0; i < count; i++) {
    particles.push({
      type: 'coin',
      x, y,
      vx: (Math.random() - 0.5) * 4.5,
      vy: -(Math.random() * 4 + 3),
      gravity: 0.2,
      rotation: 0,
      vr: (Math.random() - 0.5) * 0.25,
      size: 16 + Math.random() * 8,
      life: 55 + Math.random() * 20,
    });
  }
  ensureLoop();
}