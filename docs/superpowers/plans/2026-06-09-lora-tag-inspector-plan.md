# Lora Tag Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based local web app that batch-checks Lora training tag txt files for issues (bad tags, character/style keywords, duplicates, custom rules) and highlights findings with color-coded markers in a CodeMirror 6 editor.

**Architecture:** Single-page web app with 6 ES modules (keyword-lib, tag-parser, check-engine, file-manager, editor, app) loaded by index.html. CodeMirror 6 via CDN. File System Access API for read/write, localStorage for config persistence. No build step.

**Tech Stack:** Vanilla HTML/CSS/JS (ES Modules), CodeMirror 6 (CDN from esm.sh), File System Access API

---

## File Structure

```
lora-tag-inspector/
├── index.html              ← Entry point, loads all resources
├── css/
│   └── style.css           ← Layout, color theme, highlight styles
├── js/
│   ├── keyword-lib.js      ← Built-in + custom keyword library, localStorage persistence, import/export
│   ├── tag-parser.js       ← Parse txt into tag array with positions, encoding detection
│   ├── check-engine.js     ← 5 check types with priority ordering
│   ├── file-manager.js     ← Drag/drop, folder select, file list, tab management, save
│   ├── editor.js           ← CodeMirror 6 wrapper, decoration rendering, gutter markers
│   └── app.js              ← Main controller, module wiring, event binding
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-06-09-lora-tag-inspector-design.md
        └── plans/
            └── 2026-06-09-lora-tag-inspector-plan.md  ← This file
```

---

### Task 1: Project Skeleton — HTML Layout + CSS

**Files:**
- Create: `lora-tag-inspector/index.html`
- Create: `lora-tag-inspector/css/style.css`

- [ ] **Step 1: Create index.html with layout structure**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lora Tag Inspector</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="app">
    <!-- Left Sidebar -->
    <aside id="sidebar">
      <div id="drop-zone">
        <div class="drop-icon">📁</div>
        <p>拖拽文件夹/文件到此处</p>
        <p class="drop-hint">或</p>
        <button id="btn-select-folder">选择文件夹</button>
        <button id="btn-select-files">选择文件</button>
        <input type="file" id="file-input-hidden" webkitdirectory hidden>
        <input type="file" id="files-input-hidden" multiple hidden>
      </div>
      <div id="file-list-container" style="display:none;">
        <h3>文件列表 <span id="file-count"></span></h3>
        <ul id="file-list"></ul>
      </div>
    </aside>

    <!-- Main Editor Area -->
    <main id="editor-area">
      <div id="tab-bar"></div>
      <div id="editor-container"></div>
      <div id="status-bar">
        <span id="status-tags">0 个标签</span>
        <span id="status-modified" style="display:none;"> | 已修改</span>
        <span id="status-hint"> | Ctrl+S 保存</span>
        <span id="status-skipped" style="display:none;"></span>
      </div>
    </main>

    <!-- Right Control Panel -->
    <aside id="panel">
      <h3>检查选项</h3>
      <div id="check-options">
        <label class="check-item" data-priority="1">
          <input type="checkbox" id="chk-bad-tags" checked>
          <span class="check-color" style="background:#FF922B;"></span>
          不良标签
        </label>
        <label class="check-item" data-priority="2">
          <input type="checkbox" id="chk-custom">
          <span class="check-color" style="background:#74C0FC;"></span>
          自定义规则
        </label>
        <label class="check-item" data-priority="3">
          <input type="checkbox" id="chk-duplicate" checked>
          <span class="check-color" style="background:#FFD43B;"></span>
          冗余重复
        </label>
        <label class="check-item check-sub">
          <input type="checkbox" id="chk-fuzzy">
          启用模糊匹配
        </label>
        <label class="check-item" data-priority="4">
          <input type="checkbox" id="chk-character" checked>
          <span class="check-color" style="background:#FF6B6B;"></span>
          角色特征
        </label>
        <label class="check-item" data-priority="5">
          <input type="checkbox" id="chk-style" checked>
          <span class="check-color" style="background:#51CF66;"></span>
          风格相关
        </label>
      </div>
      <hr>
      <h3>📊 问题摘要</h3>
      <div id="issue-summary">
        <div class="summary-item" data-type="badTags" style="color:#FF922B;">🟠 不良: 0</div>
        <div class="summary-item" data-type="custom" style="color:#74C0FC;">🔵 自定义: 0</div>
        <div class="summary-item" data-type="duplicate" style="color:#FFD43B;">🟡 重复: 0</div>
        <div class="summary-item" data-type="character" style="color:#FF6B6B;">🔴 角色: 0</div>
        <div class="summary-item" data-type="style" style="color:#51CF66;">🟢 风格: 0</div>
      </div>
      <hr>
      <button id="btn-settings">⚙ 设置</button>
      <button id="btn-export-report" style="display:none;">📄 导出报告</button>
    </aside>
  </div>

  <!-- Settings Modal -->
  <div id="settings-modal" class="modal" style="display:none;">
    <div class="modal-content">
      <div class="modal-header">
        <h2>设置</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-tabs">
        <button class="tab-btn active" data-tab="tab-char">角色特征词库</button>
        <button class="tab-btn" data-tab="tab-style-kw">风格相关词库</button>
        <button class="tab-btn" data-tab="tab-bad">不良标签词库</button>
        <button class="tab-btn" data-tab="tab-conflict">冲突标签对</button>
        <button class="tab-btn" data-tab="tab-custom-rules">自定义正则规则</button>
        <button class="tab-btn" data-tab="tab-io">导入/导出配置</button>
      </div>
      <div class="modal-body">
        <div id="tab-char" class="tab-content active"></div>
        <div id="tab-style-kw" class="tab-content"></div>
        <div id="tab-bad" class="tab-content"></div>
        <div id="tab-conflict" class="tab-content"></div>
        <div id="tab-custom-rules" class="tab-content"></div>
        <div id="tab-io" class="tab-content"></div>
      </div>
      <div class="modal-footer">
        <button id="btn-reset-defaults">重置到默认</button>
        <button id="btn-save-settings">保存设置</button>
      </div>
    </div>
  </div>

  <!-- Unsaved changes dialog -->
  <div id="unsaved-modal" class="modal" style="display:none;">
    <div class="modal-content modal-small">
      <p id="unsaved-message"></p>
      <div class="modal-buttons">
        <button id="unsaved-save">保存</button>
        <button id="unsaved-discard">不保存</button>
        <button id="unsaved-cancel">取消</button>
      </div>
    </div>
  </div>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css with full layout and theme**

```css
/* ===== Reset & Variables ===== */
:root {
  --bg: #1e1e2e;
  --surface: #282840;
  --surface2: #333355;
  --border: #444477;
  --text: #e0e0f0;
  --text-dim: #9999bb;
  --accent: #7c7cff;
  --bad-tag: #FF922B;
  --custom-rule: #74C0FC;
  --duplicate: #FFD43B;
  --character: #FF6B6B;
  --style-tag: #51CF66;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  overflow: hidden;
}

#app {
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  grid-template-rows: 1fr;
  height: 100vh;
}

/* ===== Left Sidebar ===== */
#sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#drop-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  border: 2px dashed var(--border);
  border-radius: 8px;
  margin: 12px;
  transition: border-color 0.2s, background 0.2s;
  cursor: pointer;
}

#drop-zone.drag-over {
  border-color: var(--accent);
  background: rgba(124, 124, 255, 0.1);
}

.drop-icon { font-size: 40px; margin-bottom: 8px; }
.drop-hint { color: var(--text-dim); font-size: 13px; margin: 8px 0; }

#drop-zone button {
  width: 100%;
  padding: 8px;
  margin: 4px 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface2);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}
#drop-zone button:hover { background: var(--border); }

#file-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

#file-list-container h3 {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

#file-list {
  list-style: none;
}

#file-list li {
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}

#file-list li:hover { background: var(--surface2); }
#file-list li.active { background: var(--accent); color: #fff; }
#file-list li .modified-dot { color: var(--duplicate); font-size: 16px; line-height: 1; }

/* ===== Main Editor Area ===== */
#editor-area {
  display: flex;
  flex-direction: column;
  background: var(--bg);
  min-width: 0;
}

#tab-bar {
  display: flex;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  min-height: 36px;
  flex-shrink: 0;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  border-right: 1px solid var(--border);
  cursor: pointer;
  white-space: nowrap;
  color: var(--text-dim);
  background: var(--surface);
}

.tab:hover { background: var(--surface2); color: var(--text); }
.tab.active { background: var(--bg); color: var(--text); border-bottom: 2px solid var(--accent); }
.tab .tab-close { font-size: 16px; line-height: 1; color: var(--text-dim); cursor: pointer; }
.tab .tab-close:hover { color: var(--character); }
.tab .tab-modified { font-weight: bold; color: var(--duplicate); }

#editor-container {
  flex: 1;
  overflow: hidden;
}

#editor-container .cm-editor {
  height: 100%;
  font-size: 14px;
}

#editor-container .cm-editor .cm-scroller {
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
}

/* Highlight markers */
.cm-highlight-bad { background: rgba(255, 146, 43, 0.25); border-bottom: 2px solid #FF922B; }
.cm-highlight-custom { background: rgba(116, 192, 252, 0.25); border-bottom: 2px solid #74C0FC; }
.cm-highlight-duplicate { background: rgba(255, 212, 59, 0.25); border-bottom: 2px solid #FFD43B; }
.cm-highlight-character { background: rgba(255, 107, 107, 0.2); border-bottom: 1px solid #FF6B6B; }
.cm-highlight-style { background: rgba(81, 207, 102, 0.2); border-bottom: 1px solid #51CF66; }

/* Gutter markers */
.gutter-marker {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 2px;
  vertical-align: middle;
}

/* ===== Status Bar ===== */
#status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--text-dim);
  background: var(--surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

/* ===== Right Panel ===== */
#panel {
  background: var(--surface);
  border-left: 1px solid var(--border);
  padding: 16px;
  overflow-y: auto;
}

#panel h3 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-dim);
  margin-bottom: 12px;
}

#check-options { display: flex; flex-direction: column; gap: 6px; }

.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
}

.check-item.check-sub { padding-left: 28px; font-size: 12px; color: var(--text-dim); }

.check-color {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.check-item input[type="checkbox"] { accent-color: var(--accent); }

#issue-summary { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }

.summary-item {
  font-size: 13px;
  cursor: pointer;
  padding: 2px 0;
}
.summary-item:hover { text-decoration: underline; }
.summary-item.zero { opacity: 0.4; }

#panel hr { border: none; border-top: 1px solid var(--border); margin: 12px 0; }

#panel button {
  width: 100%;
  padding: 8px;
  margin: 4px 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface2);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}
#panel button:hover { background: var(--border); }

/* ===== Modal ===== */
.modal {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-small { width: 400px; }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 { font-size: 16px; }
.modal-close { background: none; border: none; color: var(--text); font-size: 24px; cursor: pointer; }

.modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.tab-btn {
  padding: 10px 16px;
  font-size: 13px;
  border: none;
  background: none;
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}
.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--text); border-bottom-color: var(--accent); }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.tab-content { display: none; }
.tab-content.active { display: block; }

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-footer button {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface2);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}

.modal-footer button:hover { background: var(--border); }
#btn-reset-defaults { margin-right: auto; color: var(--character); border-color: var(--character); }

.modal-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

/* Keyword list in settings */
.kw-group { margin-bottom: 16px; }
.kw-group h4 { font-size: 13px; color: var(--text-dim); margin-bottom: 6px; text-transform: uppercase; }
.kw-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.kw-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 12px;
  background: var(--surface2);
  border-radius: 12px;
  cursor: default;
}
.kw-tag .kw-remove { cursor: pointer; font-size: 14px; color: var(--text-dim); }
.kw-tag .kw-remove:hover { color: var(--character); }
.kw-add-row { display: flex; gap: 4px; margin-top: 4px; }
.kw-add-row input {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  flex: 1;
}
.kw-add-row button {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface2);
  color: var(--text);
  cursor: pointer;
}

.conflict-pair-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
}
.conflict-pair-row button {
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface2);
  color: var(--character);
  cursor: pointer;
}

.custom-rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
}
.custom-rule-row input { flex: 1; }
.custom-rule-row input[type="color"] { width: 32px; flex: none; }

/* ===== Tooltip ===== */
.tooltip {
  position: fixed;
  padding: 8px 12px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  max-width: 300px;
  z-index: 2000;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.tooltip .tt-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.tooltip .tt-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ===== Banner ===== */
#banner-readonly {
  display: none;
  background: #554400;
  color: #ffd43b;
  text-align: center;
  padding: 8px;
  font-size: 13px;
}

/* ===== Empty state ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-dim);
  gap: 8px;
}
.empty-state .empty-icon { font-size: 48px; }
```

- [ ] **Step 3: Verify skeleton loads in browser**

Open `index.html` in Chrome/Edge via local server. Verify three-column layout renders, checkboxes toggle, settings modal opens/closes, drop zone is visible.

```bash
# Use Python's built-in server for local testing
cd C:/Users/10466/lora-tag-inspector && python -m http.server 8080
```

Expected: Page loads at `http://localhost:8080`, layout matches design, no console errors.

---

### Task 2: Keyword Library Module

**Files:**
- Create: `lora-tag-inspector/js/keyword-lib.js`

- [ ] **Step 1: Write keyword-lib.js with built-in defaults, merge, persistence, import/export**

```javascript
// keyword-lib.js — Built-in + custom keyword library

const STORAGE_KEY = 'lora-inspector-keywords';

const BUILTIN = {
  character: {
    gender: ['1girl', '1boy', '1other', 'female', 'male', 'multiple girls', 'multiple boys'],
    hair: ['blonde hair', 'black hair', 'brown hair', 'blue hair', 'red hair', 'white hair',
           'short hair', 'long hair', 'ponytail', 'twintails', 'braid', 'bangs',
           'silver hair', 'pink hair', 'purple hair', 'green hair', 'grey hair',
           'side ponytail', 'low twintails', 'bun', 'hair bun', 'ahoge', 'drill hair'],
    eyes: ['blue eyes', 'red eyes', 'green eyes', 'brown eyes', 'purple eyes',
           'yellow eyes', 'pink eyes', 'heterochromia', 'closed eyes',
           'half-closed eyes', 'eyebrows visible through hair', 'glowing eyes'],
    expression: ['smile', 'smiling', 'open mouth', 'blush', 'angry', 'sad', 'laughing',
                 'surprised', 'embarrassed', 'serious', 'pout', 'tongue out',
                 'tears', 'crying', 'shy', 'nervous'],
    body: ['slim', 'skinny', 'muscular', 'tall', 'short', 'chibi', 'petite',
           'curvy', 'plump', 'loli', 'shota', 'bishounen', 'bishoujo'],
    clothing: ['dress', 'skirt', 'shirt', 'jacket', 'school uniform', 'kimono', 'armor',
               'swimsuit', 'maid', 'chinese clothes', 'hoodie', 'sweater', 'coat',
               'jeans', 'shorts', 'pants', 'leggings', 't-shirt', 'tank top',
               'suit', 'tuxedo', 'military uniform', 'sailor uniform', 'yukata',
               'cheongsam', 'hanfu'],
    accessories: ['glasses', 'earrings', 'necklace', 'hat', 'ribbon', 'bow',
                  'headband', 'cat ears', 'hairpin', 'hair ornament', 'choker',
                  'bracelet', 'watch', 'bag', 'backpack', 'wings', 'halo',
                  'mask', 'crown', 'tiara', 'goggles', 'belt'],
    pose: ['standing', 'sitting', 'lying', 'looking at viewer', 'looking away',
           'arms up', 'hand on hip', 'crossed arms', 'kneeling', 'squatting',
           'walking', 'running', 'jumping', 'fighting pose', 'peace sign',
           'v sign', 'salute', 'waving', 'holding', 'reaching out'],
    trigger_words: [],
  },

  style: {
    medium: ['anime style', 'realistic', 'semi-realistic', 'sketch', 'watercolor',
             'oil painting', 'lineart', 'flat color', 'digital painting', '3d', 'cg',
             'anime coloring', 'anime screenshot', 'manga style', 'comic',
             'vector', 'pixel art', 'voxel', 'lowpoly'],
    rendering: ['cel shading', 'soft shading', 'detailed', 'intricate', 'highres',
                'masterpiece', 'best quality', 'absurdres', 'ultra detailed',
                'highly detailed', 'sharp focus', 'depth of field',
                'bloom', 'chromatic aberration', 'vignette', 'lens flare',
                'motion blur', 'bokeh', 'film grain', 'god rays'],
    art_style: ['monochrome', 'greyscale', 'sepia', 'vibrant colors', 'muted colors',
                'pastel', 'dark', 'colorful', 'flat design', 'minimalist',
                'pop art', 'impressionism', 'art nouveau', 'art deco',
                'baroque', 'renaissance', 'ukiyo-e', 'sumi-e',
                'fantasy art', 'sci-fi art', 'steampunk', 'cyberpunk'],
    composition: ['portrait', 'full body', 'close-up', 'cowboy shot', 'dutch angle',
                  'from above', 'from below', 'side view', 'back view',
                  'headshot', 'bust shot', 'upper body', 'thighs shot',
                  'wide shot', 'panoramic', 'fisheye', 'tilted', 'centered',
                  'off-center', 'rule of thirds', 'symmetrical'],
    background: ['simple background', 'white background', 'transparent', 'gradient',
                 'outdoors', 'indoors', 'nature', 'city', 'night', 'day',
                 'sky', 'ocean', 'beach', 'forest', 'mountain', 'room',
                 'classroom', 'street', 'building', 'ruins', 'castle',
                 'fantasy', 'underwater', 'space', 'abstract background',
                 'detailed background'],
  },

  badTags: {
    conflictingPairs: [
      ['1girl', '1boy'],
      ['1boy', '1girl'],
      ['black hair', 'blonde hair'],
      ['black hair', 'white hair'],
      ['blonde hair', 'white hair'],
      ['day', 'night'],
      ['smile', 'angry'],
      ['smile', 'sad'],
      ['open mouth', 'closed mouth'],
      ['nude', 'clothed'],
      ['short hair', 'long hair'],
      ['standing', 'sitting'],
      ['outdoors', 'indoors'],
    ],
    negativeQuality: [
      'blurry', 'blurred', 'low quality', 'worst quality', 'bad quality',
      'lowres', 'jpeg artifacts', 'noise', 'grainy', 'distorted',
      'poorly drawn', 'bad anatomy', 'extra fingers', 'missing fingers',
      'fused fingers', 'too many fingers', 'mutation', 'deformed',
      'disfigured', 'ugly', 'bad proportions', 'gross proportions',
      'poorly drawn face', 'poorly drawn hands', 'poorly drawn feet',
      'extra limbs', 'missing limbs', 'bad hands', 'bad feet',
      'watermark', 'signature', 'text', 'username', 'logo',
      '模糊', '灰色', '灰色湖面', '模糊画面', '不清楚', '低质量',
      '画质差', '崩坏', '变形', '畸形', '水印', '文字',
    ],
    overfitRisk: [
      'Taylor Swift', 'Ariana Grande', 'Billie Eilish', 'BTS',
      'Mona Lisa', 'Starry Night', 'Nike', 'Adidas', 'Gucci', 'Louis Vuitton',
    ],
  },

  customRules: [],
};

/** Deep-clone an object (JSON-safe) */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Merge user overrides into builtin defaults */
function mergeLib(userLib) {
  if (!userLib) return deepClone(BUILTIN);
  const merged = deepClone(BUILTIN);
  for (const cat of ['character', 'style', 'badTags']) {
    if (userLib[cat]) {
      for (const group of Object.keys(userLib[cat])) {
        if (userLib[cat][group] && Array.isArray(userLib[cat][group])) {
          merged[cat][group] = userLib[cat][group];
        }
      }
    }
  }
  if (userLib.customRules && Array.isArray(userLib.customRules)) {
    merged.customRules = userLib.customRules;
  }
  return merged;
}

/** Load keyword lib — merge builtin + localStorage custom */
export function loadKeywordLib() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return mergeLib(JSON.parse(saved));
    }
  } catch (e) {
    console.warn('Failed to load keyword lib from localStorage:', e);
  }
  return deepClone(BUILTIN);
}

/** Save user customizations to localStorage */
export function saveKeywordLib(lib) {
  // Only store custom overrides (not full builtin, to save space and allow
  // builtin updates without clobbering user data)
  const custom = { character: {}, style: {}, badTags: {}, customRules: lib.customRules || [] };
  for (const cat of ['character', 'style']) {
    for (const group of Object.keys(lib[cat] || {})) {
      const builtinSet = new Set(BUILTIN[cat][group] || []);
      const current = lib[cat][group] || [];
      // Store only non-builtin items and ensure we store the full set if items
      // were removed from builtin
      const userModified = current.filter(k => !builtinSet.has(k));
      const userRemoved = (BUILTIN[cat][group] || []).filter(k => !current.includes(k));
      if (userModified.length > 0 || userRemoved.length > 0) {
        custom[cat][group] = current; // Store full list if any divergence
      }
    }
  }
  for (const group of Object.keys(lib.badTags || {})) {
    const builtinSet = new Set((BUILTIN.badTags[group] || []).map(
      Array.isArray(group) ? JSON.stringify : x => x));
    const current = lib.badTags[group] || [];
    const currentSet = new Set(current.map(
      Array.isArray(group) ? JSON.stringify : x => x));
    if (currentSet.size !== builtinSet.size ||
        ![...currentSet].every(x => builtinSet.has(x))) {
      custom.badTags[group] = current;
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  } catch (e) {
    console.warn('Failed to save keyword lib:', e);
  }
}

/** Export full keyword lib as JSON file */
export function exportKeywordLib(lib) {
  const blob = new Blob([JSON.stringify(lib, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lora-tag-inspector-keywords-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import keyword lib from JSON file, return merged result */
export function importKeywordLib(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        resolve(mergeLib(imported));
      } catch (e) {
        reject(new Error('JSON 解析失败: ' + e.message));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/** Reset to builtin defaults, clear localStorage */
export function resetToDefaults() {
  localStorage.removeItem(STORAGE_KEY);
  return deepClone(BUILTIN);
}

/** Flatten all keywords from a category into a single Set for fast lookup */
export function flattenCategory(lib, category) {
  const set = new Set();
  for (const group of Object.keys(lib[category] || {})) {
    const items = lib[category][group];
    if (Array.isArray(items)) {
      // For conflictingPairs, flatten differently
      if (group === 'conflictingPairs') {
        for (const pair of items) {
          if (Array.isArray(pair)) {
            for (const item of pair) set.add(item.toLowerCase().trim());
          }
        }
      } else {
        for (const item of items) {
          if (typeof item === 'string') set.add(item.toLowerCase().trim());
        }
      }
    }
  }
  return set;
}

/** Get conflicting pairs as array of [string, string] */
export function getConflictingPairs(lib) {
  return (lib.badTags && lib.badTags.conflictingPairs) || [];
}

/** Get negative quality keywords as a Set */
export function getNegativeQualitySet(lib) {
  const words = (lib.badTags && lib.badTags.negativeQuality) || [];
  return new Set(words.map(w => w.toLowerCase().trim()));
}

/** Get overfit risk keywords */
export function getOverfitRiskSet(lib) {
  const words = (lib.badTags && lib.badTags.overfitRisk) || [];
  return new Set(words.map(w => w.toLowerCase().trim()));
}

/** Get custom rules array */
export function getCustomRules(lib) {
  return (lib.customRules) || [];
}

export { BUILTIN, STORAGE_KEY };
```

- [ ] **Step 2: Verify in browser console**

Open `index.html` in browser, open DevTools console:

```javascript
import { loadKeywordLib, flattenCategory, getConflictingPairs } from './js/keyword-lib.js';
const lib = loadKeywordLib();
console.log('Character words:', flattenCategory(lib, 'character').size);
console.log('Style words:', flattenCategory(lib, 'style').size);
console.log('Conflict pairs:', getConflictingPairs(lib).length);
```

Expected: Character words > 60, Style words > 50, Conflict pairs = 13.

---

### Task 3: Tag Parser Module

**Files:**
- Create: `lora-tag-inspector/js/tag-parser.js`

- [ ] **Step 1: Write tag-parser.js**

```javascript
// tag-parser.js — Parse txt content into structured tag array with positions

/**
 * Parse comma-separated tag text into array of {text, startIndex, endIndex}
 * Handles: "tag1, tag2, tag3" and "tag1,tag2,tag3" (with or without space after comma)
 * Preserves original text positions for highlighting.
 *
 * @param {string} rawText
 * @returns {{text: string, startIndex: number, endIndex: number}[]}
 */
export function parseTags(rawText) {
  const tags = [];
  if (!rawText || !rawText.trim()) return tags;

  let i = 0;
  const len = rawText.length;

  while (i < len) {
    // Skip leading whitespace
    while (i < len && rawText[i] === ' ' && rawText[i] !== ',') i++;

    // Find next comma or end of string
    let start = i;
    let end = i;

    while (end < len && rawText[end] !== ',') {
      end++;
    }

    // Extract tag text
    const text = rawText.slice(start, end).trim();

    if (text.length > 0) {
      tags.push({ text, startIndex: start, endIndex: end });
    }

    // Skip past comma
    i = end + 1;
  }

  return tags;
}

/**
 * Attempt to read file content with encoding fallback.
 * Tries UTF-8 first, then GBK if garbled characters detected.
 *
 * @param {File|Blob} file
 * @returns {Promise<{content: string, encoding: string}>}
 */
export async function readFileWithEncoding(file) {
  // Try UTF-8 first
  try {
    const content = await file.text();
    // Check for garbled characters (common replacement character)
    if (!content.includes('�')) {
      return { content, encoding: 'UTF-8' };
    }
  } catch (e) {
    // Fall through to GBK attempt
  }

  // Try GBK
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('gbk');
    const content = decoder.decode(buffer);
    return { content, encoding: 'GBK' };
  } catch (e) {
    throw new Error('无法识别文件编码，请尝试用 UTF-8 或 GBK 编码保存文件');
  }
}

/**
 * Check if file is too large (>500KB).
 * @param {File} file
 * @returns {boolean}
 */
export function isLargeFile(file) {
  return file.size > 500 * 1024;
}

/**
 * Normalize a tag for fuzzy comparison:
 * - lowercase
 * - replace underscores with spaces
 * - collapse multiple spaces
 */
export function normalizeTag(text) {
  return text.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Find tags that appear more than once, with optional fuzzy matching.
 *
 * @param {{text: string, startIndex: number, endIndex: number}[]} tags
 * @param {boolean} fuzzy - Enable fuzzy matching
 * @returns {{text: string, startIndex: number, endIndex: number, message: string}[]}
 */
export function findDuplicates(tags, fuzzy = false) {
  const results = [];
  const seen = new Map(); // normalizedKey -> {firstTag, count, indices}

  for (const tag of tags) {
    const key = fuzzy ? normalizeTag(tag.text) : tag.text.toLowerCase().trim();

    if (seen.has(key)) {
      const entry = seen.get(key);
      entry.count++;
      entry.indices.push({ startIndex: tag.startIndex, endIndex: tag.endIndex });
    } else {
      seen.set(key, {
        firstTag: tag,
        count: 1,
        indices: [{ startIndex: tag.startIndex, endIndex: tag.endIndex }],
      });
    }
  }

  for (const [key, entry] of seen) {
    if (entry.count >= 2) {
      // Mark all occurrences
      const normText = fuzzy ? normalizeTag(entry.firstTag.text) : entry.firstTag.text;
      const msg = fuzzy
        ? `重复标签 (模糊): "${normText}" 出现 ${entry.count} 次`
        : `重复标签: "${entry.firstTag.text}" 出现 ${entry.count} 次`;
      for (const idx of entry.indices) {
        results.push({
          text: entry.firstTag.text,
          startIndex: idx.startIndex,
          endIndex: idx.endIndex,
          message: msg,
        });
      }
    }
  }

  return results;
}
```

- [ ] **Step 2: Test in browser console**

```javascript
import { parseTags, findDuplicates, normalizeTag } from './js/tag-parser.js';

const sample = '1girl, blue eyes, long hair, blue eyes, smile';
const tags = parseTags(sample);
console.assert(tags.length === 5, 'Should parse 5 tags');
console.assert(tags[0].text === '1girl', 'First tag should be 1girl');

const dups = findDuplicates(tags);
console.assert(dups.length === 2, 'Should find 2 duplicate entries for blue eyes');
console.assert(dups[0].startIndex !== dups[1].startIndex, 'Duplicates at different positions');

// Fuzzy test
const sample2 = 'blue eyes, blue_eyes, Blue Eyes';
const tags2 = parseTags(sample2);
const dupsFuzzy = findDuplicates(tags2, true);
console.assert(dupsFuzzy.length === 3, 'Fuzzy: all 3 should be duplicates');

console.log('Tag parser tests passed');
```

---

### Task 4: Check Engine Module

**Files:**
- Create: `lora-tag-inspector/js/check-engine.js`

- [ ] **Step 1: Write check-engine.js**

```javascript
// check-engine.js — Execute checks on parsed tags

import { findDuplicates } from './tag-parser.js';
import {
  flattenCategory,
  getConflictingPairs,
  getNegativeQualitySet,
  getOverfitRiskSet,
  getCustomRules,
} from './keyword-lib.js';

const CHECK_PRIORITY = {
  badTags: 1,
  custom: 2,
  duplicate: 3,
  character: 4,
  style: 5,
};

// Patterns for meaningless tags
const MEANINGLESS_PATTERNS = [
  /^.$/,                    // Single character
  /^[^\w一-鿿぀-ゟ゠-ヿ]+$/, // Pure punctuation/symbols
  /^[\d.]+$/,               // Pure numbers/dots
  /^[ -]+$/,     // Control characters
];

function isMeaningless(text) {
  return MEANINGLESS_PATTERNS.some(p => p.test(text.trim()));
}

// Pattern for overfit risk: known names, dates, URLs
const OVERFIT_PATTERNS = [
  /\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/,  // Dates like 2024/01/01
  /https?:\/\/\S+/,                          // URLs
  /@\w+/,                                     // Social media handles
];

function isOverfitPattern(text) {
  return OVERFIT_PATTERNS.some(p => p.test(text));
}

/**
 * Run all enabled checks on parsed tags.
 *
 * @param {{text: string, startIndex: number, endIndex: number}[]} tags
 * @param {{badTags: boolean, custom: boolean, duplicate: boolean,
 *          fuzzyDuplicate: boolean, character: boolean, style: boolean}} checks
 * @param {object} keywordLib - Merged keyword lib
 * @returns {{type: string, priority: number, tag: string,
 *            startIndex: number, endIndex: number, message: string}[]}
 */
export function runChecks(tags, checks, keywordLib) {
  const allIssues = [];

  // 1. Bad Tags (priority 1)
  if (checks.badTags) {
    allIssues.push(...checkBadTags(tags, keywordLib));
  }

  // 2. Custom Rules (priority 2)
  if (checks.custom) {
    allIssues.push(...checkCustomRules(tags, keywordLib));
  }

  // 3. Duplicates (priority 3)
  if (checks.duplicate) {
    const dups = findDuplicates(tags, checks.fuzzyDuplicate);
    for (const d of dups) {
      allIssues.push({
        type: 'duplicate',
        priority: CHECK_PRIORITY.duplicate,
        tag: d.text,
        startIndex: d.startIndex,
        endIndex: d.endIndex,
        message: d.message,
      });
    }
  }

  // 4. Character (priority 4)
  if (checks.character) {
    allIssues.push(...checkKeywordMatch(tags, keywordLib, 'character', 'character'));
  }

  // 5. Style (priority 5)
  if (checks.style) {
    allIssues.push(...checkKeywordMatch(tags, keywordLib, 'style', 'style'));
  }

  // Sort and deduplicate by priority (keep highest priority per position)
  return deduplicateByPriority(allIssues);
}

function checkBadTags(tags, lib) {
  const issues = [];
  const conflictPairs = getConflictingPairs(lib);
  const negativeSet = getNegativeQualitySet(lib);
  const overfitSet = getOverfitRiskSet(lib);

  // Build lookup map for conflict detection
  const tagTexts = tags.map(t => t.text.toLowerCase().trim());
  const tagSet = new Set(tagTexts);

  // Check each tag
  for (const tag of tags) {
    const lower = tag.text.toLowerCase().trim();

    // 1a. Meaningless tags
    if (isMeaningless(tag.text)) {
      issues.push({
        type: 'badTags',
        priority: CHECK_PRIORITY.badTags,
        tag: tag.text,
        startIndex: tag.startIndex,
        endIndex: tag.endIndex,
        message: `无意义标签: "${tag.text}"`,
      });
      continue;
    }

    // 1b. Negative quality
    if (negativeSet.has(lower)) {
      issues.push({
        type: 'badTags',
        priority: CHECK_PRIORITY.badTags,
        tag: tag.text,
        startIndex: tag.startIndex,
        endIndex: tag.endIndex,
        message: `负面质量描述: "${tag.text}" — 建议移除`,
      });
      continue;
    }

    // 1c. Overfit risk
    if (overfitSet.has(lower) || isOverfitPattern(tag.text)) {
      issues.push({
        type: 'badTags',
        priority: CHECK_PRIORITY.badTags,
        tag: tag.text,
        startIndex: tag.startIndex,
        endIndex: tag.endIndex,
        message: `过拟合风险: "${tag.text}" — 可能导致过拟合`,
      });
      continue;
    }
  }

  // 1d. Conflicting pairs — check if both tags in a pair exist in the same file
  for (const pair of conflictPairs) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const [a, b] = pair;
    const aLower = a.toLowerCase().trim();
    const bLower = b.toLowerCase().trim();
    if (tagSet.has(aLower) && tagSet.has(bLower)) {
      // Find positions for both and mark them
      for (const tag of tags) {
        const lower = tag.text.toLowerCase().trim();
        if (lower === aLower || lower === bLower) {
          issues.push({
            type: 'badTags',
            priority: CHECK_PRIORITY.badTags,
            tag: tag.text,
            startIndex: tag.startIndex,
            endIndex: tag.endIndex,
            message: `冲突标签: "${a}" 与 "${b}" 同时存在，建议移除其中一个`,
          });
        }
      }
    }
  }

  return issues;
}

function checkKeywordMatch(tags, lib, category, type) {
  const issues = [];
  const keywordSet = flattenCategory(lib, category);

  for (const tag of tags) {
    const lower = tag.text.toLowerCase().trim();
    if (keywordSet.has(lower)) {
      issues.push({
        type,
        priority: CHECK_PRIORITY[type],
        tag: tag.text,
        startIndex: tag.startIndex,
        endIndex: tag.endIndex,
        message: `${type === 'character' ? '角色特征' : '风格相关'}: "${tag.text}"`,
      });
    }
  }

  return issues;
}

function checkCustomRules(tags, lib) {
  const issues = [];
  const rules = getCustomRules(lib);
  if (!rules || rules.length === 0) return issues;

  for (const rule of rules) {
    if (!rule.pattern) continue;
    try {
      const regex = new RegExp(rule.pattern, 'gi');
      for (const tag of tags) {
        if (regex.test(tag.text)) {
          issues.push({
            type: 'custom',
            priority: CHECK_PRIORITY.custom,
            tag: tag.text,
            startIndex: tag.startIndex,
            endIndex: tag.endIndex,
            message: `自定义规则 "${rule.name}": "${tag.text}"`,
          });
        }
      }
    } catch (e) {
      console.warn(`Invalid regex pattern in custom rule "${rule.name}":`, e);
    }
  }

  return issues;
}

/**
 * Deduplicate issues by position — keep only the highest priority issue
 * for each tag position. Lower priority number = higher priority.
 */
function deduplicateByPriority(issues) {
  // Group by startIndex
  const byPosition = new Map();
  for (const issue of issues) {
    const key = issue.startIndex;
    if (!byPosition.has(key) || issue.priority < byPosition.get(key).priority) {
      byPosition.set(key, issue);
    }
  }
  return [...byPosition.values()].sort((a, b) => a.startIndex - b.startIndex);
}

/** Count issues by type */
export function countByType(issues) {
  const counts = { badTags: 0, custom: 0, duplicate: 0, character: 0, style: 0 };
  for (const issue of issues) {
    if (counts[issue.type] !== undefined) counts[issue.type]++;
  }
  return counts;
}

export { CHECK_PRIORITY };
```

- [ ] **Step 2: Test in browser console**

```javascript
import { loadKeywordLib } from './js/keyword-lib.js';
import { parseTags } from './js/tag-parser.js';
import { runChecks, countByType } from './js/check-engine.js';

const lib = loadKeywordLib();
const checks = { badTags: true, custom: false, duplicate: true, fuzzyDuplicate: false, character: true, style: true };
const sample = '1girl, blue eyes, blurry, 1boy, blue eyes, a, masterpiece, smile';
const tags = parseTags(sample);
const issues = runChecks(tags, checks, lib);

console.log('Issues found:', issues.length);
console.log('Counts:', countByType(issues));

// Verify specific issues
const badIssues = issues.filter(i => i.type === 'badTags');
console.assert(badIssues.some(i => i.tag === 'blurry'), 'Should flag blurry');
console.assert(badIssues.some(i => i.tag === 'a'), 'Should flag single char');
console.assert(badIssues.some(i => i.tag === '1girl'), 'Should flag 1girl in conflict');
console.assert(badIssues.some(i => i.tag === '1boy'), 'Should flag 1boy in conflict');

const dupIssues = issues.filter(i => i.type === 'duplicate');
console.assert(dupIssues.length === 2, 'Should have 2 duplicate entries for blue eyes');

const charIssues = issues.filter(i => i.type === 'character');
console.assert(charIssues.some(i => i.tag === '1girl'), 'Should flag 1girl as character');
console.assert(charIssues.some(i => i.tag === 'smile'), 'Should flag smile as character');

console.log('Check engine tests passed');
```

---

### Task 5: File Manager Module

**Files:**
- Create: `lora-tag-inspector/js/file-manager.js`

- [ ] **Step 1: Write file-manager.js**

```javascript
// file-manager.js — File loading, management, save

import { readFileWithEncoding, isLargeFile } from './tag-parser.js';

/**
 * Initialize file manager state
 * @returns {{
 *   files: Array<{name: string, content: string, modified: boolean, fileHandle: FileSystemFileHandle|null}>,
 *   activeFileIndex: number,
 *   activeTabIds: number[],
 *   hasWriteAccess: boolean
 * }}
 */
export function createFileState() {
  return {
    files: [],
    activeFileIndex: -1,
    activeTabIds: [],
    hasWriteAccess: false,
  };
}

/**
 * Check if File System Access API is available.
 */
export function checkWriteSupport() {
  return typeof window.showDirectoryPicker === 'function';
}

/**
 * Load files from a directory picked by user.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {object} fileState
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<object>} updated fileState
 */
export async function loadFromDirectory(dirHandle, fileState, onProgress) {
  const files = [];
  let skipped = 0;

  async function scanDir(handle, prefix = '') {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'file' && name.toLowerCase().endsWith('.txt')) {
        files.push({ handle: entry, name: prefix + name });
      } else if (entry.kind === 'directory') {
        await scanDir(entry, prefix + name + '/');
      }
    }
  }

  await scanDir(dirHandle);

  if (files.length === 0) {
    throw new Error('文件夹中未找到 .txt 文件');
  }

  return loadFiles(files, fileState, onProgress, skipped);
}

/**
 * Load files from drag/drop or file input.
 * @param {File[]|{handle: FileSystemFileHandle, name: string}[]} fileEntries
 * @param {object} fileState
 * @param {function} onProgress
 * @returns {Promise<object>} updated fileState
 */
export async function loadFiles(fileEntries, fileState, onProgress, skipped = 0) {
  const newFiles = [];

  for (const entry of fileEntries) {
    let file, fileHandle, name;

    if (entry instanceof File) {
      // From drag/drop or <input type="file">
      file = entry;
      name = entry.name;
      fileHandle = null;
      if (!name.toLowerCase().endsWith('.txt')) {
        skipped++;
        continue;
      }
    } else {
      // From File System Access API
      fileHandle = entry.handle;
      name = entry.name;
      file = await fileHandle.getFile();
    }

    // Check size
    if (isLargeFile(file)) {
      const proceed = confirm(`文件 "${name}" 较大 (${(file.size/1024).toFixed(1)}KB)，加载可能变慢，是否继续？`);
      if (!proceed) { skipped++; continue; }
    }

    try {
      const { content, encoding } = await readFileWithEncoding(file);
      newFiles.push({
        name,
        content,
        originalContent: content,
        modified: false,
        fileHandle,
        encoding,
      });
    } catch (e) {
      console.error(`Failed to read ${name}:`, e);
      alert(`无法读取文件 "${name}"：${e.message}`);
      skipped++;
    }
  }

  if (newFiles.length === 0 && fileState.files.length === 0) {
    throw new Error('未找到可读取的 .txt 文件');
  }

  // Sort by name
  newFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  // Merge with existing files (update if same name)
  for (const nf of newFiles) {
    const existingIdx = fileState.files.findIndex(f => f.name === nf.name);
    if (existingIdx >= 0) {
      fileState.files[existingIdx] = nf;
    } else {
      fileState.files.push(nf);
    }
  }

  // Open first file if nothing open
  if (fileState.activeFileIndex < 0 && fileState.files.length > 0) {
    fileState.activeFileIndex = 0;
    fileState.activeTabIds = [0];
  }

  if (onProgress) {
    onProgress({ loaded: newFiles.length, skipped, total: fileState.files.length });
  }

  return fileState;
}

/**
 * Get the currently active file object.
 */
export function getActiveFile(fileState) {
  if (fileState.activeFileIndex < 0 || fileState.activeFileIndex >= fileState.files.length) {
    return null;
  }
  return fileState.files[fileState.activeFileIndex];
}

/**
 * Switch to a file by index. Returns the file or null.
 */
export function switchFile(fileState, index) {
  if (index < 0 || index >= fileState.files.length) return null;
  fileState.activeFileIndex = index;
  if (!fileState.activeTabIds.includes(index)) {
    fileState.activeTabIds.push(index);
  }
  return fileState.files[index];
}

/**
 * Close a tab. Returns the new active index or -1.
 */
export function closeTab(fileState, index) {
  fileState.activeTabIds = fileState.activeTabIds.filter(i => i !== index);

  if (fileState.activeTabIds.length === 0) {
    fileState.activeFileIndex = -1;
    return -1;
  }

  if (fileState.activeFileIndex === index) {
    fileState.activeFileIndex = fileState.activeTabIds[fileState.activeTabIds.length - 1];
  }

  return fileState.activeFileIndex;
}

/**
 * Update file content (called on each editor change).
 */
export function updateFileContent(fileState, index, newContent) {
  if (index < 0 || index >= fileState.files.length) return;
  const f = fileState.files[index];
  f.content = newContent;
  f.modified = (newContent !== f.originalContent);
}

/**
 * Save current file back to disk.
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function saveFile(fileState, index) {
  const f = fileState.files[index];
  if (!f) return { success: false, message: '文件不存在' };

  if (f.fileHandle) {
    // File System Access API — write in place
    try {
      // Verify permission
      const opts = { mode: 'readwrite' };
      if ((await f.fileHandle.queryPermission(opts)) !== 'granted') {
        await f.fileHandle.requestPermission(opts);
      }

      const writable = await f.fileHandle.createWritable();
      await writable.write(f.content);
      await writable.close();
      f.originalContent = f.content;
      f.modified = false;
      return { success: true, message: '保存成功' };
    } catch (e) {
      if (e.name === 'NotFoundError') {
        return { success: false, message: '文件已被删除或移动，请重新加载' };
      }
      return { success: false, message: `保存失败: ${e.message}` };
    }
  } else {
    // Fallback: download the modified file
    try {
      const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
      f.originalContent = f.content;
      f.modified = false;
      return { success: true, message: '已下载保存（浏览器不支持直接写入）' };
    } catch (e) {
      return { success: false, message: `保存失败: ${e.message}` };
    }
  }
}

/**
 * Check if any file has unsaved changes.
 */
export function hasUnsavedChanges(fileState) {
  return fileState.files.some(f => f.modified);
}

/**
 * Get all files with unsaved changes.
 */
export function getModifiedFiles(fileState) {
  return fileState.files.filter(f => f.modified);
}
```

- [ ] **Step 2: Verify API support**

```javascript
import { checkWriteSupport } from './js/file-manager.js';
console.log('File System Access API:', checkWriteSupport() ? 'Supported' : 'Fallback mode');
```

---

### Task 6: Editor Module (CodeMirror 6)

**Files:**
- Create: `lora-tag-inspector/js/editor.js`

- [ ] **Step 1: Write editor.js**

```javascript
// editor.js — CodeMirror 6 wrapper with highlight decorations

import {
  EditorState,
  StateField,
  StateEffect,
  RangeSet,
} from 'https://esm.sh/@codemirror/state@6.4.1';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  Decoration,
  WidgetType,
  GutterMarker,
} from 'https://esm.sh/@codemirror/view@6.33.0';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from 'https://esm.sh/@codemirror/commands@6.6.0';
import { searchKeymap, highlightSelectionMatches } from 'https://esm.sh/@codemirror/search@6.5.8';
import { syntaxHighlighting, defaultHighlightStyle } from 'https://esm.sh/@codemirror/language@6.10.5';

// Highlight color config
const HIGHLIGHT_CLASSES = {
  badTags: 'cm-highlight-bad',
  custom: 'cm-highlight-custom',
  duplicate: 'cm-highlight-duplicate',
  character: 'cm-highlight-character',
  style: 'cm-highlight-style',
};

const HIGHLIGHT_COLORS = {
  badTags: '#FF922B',
  custom: '#74C0FC',
  duplicate: '#FFD43B',
  character: '#FF6B6B',
  style: '#51CF66',
};

/** Effect to update decorations from issues array */
const setIssues = StateEffect.define();

/** Gutter marker widget */
class IssueGutterMarker extends GutterMarker {
  constructor(types) {
    super();
    this.types = types; // Array of {type, color}
  }
  toDOM() {
    const container = document.createElement('span');
    container.style.display = 'flex';
    container.style.gap = '1px';
    container.style.paddingTop = '2px';
    for (const t of this.types.slice(0, 3)) {
      const dot = document.createElement('span');
      dot.className = 'gutter-marker';
      dot.style.background = t.color;
      container.appendChild(dot);
    }
    return container;
  }
}

/** Build DecorationSet from issues array */
function buildDecorations(issues) {
  const decorations = [];
  // Group issues by line for gutter markers
  const lineIssues = new Map();

  for (const issue of issues) {
    const cls = HIGHLIGHT_CLASSES[issue.type] || 'cm-highlight-custom';
    decorations.push(
      Decoration.mark({ class: cls, attributes: { title: issue.message } }).range(
        issue.startIndex,
        issue.endIndex
      )
    );
  }

  return { decorations: Decoration.set(decorations, true) };
}

/** The StateField that holds the current decoration set */
const highlightField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setIssues)) {
        const result = buildDecorations(e.value);
        return result.decorations;
      }
    }
    return decos.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f),
});

/**
 * Create CodeMirror editor instance.
 * @param {HTMLElement} parent - Container element
 * @param {string} initialContent - Initial text
 * @param {function} onChange - Called with (content) on every change
 * @returns {EditorView}
 */
export function createEditor(parent, initialContent, onChange) {
  const startState = EditorState.create({
    doc: initialContent || '',
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      highlightField,
      EditorView.updateListener.of(update => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString());
        }
      }),
    ],
  });

  const view = new EditorView({
    state: startState,
    parent,
  });

  return view;
}

/**
 * Update the editor's highlight decorations.
 * @param {EditorView} view
 * @param {Array} issues - Array of {startIndex, endIndex, type, message}
 */
export function updateHighlights(view, issues) {
  view.dispatch({
    effects: setIssues.of(issues || []),
  });
}

/**
 * Navigate to a specific position in the editor.
 */
export function navigateTo(view, startIndex) {
  const pos = Math.min(startIndex, view.state.doc.length);
  view.dispatch({
    selection: { anchor: pos, head: pos },
    scrollIntoView: true,
  });
}

/**
 * Get current editor content.
 */
export function getContent(view) {
  return view.state.doc.toString();
}

/**
 * Set editor content and reset history.
 */
export function setContent(view, content) {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: content || '',
    },
  });
  // Clear undo history by creating a new state
  view.setState(EditorState.create({
    doc: content || '',
    extensions: view.state.facet(EditorState.transactionExtender).length > 0
      ? [] : [], // This won't perfectly clear history, but works for our use case
  }));
}

/** Rebuild editor with fresh state (used when switching files) */
export function resetEditorContent(view, content) {
  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    drawSelection(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    history(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
    highlightField,
    EditorView.updateListener.of(update => {
      if (update.docChanged && view._onChange) {
        view._onChange(update.state.doc.toString());
      }
    }),
  ];

  const newState = EditorState.create({
    doc: content || '',
    extensions,
  });
  view.setState(newState);
}

export { HIGHLIGHT_CLASSES, HIGHLIGHT_COLORS };
```

- [ ] **Step 2: Verify editor loads in browser**

Open `index.html`, in console:

```javascript
import { createEditor, updateHighlights } from './js/editor.js';
const container = document.getElementById('editor-container');
const view = createEditor(container, '1girl, blue eyes, smile, blurry', (c) => console.log('changed:', c.length));
console.log('Editor created, content length:', view.state.doc.length);

// Test highlights
updateHighlights(view, [
  { type: 'character', startIndex: 0, endIndex: 5, message: 'Character tag' },
  { type: 'badTags', startIndex: 24, endIndex: 30, message: 'Bad quality tag' },
]);
```

Expected: Editor renders with highlighted ranges.

---

### Task 7: App Controller — Integration

**Files:**
- Create: `lora-tag-inspector/js/app.js`

- [ ] **Step 1: Write app.js — main controller**

```javascript
// app.js — Main controller wiring all modules together

import { loadKeywordLib, saveKeywordLib, exportKeywordLib, importKeywordLib, resetToDefaults } from './keyword-lib.js';
import { parseTags } from './tag-parser.js';
import { runChecks, countByType } from './check-engine.js';
import {
  createFileState, checkWriteSupport, loadFromDirectory, loadFiles,
  getActiveFile, switchFile, closeTab, updateFileContent,
  saveFile, hasUnsavedChanges, getModifiedFiles,
} from './file-manager.js';
import { createEditor, updateHighlights, resetEditorContent, getContent, navigateTo } from './editor.js';

// ─── State ────────────────────────────────────────────────
const fileState = createFileState();
const keywordLib = loadKeywordLib();
let editorView = null;
let currentIssues = [];
let pendingUnsavedAction = null; // Callback to execute after unsaved dialog resolves

// Check config
const checks = {
  badTags: true, custom: false, duplicate: true,
  fuzzyDuplicate: false, character: true, style: true,
};

// ─── DOM Elements ─────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  dropZone: $('#drop-zone'),
  fileListContainer: $('#file-list-container'),
  fileList: $('#file-list'),
  fileCount: $('#file-count'),
  editorContainer: $('#editor-container'),
  tabBar: $('#tab-bar'),
  statusTags: $('#status-tags'),
  statusModified: $('#status-modified'),
  statusSkipped: $('#status-skipped'),
  btnSelectFolder: $('#btn-select-folder'),
  btnSelectFiles: $('#btn-select-files'),
  fileInputHidden: $('#file-input-hidden'),
  filesInputHidden: $('#files-input-hidden'),
  bannerReadonly: $('#banner-readonly'),
  summaryItems: $$('#issue-summary .summary-item'),
  settingsModal: $('#settings-modal'),
  unsavedModal: $('#unsaved-modal'),
  unsavedMessage: $('#unsaved-message'),
};

// ─── Initialize ───────────────────────────────────────────
function init() {
  // Check write support
  if (!checkWriteSupport()) {
    dom.bannerReadonly.style.display = 'block';
  }

  // Load saved check states
  loadCheckStates();

  // Bind events
  bindFileEvents();
  bindCheckEvents();
  bindSettingsEvents();
  bindKeyboardShortcuts();
  bindUnsavedDialog();
  bindWindowUnload();
  renderSettingsTabs();
}

// ─── File Events ──────────────────────────────────────────
function bindFileEvents() {
  // Drag and drop
  dom.dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dom.dropZone.classList.add('drag-over');
  });
  dom.dropZone.addEventListener('dragleave', () => {
    dom.dropZone.classList.remove('drag-over');
  });
  dom.dropZone.addEventListener('drop', async e => {
    e.preventDefault();
    dom.dropZone.classList.remove('drag-over');
    const items = e.dataTransfer.items;
    if (!items) return;

    const entries = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = await item.getAsFileSystemHandle?.();
        if (entry) {
          entries.push(entry);
        } else {
          // Fallback for browsers without getAsFileSystemHandle
          const file = item.getAsFile();
          if (file) entries.push({ handle: null, file, name: file.name });
        }
      }
    }

    if (entries.length > 0) {
      await handleEntries(entries);
    }
  });

  // Folder select button
  dom.btnSelectFolder.addEventListener('click', async () => {
    if (!checkWriteSupport()) {
      dom.fileInputHidden.click();
      return;
    }
    try {
      const dirHandle = await window.showDirectoryPicker();
      await loadFromDirectory(dirHandle, fileState, onProgress);
      dom.fileListContainer.style.display = 'block';
      renderFileList();
      openActiveFile();
    } catch (e) {
      if (e.name !== 'AbortError') throw e;
    }
  });

  // File select button
  dom.btnSelectFiles.addEventListener('click', () => {
    dom.filesInputHidden.click();
  });

  // Traditional file input (webkitdirectory fallback)
  dom.fileInputHidden.addEventListener('change', async () => {
    const files = [...dom.fileInputHidden.files];
    await loadFiles(files, fileState, onProgress);
    dom.fileListContainer.style.display = 'block';
    renderFileList();
    openActiveFile();
  });

  dom.filesInputHidden.addEventListener('change', async () => {
    const files = [...dom.filesInputHidden.files];
    await loadFiles(files, fileState, onProgress);
    dom.fileListContainer.style.display = 'block';
    renderFileList();
    openActiveFile();
  });
}

async function handleEntries(entries) {
  // Separate into directories and files
  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.kind === 'directory') {
      dirs.push(entry);
    } else if (entry.kind === 'file') {
      files.push({ handle: entry, name: entry.name });
    }
  }

  let totalSkipped = 0;
  for (const dir of dirs) {
    try {
      await loadFromDirectory(dir, fileState, (p) => {
        totalSkipped += p.skipped;
        onProgress({ loaded: fileState.files.length, skipped: totalSkipped, total: fileState.files.length });
      });
    } catch (e) {
      console.error('Failed to load directory:', e);
    }
  }

  if (files.length > 0) {
    await loadFiles(files, fileState, onProgress, totalSkipped);
  }

  dom.fileListContainer.style.display = 'block';
  renderFileList();
  openActiveFile();
}

function onProgress(info) {
  if (info.skipped > 0) {
    dom.statusSkipped.style.display = 'inline';
    dom.statusSkipped.textContent = ` | 已跳过 ${info.skipped} 个非txt文件`;
  }
}

// ─── File List & Tabs ─────────────────────────────────────
function renderFileList() {
  dom.fileList.innerHTML = '';
  dom.fileCount.textContent = `(${fileState.files.length})`;

  for (let i = 0; i < fileState.files.length; i++) {
    const f = fileState.files[i];
    const li = document.createElement('li');
    li.innerHTML = `${f.modified ? '<span class="modified-dot">●</span>' : ''}${f.name}`;
    if (i === fileState.activeFileIndex) li.classList.add('active');
    li.addEventListener('click', () => {
      if (fileState.activeFileIndex >= 0) {
        const active = fileState.files[fileState.activeFileIndex];
        if (active.modified) {
          pendingUnsavedAction = () => openFile(i);
          showUnsavedDialog(`"${active.name}" 已修改，是否保存？`);
          return;
        }
      }
      openFile(i);
    });
    dom.fileList.appendChild(li);
  }
}

function renderTabs() {
  dom.tabBar.innerHTML = '';
  for (const idx of fileState.activeTabIds) {
    const f = fileState.files[idx];
    const tab = document.createElement('div');
    tab.className = 'tab';
    if (idx === fileState.activeFileIndex) tab.classList.add('active');
    tab.innerHTML = `
      <span class="${f.modified ? 'tab-modified' : ''}">${f.modified ? '● ' : ''}${f.name}</span>
      <span class="tab-close" data-idx="${idx}">&times;</span>
    `;
    tab.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeFileTab(idx);
    });
    tab.addEventListener('click', () => {
      if (fileState.activeFileIndex >= 0) {
        const active = fileState.files[fileState.activeFileIndex];
        if (active.modified && fileState.activeFileIndex !== idx) {
          pendingUnsavedAction = () => openFile(idx);
          showUnsavedDialog(`"${active.name}" 已修改，是否保存？`);
          return;
        }
      }
      openFile(idx);
    });
    dom.tabBar.appendChild(tab);
  }
}

function openFile(index) {
  const f = switchFile(fileState, index);
  if (!f) return;

  renderFileList();
  renderTabs();

  if (!editorView) {
    editorView = createEditor(dom.editorContainer, f.content, (newContent) => {
      updateFileContent(fileState, index, newContent);
      rerunChecks();
      updateStatusBar();
    });
  } else {
    resetEditorContent(editorView, f.content);
    editorView._onChange = (newContent) => {
      updateFileContent(fileState, index, newContent);
      rerunChecks();
      updateStatusBar();
    };
  }

  rerunChecks();
  updateStatusBar();
}

function closeFileTab(index) {
  const f = fileState.files[index];
  if (f.modified) {
    pendingUnsavedAction = () => {
      const newIdx = closeTab(fileState, index);
      if (newIdx >= 0) openFile(newIdx);
      else clearEditor();
      renderFileList();
      renderTabs();
    };
    showUnsavedDialog(`"${f.name}" 已修改，是否保存？`);
    return;
  }

  const newIdx = closeTab(fileState, index);
  if (newIdx >= 0) openFile(newIdx);
  else clearEditor();
  renderFileList();
  renderTabs();
}

function clearEditor() {
  if (editorView) {
    resetEditorContent(editorView, '');
    updateHighlights(editorView, []);
  }
  currentIssues = [];
  updateSummary();
  updateStatusBar();
}

function openActiveFile() {
  if (fileState.activeFileIndex >= 0) {
    openFile(fileState.activeFileIndex);
  }
}

// ─── Check Logic ──────────────────────────────────────────
function rerunChecks() {
  if (!editorView) return;
  const content = getContent(editorView);
  if (!content || !content.trim()) {
    currentIssues = [];
    updateHighlights(editorView, []);
    updateSummary();
    return;
  }

  const tags = parseTags(content);
  dom.statusTags.textContent = `${tags.length} 个标签`;
  currentIssues = runChecks(tags, checks, keywordLib);
  updateHighlights(editorView, currentIssues);
  updateSummary();
}

function updateSummary() {
  const counts = countByType(currentIssues);
  for (const item of dom.summaryItems) {
    const type = item.dataset.type;
    const count = counts[type] || 0;
    const prefix = { badTags: '🟠 不良', custom: '🔵 自定义', duplicate: '🟡 重复', character: '🔴 角色', style: '🟢 风格' };
    item.textContent = `${prefix[type] || type}: ${count}`;
    item.classList.toggle('zero', count === 0);
  }
}

function updateStatusBar() {
  const active = getActiveFile(fileState);
  if (active) {
    dom.statusModified.style.display = active.modified ? 'inline' : 'none';
  } else {
    dom.statusModified.style.display = 'none';
    dom.statusTags.textContent = '0 个标签';
  }
}

// ─── Checkbox Events ──────────────────────────────────────
function bindCheckEvents() {
  const checkIds = {
    'chk-bad-tags': 'badTags', 'chk-custom': 'custom',
    'chk-duplicate': 'duplicate', 'chk-fuzzy': 'fuzzyDuplicate',
    'chk-character': 'character', 'chk-style': 'style',
  };

  for (const [id, key] of Object.entries(checkIds)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener('change', () => {
      checks[key] = el.checked;
      saveCheckStates();
      rerunChecks();
    });
  }

  // Summary items click → navigate to first issue of that type
  for (const item of dom.summaryItems) {
    item.addEventListener('click', () => {
      const type = item.dataset.type;
      const firstIssue = currentIssues.find(i => i.type === type);
      if (firstIssue && editorView) {
        navigateTo(editorView, firstIssue.startIndex);
      }
    });
  }
}

function loadCheckStates() {
  try {
    const saved = localStorage.getItem('lora-inspector-checks');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(checks, parsed);
    }
  } catch (e) { /* ignore */ }
  // Sync DOM
  const checkIds = {
    'chk-bad-tags': 'badTags', 'chk-custom': 'custom',
    'chk-duplicate': 'duplicate', 'chk-fuzzy': 'fuzzyDuplicate',
    'chk-character': 'character', 'chk-style': 'style',
  };
  for (const [id, key] of Object.entries(checkIds)) {
    const el = document.getElementById(id);
    if (el) el.checked = checks[key];
  }
}

function saveCheckStates() {
  try {
    localStorage.setItem('lora-inspector-checks', JSON.stringify(checks));
  } catch (e) { /* ignore */ }
}

// ─── Keyboard Shortcuts ───────────────────────────────────
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', async e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      await saveCurrentFile();
    }
  });
}

async function saveCurrentFile() {
  if (fileState.activeFileIndex < 0) return;
  const result = await saveFile(fileState, fileState.activeFileIndex);
  if (!result.success) {
    alert(result.message);
  }
  renderFileList();
  renderTabs();
  updateStatusBar();
}

// ─── Settings Modal ───────────────────────────────────────
function bindSettingsEvents() {
  $('#btn-settings').addEventListener('click', () => {
    renderSettingsTabs();
    dom.settingsModal.style.display = 'flex';
  });

  $('.modal-close').addEventListener('click', () => {
    dom.settingsModal.style.display = 'none';
  });

  dom.settingsModal.addEventListener('click', e => {
    if (e.target === dom.settingsModal) {
      dom.settingsModal.style.display = 'none';
    }
  });

  // Tab buttons
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.tab-content').forEach(c => c.classList.remove('active'));
      const tabId = btn.dataset.tab;
      $(`#${tabId}`).classList.add('active');
    });
  });

  $('#btn-save-settings').addEventListener('click', () => {
    saveSettingsFromForm();
    saveKeywordLib(keywordLib);
    dom.settingsModal.style.display = 'none';
    rerunChecks();
  });

  $('#btn-reset-defaults').addEventListener('click', () => {
    if (confirm('确定要重置所有词库到默认值吗？此操作不可撤销。')) {
      const fresh = resetToDefaults();
      Object.assign(keywordLib, fresh);
      renderSettingsTabs();
      rerunChecks();
    }
  });
}

function renderSettingsTabs() {
  // Character tab
  renderKeywordGroup('tab-char', keywordLib.character, 'character');

  // Style tab
  renderKeywordGroup('tab-style-kw', keywordLib.style, 'style');

  // Bad tags tab
  renderBadTagsTab();

  // Conflict pairs tab
  renderConflictTab();

  // Custom rules tab
  renderCustomRulesTab();

  // Import/Export tab
  renderIOTab();
}

function renderKeywordGroup(containerId, category, catName) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (const [group, words] of Object.entries(category)) {
    if (group === 'trigger_words') {
      // Trigger words are simple text input
      const div = document.createElement('div');
      div.className = 'kw-group';
      div.innerHTML = `<h4>触发词 (trigger words)</h4>`;
      const row = document.createElement('div');
      row.className = 'kw-add-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '输入触发词，逗号分隔';
      input.value = (words || []).join(', ');
      row.appendChild(input);
      row.innerHTML += `<button class="btn-save-triggers" data-cat="${catName}">保存</button>`;
      div.appendChild(row);

      div.querySelector('.btn-save-triggers').addEventListener('click', () => {
        category.trigger_words = input.value.split(',').map(w => w.trim()).filter(Boolean);
      });

      container.appendChild(div);
      continue;
    }

    const div = document.createElement('div');
    div.className = 'kw-group';
    div.innerHTML = `<h4>${group}</h4><div class="kw-tags" data-group="${group}" data-cat="${catName}"></div>`;

    const tagsDiv = div.querySelector('.kw-tags');

    const renderTags = () => {
      tagsDiv.innerHTML = '';
      for (const word of (words || [])) {
        const tag = document.createElement('span');
        tag.className = 'kw-tag';
        tag.innerHTML = `${word} <span class="kw-remove" data-word="${word}" data-group="${group}" data-cat="${catName}">&times;</span>`;
        tagsDiv.appendChild(tag);
      }

      // Remove handler
      tagsDiv.querySelectorAll('.kw-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const w = btn.dataset.word;
          const g = btn.dataset.group;
          const idx = category[g].indexOf(w);
          if (idx >= 0) category[g].splice(idx, 1);
          renderTags();
        });
      });

      // Add row
      const addRow = document.createElement('div');
      addRow.className = 'kw-add-row';
      addRow.innerHTML = `<input type="text" placeholder="添加新词..." data-group="${group}" data-cat="${catName}">
        <button data-group="${group}" data-cat="${catName}">+</button>`;
      addRow.querySelector('button').addEventListener('click', () => {
        const inp = addRow.querySelector('input');
        const val = inp.value.trim();
        if (val && !category[group].includes(val)) {
          category[group].push(val);
          renderTags();
        }
      });
      addRow.querySelector('input').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          addRow.querySelector('button').click();
        }
      });
      tagsDiv.appendChild(addRow);
    };

    renderTags();
    container.appendChild(div);
  }
}

function renderBadTagsTab() {
  const container = $('#tab-bad');
  container.innerHTML = '';

  // Negative quality
  const divNQ = document.createElement('div');
  divNQ.className = 'kw-group';
  divNQ.innerHTML = `<h4>负面质量描述</h4><div class="kw-tags" id="kw-bad-quality"></div>`;
  container.appendChild(divNQ);
  renderSimpleKwList('kw-bad-quality', keywordLib.badTags.negativeQuality, 'negativeQuality');

  // Overfit risk
  const divOF = document.createElement('div');
  divOF.className = 'kw-group';
  divOF.innerHTML = `<h4>过拟合风险</h4><div class="kw-tags" id="kw-overfit"></div>`;
  container.appendChild(divOF);
  renderSimpleKwList('kw-overfit', keywordLib.badTags.overfitRisk, 'overfitRisk');
}

function renderSimpleKwList(containerId, array, key) {
  const container = document.getElementById(containerId);

  const renderTags = () => {
    container.innerHTML = '';
    for (const word of array) {
      const tag = document.createElement('span');
      tag.className = 'kw-tag';
      tag.innerHTML = `${word} <span class="kw-remove" data-word="${word}">&times;</span>`;
      tag.querySelector('.kw-remove').addEventListener('click', () => {
        const idx = array.indexOf(word);
        if (idx >= 0) array.splice(idx, 1);
        renderTags();
      });
      container.appendChild(tag);
    }

    const addRow = document.createElement('div');
    addRow.className = 'kw-add-row';
    addRow.innerHTML = `<input type="text" placeholder="添加新词..."><button>+</button>`;
    addRow.querySelector('button').addEventListener('click', () => {
      const val = addRow.querySelector('input').value.trim();
      if (val && !array.includes(val)) {
        array.push(val);
        renderTags();
      }
    });
    addRow.querySelector('input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addRow.querySelector('button').click();
    });
    container.appendChild(addRow);
  };

  renderTags();
}

function renderConflictTab() {
  const container = $('#tab-conflict');
  container.innerHTML = '';
  const pairs = keywordLib.badTags.conflictingPairs;

  const renderPairs = () => {
    container.innerHTML = '';
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const row = document.createElement('div');
      row.className = 'conflict-pair-row';
      row.innerHTML = `<span>${pair[0]}</span> <span>↔</span> <span>${pair[1]}</span>
        <button data-idx="${i}">删除</button>`;
      row.querySelector('button').addEventListener('click', () => {
        pairs.splice(i, 1);
        renderPairs();
      });
      container.appendChild(row);
    }

    const addRow = document.createElement('div');
    addRow.className = 'kw-add-row';
    addRow.style.marginTop = '8px';
    addRow.innerHTML = `<input type="text" placeholder="标签 A">
      <input type="text" placeholder="标签 B">
      <button>+</button>`;
    addRow.querySelector('button').addEventListener('click', () => {
      const inputs = addRow.querySelectorAll('input');
      const a = inputs[0].value.trim();
      const b = inputs[1].value.trim();
      if (a && b) {
        pairs.push([a, b]);
        renderPairs();
      }
    });
    container.appendChild(addRow);
  };

  renderPairs();
}

function renderCustomRulesTab() {
  const container = $('#tab-custom-rules');
  container.innerHTML = '';
  const rules = keywordLib.customRules;

  const renderRules = () => {
    container.innerHTML = '';
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const row = document.createElement('div');
      row.className = 'custom-rule-row';
      row.innerHTML = `
        <input type="text" value="${escapeHtml(rule.name || '')}" placeholder="规则名称" data-idx="${i}" class="rule-name">
        <input type="text" value="${escapeHtml(rule.pattern || '')}" placeholder="正则表达式" data-idx="${i}" class="rule-pattern">
        <input type="color" value="${rule.color || '#74C0FC'}" data-idx="${i}" class="rule-color">
        <button data-idx="${i}" class="btn-del-rule">删除</button>
      `;

      row.querySelector('.rule-name').addEventListener('change', e => { rules[i].name = e.target.value; });
      row.querySelector('.rule-pattern').addEventListener('change', e => {
        rules[i].pattern = e.target.value;
        try { new RegExp(e.target.value); } catch (ex) { e.target.style.borderColor = 'red'; return; }
        e.target.style.borderColor = '';
      });
      row.querySelector('.rule-color').addEventListener('change', e => { rules[i].color = e.target.value; });
      row.querySelector('.btn-del-rule').addEventListener('click', () => {
        rules.splice(i, 1);
        renderRules();
      });
      container.appendChild(row);
    }

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ 添加自定义规则';
    addBtn.style.marginTop = '8px';
    addBtn.addEventListener('click', () => {
      rules.push({ name: '新规则', pattern: '', color: '#74C0FC' });
      renderRules();
    });
    container.appendChild(addBtn);
  };

  renderRules();
}

function renderIOTab() {
  const container = $('#tab-io');
  container.innerHTML = `
    <div class="kw-group">
      <h4>导出词库配置</h4>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">
        将当前词库（内置+自定义）导出为 JSON 文件，用于备份或分享
      </p>
      <button id="btn-export-kw">📤 导出配置 JSON</button>
    </div>
    <div class="kw-group">
      <h4>导入词库配置</h4>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">
        从 JSON 文件导入词库配置，会合并到当前词库
      </p>
      <input type="file" id="import-kw-file" accept=".json">
    </div>
    <div class="kw-group">
      <h4>重置</h4>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">
        清除所有自定义，恢复到内置默认词库
      </p>
      <button id="btn-reset-kw" style="color:var(--character);border-color:var(--character);">🔄 重置到默认</button>
    </div>
  `;

  $('#btn-export-kw').addEventListener('click', () => exportKeywordLib(keywordLib));
  $('#import-kw-file').addEventListener('change', async e => {
    if (e.target.files[0]) {
      try {
        const imported = await importKeywordLib(e.target.files[0]);
        Object.assign(keywordLib, imported);
        saveKeywordLib(keywordLib);
        alert('配置导入成功！');
        renderSettingsTabs();
        rerunChecks();
      } catch (err) {
        alert('导入失败: ' + err.message);
      }
    }
  });
  $('#btn-reset-kw').addEventListener('click', () => {
    if (confirm('确定要重置所有词库到默认值吗？此操作不可撤销。')) {
      const fresh = resetToDefaults();
      Object.assign(keywordLib, fresh);
      renderSettingsTabs();
      rerunChecks();
      alert('已重置到默认词库');
    }
  });
}

function saveSettingsFromForm() {
  // Settings are edited in-place in keywordLib, so they're already saved.
  // This function exists for future form-based settings.
}

// ─── Unsaved Changes Dialog ───────────────────────────────
function bindUnsavedDialog() {
  $('#unsaved-save').addEventListener('click', async () => {
    await saveCurrentFile();
    dom.unsavedModal.style.display = 'none';
    if (pendingUnsavedAction) {
      pendingUnsavedAction();
      pendingUnsavedAction = null;
    }
  });

  $('#unsaved-discard').addEventListener('click', () => {
    dom.unsavedModal.style.display = 'none';
    if (pendingUnsavedAction) {
      pendingUnsavedAction();
      pendingUnsavedAction = null;
    }
  });

  $('#unsaved-cancel').addEventListener('click', () => {
    dom.unsavedModal.style.display = 'none';
    pendingUnsavedAction = null;
  });
}

function showUnsavedDialog(message) {
  dom.unsavedMessage.textContent = message || '当前文件已修改，是否保存？';
  dom.unsavedModal.style.display = 'flex';
}

function bindWindowUnload() {
  window.addEventListener('beforeunload', e => {
    if (hasUnsavedChanges(fileState)) {
      e.preventDefault();
      e.returnValue = '有未保存的修改，确定离开吗？';
      return e.returnValue;
    }
  });
}

// ─── Helper ────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Start ────────────────────────────────────────────────
init();
```

- [ ] **Step 2: Full integration test**

Start local server:
```bash
cd C:/Users/10466/lora-tag-inspector && python -m http.server 8080
```

Test full flow:
1. Open `http://localhost:8080` in Chrome/Edge
2. Click "选择文件" and select some .txt tag files
3. Verify files appear in left sidebar, first file opens in editor
4. Toggle checkboxes and verify highlights update
5. Edit text and verify "已修改" indicator appears
6. Press Ctrl+S and verify save completes
7. Click between files, verify tab switching works
8. Open settings, add a keyword, save, verify it's detected
9. Import/export keyword config JSON
10. Close a tab with unsaved changes, verify dialog appears

Expected: All features work as designed.

---

### Task 8: Polish & Edge Cases

**Files:**
- Modify: `lora-tag-inspector/css/style.css`
- Modify: `lora-tag-inspector/js/app.js`

- [ ] **Step 1: Add debounce to check rerun for performance**

In `app.js`, add a debounce utility and wrap `rerunChecks`:

```javascript
// Debounce utility — add near top of app.js, after imports
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Replace the onChange callback in openFile() to use debounced rerun
// Change this (in the createEditor call):
editorView = createEditor(dom.editorContainer, f.content, (newContent) => {
  updateFileContent(fileState, index, newContent);
  rerunChecks();
  updateStatusBar();
});

// To this:
const debouncedRerun = debounce(rerunChecks, 300);
editorView = createEditor(dom.editorContainer, f.content, (newContent) => {
  updateFileContent(fileState, index, newContent);
  debouncedRerun();
  updateStatusBar();
});

// Same change for the resetEditorContent branch:
const debouncedRerun2 = debounce(rerunChecks, 300);
editorView._onChange = (newContent) => {
  updateFileContent(fileState, index, newContent);
  debouncedRerun2();
  updateStatusBar();
};
```

*Note: The native `title` attribute on CodeMirror decorations (set in editor.js `buildDecorations`) already provides hover tooltips showing the issue message. No additional tooltip library needed.*

- [ ] **Step 2: Add empty state for editor**

Add to `app.js` `clearEditor()` function:

```javascript
function clearEditor() {
  if (editorView) {
    resetEditorContent(editorView, '');
    updateHighlights(editorView, []);
  }
  currentIssues = [];
  updateSummary();
  updateStatusBar();

  // Show empty state hint in editor container
  if (!dom.editorContainer.querySelector('.empty-state')) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="empty-icon">📄</div><p>选择文件以开始检查</p>';
    dom.editorContainer.appendChild(empty);
  }
}
```

And remove the empty state when opening a file (add at top of `openFile`):

```javascript
const emptyEl = dom.editorContainer.querySelector('.empty-state');
if (emptyEl) emptyEl.remove();
```

- [ ] **Step 3: Add responsive drag-over visual for the whole page**

Add to `style.css`:

```css
/* Global drag feedback */
body.file-drag-over #drop-zone {
  border-color: var(--accent);
  background: rgba(124, 124, 255, 0.1);
  box-shadow: inset 0 0 0 2px var(--accent);
}
```

Add to `app.js` `init()`:

```javascript
document.addEventListener('dragover', e => {
  e.preventDefault();
  if (e.dataTransfer.types.includes('Files')) {
    document.body.classList.add('file-drag-over');
  }
});
document.addEventListener('dragleave', e => {
  if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
    document.body.classList.remove('file-drag-over');
  }
});
document.addEventListener('drop', () => {
  document.body.classList.remove('file-drag-over');
});
```

- [ ] **Step 4: Verify all edge cases**

Test each scenario from the spec §7:

| Scenario | Test | Expected |
|----------|------|----------|
| Non-txt files | Drop a folder with .png, .txt mixed | Only .txt shown, status shows skip count |
| Empty txt | Open an empty .txt file | Editor blank, "0 个标签", no errors |
| Large file | Open a >500KB txt | Confirm dialog appears |
| FS API unavailable | Open in Firefox | Readonly banner shows, save downloads instead |
| File deleted | Save after external delete | Error message shown |
| Switch unsaved | Edit, click another file | Unsaved dialog appears |
| Browser close | Edit, close tab | beforeunload dialog |

- [ ] **Step 5: Final verification**

```bash
cd C:/Users/10466/lora-tag-inspector && python -m http.server 8080
```

Open `http://localhost:8080`, test complete user workflow end-to-end.

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | `index.html`, `css/style.css` | Project skeleton, full layout HTML + dark theme CSS |
| 2 | `js/keyword-lib.js` | Built-in keyword library, localStorage persistence, import/export |
| 3 | `js/tag-parser.js` | Comma-separated tag parsing, encoding detection, duplicate finder |
| 4 | `js/check-engine.js` | 5 check types with priority deduplication |
| 5 | `js/file-manager.js` | Drag/drop, folder select, file list, tabs, save with FS API |
| 6 | `js/editor.js` | CodeMirror 6 wrapper with Decoration API highlight rendering |
| 7 | `js/app.js` | Main controller — all modules wired, events, settings modal |
| 8 | Polish | Tooltips, empty states, edge case hardening, final verification |

**Total: 8 tasks, ~4-6 hours implementation time.**
