export function slerpLatLng(
  start: [number, number],
  end: [number, number],
  t: number
): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const [φ1, λ1] = [toRad(start[0]), toRad(start[1])];
  const [φ2, λ2] = [toRad(end[0]),   toRad(end[1])];

  const v1 = [Math.cos(φ1)*Math.cos(λ1), Math.cos(φ1)*Math.sin(λ1), Math.sin(φ1)];
  const v2 = [Math.cos(φ2)*Math.cos(λ2), Math.cos(φ2)*Math.sin(λ2), Math.sin(φ2)];

  const dot = Math.max(-1, Math.min(1, v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]));
  const d = Math.acos(dot);

  // DEBUG
  console.log('SLERP DEBUG →',
    { start, end, t, dot, dDeg: d * 180 / Math.PI });

  if (d < 1e-12 || Number.isNaN(d)) {
    // If NaN: one of the inputs was NaN. If tiny: points are (almost) identical.
    return start;
  }

  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);

  let x = A * v1[0] + B * v2[0];
  let y = A * v1[1] + B * v2[1];
  let z = A * v1[2] + B * v2[2];

  const len = Math.hypot(x, y, z) || 1;
  x /= len; y /= len; z /= len;

  const φ = Math.atan2(z, Math.hypot(x, y));
  const λ = Math.atan2(y, x);
  return [toDeg(φ), toDeg(λ)];
}