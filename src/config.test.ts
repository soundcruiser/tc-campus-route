import { describe, expect, it } from 'vitest';
import { createEmptyWaypoint, isImportantWaypoint } from './config';

describe('isImportantWaypoint', () => {
  it('is false for empty default point', () => {
    const wp = createEmptyWaypoint(0, 0);
    expect(isImportantWaypoint(wp)).toBe(false);
  });

  it('is true when label is set', () => {
    const wp = createEmptyWaypoint(0, 0);
    wp.label = '北交差点';
    expect(isImportantWaypoint(wp)).toBe(true);
  });

  it('is true when challenge or action is set', () => {
    const wp = createEmptyWaypoint(0, 0);
    wp.challengeId = 's_curve';
    expect(isImportantWaypoint(wp)).toBe(true);
    wp.challengeId = 'none';
    wp.action = 'stop';
    expect(isImportantWaypoint(wp)).toBe(true);
  });
});
