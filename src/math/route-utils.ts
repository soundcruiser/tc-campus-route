import type { SegmentId, Waypoint } from '../types';

export const SPLINE_STEPS_PER_LEG = 16;

export interface SegmentRange {
  segmentId: SegmentId;
  startIndex: number;
  endIndex: number;
  progressStart: number;
  progressEnd: number;
}

/**
 * フェーズ区間（スプライン上の進行度）。
 * 点 i-1 → 点 i の leg は「点 i のフェーズ色」に属する（切り替え点に到達する手前から新色）。
 */
export function computeSegmentRanges(
  points: Waypoint[],
  steps = SPLINE_STEPS_PER_LEG,
): SegmentRange[] {
  if (points.length < 2) {
    if (points.length === 1) {
      return [
        {
          segmentId: points[0].segmentId,
          startIndex: 0,
          endIndex: 0,
          progressStart: 0,
          progressEnd: 0,
        },
      ];
    }
    return [];
  }

  const splineLen = (points.length - 1) * steps;
  const ranges: SegmentRange[] = [];
  let startLeg = 0;

  for (let leg = 0; leg < points.length - 1; leg++) {
    const legSeg = points[leg + 1].segmentId;
    const hasNextLeg = leg + 1 < points.length - 1;
    const runEnds =
      !hasNextLeg || points[leg + 2].segmentId !== legSeg;

    if (runEnds) {
      ranges.push({
        segmentId: legSeg,
        startIndex: startLeg,
        endIndex: leg + 1,
        progressStart: startLeg * steps,
        progressEnd: (leg + 1) * steps,
      });
      startLeg = leg + 1;
    }
  }

  if (ranges.length) {
    ranges[ranges.length - 1].progressEnd = splineLen;
  }
  return ranges;
}

/** 再生中の進行度に対応するフェーズ（leg 先の点の segmentId） */
export function segmentAtProgress(
  points: Waypoint[],
  progress: number,
  steps = SPLINE_STEPS_PER_LEG,
): SegmentId {
  if (!points.length) return 1;
  if (points.length === 1) return points[0].segmentId;
  if (progress <= 0) return points[0].segmentId;

  const leg = Math.min(Math.floor(progress / steps), points.length - 2);
  return points[leg + 1].segmentId;
}

export function segmentAtPointIndex(
  points: Waypoint[],
  index: number,
): SegmentId {
  return points[Math.max(0, Math.min(index, points.length - 1))]?.segmentId ?? 1;
}

export function nextChallengeLabel(
  points: Waypoint[],
  fromIndex: number,
): string | null {
  for (let i = fromIndex + 1; i < points.length; i++) {
    const p = points[i];
    if (p.challengeId !== 'none') {
      return p.label || null;
    }
    if (p.label) return p.label;
  }
  return null;
}
