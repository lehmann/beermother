const ANIM_DURATION = 2e3;
const positions = new Map();
const rafs = new Map();

export function cancelAnimations() {
  rafs.forEach((id) => {
    try { cancelAnimationFrame(id); } catch {}
  });
  rafs.clear();
  positions.clear();
}

function easing(e) {
  if (e <= 0.15) return (e * e) / 0.15;
  const n = e - 0.15;
  return 0.15 + 2 * n - (n * n) / (1 - 0.15);
}

export function animateMarker(el, key, target) {
  const hasRaf =
    typeof requestAnimationFrame == "function" && typeof performance < "u";
  const current = positions.has(key) ? positions.get(key) : target;
  if (!hasRaf || Math.abs(current - target) < 5e-4) {
    positions.set(key, target);
    el.style.left = `${target * 100}%`;
    return;
  }
  rafs.has(key) && cancelAnimationFrame(rafs.get(key));
  el.style.left = `${current * 100}%`;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / ANIM_DURATION);
    const val = current + (target - current) * easing(p);
    positions.set(key, val);
    el.style.left = `${val * 100}%`;
    if (p < 1) rafs.set(key, requestAnimationFrame(step));
    else { rafs.delete(key); positions.set(key, target); }
  };
  rafs.set(key, requestAnimationFrame(step));
}
