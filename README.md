# 校内コースルート — 学習アプリ

[![CI](https://github.com/soundcruiser/tc-campus-route/actions/workflows/ci.yml/badge.svg)](https://github.com/soundcruiser/tc-campus-route/actions/workflows/ci.yml)
[![Deploy](https://github.com/soundcruiser/tc-campus-route/actions/workflows/deploy.yml/badge.svg)](https://github.com/soundcruiser/tc-campus-route/actions/workflows/deploy.yml)

修了検定（A/B/C）の **1本のつながった道順** を地図上に打ち込み、**自分で決めたフェーズ**ごとに色分けして学習するアプリです。

## 公開デモ

**https://soundcruiser.github.io/tc-campus-route/**

（`main` ブランチへの push で GitHub Pages に自動デプロイされます）

## リポジトリ

https://github.com/soundcruiser/tc-campus-route

## 起動（ローカル開発）

```bash
npm install
npm run dev
```

ブラウザで Vite の表示 URL（通常 `http://localhost:5173`）を開きます。

## 使い方

1. **背景** … 起動時に敷地のコース図が表示されます（`public/assets/campus-map-default.png`）。別画像にするときだけ「背景を変更」
2. **フェーズ** … ポイント編集欄のタブでフェーズを選び、色・名前・ルート文言を編集。「＋ フェーズを追加」で区間を増やせます
3. **編集** … 選んだフェーズの点だけ一覧に表示（「すべて」で全区間も可）。発着点から **順番に** 地図をクリックで追加
4. 色が変わる地点で点を選び **「選択点から次の区間へ」**（次のフェーズがなければ自動追加）
5. 課題（S字・クランク等）やラベル（北交差点右折など）をポイント一覧で設定（別フェーズの点を地図で選ぶとタブが追従）
6. **再生タイミング** … 各点に **次まで（秒）**（その点→次の点の移動時間。未入力は約0.5秒相当）。課題・操作・ラベルがある重要ポイントには **待ち（秒）** も表示。直線は点を減らして手前の点の「次まで」を長めにすると速度が安定します。再生速度スライダーはこれらの秒数にも比例します。再生中はルート線＋重要ポイントのみ表示されます。
7. **学習** … 「発着点まで通し」で再生。重要ポイントでは**地図上の点から吹き出し**で表示（画面は暗くしません）→ 待ち秒数ぶん停止 → 次の点へ。**スキップ**（ボタン / Enter / Esc）で待ちを飛ばせます。ガイド線はデフォルトで「今の区間だけ」

検定図が8色でも10色でも、**フェーズ数は固定しません**。他校・他コースにもそのまま使えます。

## キーボードショートカット

`?` キーまたはヘッダーの **?** ボタンで一覧を表示できます。テキスト入力中は無効です。

| キー | 操作 |
|------|------|
| Tab | 編集 ⇔ 学習 |
| E / L | 編集 / 学習 |
| 1 / 2 / 3 | A / B / C コース |
| V / M | 追加ツール / 移動ツール（編集） |
| [ / ] | 前 / 次のフェーズ（編集） |
| Space | 学習: 再生・停止　編集: 押しながらパン |
| Esc | ポップアップを閉じる / 再生停止 |
| + / - | ズームイン / アウト |
| 0 | 全体表示 |
| ⌘Z / Ctrl+Z | 元に戻す（編集） |
| Backspace | 点を削除（編集） |

## 表示設定

| ガイド線 | 意味 |
|----------|------|
| 今の区間だけ | 前の区間のルート線は描かない（おすすめ） |
| 全区間を薄く | 全体の流れをうっすら表示 |
| 非表示 | 線なし（走行軌跡のみ） |

## データ

- 自動保存: IndexedDB（フェーズ定義もコースごとに保存）
- エクスポート/インポート: JSON

## 開発

```bash
npm test          # ユニットテスト
npm run build     # 本番ビルド（dist/）
npm run preview   # ビルド結果のプレビュー
```

設計メモ: [docs/architecture.md](docs/architecture.md)

### CI / デプロイ

| ワークフロー | タイミング | 内容 |
|-------------|-----------|------|
| [CI](.github/workflows/ci.yml) | push / PR → `main` | `npm test` + `npm run build` |
| [Deploy](.github/workflows/deploy.yml) | push → `main` | テスト後、GitHub Pages へデプロイ |

Pages 用ビルドでは `GITHUB_PAGES=true` を渡し、Vite の `base` を `/tc-campus-route/` に切り替えています。

## 構成

```
src/core/segments.ts          … フェーズ追加・削除
src/config/course-scripts.ts  … 新規フェーズ用の色パレットのみ
src/types.ts
src/features/player.ts        … 連続再生
src/math/playback-timeline.ts … 待ち・移動の秒数タイムライン
src/render/canvas-renderer.ts … 描画
src/ui/                       … 画面（dom-controller / point-list-view 等）
```
