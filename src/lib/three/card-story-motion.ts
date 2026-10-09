/** Deterministic choreography: scroll is the clock, including when travelling backwards. */
const clamp = (n: number) =>
  Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const poses = [
  { at: 0, x: 0, y: 0, z: 0, rx: 0.12, ry: -0.48, rz: -0.1, scale: 1, fan: 0 },
  {
    at: 0.28,
    x: 0.1,
    y: -0.15,
    z: 0.7,
    rx: -0.16,
    ry: 0.78,
    rz: 0.16,
    scale: 1.55,
    fan: 0,
  },
  {
    at: 0.53,
    x: 0,
    y: 0,
    z: 0,
    rx: 0.1,
    ry: Math.PI + 0.3,
    rz: 0.1,
    scale: 1.08,
    fan: 0,
  },
  {
    at: 0.76,
    x: 0,
    y: 0,
    z: 0,
    rx: -0.08,
    ry: Math.PI * 2 - 0.25,
    rz: -0.05,
    scale: 0.87,
    fan: 1,
  },
  {
    at: 1,
    x: 0,
    y: 0.08,
    z: 0,
    rx: 0.04,
    ry: Math.PI * 2 + 0.15,
    rz: 0,
    scale: 0.9,
    fan: 1,
  },
] as const;

export function cardStoryPose(progress: number) {
  const p = clamp(progress);
  const end = poses.findIndex((pose, index) => index > 0 && p <= pose.at);
  const b = poses[end === -1 ? poses.length - 1 : end]!;
  const a = poses[Math.max(0, (end === -1 ? poses.length - 1 : end) - 1)]!;
  const t = ease((p - a.at) / (b.at - a.at));
  return {
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    z: mix(a.z, b.z, t),
    rx: mix(a.rx, b.rx, t),
    ry: mix(a.ry, b.ry, t),
    rz: mix(a.rz, b.rz, t),
    scale: mix(a.scale, b.scale, t),
    fan: mix(a.fan, b.fan, t),
    chapter: p < 0.34 ? 0 : p < 0.66 ? 1 : 2,
  };
}
export function cardStoryProgress(
  top: number,
  height: number,
  viewport: number,
) {
  return clamp(-top / Math.max(1, height - viewport));
}

/** Fan offsets are local to the rotating assembly, preserving the gap between surfaces. */
export function cardFanPose(fan: number, direction: -1 | 1) {
  const spread = clamp(fan);
  return {
    x: direction * 0.95 * spread,
    y: -0.12 * spread,
    z: -0.5,
    ry: direction * 0.18 * spread,
    rz: -direction * 0.3 * spread,
  };
}
