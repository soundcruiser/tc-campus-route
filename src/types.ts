/** コース識別子 */
export type CourseId = 'A' | 'B' | 'C';

export type AppMode = 'edit' | 'learn';
export type EditTool = 'add' | 'edit';

/** 区間番号（コースごとに 3〜4。将来は拡張可） */
export type SegmentId = number;

export type ChallengeId =
  | 'none'
  | 'rail_crossing'
  | 'hill_start'
  | 's_curve'
  | 'crank'
  | 'slalom'
  | 'parallel'
  | 'crossing'
  | 'roundabout';

export type ActionId =
  | 'none'
  | 'stop'
  | 'slow'
  | 'blinker_l'
  | 'blinker_r'
  | 'look_lr';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Waypoint {
  x: number;
  y: number;
  label: string;
  challengeId: ChallengeId;
  action: ActionId;
  /** 属する区間（1本ルート上の連続区間） */
  segmentId: SegmentId;
  /** 到達後の待ち秒数（animSpeed=1 基準）。未設定は 0 */
  waitSec?: number;
  /** 次の点までの移動秒数（animSpeed=1 基準）。未設定は従来速度に相当 */
  travelSec?: number;
}

/** 検定図の色分け区間定義 */
export interface SegmentDef {
  id: SegmentId;
  name: string;
  color: string;
  routeText: string;
}

export interface CourseData {
  /** 走行順＝配列順の1本ルート */
  points: Waypoint[];
  segments: SegmentDef[];
}

/** 学習時のガイド線: current=今の区間のみ / dim=全区間薄く / off=非表示 */
export type BaseRouteDisplay = 'off' | 'dim' | 'current';

export type CameraMode = 'overview' | 'follow';
export type PlaybackMode = 'single_segment' | 'full_course';

/** 背景地図のフィット: auto=縦長なら縦いっぱい / contain=全体 / fill-height=高さ優先 / cover=画面いっぱい */
export type MapFitMode = 'auto' | 'contain' | 'fill-height' | 'cover';

/** ポイント一覧: phase=いまのフェーズのみ / all=全区間 */
export type PointListScope = 'phase' | 'all';

export interface AppSettings {
  trailDurationSec: number;
  baseRouteDisplay: BaseRouteDisplay;
  cameraMode: CameraMode;
  playbackMode: PlaybackMode;
  animSpeed: number;
  mapFit: MapFitMode;
  pointListScope: PointListScope;
  /** ポイント一覧パネル（リスト部分）をたたむ */
  pointListPanelCollapsed: boolean;
}

export interface PersistedData {
  version: 4;
  courses: Record<CourseId, CourseData>;
  settings: AppSettings;
  customBackground: string | null;
}

export interface TrailSample {
  x: number;
  y: number;
  t: number;
  segmentId: SegmentId;
  color: string;
}
