# 自定义关键词检查 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将正则规则替换为直观的关键词包含匹配，新增右侧面板快捷输入 + 设置弹窗持久化管理

**Architecture:** keyword-lib 改数据模型（customRules[] → customKeywords[]），check-engine 改匹配逻辑（regex → includes），UI 双层配合（临时/持久化），删除融入现有 batchDelete 体系

**Tech Stack:** 纯前端 JS/HTML/CSS，CodeMirror 6，ES Modules，localStorage

---

## 文件职责

| 文件 | 职责 |
|------|------|
| `js/keyword-lib.js` | 数据模型：`customRules` → `customKeywords`，localStorage 读写 |
| `js/check-engine.js` | `checkCustomRules` → `checkCustomKeywords`，包含匹配 |
| `css/style.css` | 紫色高亮 `.cm-highlight-custom`，快捷面板 `.kw-panel` |
| `index.html` | 检查选项标签改文字/颜色，新增快捷输入面板区域 |
| `js/app.js` | 临时关键词管理、设置Tab渲染、"仅删关键词"按钮 |

---

### Task 1: keyword-lib.js — 数据模型迁移

**Files:**
- Modify: `C:\Users\10466\lora-tag-inspector\js\keyword-lib.js`

- [ ] **Step 1: 将 BUILTIN.customRules 改为 customKeywords**

定位到 line 98：`customRules: []`，替换为：
```js
customKeywords: [],
```

- [ ] **Step 2: 修改 mergeLib 中的 customRules 合并逻辑**

定位到 line 119-121，将 `customRules` 合并改为 `customKeywords`：
```js
// 旧 (lines 119-121):
if (userLib.customRules && Array.isArray(userLib.customRules)) {
  merged.customRules = userLib.customRules;
}

// 新:
if (userLib.customKeywords && Array.isArray(userLib.customKeywords)) {
  merged.customKeywords = userLib.customKeywords;
}
```

- [ ] **Step 3: 修改 saveKeywordLib 中的 customRules 存储**

定位到 line 142，`custom: { character: {}, style: {}, badTags: {}, customRules: lib.customRules || [] }`，替换为：
```js
const custom = { character: {}, style: {}, badTags: {}, customKeywords: lib.customKeywords || [] };
```

- [ ] **Step 4: 修改 getCustomRules 导出函数**

定位到 lines 246-248，替换为：
```js
/** Get custom keywords array */
export function getCustomKeywords(lib) {
  return (lib.customKeywords) || [];
}
```

保留旧的 `getCustomRules` 作为 deprecated wrapper（兼容处理）：
```js
/** @deprecated Use getCustomKeywords instead */
export function getCustomRules(lib) {
  return [];
}
```

- [ ] **Step 5: 验证**

在浏览器控制台执行：
```js
const lib = await import('./js/keyword-lib.js');
console.log(lib.getCustomKeywords({ customKeywords: ['test', 'nsfw'] }));
// Expected: ['test', 'nsfw']
console.log(lib.getCustomRules({ customRules: [{name:'x',pattern:'y'}] }));
// Expected: [] (always empty)
```

---

### Task 2: check-engine.js — 检查逻辑替换

**Files:**
- Modify: `C:\Users\10466\lora-tag-inspector\js\check-engine.js`

- [ ] **Step 1: 修改 import**

定位到 line 6，将 `getCustomRules` 替换为 `getCustomKeywords`：
```js
import {
  flattenCategory,
  getConflictingPairs,
  getNegativeQualitySet,
  getOverfitRiskSet,
  getCustomKeywords,
} from './keyword-lib.js';
```

- [ ] **Step 2: 修改 runChecks 中的 custom rules 调用**

定位到 lines 61-63：
```js
// 旧:
// 2. Custom Rules (priority 2)
if (checks.custom) {
  allIssues.push(...checkCustomRules(tags, keywordLib));
}

// 新:
// 2. Custom Keywords (priority 2)
if (checks.custom) {
  allIssues.push(...checkCustomKeywords(tags, keywordLib));
}
```

- [ ] **Step 3: 替换 checkCustomRules 函数为 checkCustomKeywords**

定位到 lines 197-224，整个函数替换为：
```js
function checkCustomKeywords(tags, lib) {
  const issues = [];
  const keywords = getCustomKeywords(lib);
  if (!keywords || keywords.length === 0) return issues;

  for (const tag of tags) {
    const lower = tag.text.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        issues.push({
          type: 'custom',
          priority: CHECK_PRIORITY.custom,
          tag: tag.text,
          startIndex: tag.startIndex,
          endIndex: tag.endIndex,
          message: `自定义关键词: "${tag.text}" 包含 "${kw}"`,
        });
        break; // 一个标签只报一次
      }
    }
  }
  return issues;
}
```

- [ ] **Step 4: 验证**

浏览器刷新后，在设置中添加关键词 `bad`，勾选自定义关键词，打开含 `bad quality` 标签的文件，确认出现高亮。

---

### Task 3: style.css — 新增样式

**Files:**
- Modify: `C:\Users\10466\lora-tag-inspector\css\style.css`

- [ ] **Step 1: 新增 CSS 变量 `--custom-kw`**

在 `:root` 块（line 14 后）添加：
```css
--custom-kw: #c084fc;
```

- [ ] **Step 2: 修改自定义高亮颜色**

定位到 line 259（`.cm-highlight-custom`），将 `#74C0FC` 改为 `var(--custom-kw)`：
```css
.cm-highlight-custom { background: rgba(192, 132, 252, 0.25); border-bottom: 2px solid var(--custom-kw); }
```

- [ ] **Step 3: 新增快捷关键词面板样式**

在 `#btn-batch-delete:hover` 块后（line 341 后）插入：
```css
/* Custom keywords quick panel */
#kw-panel {
  display: none;
  margin: 0 0 8px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface2);
}

#kw-panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

#kw-panel-header span {
  font-size: 12px;
  color: var(--custom-kw);
  font-weight: bold;
}

#kw-input-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

#kw-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
}

#kw-input::placeholder { color: var(--text-dim); }

#btn-kw-add {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--custom-kw);
  border-radius: 4px;
  background: var(--surface2);
  color: var(--custom-kw);
  cursor: pointer;
  white-space: nowrap;
}
#btn-kw-add:hover { background: var(--custom-kw); color: #fff; }

#kw-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
  min-height: 4px;
}

.kw-tag-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  font-size: 11px;
  background: rgba(192, 132, 252, 0.15);
  border: 1px solid rgba(192, 132, 252, 0.3);
  border-radius: 10px;
  color: var(--custom-kw);
  cursor: default;
}

.kw-tag-item .kw-remove {
  cursor: pointer;
  font-size: 12px;
  opacity: 0.7;
}
.kw-tag-item .kw-remove:hover { opacity: 1; }

#kw-actions {
  display: flex;
  gap: 6px;
}

#kw-actions button {
  font-size: 11px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
}
#kw-actions button:hover { color: var(--text); border-color: var(--text-dim); }

#btn-kw-delete-only {
  border-color: var(--custom-kw) !important;
  color: var(--custom-kw) !important;
}
#btn-kw-delete-only:hover { background: var(--custom-kw) !important; color: #fff !important; }
```

- [ ] **Step 4: 验证**

刷新浏览器，检查面板关键词输入区样式是否正常。

---

### Task 4: index.html — UI 骨架

**Files:**
- Modify: `C:\Users\10466\lora-tag-inspector\index.html`

- [ ] **Step 1: 修改「自定义规则」标签**

定位到 lines 56-60（自定义规则 checkbox），替换为：
```html
<label class="check-item" data-priority="2">
  <input type="checkbox" id="chk-custom">
  <span class="check-color" style="background:#c084fc;"></span>
  自定义关键词
</label>
```

- [ ] **Step 2: 新增快捷关键词面板（在 btn-batch-delete 之后）**

在 line 81（`<button id="btn-batch-delete">...</button>`）之后、`<hr>` 之前插入：
```html
<div id="kw-panel">
  <div id="kw-panel-header">
    <span>🔍 自定义关键词</span>
  </div>
  <div id="kw-input-row">
    <input type="text" id="kw-input" placeholder="输入关键词，回车添加...">
    <button id="btn-kw-add">+</button>
  </div>
  <div id="kw-tags"></div>
  <div id="kw-actions">
    <button id="btn-kw-delete-only" title="仅删除自定义关键词匹配的标签">🗑 仅删关键词</button>
    <button id="btn-kw-manage" title="打开设置管理持久化关键词">⚙ 管理</button>
  </div>
</div>
```

- [ ] **Step 3: 修改设置弹窗 Tab 按钮文字**

定位到 line 109，将 `自定义正则规则` 改为 `自定义关键词`：
```html
<button class="tab-btn" data-tab="tab-custom-rules">自定义关键词</button>
```

- [ ] **Step 4: 验证**

刷新浏览器，确认检查选项显示 `自定义关键词` 紫色圆点，快捷面板在按钮下方。

---

### Task 5: app.js — 控制器逻辑

**Files:**
- Modify: `C:\Users\10466\lora-tag-inspector\js\app.js`

- [ ] **Step 1: 新增 import**

定位到 line 10，`getCustomRules` → `getCustomKeywords`：
```js
import {
  flattenCategory,
  getConflictingPairs,
  getNegativeQualitySet,
  getOverfitRiskSet,
  getCustomKeywords,
} from './keyword-lib.js';
```

- [ ] **Step 2: 新增临时关键词状态**

在 `let currentIssues = []` 后（line 19）添加：
```js
let tempKeywords = []; // Session-only keywords from quick panel
```

- [ ] **Step 3: 新增 DOM 引用**

在 `dom` 对象中（line 53 `btnBatchDelete` 后）添加：
```js
kwPanel: $('#kw-panel'),
kwInput: $('#kw-input'),
kwTags: $('#kw-tags'),
kwBtnAdd: $('#btn-kw-add'),
kwBtnDeleteOnly: $('#btn-kw-delete-only'),
kwBtnManage: $('#btn-kw-manage'),
```

- [ ] **Step 4: 修改 rerunChecks 传入运行时关键词**

定位到 line 448，`runChecks(tags, checks, keywordLib)` 需要改为传入合并后的关键词。在 `rerunChecks` 函数中，line 448 前插入临时关键词注入：
```js
// Build runtime keyword lib with temp keywords merged
const runtimeLib = { ...keywordLib };
runtimeLib.customKeywords = [
  ...(keywordLib.customKeywords || []),
  ...tempKeywords,
];
currentIssues = runChecks(tags, checks, runtimeLib);
```

- [ ] **Step 5: 新增 bindKeywordPanel 函数并调用**

在 `bindDeleteButton()` 调用后（`init()` 中 line 69 后）添加：
```js
bindKeywordPanel();
```

新增 `bindKeywordPanel` 函数（放在 `bindDeleteButton` 后面）：

```js
function bindKeywordPanel() {
  if (!dom.kwInput) return;

  // Toggle panel when custom checkbox changes
  const chkCustom = document.getElementById('chk-custom');
  if (chkCustom) {
    chkCustom.addEventListener('change', () => {
      dom.kwPanel.style.display = chkCustom.checked ? 'block' : 'none';
    });
    // Initial state
    dom.kwPanel.style.display = chkCustom.checked ? 'block' : 'none';
  }

  // Add keyword on Enter or button click
  function addKeyword() {
    const val = dom.kwInput.value.trim();
    if (!val) return;
    if (tempKeywords.includes(val)) {
      dom.kwInput.value = '';
      return;
    }
    tempKeywords.push(val);
    renderKwTags();
    rerunChecks();
    dom.kwInput.value = '';
    dom.kwInput.focus();
  }

  dom.kwInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  });

  if (dom.kwBtnAdd) {
    dom.kwBtnAdd.addEventListener('click', addKeyword);
  }

  // Manage button → open settings
  if (dom.kwBtnManage) {
    dom.kwBtnManage.addEventListener('click', () => {
      renderSettingsTabs();
      // Switch to custom keywords tab
      const tabBtn = document.querySelector('.tab-btn[data-tab="tab-custom-rules"]');
      if (tabBtn) tabBtn.click();
      dom.settingsModal.style.display = 'flex';
    });
  }

  // "Only delete keywords" button
  if (dom.kwBtnDeleteOnly) {
    dom.kwBtnDeleteOnly.addEventListener('click', () => {
      if (!editorView) return;
      const issues = currentIssues.filter(i => i.type === 'custom' && i.startIndex < i.endIndex);
      if (issues.length === 0) {
        alert('当前没有自定义关键词匹配的标签可删除。');
        return;
      }
      if (!confirm(`将仅删除自定义关键词匹配的 ${issues.length} 个标签。此操作可撤销 (Ctrl+Z)。确认？`)) return;

      const text = editorView.state.doc.toString();
      let ranges = issues.map(i => ({ from: i.startIndex, to: i.endIndex }));
      // Merge, extend, re-merge (same logic as batchDeleteTags)
      ranges.sort((a, b) => a.from - b.from);
      const merged = [];
      for (const r of ranges) {
        if (merged.length > 0 && r.from <= merged[merged.length - 1].to) {
          merged[merged.length - 1].to = Math.max(merged[merged.length - 1].to, r.to);
        } else { merged.push({ from: r.from, to: r.to }); }
      }
      const extended = merged.map(({ from, to }) => {
        let ef = from, et = to;
        while (et < text.length && ',\t '.includes(text[et])) et++;
        while (ef > 0 && ',\t '.includes(text[ef - 1])) ef--;
        while (et < text.length && text[et] === '\n') et++;
        while (ef > 0 && text[ef - 1] === '\n') ef--;
        return { from: ef, to: et };
      });
      extended.sort((a, b) => a.from - b.from);
      const finalRanges = [];
      for (const r of extended) {
        if (finalRanges.length > 0 && r.from <= finalRanges[finalRanges.length - 1].to) {
          finalRanges[finalRanges.length - 1].to = Math.max(finalRanges[finalRanges.length - 1].to, r.to);
        } else { finalRanges.push({ from: r.from, to: r.to }); }
      }
      finalRanges.sort((a, b) => b.from - a.from);
      editorView.dispatch({ changes: finalRanges.map(({ from, to }) => ({ from, to, insert: '' })) });

      // Cleanup
      const cleaned = editorView.state.doc.toString();
      const reClean = cleaned.replace(/,{2,}/g, ',').replace(/^[\s,]+/, '').replace(/[\s,]+$/, '').replace(/\n{3,}/g, '\n\n').replace(/,\s*,/g, ',');
      if (reClean !== cleaned) {
        editorView.dispatch({ changes: { from: 0, to: editorView.state.doc.length, insert: reClean } });
      }
      rerunChecks();
      renderFileList();
      renderTabs();
      updateStatusBar();
    });
  }
}

function renderKwTags() {
  if (!dom.kwTags) return;
  dom.kwTags.innerHTML = '';
  for (const kw of tempKeywords) {
    const tag = document.createElement('span');
    tag.className = 'kw-tag-item';
    tag.innerHTML = `${kw} <span class="kw-remove" data-kw="${escapeHtmlAttr(kw)}">&times;</span>`;
    tag.querySelector('.kw-remove').addEventListener('click', () => {
      tempKeywords = tempKeywords.filter(k => k !== kw);
      renderKwTags();
      rerunChecks();
    });
    dom.kwTags.appendChild(tag);
  }
}
```

- [ ] **Step 6: 修改 renderCustomRulesTab → renderCustomKeywordsTab**

定位到 `renderSettingsTabs` 中的 `renderCustomRulesTab()` 调用（line 750），改为：
```js
renderCustomKeywordsTab();
```

定位到 `renderCustomRulesTab` 函数（lines 941-985），整个替换为：
```js
function renderCustomKeywordsTab() {
  const container = $('#tab-custom-rules');
  if (!container) return;
  container.innerHTML = '';
  const keywords = keywordLib.customKeywords || [];

  const renderList = () => {
    container.innerHTML = '';
    
    // Input row
    const addRow = document.createElement('div');
    addRow.className = 'kw-add-row';
    addRow.style.marginBottom = '8px';
    addRow.innerHTML = `
      <input type="text" placeholder="输入关键词，回车添加..." id="settings-kw-input">
      <button id="settings-kw-add">+ 添加</button>
      <button id="settings-kw-batch">📋 批量导入</button>
    `;
    container.appendChild(addRow);

    // Tags container
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'kw-tags';
    tagsDiv.style.cssText = 'background:#1e1e2e;border-radius:4px;min-height:80px;padding:8px;';
    container.appendChild(tagsDiv);

    const renderTags = () => {
      tagsDiv.innerHTML = '';
      if (keywords.length === 0) {
        tagsDiv.innerHTML = '<span style="color:#9999bb;font-size:12px;">暂无关键词，请添加</span>';
      }
      for (const kw of keywords) {
        const tag = document.createElement('span');
        tag.className = 'kw-tag';
        tag.innerHTML = `${kw} <span class="kw-remove" data-kw="${escapeHtmlAttr(kw)}">&times;</span>`;
        tag.querySelector('.kw-remove').addEventListener('click', () => {
          const idx = keywords.indexOf(kw);
          if (idx >= 0) keywords.splice(idx, 1);
          renderTags();
        });
        tagsDiv.appendChild(tag);
      }
    };
    renderTags();

    // Hint
    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:6px;color:var(--text-dim);font-size:10px;';
    hint.textContent = '💡 持久化关键词自动保存。右侧面板可临时追加，不影响此列表。';
    container.appendChild(hint);

    // Event bindings
    const input = document.getElementById('settings-kw-input');
    const addBtn = document.getElementById('settings-kw-add');
    const batchBtn = document.getElementById('settings-kw-batch');

    function addKw() {
      const val = input.value.trim();
      if (val && !keywords.includes(val)) {
        keywords.push(val);
        renderTags();
      }
      input.value = '';
      input.focus();
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addKw(); } });
    addBtn.addEventListener('click', addKw);
    batchBtn.addEventListener('click', () => {
      const text = prompt('粘贴多个关键词，用逗号、空格或换行分隔：');
      if (!text) return;
      const newKws = text.split(/[,\n\s]+/).map(s => s.trim()).filter(Boolean);
      for (const kw of newKws) {
        if (!keywords.includes(kw)) keywords.push(kw);
      }
      renderTags();
    });
  };

  renderList();
}
```

- [ ] **Step 7: 验证**

1. 勾选「自定义关键词」→ 看到快捷面板展开
2. 输入 `1girl` → 回车 → 标签出现在面板中，编辑器中 `1girl` 紫色高亮
3. 点击 × 删除临时关键词 → 高亮消失
4. 打开设置 → 「自定义关键词」Tab → 添加 `blurry` → 保存 → 编辑器立即高亮
5. 点「仅删关键词」→ 仅删除紫色高亮的标签
6. 点「一键删除选中标签」→ 勾选类型一起删除

---

## 验证清单

| # | 验证点 | 预期 |
|---|--------|------|
| 1 | 面板显示「自定义关键词」+ 紫色圆点 | ✅ |
| 2 | 勾选后快捷面板展开 | ✅ |
| 3 | 输入关键词回车添加，标签显示在面板 | ✅ |
| 4 | 编辑器中匹配标签紫色高亮 | ✅ |
| 5 | 设置中添加的关键词持久化保存 | ✅ |
| 6 | 临时关键词刷新后消失 | ✅ |
| 7 | 「仅删关键词」只删紫色标签 | ✅ |
| 8 | 「一键删除」包含紫色标签 | ✅ |
| 9 | 删除后可 Ctrl+Z 撤销 | ✅ |
| 10 | 旧正则规则数据被忽略（不报错） | ✅ |
