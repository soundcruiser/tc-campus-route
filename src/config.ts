import { createDefaultSegment } from './config/course-scripts';
import type {
  ActionId,
  AppSettings,
  ChallengeId,
  CourseData,
  CourseId,
  SegmentDef,
  SegmentId,
  Waypoint,
} from './types';

export {
  createDefaultSegment,
  pickSegmentColor,
  SEGMENT_COLOR_PALETTE,
} from './config/course-scripts';

export const DEFAULT_MAP_URL = './assets/campus-map-default.png';
export const COURSE_IDS: CourseId[] = ['A', 'B', 'C'];

export const COURSES: Record<CourseId, { color: string; name: string }> = {
  A: { color: '#ff4d6d', name: 'Aコース' },
  B: { color: '#4dc9ff', name: 'Bコース' },
  C: { color: '#4dff9b', name: 'Cコース' },
};

export interface ChallengeDef {
  id: ChallengeId;
  label: string;
  icon: string;
  hint: string;
  color: string;
}

export const CHALLENGES: ChallengeDef[] = [
  { id: 'none', label: '課題なし', icon: '', hint: '', color: '#888' },
  {
    id: 'rail_crossing',
    label: '踏切',
    icon: '🚃',
    hint: '遮断器の手前で一時停止し、左右の安全を確認してから進みます。',
    color: '#ff6b6b',
  },
  {
    id: 'hill_start',
    label: '坂道発進',
    icon: '⛰️',
    hint: 'ブレーキとアクセルのバランスを意識。後退しないよう発進します。',
    color: '#f0a500',
  },
  {
    id: 's_curve',
    label: 'S字',
    icon: '〰️',
    hint: 'ハンドル操作は小さく、ゆっくり。進行方向の確認を忘れずに。',
    color: '#4dc9ff',
  },
  {
    id: 'crank',
    label: 'クランク',
    icon: '↩️',
    hint: '直角に近い曲がり角。速度を落として丁寧に曲げます。',
    color: '#b388ff',
  },
  {
    id: 'slalom',
    label: 'スラローム',
    icon: '🎯',
    hint: 'コーンの間を一定速度で通過。急なハンドル操作は避けます。',
    color: '#ff9800',
  },
  {
    id: 'parallel',
    label: '縦列・庫内',
    icon: '🅿️',
    hint: 'ミラーと後方を確認しながら、ゆっくり正確に操作します。',
    color: '#78909c',
  },
  {
    id: 'crossing',
    label: '横断歩道',
    icon: '🚶',
    hint: '歩行者の有無を確認。必要なら一時停止します。',
    color: '#26a69a',
  },
  {
    id: 'roundabout',
    label: '交差点・信号',
    icon: '🚦',
    hint: '信号と優先道路を確認。進行方向に合わせて進みます。',
    color: '#ef5350',
  },
];

export const CHALLENGE_BY_ID = Object.fromEntries(
  CHALLENGES.map((c) => [c.id, c]),
) as Record<ChallengeId, ChallengeDef>;

export interface ActionDef {
  id: ActionId;
  label: string;
  icon: string;
  color: string;
}

export const ACTIONS: ActionDef[] = [
  { id: 'none', label: '操作ヒントなし', icon: '', color: '' },
  { id: 'stop', label: '一時停止', icon: '🛑', color: '#ff4d4d' },
  { id: 'slow', label: '徐行', icon: '⚠️', color: '#f0a500' },
  { id: 'blinker_l', label: '左ウィンカー', icon: '◀', color: '#f0a500' },
  { id: 'blinker_r', label: '右ウィンカー', icon: '▶', color: '#f0a500' },
  {
    id: 'look_lr',
    label: '左右・巻き込み確認',
    icon: '👁',
    color: '#4dc9ff',
  },
];

export const ACTION_BY_ID = Object.fromEntries(
  ACTIONS.map((a) => [a.id, a]),
) as Record<ActionId, ActionDef>;

export const DEFAULT_SETTINGS: AppSettings = {
  trailDurationSec: 4,
  baseRouteDisplay: 'current',
  cameraMode: 'overview',
  playbackMode: 'full_course',
  animSpeed: 1,
  mapFit: 'auto',
  pointListScope: 'phase',
  pointListPanelCollapsed: false,
};

export function createEmptyWaypoint(
  x: number,
  y: number,
  segmentId: SegmentId = 1,
): Waypoint {
  return {
    x,
    y,
    label: '',
    challengeId: 'none',
    action: 'none',
    segmentId,
    waitSec: 0,
  };
}

/** ポップアップ・待機の対象になる点 */
export function isImportantWaypoint(wp: Waypoint): boolean {
  return (
    wp.challengeId !== 'none' ||
    wp.action !== 'none' ||
    wp.label.trim().length > 0
  );
}

export function emptyCourse(_courseId: CourseId): CourseData {
  return {
    points: [],
    segments: [createDefaultSegment(1, 0)],
  };
}

export function emptyCourses(): Record<CourseId, CourseData> {
  return {
    A: emptyCourse('A'),
    B: emptyCourse('B'),
    C: emptyCourse('C'),
  };
}

export function getSegmentDef(
  segments: SegmentDef[],
  id: SegmentId,
): SegmentDef {
  return (
    segments.find((s) => s.id === id) ??
    segments[0] ??
    createDefaultSegment(1, 0)
  );
}
