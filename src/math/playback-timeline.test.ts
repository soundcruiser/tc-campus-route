import { describe, expect, it } from 'vitest';
import { createEmptyWaypoint } from '../config';
import {
  buildPlaybackTimeline,
  getTravelSec,
  getWaitSec,
  progressAtElapsed,
  totalTimelineSec,
  waypointIndexAtElapsed,
} from './playback-timeline';

describe('playback-timeline', () => {
  it('builds wait and travel pieces for two points', () => {
    const a = createEmptyWaypoint(0, 0, 1);
    a.waitSec = 2;
    a.travelSec = 1.5;
    const b = createEmptyWaypoint(1, 1, 1);
    const pieces = buildPlaybackTimeline([a, b]);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toMatchObject({ kind: 'wait', durationSec: 2 });
    expect(pieces[1]).toMatchObject({ kind: 'travel', durationSec: 1.5 });
    expect(totalTimelineSec(pieces)).toBeCloseTo(3.5);
  });

  it('uses default travel when travelSec omitted', () => {
    const a = createEmptyWaypoint(0, 0);
    const b = createEmptyWaypoint(1, 1);
    expect(getTravelSec(a)).toBeGreaterThan(0);
    const pieces = buildPlaybackTimeline([a, b]);
    expect(pieces.filter((p) => p.kind === 'travel')).toHaveLength(1);
  });

  it('skips zero wait pieces', () => {
    const pts = [createEmptyWaypoint(0, 0), createEmptyWaypoint(1, 1)];
    pts[0].waitSec = 0;
    const pieces = buildPlaybackTimeline(pts);
    expect(pieces.every((p) => p.kind !== 'wait' || p.durationSec > 0)).toBe(
      true,
    );
    expect(getWaitSec(pts[0])).toBe(0);
  });

  it('maps elapsed time to progress and waypoint index', () => {
    const a = createEmptyWaypoint(0, 0);
    a.travelSec = 2;
    const b = createEmptyWaypoint(10, 10);
    b.waitSec = 1;
    const pieces = buildPlaybackTimeline([a, b]);
    const midTravel = progressAtElapsed(pieces, 1);
    expect(midTravel).toBeGreaterThan(0);
    expect(midTravel).toBeLessThan(pieces[1].kind === 'travel' ? pieces[1].progressEnd : Infinity);

    const atEnd = totalTimelineSec(pieces);
    expect(waypointIndexAtElapsed(pieces, atEnd)).toBe(1);
  });
});
