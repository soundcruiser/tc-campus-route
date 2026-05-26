/** DOM 再描画の範囲（不要な innerHTML 再生成を避ける） */
export type UiSyncScope =
  | 'full'
  | 'chrome'
  | 'points'
  | 'status';
