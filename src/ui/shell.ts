export function renderAppShell(): string {
  return `
<header class="app-header">
  <h1 class="app-title">校内コースルート</h1>
  <div class="course-tabs" role="tablist">
    <button type="button" class="tab active" data-course="A">A</button>
    <button type="button" class="tab" data-course="B">B</button>
    <button type="button" class="tab" data-course="C">C</button>
  </div>
  <div class="mode-switch" role="group">
    <button type="button" class="mode-chip active" data-app-mode="edit">編集</button>
    <button type="button" class="mode-chip" data-app-mode="learn">学習</button>
  </div>
  <div class="edit-tools" id="editTools">
    <button type="button" class="tool-btn active" data-tool="add">追加</button>
    <button type="button" class="tool-btn" data-tool="edit">移動</button>
  </div>
  <button type="button" class="header-help-btn" id="btnShortcutHelp" title="ショートカット（?）">?</button>
</header>

<main class="app-main">
  <div class="canvas-column">
    <div class="canvas-wrap" id="canvasWrap">
      <div class="map-controls" aria-label="地図操作">
        <button type="button" class="map-btn" id="btnZoomIn" title="拡大">＋</button>
        <button type="button" class="map-btn" id="btnZoomOut" title="縮小">－</button>
        <button type="button" class="map-btn map-btn-wide" id="btnZoomFit" title="全体表示">全体</button>
      </div>
      <canvas id="routeCanvas"></canvas>
      <div class="status-bar" id="statusBar">
        <span id="statusCourse">Aコース</span>
        <span class="status-sep">·</span>
        <span id="statusSegment">区間1</span>
        <span class="status-sep">·</span>
        <span id="statusNext">次: —</span>
        <span class="status-sep status-speed-sep hidden" id="statusSpeedSep">·</span>
        <span id="statusSpeed" class="hidden">×1.0</span>
      </div>
      <div class="toast hidden" id="toast"></div>
      <div class="segment-band" id="segmentBand">
        <div class="segment-band-label">いまの区間</div>
        <p class="segment-band-text" id="segmentBandText">—</p>
      </div>
      <div class="map-callout hidden" id="challengePopup" role="dialog" aria-live="polite">
        <div class="map-callout-bubble">
          <div class="popup-icon" id="popupIcon"></div>
          <p class="popup-round" id="popupRound"></p>
          <h2 class="popup-title" id="popupTitle"></h2>
          <p class="popup-hint" id="popupHint"></p>
          <p class="popup-action hidden" id="popupAction"></p>
          <div class="map-callout-actions">
            <button type="button" class="btn secondary map-callout-skip" id="popupSkip">スキップ</button>
            <button type="button" class="btn primary" id="popupClose">OK</button>
          </div>
        </div>
        <div class="map-callout-tail" aria-hidden="true"></div>
      </div>
    </div>
  </div>

  <aside class="sidebar">
    <section class="panel points-panel edit-only flex-grow" id="pointsPanel">
      <div class="points-panel-head">
        <h2 class="panel-title">ポイント編集</h2>
        <div class="points-meta">
          <span class="points-count"><span id="statPoints">0 / 0</span> 点</span>
          <span class="points-meta-sep">·</span>
          <span class="stat-zoom" id="statZoom">100%</span>
        </div>
      </div>
      <div id="segmentTabs" class="segment-tabs" role="tablist" aria-label="フェーズ"></div>
      <div id="activeSegmentEditor" class="active-segment-editor"></div>
      <div class="point-list-toolbar">
        <button type="button" class="point-list-tool-btn" id="btnTogglePointList">一覧をたたむ</button>
        <button type="button" class="point-list-tool-btn" id="btnCollapseAllPoints">すべてたたむ</button>
        <button type="button" class="point-list-tool-btn" id="btnExpandAllPoints">すべて開く</button>
      </div>
      <div class="point-list-body" id="pointListBody">
        <div class="point-list-scope" id="pointListScope" role="group" aria-label="ポイント表示">
          <button type="button" class="scope-btn active" data-scope="phase">このフェーズ</button>
          <button type="button" class="scope-btn" data-scope="all">すべて</button>
        </div>
        <div class="point-list" id="pointList"></div>
      </div>
      <div class="points-panel-actions">
        <button type="button" class="btn secondary full" id="btnAddSegment">＋ フェーズを追加</button>
        <button type="button" class="btn secondary full" id="btnSplitSegment">選択点から次の区間へ</button>
      </div>
    </section>

    <section class="panel learn-only hidden" id="learnPanel">
      <h2 class="panel-title">学習</h2>
      <label class="field-label">練習する区間</label>
      <select id="practiceSegment" class="select"></select>
      <label class="field-label">再生</label>
      <select id="playbackMode" class="select">
        <option value="full_course">発着点まで通し</option>
        <option value="single_segment">選んだ区間だけ</option>
      </select>
      <button type="button" class="btn primary full" id="btnPlay">▶ 再生</button>
      <button type="button" class="btn secondary full hidden" id="btnStop">⏸ 停止</button>
      <button type="button" class="btn secondary full" id="btnNextSegment">次の区間へ</button>
      <label class="field-label">再生速度 ×<span id="speedLabel">1.0</span></label>
      <input type="range" id="animSpeed" min="0.2" max="5" step="0.1" value="1" />
      <p class="panel-hint">再生中でも変更できます。区間ごとに遅くしたい場合は、その区間の点を密に打ってください。キー操作は <kbd>?</kbd> で一覧。</p>
    </section>

    <details class="sidebar-details">
      <summary class="sidebar-details-summary">コース背景</summary>
      <div class="sidebar-details-body">
        <p class="panel-hint">差し替えるときだけ読み込んでください。</p>
        <label class="upload-btn">
          <input type="file" id="bgUpload" accept="image/*" hidden />
          背景を変更
        </label>
        <button type="button" class="btn secondary full" id="bgReset">デフォルトに戻す</button>
      </div>
    </details>

    <details class="sidebar-details" id="detailsDisplay">
      <summary class="sidebar-details-summary">表示・再生設定</summary>
      <div class="sidebar-details-body">
        <label class="field-label">地図の見え方</label>
        <select id="mapFit" class="select">
          <option value="auto" selected>自動（縦長は高さいっぱい）</option>
          <option value="fill-height">縦いっぱい</option>
          <option value="contain">全体を収める</option>
          <option value="cover">画面いっぱい（はみ出しあり）</option>
        </select>
        <label class="field-label">通過した軌跡（秒）</label>
        <input type="range" id="trailDuration" min="2" max="10" step="1" value="4" />
        <label class="field-label">ガイド線</label>
        <select id="baseRouteDisplay" class="select">
          <option value="current" selected>今の区間だけ</option>
          <option value="dim">全区間を薄く</option>
          <option value="off">非表示</option>
        </select>
        <label class="field-label">カメラ</label>
        <select id="cameraMode" class="select">
          <option value="overview">全体</option>
          <option value="follow">追従</option>
        </select>
        <div class="stats learn-only hidden">
          <div><span>ズーム</span><strong class="stat-zoom">100%</strong></div>
        </div>
      </div>
    </details>

    <details class="sidebar-details edit-only">
      <summary class="sidebar-details-summary">データの保存</summary>
      <div class="sidebar-details-body">
        <button type="button" class="btn secondary full" id="btnExport">エクスポート</button>
        <button type="button" class="btn secondary full" id="btnImport">インポート</button>
        <button type="button" class="btn secondary full" id="btnUndo">元に戻す</button>
        <button type="button" class="btn danger full" id="btnClear">ルートをクリア</button>
      </div>
    </details>
  </aside>
</main>

<div class="shortcut-help hidden" id="shortcutHelp" role="dialog" aria-label="ショートカット一覧">
  <div class="shortcut-help-inner">
    <h2 class="shortcut-help-title">キーボードショートカット</h2>
    <table class="shortcut-table">
      <tbody>
        <tr><th>Tab</th><td>編集 ⇔ 学習</td></tr>
        <tr><th>E / L</th><td>編集 / 学習</td></tr>
        <tr><th>1 / 2 / 3</th><td>A / B / C コース</td></tr>
        <tr><th>V / M</th><td>追加ツール / 移動ツール（編集）</td></tr>
        <tr><th>[ / ]</th><td>前 / 次のフェーズ（編集）</td></tr>
        <tr><th>Space</th><td>学習: 再生・停止　編集: 押しながらパン</td></tr>
        <tr><th>Enter</th><td>ポップアップをスキップ（再生中）</td></tr>
        <tr><th>Esc</th><td>ポップアップをスキップ / 再生停止</td></tr>
        <tr><th>+ / -</th><td>ズームイン / アウト</td></tr>
        <tr><th>0</th><td>全体表示</td></tr>
        <tr><th>⌘Z</th><td>元に戻す（編集）</td></tr>
        <tr><th>Backspace</th><td>点を削除（編集）</td></tr>
        <tr><th>?</th><td>この一覧</td></tr>
      </tbody>
    </table>
    <p class="shortcut-help-note">テキスト入力中はショートカットは無効です。</p>
    <button type="button" class="btn primary full" id="shortcutHelpClose">閉じる</button>
  </div>
</div>


`;
}
