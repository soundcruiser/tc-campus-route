import { COURSES, CHALLENGE_BY_ID, getSegmentDef } from '../config';
import type { AppState } from '../core/app-state';
import type { AppMode, CourseId, EditTool, SegmentId, Waypoint } from '../types';
import { ChallengePopup } from './challenge-popup';
import { PointListView } from './point-list-view';
import { SegmentPanel } from './segment-panel';
import type { UiSyncScope } from './ui-scopes';

type El = HTMLElement;

export class DomController {
  readonly root: El;
  readonly canvas: HTMLCanvasElement;
  readonly canvasWrap: El;

  private persistCallback: (() => void) | null = null;
  private redrawCallback: (() => void) | null = null;
  private refitMapCallback: (() => void) | null = null;
  private onEditToolCallback: ((tool: string) => void) | null = null;

  private readonly pointList: PointListView;
  private readonly segmentPanel: SegmentPanel;
  private readonly popup: ChallengePopup;

  constructor(private state: AppState) {
    const app = document.getElementById('app')!;
    this.root = app;
    this.canvas = app.querySelector('#routeCanvas') as HTMLCanvasElement;
    this.canvasWrap = app.querySelector('#canvasWrap') as El;

    this.pointList = new PointListView(this.q('#pointList'), state, {
      onRedraw: () => this.redrawCallback?.(),
      onPersist: () => this.persistCallback?.(),
      onChromeChange: () => this.syncUi('chrome'),
    });

    this.segmentPanel = new SegmentPanel(this.root, state, {
      onPersist: () => this.persistCallback?.(),
      onRedraw: () => this.redrawCallback?.(),
      onActiveSegmentChange: () => this.onActiveSegmentChanged(),
      onRemoveSegment: (id) => this.onRemoveSegment?.(id),
      onSegmentMetaChange: () => {
        this.segmentPanel.refreshTabColors();
        this.syncStatus();
        this.updateSegmentBand();
      },
    });

    this.popup = new ChallengePopup(this.root, this.canvasWrap, state);
  }

  private onRemoveSegment: ((id: SegmentId) => void) | null = null;

  onPersist(cb: () => void): void {
    this.persistCallback = cb;
  }

  onRedraw(cb: () => void): void {
    this.redrawCallback = cb;
  }

  onRefitMap(cb: () => void): void {
    this.refitMapCallback = cb;
  }

  onSkipPopupCallback(cb: () => void): void {
    this.popup.setOnSkip(cb);
  }

  getPopupWaypoint(): Waypoint | null {
    return this.popup.getWaypoint();
  }

  private refitMap(): void {
    this.refitMapCallback?.();
  }

  bindAll(handlers: {
    onPlay: () => void;
    onStop: () => void;
    onNextSegment: () => void;
    onSplitSegment: () => void;
    onAddSegment: () => void;
    onRemoveSegment: (id: SegmentId) => void;
    onExport: () => void;
    onImport: () => void;
    onUndo: () => void;
    onClear: () => void;
    onBgUpload: (file: File) => void;
    onBgReset: () => void;
    onEditTool: (tool: string) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomFit: () => void;
  }): void {
    this.onRemoveSegment = handlers.onRemoveSegment;
    this.onEditToolCallback = handlers.onEditTool;
    this.bindCourseTabs();
    this.bindModeSwitch();
    this.bindEditTools();
    this.bindSettings();
    this.bindPointListScope();
    this.bindPointListToolbar();
    this.bindLearn(handlers);
    this.bindData(handlers);
    this.bindBackground(handlers);
    this.q('#btnSplitSegment').addEventListener('click', handlers.onSplitSegment);
    this.q('#btnAddSegment').addEventListener('click', handlers.onAddSegment);
    this.q('#btnZoomIn').addEventListener('click', handlers.onZoomIn);
    this.q('#btnZoomOut').addEventListener('click', handlers.onZoomOut);
    this.q('#btnZoomFit').addEventListener('click', handlers.onZoomFit);
    this.popup.bind('#popupClose', '#popupSkip');
    this.q('#btnShortcutHelp').addEventListener('click', () =>
      this.toggleShortcutHelp(),
    );
    this.q('#shortcutHelpClose').addEventListener('click', () =>
      this.closeShortcutHelp(),
    );
    this.q('#shortcutHelp').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeShortcutHelp();
    });
  }

  private q<T extends El>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  /**
   * UI 反映の範囲
   * - full: 設定フォーム含む全体（インポート・コース切替・初期化）
   * - chrome: フェーズタブ・編集カード・一覧パネル（点の構造変更）
   * - points: ポイント一覧と件数のみ
   * - status: ヘッダー・帯・再生ボタン表示のみ
   */
  syncUi(scope: UiSyncScope = 'full'): void {
    if (scope === 'full') this.syncSettingsForm();
    if (scope === 'full' || scope === 'chrome') {
      this.segmentPanel.renderTabs();
      this.segmentPanel.renderActiveEditor();
      this.segmentPanel.renderPracticeSelect();
      this.syncPointListScopeUi();
      this.syncPointListPanelUi();
    }
    if (scope === 'full' || scope === 'chrome' || scope === 'points') {
      this.pointList.render();
      this.updatePointsStat();
    }
    if (scope === 'full' || scope === 'chrome' || scope === 'status') {
      this.syncStatus();
      this.setPlayUi(this.state.playing);
    }
  }

  private syncSettingsForm(): void {
    const s = this.state.settings;
    this.q<HTMLInputElement>('#trailDuration').value = String(s.trailDurationSec);
    this.q<HTMLSelectElement>('#mapFit').value = s.mapFit;
    this.q<HTMLSelectElement>('#baseRouteDisplay').value = s.baseRouteDisplay;
    this.q<HTMLSelectElement>('#cameraMode').value = s.cameraMode;
    this.q<HTMLSelectElement>('#playbackMode').value = s.playbackMode;
    this.q<HTMLInputElement>('#animSpeed').value = String(s.animSpeed);
    this.q('#speedLabel').textContent = s.animSpeed.toFixed(1);
  }

  private bindCourseTabs(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setCourse(btn.dataset.course as CourseId);
      });
    });
  }

  private bindModeSwitch(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.mode-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setAppMode(btn.dataset.appMode as AppMode);
      });
    });
  }

  private bindEditTools(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setEditTool(btn.dataset.tool as EditTool);
      });
    });
  }

  setCourse(id: CourseId): void {
    if (this.state.courseId === id) return;
    this.state.courseId = id;
    this.state.selectedPointIndex = null;
    this.state.history = [];
    this.root.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', (t as HTMLButtonElement).dataset.course === id);
    });
    this.syncUi('full');
    this.redrawCallback?.();
    this.persistCallback?.();
  }

  setAppMode(mode: AppMode): void {
    if (this.state.appMode === mode) return;
    this.state.appMode = mode;
    this.root.querySelectorAll<HTMLButtonElement>('.mode-chip').forEach((m) => {
      m.classList.toggle('active', m.dataset.appMode === mode);
    });
    this.root.classList.toggle('learn-mode', mode === 'learn');
    const displayDetails = this.q<HTMLDetailsElement>('#detailsDisplay');
    if (displayDetails) displayDetails.open = mode === 'learn';
    this.syncUi('chrome');
    this.redrawCallback?.();
  }

  toggleAppMode(): void {
    this.setAppMode(this.state.appMode === 'edit' ? 'learn' : 'edit');
  }

  setEditTool(tool: EditTool): void {
    if (this.state.appMode !== 'edit') return;
    this.state.editTool = tool;
    this.root.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    this.canvasWrap.className = 'canvas-wrap tool-' + tool;
    this.onEditToolCallback?.(tool);
    this.redrawCallback?.();
  }

  cycleSegmentTab(delta: 1 | -1): void {
    const segs = this.state.segments();
    if (!segs.length) return;
    const ids = segs.map((s) => s.id);
    const idx = ids.indexOf(this.state.activeSegmentId);
    const next = (idx + delta + ids.length) % ids.length;
    this.state.activeSegmentId = ids[next];
    this.onActiveSegmentChanged();
  }

  afterPointSelect(): void {
    const i = this.state.selectedPointIndex;
    if (i !== null) {
      const segId = this.state.points()[i].segmentId;
      if (segId !== this.state.activeSegmentId) {
        this.state.activeSegmentId = segId;
        this.onActiveSegmentChanged(false);
        return;
      }
    }
    if (i !== null) {
      this.pointList.openIndex(i);
      this.pointList.requestScrollToSelection();
    }
    this.syncUi('points');
    this.redrawCallback?.();
  }

  private onActiveSegmentChanged(redraw = true): void {
    this.syncUi('chrome');
    if (redraw) this.redrawCallback?.();
  }

  isPopupVisible(): boolean {
    return this.popup.isVisible();
  }

  toggleShortcutHelp(): void {
    this.q<El>('#shortcutHelp').classList.toggle('hidden');
  }

  closeShortcutHelp(): void {
    this.q('#shortcutHelp').classList.add('hidden');
  }

  isShortcutHelpVisible(): boolean {
    return !this.q('#shortcutHelp').classList.contains('hidden');
  }

  private bindPointListScope(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.scope-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const scope = btn.dataset.scope as 'phase' | 'all';
        if (this.state.settings.pointListScope === scope) return;
        this.state.settings.pointListScope = scope;
        this.syncPointListScopeUi();
        this.syncUi('points');
        this.persistCallback?.();
      });
    });
  }

  private syncPointListScopeUi(): void {
    const scope = this.state.settings.pointListScope;
    this.root.querySelectorAll<HTMLButtonElement>('.scope-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.scope === scope);
    });
  }

  private bindPointListToolbar(): void {
    this.q('#btnTogglePointList').addEventListener('click', () => {
      this.state.settings.pointListPanelCollapsed =
        !this.state.settings.pointListPanelCollapsed;
      this.syncPointListPanelUi();
      this.persistCallback?.();
    });
    this.q('#btnCollapseAllPoints').addEventListener('click', () => {
      this.pointList.collapseAll();
    });
    this.q('#btnExpandAllPoints').addEventListener('click', () => {
      this.pointList.expandAll();
    });
  }

  private syncPointListPanelUi(): void {
    const collapsed = this.state.settings.pointListPanelCollapsed;
    this.q<El>('#pointListBody').classList.toggle('hidden', collapsed);
    this.q('#btnTogglePointList').textContent = collapsed
      ? '一覧を開く'
      : '一覧をたたむ';
    this.q<El>('.point-list-toolbar').classList.toggle(
      'point-list-toolbar--collapsed',
      collapsed,
    );
  }

  private bindSettings(): void {
    this.q<HTMLInputElement>('#trailDuration').addEventListener('input', (e) => {
      this.state.settings.trailDurationSec = Number(
        (e.target as HTMLInputElement).value,
      );
      this.persistCallback?.();
    });
    this.q<HTMLSelectElement>('#mapFit').addEventListener('change', (e) => {
      this.state.settings.mapFit = (e.target as HTMLSelectElement)
        .value as typeof this.state.settings.mapFit;
      this.refitMap();
      this.persistCallback?.();
    });
    this.q<HTMLSelectElement>('#baseRouteDisplay').addEventListener('change', (e) => {
      this.state.settings.baseRouteDisplay = (e.target as HTMLSelectElement)
        .value as typeof this.state.settings.baseRouteDisplay;
      this.redrawCallback?.();
      this.persistCallback?.();
    });
    this.q<HTMLSelectElement>('#cameraMode').addEventListener('change', (e) => {
      this.state.settings.cameraMode = (e.target as HTMLSelectElement)
        .value as typeof this.state.settings.cameraMode;
      this.persistCallback?.();
    });
    const speed = this.q<HTMLInputElement>('#animSpeed');
    speed.addEventListener('input', () => {
      const v = Math.min(5, Math.max(0.2, Number(speed.value)));
      this.state.settings.animSpeed = v;
      this.q('#speedLabel').textContent = v.toFixed(1);
      this.updateSpeedStatus();
      this.persistCallback?.();
    });
  }

  private bindLearn(h: {
    onPlay: () => void;
    onStop: () => void;
    onNextSegment: () => void;
  }): void {
    this.q('#practiceSegment').addEventListener('change', (e) => {
      this.state.practiceSegmentId = Number((e.target as HTMLSelectElement).value);
      this.syncUi('status');
      this.redrawCallback?.();
    });
    this.q('#playbackMode').addEventListener('change', (e) => {
      this.state.settings.playbackMode = (e.target as HTMLSelectElement)
        .value as typeof this.state.settings.playbackMode;
      this.persistCallback?.();
    });
    this.q('#btnPlay').addEventListener('click', h.onPlay);
    this.q('#btnStop').addEventListener('click', h.onStop);
    this.q('#btnNextSegment').addEventListener('click', h.onNextSegment);
  }

  private bindData(h: {
    onExport: () => void;
    onImport: () => void;
    onUndo: () => void;
    onClear: () => void;
  }): void {
    this.q('#btnExport').addEventListener('click', h.onExport);
    this.q('#btnImport').addEventListener('click', h.onImport);
    this.q('#btnUndo').addEventListener('click', h.onUndo);
    this.q('#btnClear').addEventListener('click', h.onClear);
  }

  private bindBackground(h: {
    onBgUpload: (file: File) => void;
    onBgReset: () => void;
  }): void {
    const input = this.q<HTMLInputElement>('#bgUpload');
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) h.onBgUpload(file);
      input.value = '';
    });
    this.q('#bgReset').addEventListener('click', h.onBgReset);
  }

  private updatePointsStat(): void {
    const pts = this.state.points();
    const activeId = this.state.activeSegmentId;
    const phaseCount = pts.filter((p) => p.segmentId === activeId).length;
    this.q('#statPoints').textContent = `${phaseCount} / ${pts.length}`;
  }

  updateSegmentBand(): void {
    const segId = this.state.playing
      ? this.state.currentSegmentId
      : this.state.appMode === 'learn'
        ? this.state.practiceSegmentId
        : this.state.activeSegmentId;
    const seg = getSegmentDef(this.state.segments(), segId);
    const band = this.q<El>('#segmentBand');
    band.style.borderColor = seg.color;
    band.style.backgroundColor = seg.color + '22';
    this.q('#segmentBandText').textContent =
      seg.routeText.trim() || '（文言はサイドバーで入力）';
  }

  syncStatus(): void {
    const course = COURSES[this.state.courseId];
    const segId = this.state.playing
      ? this.state.currentSegmentId
      : this.state.appMode === 'learn'
        ? this.state.practiceSegmentId
        : this.state.activeSegmentId;
    const seg = getSegmentDef(this.state.segments(), segId);

    this.q('#statusCourse').textContent = course.name;
    this.q('#statusSegment').textContent = seg.name;

    const pts = this.state.points();
    let nextText = '—';
    const nextInSeg = pts.find(
      (p) => p.segmentId === segId && p.challengeId !== 'none',
    );
    if (nextInSeg) {
      nextText = CHALLENGE_BY_ID[nextInSeg.challengeId].label;
    }
    const nextLabel = pts.find((p) => p.label && p.segmentId === segId);
    if (nextLabel?.label) nextText = nextLabel.label;
    this.q('#statusNext').textContent = `次: ${nextText}`;
    this.updateSpeedStatus();
    this.updateSegmentBand();
  }

  private updateSpeedStatus(): void {
    const el = this.q<El>('#statusSpeed');
    const sep = this.q<El>('#statusSpeedSep');
    if (!this.state.playing) {
      el.classList.add('hidden');
      sep.classList.add('hidden');
      return;
    }
    const v = this.state.settings.animSpeed;
    el.textContent = `×${v.toFixed(1)}`;
    el.classList.remove('hidden');
    sep.classList.remove('hidden');
  }

  setZoomLabel(pct: number): void {
    const text = `${pct}%`;
    this.root.querySelectorAll<HTMLElement>('.stat-zoom').forEach((el) => {
      el.textContent = text;
    });
  }

  setPlayUi(playing: boolean): void {
    this.q('#btnPlay').classList.toggle('hidden', playing);
    this.q('#btnStop').classList.toggle('hidden', !playing);
  }

  showToast(msg: string, ms = 2800): void {
    const el = this.q<El>('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), ms);
  }

  showPopup(
    wp: Waypoint,
    segmentId: SegmentId,
    options?: { autoCloseMs?: number; playback?: boolean },
  ): void {
    this.popup.show(wp, segmentId, options);
  }

  positionPopup(screenX: number, screenY: number): void {
    this.popup.position(screenX, screenY);
  }

  skipPopup(): void {
    this.popup.skip();
  }

  hidePopup(): void {
    this.popup.hide();
  }
}
