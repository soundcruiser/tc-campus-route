# アーキテクチャ概要

校内コースルート学習アプリの状態の流れと UI 更新の約束事です。機能追加時はこの文書と `src/ui/ui-scopes.ts` を参照してください。

## レイヤー

```
app.ts          … 起動・イベント配線・描画ループ
core/           … AppState（唯一の真実）、Viewport、フェーズ CRUD
features/       … 編集・再生・ショートカット（DOM 非依存）
math/           … スプライン・再生タイムライン
render/         … CanvasRenderer
storage/        … IndexedDB・JSON
ui/             … DOM（DomController が配線、部品は分割モジュール）
```

## 状態（AppState）

- コースデータ（点・フェーズ）は `state.courses[courseId]`
- 編集 UI: `activeSegmentId`, `selectedPointIndex`, `editTool`
- 学習 UI: `practiceSegmentId`, `appMode`
- 再生: `playing`, `playbackElapsedSec`, `currentSegmentId` など

**原則**: データ変更は `AppState` / `editor` / `player` 経由。UI は読むか、ユーザー入力で state を書き換えてから `syncUi` で反映する。

## UI 更新スコープ（`DomController.syncUi(scope)`）

| scope | いつ使うか | 内容 |
|-------|------------|------|
| `full` | 初期化・インポート・コース切替 | 設定フォーム + chrome + points + status |
| `chrome` | フェーズ追加/削除・区切り・undo・点のフェーズ変更 | タブ・編集カード・一覧パネル + 一覧 + status |
| `points` | 点の追加/削除・地図で選択・一覧スコープ変更 | ポイント一覧 + 件数 |
| `status` | 再生中の表示・練習フェーズ変更・次フェーズ | ヘッダー・帯・再生ボタン |

**避けること**

- マウスアップのたびに `syncUi('full')`（パン・ドラッグ終了では `draw()` のみ）
- ポイントカードの `toggle` から一覧の再生成（`PointListView` が開閉 Set で管理）

## UI モジュール

| ファイル | 責務 |
|----------|------|
| `point-list-view.ts` | ポイント一覧カード・開閉状態 |
| `segment-panel.ts` | フェーズタブ・アクティブフェーズ編集 |
| `challenge-popup.ts` | 地図吹き出し |
| `dom-controller.ts` | バインド・`syncUi`・トースト等 |

## 再生

1. `RoutePlayer.start` → `buildPlaybackTimeline(points)`
2. 毎フレーム `tick` → 位置・到達イベント
3. 重要点のみ `showPopup`（`isImportantWaypoint`）
4. キャンバスは `app.ts` の `draw()` のみ（一覧は触らない）

## テスト

- `npm test` … Vitest（`src/**/*.test.ts`）
- 優先: `playback-timeline`, `isImportantWaypoint`（純関数）
- GitHub Actions（`.github/workflows/ci.yml`）でも push / PR 時に実行

## デプロイ

- `main` への push で GitHub Pages に自動公開（`.github/workflows/deploy.yml`）
- Pages ビルド時のみ `base: /tc-campus-route/`（`vite.config.ts` + `GITHUB_PAGES=true`）

## 機能追加のチェックリスト

- [ ] state をどこで変えるか決めたか
- [ ] 必要な `syncUi` スコープは最小か（`points` で足りないか）
- [ ] 再生中にサイドバーを再生成していないか
- [ ] 数学・時間ロジックは `math/` に置き、テストを足せるか
