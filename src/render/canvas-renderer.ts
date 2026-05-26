import { CHALLENGE_BY_ID, COURSES, getSegmentDef, isImportantWaypoint } from '../config';
import { buildSplinePath } from '../math/spline';
import { computeSegmentRanges } from '../math/route-utils';
import type { AppState } from '../core/app-state';
import type { Viewport } from '../core/viewport';
import type { SegmentId, Waypoint } from '../types';

export class CanvasRenderer {
  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: Viewport,
    private state: AppState,
  ) {}

  private get ctx(): CanvasRenderingContext2D {
    return this.canvas.getContext('2d')!;
  }

  resize(): void {
    const parent = this.canvas.parentElement!;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
  }

  draw(
    carPosition?: { x: number; y: number; heading: number } | null,
  ): void {
    const { width: W, height: H } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    const courseId = this.state.courseId;
    const pts = this.state.points();
    const segments = this.state.segments();
    const displaySeg = this.state.playing
      ? this.state.currentSegmentId
      : this.state.appMode === 'learn'
        ? this.state.practiceSegmentId
        : this.state.activeSegmentId;

    ctx.save();
    ctx.translate(this.viewport.x, this.viewport.y);
    ctx.scale(this.viewport.scale, this.viewport.scale);

    this.drawBackground(W, H);

    if (pts.length >= 2) {
      this.drawSegmentedRoute(pts, segments, displaySeg);
    }

    if (this.state.appMode === 'learn' && this.state.trail.length >= 2) {
      this.drawFadingTrail();
    }

    if (carPosition && this.state.playing) {
      const color = getSegmentDef(segments, this.state.currentSegmentId).color;
      this.drawCar(carPosition, color, carPosition.heading);
    }

    this.drawWaypoints(pts, displaySeg);
    ctx.restore();
    this.drawHud(W, courseId, displaySeg);
  }

  private drawSegmentedRoute(
    pts: Waypoint[],
    segments: import('../types').SegmentDef[],
    displaySeg: SegmentId,
  ): void {
    const mode = this.state.settings.baseRouteDisplay;
    if (mode === 'off' && this.state.appMode === 'learn') return;

    const ranges = computeSegmentRanges(pts);
    const isLearn = this.state.appMode === 'learn';

    for (let ri = 0; ri < ranges.length; ri++) {
      const range = ranges[ri];
      // フェーズ境界の点を前後で共有し、色の切り替わりで線が途切れないようにする
      const sliceFrom = ri === 0 ? range.startIndex : ranges[ri - 1].endIndex;
      const slice = pts.slice(sliceFrom, range.endIndex + 1);
      if (slice.length < 2) continue;

      const def = getSegmentDef(segments, range.segmentId);
      let alpha = 0.85;
      if (isLearn && mode === 'current') {
        alpha = range.segmentId === displaySeg ? 0.9 : 0;
      } else if (isLearn && mode === 'dim') {
        alpha = range.segmentId === displaySeg ? 0.75 : 0.15;
      } else {
        // 編集: 押したフェーズタブの区間だけ、そのフェーズ色で表示
        alpha = range.segmentId === this.state.activeSegmentId ? 1 : 0;
      }

      if (alpha <= 0) continue;

      const spline = buildSplinePath(slice, 16);
      const ctx = this.ctx;
      const scale = this.viewport.scale;
      const isActive =
        range.segmentId === displaySeg ||
        range.segmentId === this.state.activeSegmentId;
      ctx.save();
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = alpha;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = (isActive ? 3.5 : 2.5) / scale;
      ctx.beginPath();
      ctx.moveTo(spline[0].x, spline[0].y);
      for (let i = 1; i < spline.length; i++) {
        ctx.lineTo(spline[i].x, spline[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBackground(W: number, H: number): void {
    const img = this.state.backgroundImage;
    const ctx = this.ctx;
    if (img) {
      const w = img.width;
      const h = img.height;
      const scale = this.viewport.scale;
      const worldW = W / scale;
      const worldH = H / scale;
      const worldX = -this.viewport.x / scale;
      const worldY = -this.viewport.y / scale;

      if (this.viewport.hasLetterbox) {
        const cover = Math.max(worldW / w, worldH / h);
        const sw = w * cover;
        const sh = h * cover;
        ctx.globalAlpha = 0.42;
        ctx.drawImage(
          img,
          worldX + (worldW - sw) / 2,
          worldY + (worldH - sh) / 2,
          sw,
          sh,
        );
      }

      ctx.globalAlpha = 0.94;
      ctx.drawImage(img, 0, 0);
      ctx.globalAlpha = 1;
    } else {
      const w = W / this.viewport.scale;
      const h = H / this.viewport.scale;
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawFadingTrail(): void {
    const ctx = this.ctx;
    const scale = this.viewport.scale;
    const now = Date.now();
    const maxAge = this.state.settings.trailDurationSec * 1000;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4 / scale;

    const samples = this.state.trail;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      const age = (now - b.t) / maxAge;
      ctx.globalAlpha = Math.max(0, 1 - age) * 0.9;
      ctx.strokeStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCar(
    pos: { x: number; y: number },
    color: string,
    heading: number,
  ): void {
    const ctx = this.ctx;
    const s = this.viewport.scale;
    const { x: cx, y: cy } = pos;
    const u = 1 / s;

    ctx.save();
    ctx.translate(cx, cy);
    // 車形は上向き（-Y）で描き、進行方向へ回転
    ctx.rotate(heading + Math.PI / 2);

    ctx.shadowColor = '#00000088';
    ctx.shadowBlur = 8 * u;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // ボディ
    ctx.fillStyle = '#f5f5fa';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2 * u;
    ctx.beginPath();
    ctx.moveTo(0, -11 * u);
    ctx.lineTo(7 * u, -4 * u);
    ctx.lineTo(7 * u, 7 * u);
    ctx.lineTo(-7 * u, 7 * u);
    ctx.lineTo(-7 * u, -4 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // フロントガラス
    ctx.fillStyle = color + '55';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 * u;
    ctx.beginPath();
    ctx.moveTo(0, -9 * u);
    ctx.lineTo(4.5 * u, -4 * u);
    ctx.lineTo(-4.5 * u, -4 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // タイヤ（4隅）
    ctx.fillStyle = '#2a2a38';
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.8 * u;
    for (const [tx, ty] of [
      [-5.5, -2],
      [5.5, -2],
      [-5.5, 5],
      [5.5, 5],
    ] as const) {
      const tw = 3.6 * u;
      const th = 5 * u;
      const tx0 = tx * u - tw / 2;
      const ty0 = ty * u - th / 2;
      ctx.fillRect(tx0, ty0, tw, th);
      ctx.strokeRect(tx0, ty0, tw, th);
    }

    ctx.restore();
  }

  private drawWaypoints(pts: Waypoint[], displaySeg: SegmentId): void {
    const ctx = this.ctx;
    const s = this.viewport.scale;
    const isLearn = this.state.appMode === 'learn';

    pts.forEach((p, i) => {
      if (this.state.playing && !isImportantWaypoint(p)) return;

      const isBoundary =
        i > 0 && pts[i - 1].segmentId !== p.segmentId;
      const inActiveSeg =
        this.state.appMode === 'edit'
          ? p.segmentId === this.state.activeSegmentId
          : p.segmentId === displaySeg;
      const alpha = inActiveSeg ? 1 : isLearn ? 0.2 : 0.35;
      if (alpha < 0.05) return;

      const isFirst = i === 0;
      const isLast = i === pts.length - 1;
      const isSel = i === this.state.selectedPointIndex;
      const playbackImportant = this.state.playing;
      const r =
        (playbackImportant ? 7 : isFirst || isLast ? 8 : 5) / s;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      const segColor = getSegmentDef(this.state.segments(), p.segmentId).color;
      ctx.fillStyle = playbackImportant
        ? '#fff'
        : isSel
          ? '#fff'
          : isFirst || isLast
            ? '#f0a500'
            : segColor;
      ctx.fill();
      ctx.strokeStyle = playbackImportant ? '#f0a500' : '#fff';
      ctx.lineWidth = (playbackImportant || isSel ? 2.5 : 1.5) / s;
      ctx.stroke();

      if (isBoundary && !playbackImportant) {
        const def = getSegmentDef(this.state.segments(), p.segmentId);
        ctx.fillStyle = def.color;
        ctx.font = `bold ${10 / s}px "Noto Sans JP", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${def.name}開始`, p.x, p.y - r - 8 / s);
      }

      if (p.challengeId !== 'none') {
        const ch = CHALLENGE_BY_ID[p.challengeId];
        ctx.font = `${14 / s}px sans-serif`;
        ctx.fillText(ch.icon, p.x + 14 / s, p.y + 6 / s);
      }

      if (!isLearn) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${8 / s}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), p.x, p.y);
      }
      ctx.restore();
    });
  }

  private drawHud(W: number, courseId: keyof typeof COURSES, segId: SegmentId): void {
    const ctx = this.ctx;
    const course = COURSES[courseId];
    const seg = getSegmentDef(this.state.segments(), segId);
    ctx.save();
    ctx.fillStyle = course.color + 'dd';
    this.roundRect(W - 100, 10, 90, 32, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(course.name, W - 55, 20);
    ctx.font = '10px "Noto Sans JP", sans-serif';
    ctx.fillText(seg.name, W - 55, 32);
    ctx.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
