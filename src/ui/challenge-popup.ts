import { ACTIONS, CHALLENGE_BY_ID, getSegmentDef } from '../config';
import type { AppState } from '../core/app-state';
import type { SegmentId, Waypoint } from '../types';

type El = HTMLElement;

/** 地図上の課題吹き出し */
export class ChallengePopup {
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private waypoint: Waypoint | null = null;
  private onSkip: (() => void) | null = null;

  constructor(
    private root: El,
    private canvasWrap: El,
    private state: AppState,
  ) {}

  bind(closeSelector: string, skipSelector: string): void {
    this.q(closeSelector).addEventListener('click', () => this.hide());
    this.q(skipSelector).addEventListener('click', () => this.skip());
  }

  setOnSkip(cb: () => void): void {
    this.onSkip = cb;
  }

  getWaypoint(): Waypoint | null {
    return this.waypoint;
  }

  isVisible(): boolean {
    return !this.q('#challengePopup').classList.contains('hidden');
  }

  show(
    wp: Waypoint,
    segmentId: SegmentId,
    options?: { autoCloseMs?: number; playback?: boolean },
  ): void {
    this.clearTimer();
    this.waypoint = wp;
    const ch = CHALLENGE_BY_ID[wp.challengeId];
    const seg = getSegmentDef(this.state.segments(), segmentId);
    const act = ACTIONS.find((a) => a.id === wp.action)!;
    const popup = this.q<El>('#challengePopup');

    this.q('#popupIcon').textContent = ch.icon || '📍';
    this.q('#popupRound').textContent = seg.name;
    this.q('#popupTitle').textContent = wp.label || ch.label || 'ポイント';
    this.q('#popupHint').textContent = ch.hint || seg.routeText;
    const actEl = this.q<El>('#popupAction');
    if (wp.action !== 'none') {
      actEl.textContent = `${act.icon} ${act.label}`;
      actEl.classList.remove('hidden');
    } else {
      actEl.classList.add('hidden');
    }

    const playback = !!options?.playback;
    const skipBtn = this.q<HTMLButtonElement>('#popupSkip');
    const closeBtn = this.q<HTMLButtonElement>('#popupClose');
    skipBtn.classList.toggle('hidden', !playback);
    closeBtn.classList.toggle('hidden', playback);
    popup.classList.toggle('map-callout--playback', playback);
    popup.classList.remove('hidden', 'map-callout--below');

    if ((options?.autoCloseMs ?? 0) > 0) {
      this.closeTimer = setTimeout(
        () => this.skip(),
        options!.autoCloseMs,
      );
    }
  }

  position(screenX: number, screenY: number): void {
    if (this.q('#challengePopup').classList.contains('hidden')) return;
    const w = this.canvasWrap.clientWidth;
    const h = this.canvasWrap.clientHeight;
    const margin = 12;
    const popup = this.q<El>('#challengePopup');
    const preferAbove = screenY > h * 0.28;
    popup.classList.toggle('map-callout--below', !preferAbove);

    const left = Math.max(margin, Math.min(w - margin, screenX));
    const top = preferAbove
      ? Math.max(margin, screenY - 10)
      : Math.min(h - margin, screenY + 10);

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }

  skip(): void {
    this.clearTimer();
    this.onSkip?.();
    this.hide();
  }

  hide(): void {
    this.clearTimer();
    this.waypoint = null;
    const popup = this.q<El>('#challengePopup');
    popup.classList.add('hidden');
    popup.classList.remove('map-callout--playback', 'map-callout--below');
    this.q<HTMLButtonElement>('#popupSkip').classList.remove('hidden');
    this.q<HTMLButtonElement>('#popupClose').classList.remove('hidden');
  }

  private q<T extends El>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  private clearTimer(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
