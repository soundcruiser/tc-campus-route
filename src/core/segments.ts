import { createDefaultSegment } from '../config/course-scripts';
import type { CourseData, SegmentDef, SegmentId } from '../types';

export const MAX_SEGMENTS = 16;

export function nextSegmentId(segments: SegmentDef[]): SegmentId {
  if (!segments.length) return 1;
  return Math.max(...segments.map((s) => s.id)) + 1;
}

export function ensureDefaultSegments(course: CourseData): void {
  if (!course.segments.length) {
    course.segments = [createDefaultSegment(1, 0)];
  }
}

export function addSegment(course: CourseData): SegmentDef {
  if (course.segments.length >= MAX_SEGMENTS) {
    throw new Error(`フェーズは最大${MAX_SEGMENTS}までです`);
  }
  const id = nextSegmentId(course.segments);
  const seg = createDefaultSegment(id, course.segments.length);
  course.segments.push(seg);
  return seg;
}

/** 現在のフェーズの次。なければ新規追加 */
export function findOrCreateNextSegment(
  course: CourseData,
  currentId: SegmentId,
): SegmentDef {
  const sorted = [...course.segments].sort((a, b) => a.id - b.id);
  const existing = sorted.find((s) => s.id > currentId);
  if (existing) return existing;
  return addSegment(course);
}

export function removeSegment(course: CourseData, id: SegmentId): boolean {
  if (course.segments.length <= 1) return false;
  const hasPoints = course.points.some((p) => p.segmentId === id);
  if (hasPoints) return false;

  course.segments = course.segments.filter((s) => s.id !== id);
  return true;
}

export function renumberSegmentIds(course: CourseData): void {
  const sorted = [...course.segments].sort((a, b) => a.id - b.id);
  const map = new Map<SegmentId, SegmentId>();
  sorted.forEach((s, i) => {
    const newId = i + 1;
    map.set(s.id, newId);
    s.id = newId;
    if (!s.name || /^フェーズ\d+$/.test(s.name)) {
      s.name = `フェーズ${newId}`;
    }
  });
  for (const p of course.points) {
    p.segmentId = map.get(p.segmentId) ?? 1;
  }
}
