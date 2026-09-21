type Pose = Readonly<{ x: number; y: number }>;
// At either half-turn choose negative yaw. Multiples of 2π are front-facing.
export function captureBootReturn(start: Pose) {
  const turn = 2 * Math.PI;
  const wrapped = ((start.y % turn) + turn) % turn;
  const delta = wrapped <= Math.PI ? -wrapped : turn - wrapped;
  return { ...start, targetYaw: start.y + delta };
}
export function bootReturnPose(start: ReturnType<typeof captureBootReturn>, progress: number): Pose {
  const t = Math.max(0, Math.min(1, progress));
  return { x: start.x * (1 - t), y: start.y + (start.targetYaw - start.y) * t };
}
