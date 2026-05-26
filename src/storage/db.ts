import {
  createDefaultSegment,
  DEFAULT_SETTINGS,
  emptyCourse,
  emptyCourses,
} from '../config';
import { ensureDefaultSegments } from '../core/segments';
import type {
  ActionId,
  ChallengeId,
  CourseData,
  CourseId,
  PersistedData,
  SegmentId,
  Waypoint,
} from '../types';

const DB_NAME = 'tc-campus-route';
const DB_VERSION = 1;
const STORE = 'app';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
  });
}

export function defaultPersistedData(): PersistedData {
  return {
    version: 4,
    courses: emptyCourses(),
    settings: { ...DEFAULT_SETTINGS },
    customBackground: null,
  };
}

export async function loadPersistedData(): Promise<PersistedData> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get('state');
      req.onsuccess = () => {
        const raw = req.result;
        resolve(raw ? migrate(raw) : defaultPersistedData());
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return defaultPersistedData();
  }
}

export async function savePersistedData(data: PersistedData): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data, 'state');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

interface LegacyWaypoint {
  x: number;
  y: number;
  label?: string;
  challengeId?: ChallengeId;
  action?: ActionId;
  segmentId?: SegmentId;
  roundIds?: number[];
  waitSec?: number;
  travelSec?: number;
}

function normalizeWaypoint(p: LegacyWaypoint, segmentId: SegmentId): Waypoint {
  const wait = Number(p.waitSec);
  const travel = Number(p.travelSec);
  return {
    x: p.x,
    y: p.y,
    label: p.label ?? '',
    challengeId: p.challengeId ?? 'none',
    action: p.action ?? 'none',
    segmentId: p.segmentId ?? segmentId,
    waitSec: Number.isFinite(wait) && wait >= 0 ? wait : 0,
    travelSec:
      Number.isFinite(travel) && travel > 0 ? travel : undefined,
  };
}

function segmentsFromLegacyRoutes(
  routes: Record<number, LegacyWaypoint[]>,
): import('../types').SegmentDef[] {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8].filter((r) => (routes[r]?.length ?? 0) > 0);
  if (!ids.length) return [createDefaultSegment(1, 0)];
  return ids.map((id, i) => createDefaultSegment(id, i));
}

function migrateV2Routes(
  courseId: CourseId,
  routes: Record<number, LegacyWaypoint[]>,
): CourseData {
  const course = emptyCourse(courseId);
  course.segments = segmentsFromLegacyRoutes(routes);
  const order = [1, 2, 3, 4, 5, 6, 7, 8];
  for (const r of order) {
    const pts = routes[r];
    if (!pts?.length) continue;
    for (const p of pts) {
      course.points.push(normalizeWaypoint(p, r));
    }
  }
  return course;
}

function migrate(raw: unknown): PersistedData {
  const data = raw as Record<string, unknown>;
  const version = (data.version as number) ?? 1;
  const courses = emptyCourses();

  if (version >= 3 && data.courses) {
    const c = data.courses as Record<CourseId, CourseData>;
    for (const id of ['A', 'B', 'C'] as CourseId[]) {
      const src = c[id];
      courses[id] = {
        points: (src?.points ?? []).map((p) =>
          normalizeWaypoint(p, p.segmentId ?? 1),
        ),
        segments: (src?.segments ?? []).map((s) => ({
          id: s.id,
          name: s.name ?? `フェーズ${s.id}`,
          color: s.color ?? '#e53935',
          routeText: s.routeText ?? '',
        })),
      };
    }
    for (const id of ['A', 'B', 'C'] as CourseId[]) {
      ensureDefaultSegments(courses[id]);
    }
    return finalizePersisted(
      courses,
      data.settings,
      (data.customBackground as string | null) ?? null,
      version,
    );
  }

  if (version === 2 && data.courses) {
    const c = data.courses as Record<
      CourseId,
      { routes?: Record<number, LegacyWaypoint[]>; points?: LegacyWaypoint[] }
    >;
    for (const id of ['A', 'B', 'C'] as CourseId[]) {
      if (c[id]?.routes) {
        courses[id] = migrateV2Routes(id, c[id].routes!);
      } else if (c[id]?.points) {
        courses[id] = emptyCourse(id);
        courses[id].points = c[id].points!.map((p) =>
          normalizeWaypoint(p, p.segmentId ?? 1),
        );
      }
      ensureDefaultSegments(courses[id]);
    }
    return finalizePersisted(
      courses,
      data.settings,
      (data.customBackground as string | null) ?? null,
      version,
    );
  }

  return defaultPersistedData();
}

function finalizePersisted(
  courses: Record<CourseId, CourseData>,
  settings: unknown,
  customBackground: string | null,
  fromVersion: number,
): PersistedData {
  return {
    version: 4,
    courses,
    settings: normalizeSettings(settings),
    // v4: 同梱の敷地図をデフォルトに統一（以前の手動読み込みを解除）
    customBackground: fromVersion < 4 ? null : customBackground,
  };
}

function normalizeSettings(raw: unknown): import('../types').AppSettings {
  const s = { ...DEFAULT_SETTINGS, ...(raw as object) } as Record<string, unknown>;
  if (s.playbackMode === 'single_round' || s.playbackMode === 'all_rounds') {
    s.playbackMode =
      s.playbackMode === 'single_round' ? 'single_segment' : 'full_course';
  }
  if (s.baseRouteDisplay === 'round') {
    s.baseRouteDisplay = 'current';
  }
  if (!s.mapFit) {
    s.mapFit = 'auto';
  }
  const speed = Number(s.animSpeed);
  s.animSpeed = Number.isFinite(speed)
    ? Math.min(5, Math.max(0.2, speed))
    : 1;
  if (s.pointListScope !== 'phase' && s.pointListScope !== 'all') {
    s.pointListScope = 'phase';
  }
  if (typeof s.pointListPanelCollapsed !== 'boolean') {
    s.pointListPanelCollapsed = false;
  }
  return s as unknown as import('../types').AppSettings;
}

export function exportJson(data: PersistedData): string {
  const { customBackground: _, ...rest } = data;
  return JSON.stringify(rest, null, 2);
}

export function importJson(json: string): PersistedData {
  return migrate(JSON.parse(json));
}
