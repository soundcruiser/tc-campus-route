import { DEFAULT_SETTINGS, emptyCourses } from '../config';
import { ensureDefaultSegments } from './segments';
import type {
  AppMode,
  AppSettings,
  CourseId,
  EditTool,
  PersistedData,
  SegmentId,
  TrailSample,
} from '../types';

export class AppState {
  courses = emptyCourses();
  settings: AppSettings = { ...DEFAULT_SETTINGS };

  courseId: CourseId = 'A';
  appMode: AppMode = 'edit';
  editTool: EditTool = 'add';

  /** 新規ポイント・ハイライト用の区間 */
  activeSegmentId: SegmentId = 1;
  practiceSegmentId: SegmentId = 1;

  selectedPointIndex: number | null = null;
  history: string[] = [];

  backgroundImage: HTMLImageElement | null = null;
  usingCustomBackground = false;

  playing = false;
  animProgress = 0;
  /** 再生タイムライン経過（animSpeed=1 基準の秒） */
  playbackElapsedSec = 0;
  progressEnd = Infinity;
  currentSegmentId: SegmentId = 1;
  trail: TrailSample[] = [];
  shownPopupIndices = new Set<number>();

  loadFromPersisted(data: PersistedData): void {
    this.courses = data.courses;
    for (const id of ['A', 'B', 'C'] as const) {
      ensureDefaultSegments(this.courses[id]);
    }
    this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    this.usingCustomBackground = !!data.customBackground;
    this.clampSegmentSelection();
  }

  clampSegmentSelection(): void {
    const ids = new Set(this.segments().map((s) => s.id));
    if (!ids.has(this.activeSegmentId)) {
      this.activeSegmentId = this.segments()[0].id;
    }
    if (!ids.has(this.practiceSegmentId)) {
      this.practiceSegmentId = this.segments()[0].id;
    }
  }

  toPersisted(customBackground: string | null): PersistedData {
    return {
      version: 4,
      courses: this.courses,
      settings: this.settings,
      customBackground,
    };
  }

  course() {
    return this.courses[this.courseId];
  }

  points() {
    return this.course().points;
  }

  segments() {
    return this.course().segments;
  }

  pushHistory(): void {
    this.history.push(JSON.stringify(this.points()));
    if (this.history.length > 50) this.history.shift();
  }

  undo(): boolean {
    if (!this.history.length) return false;
    this.course().points = JSON.parse(this.history.pop()!);
    this.selectedPointIndex = null;
    return true;
  }
}
