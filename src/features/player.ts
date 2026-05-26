import { getSegmentDef, isImportantWaypoint } from '../config';
import {
  buildSplinePath,
  headingOnSpline,
  positionOnSpline,
  waypointIndexAtProgress,
} from '../math/spline';
import {
  buildPlaybackTimeline,
  elapsedAtProgress,
  progressAtElapsed,
  waypointIndexAtElapsed,
  type TimelinePiece,
} from '../math/playback-timeline';
import {
  computeSegmentRanges,
  segmentAtProgress,
  SPLINE_STEPS_PER_LEG,
} from '../math/route-utils';
import type { AppState } from '../core/app-state';
import type { SegmentId, Waypoint } from '../types';

export interface PlayerSnapshot {
  position: { x: number; y: number };
  /** 進行方向（ラジアン） */
  heading: number;
  progress: number;
  segmentId: SegmentId;
  trailColor: string;
  activeWaypoint: Waypoint | null;
  activeIndex: number;
  /** ウェイポイント到達時（重要点のポップアップ用） */
  arrivedAt: { index: number; waypoint: Waypoint } | null;
}

export class RoutePlayer {
  private onSegmentChange: ((id: SegmentId) => void) | null = null;
  private lastSegmentId: SegmentId = 0;
  private lastFrameMs = 0;
  private timeline: TimelinePiece[] = [];
  private playbackEndElapsedSec = Infinity;
  private lastArrivalIndex = -1;

  setOnSegmentChange(cb: (id: SegmentId) => void): void {
    this.onSegmentChange = cb;
  }

  reset(state: AppState): void {
    state.playing = false;
    state.animProgress = 0;
    state.playbackElapsedSec = 0;
    state.progressEnd = Infinity;
    state.trail = [];
    state.shownPopupIndices.clear();
    state.currentSegmentId = 1;
    this.lastSegmentId = 0;
    this.lastFrameMs = 0;
    this.timeline = [];
    this.playbackEndElapsedSec = Infinity;
    this.lastArrivalIndex = -1;
  }

  start(state: AppState): boolean {
    const pts = state.points();
    if (pts.length < 2) return false;

    this.reset(state);

    this.timeline = buildPlaybackTimeline(pts);
    const splineLen = buildSplinePath(pts, SPLINE_STEPS_PER_LEG).length - 1;
    let progressStart = 0;
    let progressEnd = splineLen;

    if (state.settings.playbackMode === 'single_segment') {
      const ranges = computeSegmentRanges(pts);
      const r = ranges.find((x) => x.segmentId === state.practiceSegmentId);
      if (!r || r.progressEnd <= r.progressStart) return false;
      progressStart = r.progressStart;
      progressEnd = r.progressEnd;
      state.currentSegmentId = state.practiceSegmentId;
    } else {
      state.currentSegmentId = pts[0]?.segmentId ?? 1;
    }

    state.progressEnd = progressEnd;
    state.playbackElapsedSec = elapsedAtProgress(
      this.timeline,
      progressStart,
    );
    this.playbackEndElapsedSec = elapsedAtProgress(
      this.timeline,
      progressEnd,
    );
    state.animProgress = progressAtElapsed(
      this.timeline,
      state.playbackElapsedSec,
    );

    state.playing = true;
    this.lastSegmentId = state.currentSegmentId;
    this.lastFrameMs = 0;
    this.lastArrivalIndex = -1;
    return true;
  }

  stop(state: AppState): void {
    state.playing = false;
    this.lastFrameMs = 0;
  }

  tick(state: AppState): PlayerSnapshot | null {
    const pts = state.points();
    if (pts.length < 2) return null;

    const spline = buildSplinePath(pts, SPLINE_STEPS_PER_LEG);
    const total = spline.length - 1;
    const end = Math.min(state.progressEnd, total);

    if (state.playing && this.timeline.length) {
      const frameMs = performance.now();
      const dtSec =
        this.lastFrameMs > 0 ? (frameMs - this.lastFrameMs) / 1000 : 0;
      this.lastFrameMs = frameMs;
      const speed = clampSpeed(state.settings.animSpeed);
      state.playbackElapsedSec += dtSec * speed;

      if (state.playbackElapsedSec >= this.playbackEndElapsedSec) {
        state.playing = false;
        state.playbackElapsedSec = this.playbackEndElapsedSec;
      }

      state.animProgress = progressAtElapsed(
        this.timeline,
        state.playbackElapsedSec,
      );
      if (state.animProgress > end) state.animProgress = end;

      const newSeg = segmentAtProgress(pts, state.animProgress);
      if (newSeg !== this.lastSegmentId && state.playing) {
        this.lastSegmentId = newSeg;
        state.currentSegmentId = newSeg;
        this.onSegmentChange?.(newSeg);
      } else {
        state.currentSegmentId = newSeg;
      }

      const segDef = getSegmentDef(state.segments(), state.currentSegmentId);
      const pos = positionOnSpline(spline, state.animProgress);
      const now = Date.now();
      state.trail.push({
        x: pos.x,
        y: pos.y,
        t: now,
        segmentId: state.currentSegmentId,
        color: segDef.color,
      });
      const maxAge = state.settings.trailDurationSec * 1000;
      state.trail = state.trail.filter((s) => now - s.t < maxAge);
    } else {
      state.currentSegmentId = segmentAtProgress(
        pts,
        Math.min(state.animProgress, end),
      );
    }

    const progress = Math.min(state.animProgress, end);
    const segDef = getSegmentDef(state.segments(), state.currentSegmentId);
    const trailColor = segDef.color;
    const pos = positionOnSpline(spline, progress);
    const heading = headingOnSpline(spline, progress);
    const idx = waypointIndexAtProgress(
      pts.length,
      spline.length,
      progress,
      SPLINE_STEPS_PER_LEG,
    );
    const active = pts[idx] ?? null;

    const arrivedAt = state.playing ? this.checkArrival(state) : null;

    return {
      position: pos,
      heading,
      progress,
      segmentId: state.currentSegmentId,
      trailColor,
      activeWaypoint: active,
      activeIndex: idx,
      arrivedAt,
    };
  }

  private checkArrival(state: AppState): PlayerSnapshot['arrivedAt'] {
    const wpIdx = waypointIndexAtElapsed(
      this.timeline,
      state.playbackElapsedSec,
    );
    if (wpIdx <= this.lastArrivalIndex) return null;

    this.lastArrivalIndex = wpIdx;
    const pts = state.points();
    const wp = pts[wpIdx];
    if (!wp || !isImportantWaypoint(wp)) return null;
    if (state.shownPopupIndices.has(wpIdx)) return null;

    state.shownPopupIndices.add(wpIdx);
    return { index: wpIdx, waypoint: wp };
  }

  /** 再生中の待ち区間をスキップ（ポップアップ閉じるとき） */
  skipCurrentWait(state: AppState): boolean {
    if (!state.playing || !this.timeline.length) return false;
    let acc = 0;
    for (const piece of this.timeline) {
      const end = acc + piece.durationSec;
      if (state.playbackElapsedSec < end) {
        if (piece.kind === 'wait' && piece.durationSec > 0) {
          state.playbackElapsedSec = end;
          state.animProgress = progressAtElapsed(
            this.timeline,
            state.playbackElapsedSec,
          );
          return true;
        }
        return false;
      }
      acc = end;
    }
    return false;
  }

  jumpToNextSegment(state: AppState): void {
    const pts = state.points();
    const ranges = computeSegmentRanges(pts);
    const idx = ranges.findIndex((r) => r.segmentId === state.currentSegmentId);
    if (idx < 0 || idx >= ranges.length - 1) return;
    const next = ranges[idx + 1];
    state.currentSegmentId = next.segmentId;
    state.progressEnd = next.progressEnd;
    state.playbackElapsedSec = elapsedAtProgress(
      this.timeline,
      next.progressStart,
    );
    this.playbackEndElapsedSec = elapsedAtProgress(
      this.timeline,
      next.progressEnd,
    );
    state.animProgress = progressAtElapsed(
      this.timeline,
      state.playbackElapsedSec,
    );
    state.trail = [];
    state.shownPopupIndices.clear();
    this.lastSegmentId = next.segmentId;
    this.lastArrivalIndex =
      waypointIndexAtElapsed(this.timeline, state.playbackElapsedSec) - 1;
    this.onSegmentChange?.(next.segmentId);
  }
}

function clampSpeed(s: number): number {
  return Math.min(5, Math.max(0.15, s));
}

export const routePlayer = new RoutePlayer();
