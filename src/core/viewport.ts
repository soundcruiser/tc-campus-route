import type { MapFitMode } from '../types';
import type { Vec2 } from '../types';

/** 画面座標とワールド座標の変換・パンズーム */
export class Viewport {
  x = 0;
  y = 0;
  scale = 1;
  /** 直近の fit で余白が出ているか（ぼかし背景用） */
  hasLetterbox = false;

  screenToWorld(sx: number, sy: number): Vec2 {
    return {
      x: (sx - this.x) / this.scale,
      y: (sy - this.y) / this.scale,
    };
  }

  worldToScreen(wx: number, wy: number): Vec2 {
    return {
      x: wx * this.scale + this.x,
      y: wy * this.scale + this.y,
    };
  }

  resolveMapFit(
    imgW: number,
    imgH: number,
    canvasW: number,
    canvasH: number,
    mode: MapFitMode,
  ): Exclude<MapFitMode, 'auto'> {
    if (mode !== 'auto') return mode;
    const imgAspect = imgW / imgH;
    const viewAspect = canvasW / canvasH;
    // 画像の方が縦長 → 高さ優先で大きく見せる
    if (imgAspect < viewAspect * 0.92) return 'fill-height';
    return 'contain';
  }

  /** 背景画像をキャンバスにフィット */
  fitImage(
    imgW: number,
    imgH: number,
    canvasW: number,
    canvasH: number,
    mode: MapFitMode = 'auto',
    padding = 0.98,
  ): void {
    const fit = this.resolveMapFit(imgW, imgH, canvasW, canvasH, mode);
    this.hasLetterbox = false;

    if (fit === 'cover') {
      this.scale = Math.max(canvasW / imgW, canvasH / imgH) * padding;
      this.x = (canvasW - imgW * this.scale) / 2;
      this.y = (canvasH - imgH * this.scale) / 2;
      return;
    }

    if (fit === 'fill-height') {
      this.scale = (canvasH / imgH) * padding;
      this.x = (canvasW - imgW * this.scale) / 2;
      this.y = (canvasH - imgH * this.scale) / 2;
      const sideGap = canvasW - imgW * this.scale;
      if (sideGap > 4) this.hasLetterbox = true;
      return;
    }

    // contain
    this.scale = Math.min(canvasW / imgW, canvasH / imgH) * padding;
    this.x = (canvasW - imgW * this.scale) / 2;
    this.y = (canvasH - imgH * this.scale) / 2;
    const gapX = canvasW - imgW * this.scale;
    const gapY = canvasH - imgH * this.scale;
    if (gapX > 4 || gapY > 4) this.hasLetterbox = true;
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const newScale = Math.max(0.15, Math.min(10, this.scale * factor));
    this.x = sx - (sx - this.x) * (newScale / this.scale);
    this.y = sy - (sy - this.y) * (newScale / this.scale);
    this.scale = newScale;
    this.hasLetterbox = false;
  }

  /** 追従カメラ（スムーズ） */
  follow(target: Vec2, canvasW: number, canvasH: number, lerp = 0.12): void {
    const targetX = canvasW / 2 - target.x * this.scale;
    const targetY = canvasH / 2 - target.y * this.scale;
    this.x += (targetX - this.x) * lerp;
    this.y += (targetY - this.y) * lerp;
  }
}
