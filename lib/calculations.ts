export const G = 9.81; // m/s²

export function calcFlightTime(takeoffFrame: number, landingFrame: number, fps: number): number {
  return (landingFrame - takeoffFrame) / fps; // seconds
}

export function calcJumpHeight(flightTime_s: number): number {
  return (G * flightTime_s * flightTime_s) / 8; // meters
}

export function calcTimeToTakeoff(movementStartFrame: number, takeoffFrame: number, fps: number): number {
  return (takeoffFrame - movementStartFrame) / fps; // seconds
}

export function calcRSImod(jumpHeight_m: number, timeToTakeoff_s: number): number {
  return jumpHeight_m / timeToTakeoff_s;
}

export interface CMJMetrics {
  flightTime_ms: number;
  jumpHeight_cm: number;
  jumpHeight_m: number;
  RSImod: number | null;
  timeToTakeoff_s: number | null;
}

export function computeMetrics(
  takeoffFrame: number,
  landingFrame: number,
  fps: number,
  movementStartFrame?: number
): CMJMetrics {
  const ft = calcFlightTime(takeoffFrame, landingFrame, fps);
  const jh_m = calcJumpHeight(ft);
  const tto = movementStartFrame != null ? calcTimeToTakeoff(movementStartFrame, takeoffFrame, fps) : null;
  const rsi = tto != null && tto > 0 ? calcRSImod(jh_m, tto) : null;
  return {
    flightTime_ms: ft * 1000,
    jumpHeight_m: jh_m,
    jumpHeight_cm: jh_m * 100,
    RSImod: rsi,
    timeToTakeoff_s: tto,
  };
}

export function validateMarkers(
  takeoffFrame: number | null,
  landingFrame: number | null,
  movementStartFrame: number | null,
  totalFrames: number
): string[] {
  const errors: string[] = [];
  if (takeoffFrame === null) errors.push('Set Takeoff marker');
  if (landingFrame === null) errors.push('Set Landing marker');
  if (takeoffFrame !== null && landingFrame !== null) {
    if (landingFrame <= takeoffFrame) errors.push('Landing must be after Takeoff');
    const ft = (landingFrame - takeoffFrame);
    if (ft < 2) errors.push('Flight time too short');
    if (ft > totalFrames * 0.9) errors.push('Flight time suspiciously long');
  }
  if (movementStartFrame !== null && takeoffFrame !== null && movementStartFrame >= takeoffFrame)
    errors.push('Movement start must be before Takeoff');
  return errors;
}
