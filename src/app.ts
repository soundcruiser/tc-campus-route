import { getSegmentDef } from './config';
import { AppState } from './core/app-state';
import { addSegment, MAX_SEGMENTS, removeSegment } from './core/segments';
import { Viewport } from './core/viewport';
import { CanvasNavigation } from './features/canvas-navigation';
import { RouteEditor } from './features/editor';
import {
  matchShortcut,
  type ShortcutAction,
} from './features/keyboard-shortcuts';
import { routePlayer } from './features/player';
import { CanvasRenderer } from './render/canvas-renderer';
import {
  exportJson,
  importJson,
  loadPersistedData,
  savePersistedData,
} from './storage/db';
import {
  loadCustomBackground,
  loadDefaultBackground,
  loadImage,
} from './services/background';
import { DomController } from './ui/dom-controller';
import { renderAppShell } from './ui/shell';
import type { EditTool } from './types';

export class CampusRouteApp {
  private state = new AppState();
  private viewport = new Viewport();
  private nav = new CanvasNavigation(this.viewport);
  private editor = new RouteEditor(this.state, this.viewport);
  private renderer!: CanvasRenderer;
  private dom!: DomController;
  private customBgDataUrl: string | null = null;
  private carPos: { x: number; y: number; heading: number } | null = null;

  async init(): Promise<void> {
    document.getElementById('app')!.innerHTML = renderAppShell();

    this.dom = new DomController(this.state);
    this.renderer = new CanvasRenderer(
      this.dom.canvas,
      this.viewport,
      this.state,
    );

    const data = await loadPersistedData();
    this.state.loadFromPersisted(data);
    this.customBgDataUrl = data.customBackground;

    this.dom.onPersist(() => void this.persist());
    this.dom.onRedraw(() => this.draw());
    this.dom.onRefitMap(() => this.zoomFit());
    this.dom.onSkipPopupCallback(() => {
      if (this.state.playing) routePlayer.skipCurrentWait(this.state);
    });

    this.dom.bindAll({
      onPlay: () => this.togglePlay(),
      onStop: () => this.stopPlay(),
      onNextSegment: () => {
        routePlayer.jumpToNextSegment(this.state);
        this.dom.syncUi('status');
      },
      onSplitSegment: () => {
        this.editor.splitSegmentFromSelected();
        this.dom.syncUi('chrome');
        this.draw();
        void this.persist();
      },
      onAddSegment: () => {
        try {
          const seg = addSegment(this.state.course());
          this.state.activeSegmentId = seg.id;
          this.dom.syncUi('chrome');
          this.draw();
          void this.persist();
        } catch {
          alert(`フェーズは最大${MAX_SEGMENTS}までです`);
        }
      },
      onRemoveSegment: (id) => {
        if (!removeSegment(this.state.course(), id)) {
          alert(
            '削除できません。最低1つのフェーズが必要です。また、点が残っているフェーズは削除できません。',
          );
          return;
        }
        this.state.clampSegmentSelection();
        this.dom.syncUi('chrome');
        this.draw();
        void this.persist();
      },
      onExport: () => this.exportData(),
      onImport: () => void this.importData(),
      onClear: () => this.clearCourse(),
      onUndo: () => this.undo(),
      onBgUpload: (f) => void this.uploadBackground(f),
      onBgReset: () => void this.resetBackground(),
      onEditTool: (tool) => this.editor.setTool(tool as EditTool),
      onZoomIn: () => this.zoomStep(true),
      onZoomOut: () => this.zoomStep(false),
      onZoomFit: () => this.zoomFit(),
    });

    routePlayer.setOnSegmentChange((segId) => {
      const seg = getSegmentDef(this.state.segments(), segId);
      this.dom.showToast(`${seg.name} に入りました`);
      this.dom.syncUi('status');
      this.dom.hidePopup();
    });

    this.setupCanvasEvents();
    this.setupKeyboardShortcuts();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    if (this.customBgDataUrl) {
      this.state.backgroundImage = await loadImage(this.customBgDataUrl);
      this.viewport.fitImage(
        this.state.backgroundImage.width,
        this.state.backgroundImage.height,
        this.dom.canvas.width,
        this.dom.canvas.height,
        this.state.settings.mapFit,
      );
    } else {
      await loadDefaultBackground(
        this.state,
        this.viewport,
        this.dom.canvas.width,
        this.dom.canvas.height,
      );
    }

    this.dom.syncUi('full');
    this.startLoop();
  }

  private canvasPoint(e: MouseEvent): { sx: number; sy: number; rect: DOMRect } {
    const rect = this.dom.canvas.getBoundingClientRect();
    return {
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
      rect,
    };
  }

  private setupCanvasEvents(): void {
    const canvas = this.dom.canvas;
    const wrap = this.dom.canvasWrap;

    let pointerEnded = false;

    const endPointer = (e: MouseEvent, onCanvas: boolean) => {
      if (pointerEnded) return;
      const active =
        this.nav.canvasPointerActive ||
        this.nav.panning ||
        this.editor.dragging !== null;
      if (!active) return;

      pointerEnded = true;
      const { sx, sy } = this.canvasPoint(e);

      if (
        onCanvas &&
        this.nav.isCanvasClick() &&
        this.state.appMode === 'edit' &&
        e.button === 0 &&
        !this.nav.spaceHeld
      ) {
        this.editor.tryAddPoint(sx, sy);
        this.dom.syncUi('points');
        void this.persist();
      }

      this.editor.handleMouseUp();
      this.nav.onPointerUp();
      wrap.classList.remove('is-panning', 'space-pan');
      this.draw();
    };

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.state.appMode !== 'edit') return;
      if (this.editor.handleContextMenu()) {
        this.dom.syncUi('points');
        this.draw();
        void this.persist();
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      pointerEnded = false;
      const { sx, sy } = this.canvasPoint(e);
      this.nav.beginCanvasPointer(sx, sy);

      if (this.nav.onPointerDown(sx, sy, e.button)) {
        wrap.classList.add('is-panning');
        if (this.nav.spaceHeld) wrap.classList.add('space-pan');
        e.preventDefault();
        return;
      }

      if (this.state.appMode !== 'edit') return;

      if (this.editor.handleMouseDown(sx, sy, e.button)) {
        this.dom.afterPointSelect();
        this.draw();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const { sx, sy } = this.canvasPoint(e);
      this.nav.onPointerMove(sx, sy);
      const edited = this.editor.handleMouseMove(sx, sy);
      if (this.nav.panning || edited) {
        this.dom.setZoomLabel(Math.round(this.viewport.scale * 100));
        this.draw();
      }
    });

    canvas.addEventListener('mouseup', (e) => endPointer(e, true));
    window.addEventListener('mouseup', (e) => endPointer(e, false));
    window.addEventListener('blur', () => {
      this.nav.spaceHeld = false;
      this.nav.onPointerUp();
      this.editor.handleMouseUp();
      wrap.classList.remove('is-panning', 'space-pan');
      pointerEnded = true;
    });

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (this.state.appMode === 'edit') {
        e.preventDefault();
        this.nav.spaceHeld = true;
        wrap.classList.add('space-pan');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code !== 'Space') return;
      this.nav.spaceHeld = false;
      wrap.classList.remove('space-pan');
      if (!this.nav.panning) wrap.classList.remove('is-panning');
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const { rect } = this.canvasPoint(e);
        this.nav.handleWheel(e, rect);
        this.dom.setZoomLabel(Math.round(this.viewport.scale * 100));
        this.draw();
      },
      { passive: false },
    );

  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      const action = matchShortcut(e);
      if (!action) return;

      if (action === 'togglePlay') {
        if (this.state.appMode === 'learn') {
          e.preventDefault();
          this.togglePlay();
        }
        return;
      }

      if (action === 'skipPopup') {
        if (this.dom.isPopupVisible()) {
          e.preventDefault();
          this.dom.skipPopup();
        }
        return;
      }

      e.preventDefault();
      this.handleShortcut(action);
    });
  }

  private handleShortcut(action: ShortcutAction): void {
    switch (action) {
      case 'toggleMode':
        this.dom.toggleAppMode();
        break;
      case 'modeEdit':
        this.dom.setAppMode('edit');
        break;
      case 'modeLearn':
        this.dom.setAppMode('learn');
        break;
      case 'courseA':
        this.dom.setCourse('A');
        break;
      case 'courseB':
        this.dom.setCourse('B');
        break;
      case 'courseC':
        this.dom.setCourse('C');
        break;
      case 'toolAdd':
        this.dom.setEditTool('add');
        break;
      case 'toolMove':
        this.dom.setEditTool('edit');
        break;
      case 'escape':
        if (this.dom.isShortcutHelpVisible()) {
          this.dom.closeShortcutHelp();
        } else if (this.dom.isPopupVisible()) {
          this.dom.skipPopup();
        } else if (this.state.playing) {
          this.stopPlay();
        }
        break;
      case 'zoomIn':
        this.zoomStep(true);
        break;
      case 'zoomOut':
        this.zoomStep(false);
        break;
      case 'zoomFit':
        this.zoomFit();
        break;
      case 'undo':
        if (this.state.appMode === 'edit') this.undo();
        break;
      case 'deletePoint':
        if (this.state.appMode !== 'edit') break;
        if (this.editor.deleteSelectedOrLastPoint()) {
          this.dom.syncUi('points');
          this.draw();
          void this.persist();
        }
        break;
      case 'segmentPrev':
        if (this.state.appMode === 'edit') this.dom.cycleSegmentTab(-1);
        break;
      case 'segmentNext':
        if (this.state.appMode === 'edit') this.dom.cycleSegmentTab(1);
        break;
      case 'toggleHelp':
        this.dom.toggleShortcutHelp();
        break;
      default:
        break;
    }
  }

  private zoomStep(zoomIn: boolean): void {
    const { width: W, height: H } = this.dom.canvas;
    if (zoomIn) this.nav.zoomInAtCenter(W, H);
    else this.nav.zoomOutAtCenter(W, H);
    this.dom.setZoomLabel(Math.round(this.viewport.scale * 100));
    this.draw();
  }

  private zoomFit(): void {
    const img = this.state.backgroundImage;
    if (!img) return;
    this.viewport.fitImage(
      img.width,
      img.height,
      this.dom.canvas.width,
      this.dom.canvas.height,
      this.state.settings.mapFit,
    );
    this.dom.setZoomLabel(Math.round(this.viewport.scale * 100));
    this.draw();
  }

  private resize(): void {
    this.renderer.resize();
    if (this.state.backgroundImage) {
      this.viewport.fitImage(
        this.state.backgroundImage.width,
        this.state.backgroundImage.height,
        this.dom.canvas.width,
        this.dom.canvas.height,
        this.state.settings.mapFit,
      );
    }
    this.dom.setZoomLabel(Math.round(this.viewport.scale * 100));
    this.draw();
  }

  private startLoop(): void {
    const tick = () => {
      const snap = routePlayer.tick(this.state);
      if (snap) {
        this.carPos = {
          x: snap.position.x,
          y: snap.position.y,
          heading: snap.heading,
        };
        if (snap.arrivedAt && this.state.playing) {
          const wp = snap.arrivedAt.waypoint;
          const waitMs = Math.max(0, (wp.waitSec ?? 0) * 1000);
          this.dom.showPopup(wp, snap.segmentId, {
            playback: true,
            autoCloseMs: waitMs > 0 ? waitMs : undefined,
          });
          const s = this.viewport.worldToScreen(wp.x, wp.y);
          this.dom.positionPopup(s.x, s.y);
        }
        const popupWp = this.dom.getPopupWaypoint();
        if (popupWp && this.dom.isPopupVisible()) {
          const s = this.viewport.worldToScreen(popupWp.x, popupWp.y);
          this.dom.positionPopup(s.x, s.y);
        }
        if (
          this.state.settings.cameraMode === 'follow' &&
          this.state.playing
        ) {
          this.viewport.follow(
            snap.position,
            this.dom.canvas.width,
            this.dom.canvas.height,
          );
          this.dom.setZoomLabel(Math.round(this.viewport.scale * 100));
        }
        this.dom.syncStatus();
      }
      this.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private draw(): void {
    this.renderer.draw(this.state.playing ? this.carPos : null);
  }

  private togglePlay(): void {
    if (this.state.playing) {
      this.stopPlay();
      return;
    }
    if (!routePlayer.start(this.state)) {
      alert(
        'ルートにポイントを2つ以上置いてください。\n発着点から順に打ち、区間が変わる地点で「選択点から次の区間へ」を使います。',
      );
      return;
    }
    this.dom.setPlayUi(true);
    this.dom.hidePopup();
  }

  private stopPlay(): void {
    routePlayer.stop(this.state);
    this.dom.setPlayUi(false);
  }

  private async persist(): Promise<void> {
    await savePersistedData(this.state.toPersisted(this.customBgDataUrl));
  }

  private async uploadBackground(file: File): Promise<void> {
    this.customBgDataUrl = await loadCustomBackground(
      this.state,
      this.viewport,
      file,
      this.dom.canvas.width,
      this.dom.canvas.height,
    );
    this.draw();
    await this.persist();
  }

  private async resetBackground(): Promise<void> {
    this.customBgDataUrl = null;
    await loadDefaultBackground(
      this.state,
      this.viewport,
      this.dom.canvas.width,
      this.dom.canvas.height,
    );
    this.draw();
    await this.persist();
  }

  private exportData(): void {
    void navigator.clipboard
      .writeText(exportJson(this.state.toPersisted(this.customBgDataUrl)))
      .then(() => alert('JSONをコピーしました'));
  }

  private async importData(): Promise<void> {
    const json = prompt('JSONを貼り付け:');
    if (!json) return;
    try {
      const data = importJson(json);
      this.state.loadFromPersisted(data);
      this.customBgDataUrl = data.customBackground;
      if (this.customBgDataUrl) {
        this.state.backgroundImage = await loadImage(this.customBgDataUrl);
        this.viewport.fitImage(
          this.state.backgroundImage.width,
          this.state.backgroundImage.height,
          this.dom.canvas.width,
          this.dom.canvas.height,
        );
      }
      this.dom.syncUi('full');
      this.draw();
      await this.persist();
    } catch {
      alert('形式が正しくありません');
    }
  }

  private clearCourse(): void {
    if (!confirm('このコースのルートをすべて削除しますか？')) return;
    this.state.pushHistory();
    this.state.course().points = [];
    this.state.selectedPointIndex = null;
    this.dom.syncUi('chrome');
    this.draw();
    void this.persist();
  }

  private undo(): void {
    if (this.state.undo()) {
      this.dom.syncUi('chrome');
      this.draw();
      void this.persist();
    }
  }
}
