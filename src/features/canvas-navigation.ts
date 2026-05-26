import type { Viewport } from '../core/viewport';
import type { MapFitMode } from '../types';

const DRAG_THRESHOLD_PX = 5;

/** キャンバスのパン・ズーム（編集ツールと独立） */
export class CanvasNavigation {
  spaceHeld = false;
  panning = false;
  private panStart = { x: 0, y: 0 };
  private pointerStart = { sx: 0, sy: 0 };
  private maxDrag = 0;

  constructor(private viewport: Viewport) {}

  /** キャンバス上でポインタを押した（mouseup の誤判定防止用） */
  canvasPointerActive = false;

  /** 左ボタンでパンすべきか（Space 押下中 or 中クリック） */
  shouldPan(button: number): boolean {
    return button === 1 || (button === 0 && this.spaceHeld);
  }

  /** キャンバス mousedown 時に必ず呼ぶ */
  beginCanvasPointer(sx: number, sy: number): void {
    this.canvasPointerActive = true;
    this.pointerStart = { sx, sy };
    this.maxDrag = 0;
  }

  onPointerDown(sx: number, sy: number, button: number): boolean {
    if (this.shouldPan(button)) {
      this.panning = true;
      this.panStart = { x: sx - this.viewport.x, y: sy - this.viewport.y };
      return true;
    }
    return false;
  }

  onPointerMove(sx: number, sy: number): void {
    if (this.canvasPointerActive) {
      this.maxDrag = Math.max(
        this.maxDrag,
        Math.hypot(sx - this.pointerStart.sx, sy - this.pointerStart.sy),
      );
    }
    if (this.panning) {
      this.viewport.x = sx - this.panStart.x;
      this.viewport.y = sy - this.panStart.y;
    }
  }

  onPointerUp(): void {
    this.panning = false;
    this.canvasPointerActive = false;
  }

  /** キャンバス上のクリック（点追加など）として扱ってよいか */
  isCanvasClick(): boolean {
    return (
      this.canvasPointerActive &&
      !this.panning &&
      this.maxDrag < DRAG_THRESHOLD_PX
    );
  }

  handleWheel(
    e: WheelEvent,
    canvasRect: DOMRect,
  ): 'zoom' | 'pan' | null {
    const sx = e.clientX - canvasRect.left;
    const sy = e.clientY - canvasRect.top;

    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.002);
      this.viewport.zoomAt(sx, sy, factor);
      return 'zoom';
    }

    // トラックパッドの二本指スクロール → パン
    if (e.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
      this.viewport.x -= e.deltaX;
      this.viewport.y -= e.deltaY;
      return 'pan';
    }

    // マウスホイール → ズーム
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    this.viewport.zoomAt(sx, sy, factor);
    return 'zoom';
  }

  zoomInAtCenter(canvasW: number, canvasH: number): void {
    this.viewport.zoomAt(canvasW / 2, canvasH / 2, 1.25);
  }

  zoomOutAtCenter(canvasW: number, canvasH: number): void {
    this.viewport.zoomAt(canvasW / 2, canvasH / 2, 0.8);
  }

  fitImage(
    imgW: number,
    imgH: number,
    canvasW: number,
    canvasH: number,
    mode: MapFitMode = 'auto',
  ): void {
    this.viewport.fitImage(imgW, imgH, canvasW, canvasH, mode);
  }
}
