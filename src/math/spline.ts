import type { Vec2, Waypoint } from '../types';

function catmullRomPoint(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number,
): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** ウェイポイント列から滑らかな走行パスを生成 */
export function buildSplinePath(
  points: Waypoint[],
  stepsPerSegment = 16,
): Vec2[] {
  if (points.length < 2) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }

  const result: Vec2[] = [];
  const n = points.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    for (let s = 0; s < stepsPerSegment; s++) {
      result.push(catmullRomPoint(p0, p1, p2, p3, s / stepsPerSegment));
    }
  }
  result.push({ x: points[n - 1].x, y: points[n - 1].y });
  return result;
}

/** スプライン上の進行度（0 … length-1）から座標を補間 */
export function positionOnSpline(spline: Vec2[], progress: number): Vec2 {
  const total = spline.length - 1;
  if (total <= 0) return spline[0] ?? { x: 0, y: 0 };
  const clamped = Math.min(Math.max(progress, 0), total);
  const idx = Math.floor(clamped);
  const frac = clamped - idx;
  if (idx >= total) return spline[spline.length - 1];
  const a = spline[idx];
  const b = spline[idx + 1];
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

/** 進行方向（ラジアン、canvas 座標系: 右が 0） */
export function headingOnSpline(spline: Vec2[], progress: number): number {
  const total = spline.length - 1;
  if (total <= 0) return 0;
  const delta = 0.6;
  const a = positionOnSpline(spline, progress - delta);
  const b = positionOnSpline(spline, progress + delta);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx * dx + dy * dy < 1e-8) return 0;
  return Math.atan2(dy, dx);
}

/** 進行度から最寄りのウェイポイントインデックス（粗い対応） */
export function waypointIndexAtProgress(
  pointCount: number,
  _splineLength: number,
  progress: number,
  stepsPerSegment = 16,
): number {
  if (pointCount <= 0) return 0;
  const seg = stepsPerSegment;
  return Math.min(Math.floor(progress / seg), pointCount - 1);
}
