import type { SegmentDef } from '../types';

/**
 * 新規フェーズ追加時に使う色の候補（任意）。
 * 検定の文言・フェーズ数は固定しない。ユーザーがコースごとに追加・編集する。
 */
export const SEGMENT_COLOR_PALETTE = [
  '#e53935',
  '#f48fb1',
  '#ffccbc',
  '#9e9e9e',
  '#fff59d',
  '#4dd0e1',
  '#42a5f5',
  '#1565c0',
  '#66bb6a',
  '#ab47bc',
  '#80cbc4',
  '#ffb74d',
];

export function pickSegmentColor(index: number): string {
  return SEGMENT_COLOR_PALETTE[index % SEGMENT_COLOR_PALETTE.length];
}

/** 空のフェーズ1つ（文言はユーザーが入力） */
export function createDefaultSegment(id: number, index = 0): SegmentDef {
  return {
    id,
    name: `フェーズ${id}`,
    color: pickSegmentColor(index),
    routeText: '',
  };
}
