import { SPLINE_STEPS_PER_LEG } from './route-utils';
import type { Waypoint } from '../types';

/** 従来の一律速度（animSpeed=1）に相当する 1 leg あたりの秒数 */
export const DEFAULT_TRAVEL_SEC =
  SPLINE_STEPS_PER_LEG / (0.55 * 60);

export type TimelinePiece =
  | {
      kind: 'wait';
      waypointIndex: number;
      progress: number;
      durationSec: number;
    }
  | {
      kind: 'travel';
      fromIndex: number;
      progressStart: number;
      progressEnd: number;
      durationSec: number;
    };

export function progressAtWaypoint(index: number): number {
  return index * SPLINE_STEPS_PER_LEG;
}

export function getTravelSec(wp: Waypoint): number {
  const t = wp.travelSec;
  if (t != null && t > 0) return t;
  return DEFAULT_TRAVEL_SEC;
}

export function getWaitSec(wp: Waypoint): number {
  const w = wp.waitSec;
  if (w != null && w >= 0) return w;
  return 0;
}

/** 全区間の再生タイムライン（animSpeed=1 基準の秒数） */
export function buildPlaybackTimeline(points: Waypoint[]): TimelinePiece[] {
  const pieces: TimelinePiece[] = [];
  if (points.length < 2) return pieces;

  for (let i = 0; i < points.length; i++) {
    const wait = getWaitSec(points[i]);
    if (wait > 0) {
      pieces.push({
        kind: 'wait',
        waypointIndex: i,
        progress: progressAtWaypoint(i),
        durationSec: wait,
      });
    }

    if (i < points.length - 1) {
      pieces.push({
        kind: 'travel',
        fromIndex: i,
        progressStart: progressAtWaypoint(i),
        progressEnd: progressAtWaypoint(i + 1),
        durationSec: getTravelSec(points[i]),
      });
    }
  }

  return pieces;
}

export function totalTimelineSec(pieces: TimelinePiece[]): number {
  return pieces.reduce((s, p) => s + p.durationSec, 0);
}

/** タイムライン上の経過秒 → スプライン進行度 */
export function progressAtElapsed(
  pieces: TimelinePiece[],
  elapsedSec: number,
): number {
  if (!pieces.length) return 0;
  let t = Math.max(0, elapsedSec);
  for (const piece of pieces) {
    if (t <= piece.durationSec) {
      if (piece.kind === 'wait') return piece.progress;
      const f =
        piece.durationSec > 0 ? t / piece.durationSec : 1;
      return (
        piece.progressStart +
        (piece.progressEnd - piece.progressStart) * f
      );
    }
    t -= piece.durationSec;
  }
  const last = pieces[pieces.length - 1];
  return last.kind === 'wait' ? last.progress : last.progressEnd;
}

/** 指定進行度に到達するタイムライン秒（区間再生の開始オフセット用） */
export function elapsedAtProgress(
  pieces: TimelinePiece[],
  targetProgress: number,
): number {
  let elapsed = 0;
  for (const piece of pieces) {
    if (piece.kind === 'wait') {
      if (targetProgress <= piece.progress) return elapsed;
      elapsed += piece.durationSec;
      continue;
    }
    if (targetProgress <= piece.progressStart) return elapsed;
    if (targetProgress >= piece.progressEnd) {
      elapsed += piece.durationSec;
      continue;
    }
    const span = piece.progressEnd - piece.progressStart;
    const frac = span > 0 ? (targetProgress - piece.progressStart) / span : 0;
    return elapsed + piece.durationSec * frac;
  }
  return elapsed;
}

/** 経過秒時点で「到達済み」とみなす最後のウェイポイント index */
export function waypointIndexAtElapsed(
  pieces: TimelinePiece[],
  elapsedSec: number,
): number {
  let t = Math.max(0, elapsedSec);
  let lastWp = 0;
  for (const piece of pieces) {
    if (t <= piece.durationSec) {
      if (piece.kind === 'wait') return piece.waypointIndex;
      return piece.fromIndex;
    }
    t -= piece.durationSec;
    if (piece.kind === 'wait') lastWp = piece.waypointIndex;
    else lastWp = piece.fromIndex + 1;
  }
  return lastWp;
}
