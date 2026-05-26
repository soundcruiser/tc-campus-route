import { getSegmentDef } from '../config';
import type { AppState } from '../core/app-state';
import type { SegmentId } from '../types';

type El = HTMLElement;

export interface SegmentPanelDeps {
  onPersist: () => void;
  onRedraw: () => void;
  onActiveSegmentChange: () => void;
  onRemoveSegment: (id: SegmentId) => void;
  onSegmentMetaChange: () => void;
}

/** フェーズタブとアクティブフェーズ編集カード */
export class SegmentPanel {
  constructor(
    private root: El,
    private state: AppState,
    private deps: SegmentPanelDeps,
  ) {}

  private q<T extends El>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  renderTabs(): void {
    const wrap = this.q<El>('#segmentTabs');
    wrap.innerHTML = '';
    for (const seg of this.state.segments()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'segment-tab' + (seg.id === this.state.activeSegmentId ? ' active' : '');
      btn.textContent = seg.name;
      btn.style.borderColor = seg.color;
      if (seg.id === this.state.activeSegmentId) {
        btn.style.color = '#fff';
        btn.style.backgroundColor = seg.color + 'cc';
      } else {
        btn.style.color = seg.color;
        btn.style.backgroundColor = 'transparent';
      }
      btn.addEventListener('click', () => {
        this.state.activeSegmentId = seg.id;
        this.deps.onActiveSegmentChange();
      });
      wrap.appendChild(btn);
    }
  }

  renderPracticeSelect(): void {
    const sel = this.q<HTMLSelectElement>('#practiceSegment');
    const cur = this.state.practiceSegmentId;
    sel.innerHTML = '';
    for (const seg of this.state.segments()) {
      const opt = document.createElement('option');
      opt.value = String(seg.id);
      opt.textContent = seg.name;
      sel.appendChild(opt);
    }
    sel.value = String(cur);
  }

  renderActiveEditor(): void {
    const wrap = this.q<El>('#activeSegmentEditor');
    if (!wrap) return;
    wrap.innerHTML = '';
    const seg = getSegmentDef(this.state.segments(), this.state.activeSegmentId);
    const pts = this.state.points();
    const canDelete = this.state.segments().length > 1;

    const card = document.createElement('div');
    card.className = 'active-segment-card';
    card.style.borderLeftColor = seg.color;

    const head = document.createElement('div');
    head.className = 'active-segment-head';

    const color = document.createElement('input');
    color.type = 'color';
    color.value = seg.color;
    color.title = '色';
    color.addEventListener('input', () => {
      seg.color = color.value;
      card.style.borderLeftColor = seg.color;
      this.deps.onSegmentMetaChange();
      this.deps.onRedraw();
    });
    color.addEventListener('change', () => this.deps.onPersist());

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'segment-name-input';
    name.value = seg.name;
    name.placeholder = 'フェーズ名';
    name.addEventListener('input', () => {
      seg.name = name.value;
      this.renderTabs();
      this.renderPracticeSelect();
      this.deps.onSegmentMetaChange();
      this.deps.onPersist();
    });

    head.appendChild(color);
    head.appendChild(name);

    if (canDelete) {
      const hasPoints = pts.some((p) => p.segmentId === seg.id);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn-icon';
      del.textContent = '×';
      del.title = hasPoints
        ? 'このフェーズに点があるため削除できません'
        : 'フェーズを削除';
      del.disabled = hasPoints;
      del.addEventListener('click', () => this.deps.onRemoveSegment(seg.id));
      head.appendChild(del);
    }

    const text = document.createElement('textarea');
    text.rows = 2;
    text.className = 'segment-route-text';
    text.placeholder = 'この区間のルート文言';
    text.value = seg.routeText;
    text.addEventListener('input', () => {
      seg.routeText = text.value;
      this.deps.onSegmentMetaChange();
      this.deps.onPersist();
    });

    card.appendChild(head);
    card.appendChild(text);
    wrap.appendChild(card);
  }

  /** 色変更時：タブだけ再生成せずスタイル更新したいが、現状はタブ再描画で十分 */
  refreshTabColors(): void {
    this.renderTabs();
  }
}
