/** ショートカットが発火したときのアクション */
export type ShortcutAction =
  | 'toggleMode'
  | 'modeEdit'
  | 'modeLearn'
  | 'courseA'
  | 'courseB'
  | 'courseC'
  | 'toolAdd'
  | 'toolMove'
  | 'togglePlay'
  | 'escape'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomFit'
  | 'undo'
  | 'deletePoint'
  | 'segmentPrev'
  | 'segmentNext'
  | 'toggleHelp'
  | 'skipPopup';

export interface ShortcutRow {
  keys: string;
  action: string;
}

/** ヘルプ表示用 */
export const SHORTCUT_HELP_ROWS: ShortcutRow[] = [
  { keys: 'Tab', action: '編集 ⇔ 学習' },
  { keys: 'E / L', action: '編集 / 学習' },
  { keys: '1 / 2 / 3', action: 'A / B / C コース' },
  { keys: 'V / M', action: '追加ツール / 移動ツール（編集）' },
  { keys: '[ / ]', action: '前 / 次のフェーズ（編集）' },
  { keys: 'Space', action: '学習: 再生・停止　編集: 押しながらパン' },
  { keys: 'Enter', action: 'ポップアップをスキップ（表示中）' },
  { keys: 'Esc', action: 'ポップアップをスキップ / 再生停止' },
  { keys: '+ / -', action: 'ズームイン / アウト' },
  { keys: '0', action: '全体表示' },
  { keys: '⌘Z / Ctrl+Z', action: '元に戻す（編集）' },
  { keys: 'Backspace', action: '点を削除（編集）' },
  { keys: '?', action: 'この一覧を表示' },
];

export function shouldIgnoreKeyboard(e: KeyboardEvent): boolean {
  const el = e.target;
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    const input = el as HTMLInputElement;
    if (tag === 'INPUT' && (input.type === 'color' || input.type === 'range')) {
      return false;
    }
    return true;
  }
  return el.isContentEditable;
}

/** 修飾キーだけの場合は無視 */
function hasNoModifiers(e: KeyboardEvent): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey;
}

/**
 * キーイベントをアクションに変換。該当なしは null。
 * Space の学習モード再生は呼び出し側で appMode を見て処理してもよい。
 */
export function matchShortcut(e: KeyboardEvent): ShortcutAction | null {
  if (shouldIgnoreKeyboard(e)) return null;

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    return 'undo';
  }

  if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
    return 'toggleHelp';
  }

  if (e.code === 'Escape') {
    return 'escape';
  }

  if (e.key === 'Enter' && hasNoModifiers(e)) {
    return 'skipPopup';
  }

  if (e.code === 'Space' && !e.repeat) {
    return 'togglePlay';
  }

  if (!hasNoModifiers(e)) return null;

  switch (e.code) {
    case 'Tab':
      return 'toggleMode';
    case 'KeyE':
      return 'modeEdit';
    case 'KeyL':
      return 'modeLearn';
    case 'Digit1':
      return 'courseA';
    case 'Digit2':
      return 'courseB';
    case 'Digit3':
      return 'courseC';
    case 'KeyV':
      return 'toolAdd';
    case 'KeyM':
      return 'toolMove';
    case 'BracketLeft':
      return 'segmentPrev';
    case 'BracketRight':
      return 'segmentNext';
    case 'Equal':
    case 'NumpadAdd':
      return 'zoomIn';
    case 'Minus':
    case 'NumpadSubtract':
      return 'zoomOut';
    case 'Digit0':
    case 'Numpad0':
      return 'zoomFit';
    case 'Backspace':
    case 'Delete':
      return 'deletePoint';
    default:
      break;
  }

  return null;
}
