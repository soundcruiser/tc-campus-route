import {
  ACTION_BY_ID,
  ACTIONS,
  CHALLENGES,
  CHALLENGE_BY_ID,
  isImportantWaypoint,
} from '../config';
import type { AppState } from '../core/app-state';
import { DEFAULT_TRAVEL_SEC } from '../math/playback-timeline';
import type { Waypoint } from '../types';

type El = HTMLElement;

export interface PointListDeps {
  onRedraw: () => void;
  onPersist: () => void;
  /** 点のフェーズ変更など、一覧以外のサイドバーも更新が必要なとき */
  onChromeChange: () => void;
}

/** ポイント一覧（開閉状態は View 内で保持） */
export class PointListView {
  private pointCardsOpen = new Set<number>();
  private suppressPointCardToggle = false;
  private scrollOnNextRender = false;

  constructor(
    private listEl: El,
    private state: AppState,
    private deps: PointListDeps,
  ) {}

  requestScrollToSelection(): void {
    this.scrollOnNextRender = true;
  }

  openIndex(index: number): void {
    this.pointCardsOpen.add(index);
  }

  collapseAll(): void {
    const sel = this.state.selectedPointIndex;
    const cards = this.listEl.querySelectorAll<HTMLDetailsElement>(
      'details.point-card',
    );
    this.suppressPointCardToggle = true;
    try {
      this.pointCardsOpen.clear();
      if (sel !== null) this.pointCardsOpen.add(sel);
      cards.forEach((d) => {
        const idx = Number(d.dataset.pointIndex);
        d.open = sel !== null && idx === sel;
      });
    } finally {
      this.suppressPointCardToggle = false;
    }
  }

  expandAll(): void {
    const cards = this.listEl.querySelectorAll<HTMLDetailsElement>(
      'details.point-card',
    );
    this.suppressPointCardToggle = true;
    try {
      cards.forEach((d) => {
        const idx = Number(d.dataset.pointIndex);
        this.pointCardsOpen.add(idx);
        d.open = true;
      });
    } finally {
      this.suppressPointCardToggle = false;
    }
  }

  updateSelectionHighlight(): void {
    this.listEl
      .querySelectorAll<HTMLDetailsElement>('details.point-card')
      .forEach((d) => {
        const idx = Number(d.dataset.pointIndex);
        d.classList.toggle('selected', idx === this.state.selectedPointIndex);
      });
  }

  render(): void {
    const pts = this.state.points();
    const segs = this.state.segments();
    const scope = this.state.settings.pointListScope;
    const activeId = this.state.activeSegmentId;
    const showAll = scope === 'all';
    const scrollTop = this.listEl.scrollTop;
    const shouldScroll = this.scrollOnNextRender;
    this.scrollOnNextRender = false;
    this.listEl.innerHTML = '';

    const phaseOrder = new Map<number, number>();
    let phaseN = 0;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].segmentId === activeId) {
        phaseN++;
        phaseOrder.set(i, phaseN);
      }
    }

    const visibleIndices: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      if (showAll || pts[i].segmentId === activeId) visibleIndices.push(i);
    }

    if (!visibleIndices.length) {
      const empty = document.createElement('p');
      empty.className = 'point-list-empty';
      empty.textContent = showAll
        ? 'まだ点がありません。地図をクリックして追加してください。'
        : 'このフェーズにはまだ点がありません。地図をクリックして追加してください。';
      this.listEl.appendChild(empty);
      return;
    }

    this.pruneOpenIndices(visibleIndices);
    const sel = this.state.selectedPointIndex;

    for (const i of visibleIndices) {
      this.listEl.appendChild(
        this.buildCard(i, pts[i], pts, segs, phaseOrder, showAll, sel),
      );
    }

    if (shouldScroll && sel !== null) {
      const el = this.listEl.querySelector<HTMLElement>(
        `[data-point-index="${sel}"]`,
      );
      el?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    } else {
      this.listEl.scrollTop = scrollTop;
    }
  }

  private pruneOpenIndices(visibleIndices: number[]): void {
    const visible = new Set(visibleIndices);
    for (const idx of this.pointCardsOpen) {
      if (!visible.has(idx)) this.pointCardsOpen.delete(idx);
    }
  }

  private buildCard(
    i: number,
    p: Waypoint,
    pts: Waypoint[],
    segs: { id: number; name: string }[],
    phaseOrder: Map<number, number>,
    showAll: boolean,
    sel: number | null,
  ): HTMLDetailsElement {
    const isSel = i === sel;
    const card = document.createElement('details');
    card.className = 'point-card' + (isSel ? ' selected' : '');
    card.dataset.pointIndex = String(i);
    card.open = this.pointCardsOpen.has(i);

    const segOpts = segs
      .map(
        (s) =>
          `<option value="${s.id}" ${p.segmentId === s.id ? 'selected' : ''}>${s.name}</option>`,
      )
      .join('');
    const chOpts = CHALLENGES.map(
      (c) =>
        `<option value="${c.id}" ${p.challengeId === c.id ? 'selected' : ''}>${c.label}</option>`,
    ).join('');
    const actOpts = ACTIONS.map(
      (a) =>
        `<option value="${a.id}" ${p.action === a.id ? 'selected' : ''}>${a.label}</option>`,
    ).join('');

    const phaseNum = phaseOrder.get(i);
    const numLabel = showAll ? `#${i + 1}` : `#${phaseNum ?? '?'}`;
    const numExtra = showAll
      ? ''
      : `<span class="point-card-num-global">全体 #${i + 1}</span>`;
    const preview = pointCardPreview(p);

    const segmentField = showAll
      ? `<div class="point-field-row">
          <label class="point-field">
            <span class="point-field-label">フェーズ</span>
            <select data-f="segment">${segOpts}</select>
          </label>
          <label class="point-field">
            <span class="point-field-label">課題</span>
            <select data-f="challenge">${chOpts}</select>
          </label>
        </div>`
      : `<label class="point-field">
          <span class="point-field-label">課題</span>
          <select data-f="challenge">${chOpts}</select>
        </label>`;

    const important = isImportantWaypoint(p);
    const travelPlaceholder = DEFAULT_TRAVEL_SEC.toFixed(1);
    const waitField = important
      ? `<label class="point-field point-field-compact">
            <span class="point-field-label">待ち（秒）</span>
            <input type="number" data-f="waitSec" min="0" max="60" step="0.5" value="${p.waitSec ?? 0}" />
          </label>`
      : '';
    const travelField =
      i < pts.length - 1
        ? `<label class="point-field point-field-compact">
            <span class="point-field-label">次まで（秒）</span>
            <input type="number" data-f="travelSec" min="0.1" max="120" step="0.1" placeholder="${travelPlaceholder}" value="${p.travelSec != null && p.travelSec > 0 ? p.travelSec : ''}" title="この点から次の点までの移動時間" />
          </label>`
        : '';
    const timingFields =
      waitField || travelField
        ? `<div class="point-timing-row${!waitField ? ' point-timing-row--travel-only' : ''}">${waitField}${travelField}</div>`
        : '';

    const summary = document.createElement('summary');
    summary.className = 'point-card-summary';
    summary.innerHTML = `
        <span class="point-card-summary-num">${numLabel}</span>
        ${numExtra}
        <span class="point-card-preview">${escapeAttr(preview)}</span>
      `;
    const body = document.createElement('div');
    body.className = 'point-card-body';
    body.innerHTML = `
        <label class="point-field">
          <span class="point-field-label">ラベル</span>
          <input type="text" placeholder="北交差点右折など" data-f="label" value="${escapeAttr(p.label)}" />
        </label>
        ${segmentField}
        <label class="point-field">
          <span class="point-field-label">操作ヒント</span>
          <select data-f="action">${actOpts}</select>
        </label>
        ${timingFields}
      `;

    card.appendChild(summary);
    card.appendChild(body);

    card.addEventListener('toggle', () => {
      if (this.suppressPointCardToggle) return;
      if (card.open) this.pointCardsOpen.add(i);
      else this.pointCardsOpen.delete(i);
      if (card.open) {
        this.state.selectedPointIndex = i;
        this.updateSelectionHighlight();
        this.deps.onRedraw();
      }
    });

    body.querySelector('[data-f="label"]')?.addEventListener('input', (e) => {
      p.label = (e.target as HTMLInputElement).value;
      const prev = summary.querySelector('.point-card-preview');
      if (prev) prev.textContent = pointCardPreview(p);
      this.deps.onRedraw();
      this.deps.onPersist();
    });
    body.querySelector('[data-f="segment"]')?.addEventListener('change', (e) => {
      p.segmentId = Number((e.target as HTMLSelectElement).value);
      this.deps.onChromeChange();
      this.deps.onRedraw();
      this.deps.onPersist();
    });
    body.querySelector('[data-f="challenge"]')?.addEventListener('change', (e) => {
      p.challengeId = (e.target as HTMLSelectElement)
        .value as Waypoint['challengeId'];
      const prev = summary.querySelector('.point-card-preview');
      if (prev) prev.textContent = pointCardPreview(p);
      this.refreshTimingFields(body, p, i, pts.length);
      this.deps.onRedraw();
      this.deps.onPersist();
    });
    body.querySelector('[data-f="action"]')?.addEventListener('change', (e) => {
      p.action = (e.target as HTMLSelectElement).value as Waypoint['action'];
      const prev = summary.querySelector('.point-card-preview');
      if (prev) prev.textContent = pointCardPreview(p);
      this.refreshTimingFields(body, p, i, pts.length);
      this.deps.onRedraw();
      this.deps.onPersist();
    });
    this.bindTimingInputs(body, p);

    return card;
  }

  private refreshTimingFields(
    body: El,
    p: Waypoint,
    index: number,
    pointCount: number,
  ): void {
    const important = isImportantWaypoint(p);
    let row = body.querySelector<El>('.point-timing-row');
    if (!important) {
      row?.remove();
      return;
    }
    const travelPlaceholder = DEFAULT_TRAVEL_SEC.toFixed(1);
    const waitField = `<label class="point-field point-field-compact">
      <span class="point-field-label">待ち（秒）</span>
      <input type="number" data-f="waitSec" min="0" max="60" step="0.5" value="${p.waitSec ?? 0}" />
    </label>`;
    const travelField =
      index < pointCount - 1
        ? `<label class="point-field point-field-compact">
      <span class="point-field-label">次まで（秒）</span>
      <input type="number" data-f="travelSec" min="0.1" max="120" step="0.1" placeholder="${travelPlaceholder}" value="${p.travelSec != null && p.travelSec > 0 ? p.travelSec : ''}" />
    </label>`
        : '';
    const html = `<div class="point-timing-row${!waitField ? ' point-timing-row--travel-only' : ''}">${waitField}${travelField}</div>`;
    if (row) row.outerHTML = html;
    else body.insertAdjacentHTML('beforeend', html);
    this.bindTimingInputs(body, p);
  }

  private bindTimingInputs(body: El, p: Waypoint): void {
    body.querySelector('[data-f="waitSec"]')?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      p.waitSec = Number.isFinite(v) && v >= 0 ? v : 0;
      this.deps.onPersist();
    });
    body.querySelector('[data-f="travelSec"]')?.addEventListener('input', (e) => {
      const raw = (e.target as HTMLInputElement).value;
      const v = Number(raw);
      p.travelSec =
        raw === '' || !Number.isFinite(v) || v <= 0 ? undefined : v;
      this.deps.onPersist();
    });
  }
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function pointCardPreview(p: Waypoint): string {
  const parts: string[] = [];
  if (p.label.trim()) parts.push(p.label.trim());
  if (p.challengeId !== 'none') parts.push(CHALLENGE_BY_ID[p.challengeId].label);
  if (p.action !== 'none') parts.push(ACTION_BY_ID[p.action].label);
  return parts.length ? parts.join(' · ') : '未設定';
}
