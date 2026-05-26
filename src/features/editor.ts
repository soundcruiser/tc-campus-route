import { createEmptyWaypoint } from '../config';
import type { AppState } from '../core/app-state';
import { findOrCreateNextSegment } from '../core/segments';
import type { Viewport } from '../core/viewport';
import type { EditTool } from '../types';

export class RouteEditor {
  dragging: number | null = null;

  constructor(
    private state: AppState,
    private viewport: Viewport,
  ) {}

  tryAddPoint(sx: number, sy: number): void {
    if (this.state.appMode !== 'edit' || this.state.editTool !== 'add') return;
    const w = this.viewport.screenToWorld(sx, sy);
    const pts = this.state.points();
    this.state.pushHistory();
    pts.push(
      createEmptyWaypoint(w.x, w.y, this.state.activeSegmentId),
    );
  }

  handleContextMenu(): boolean {
    return this.deleteSelectedOrLastPoint();
  }

  /** 選択点を削除。未選択なら最後の点を削除 */
  deleteSelectedOrLastPoint(): boolean {
    const pts = this.state.points();
    if (!pts.length) return false;
    this.state.pushHistory();
    const i = this.state.selectedPointIndex;
    if (i !== null && i >= 0 && i < pts.length) {
      pts.splice(i, 1);
      this.state.selectedPointIndex = null;
    } else {
      pts.pop();
      this.state.selectedPointIndex = null;
    }
    return true;
  }

  handleMouseDown(sx: number, sy: number, button: number): boolean {
    if (this.state.appMode !== 'edit' || button !== 0) return false;

    if (this.state.editTool === 'edit') {
      const w = this.viewport.screenToWorld(sx, sy);
      const pts = this.state.points();
      let closest: number | null = null;
      let minD = 20 / this.viewport.scale;
      pts.forEach((p, i) => {
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        if (d < minD) {
          minD = d;
          closest = i;
        }
      });
      this.state.selectedPointIndex = closest;
      if (closest !== null) {
        const segId = pts[closest].segmentId;
        if (segId !== this.state.activeSegmentId) {
          this.state.activeSegmentId = segId;
        }
        this.dragging = closest;
      }
      return true;
    }
    return false;
  }

  handleMouseMove(sx: number, sy: number): boolean {
    if (this.dragging === null) return false;
    const w = this.viewport.screenToWorld(sx, sy);
    const pt = this.state.points()[this.dragging];
    pt.x = w.x;
    pt.y = w.y;
    return true;
  }

  handleMouseUp(): void {
    if (this.dragging !== null) {
      this.state.pushHistory();
      this.dragging = null;
    }
  }

  setTool(tool: EditTool): void {
    this.state.editTool = tool;
    this.dragging = null;
  }

  /** 選択点から次の区間へ（この点の segmentId を区切りに） */
  splitSegmentFromSelected(): void {
    const i = this.state.selectedPointIndex;
    if (i === null) return;
    const pts = this.state.points();
    const orig = pts[i].segmentId;
    const nextSeg = findOrCreateNextSegment(this.state.course(), orig);
    this.state.pushHistory();
    for (let j = i; j < pts.length; j++) {
      if (j > i && pts[j].segmentId !== orig) break;
      pts[j].segmentId = nextSeg.id;
    }
    this.state.activeSegmentId = nextSeg.id;
  }
}
