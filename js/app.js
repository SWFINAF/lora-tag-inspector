// app.js — Main controller wiring all modules together

import { loadKeywordLib, saveKeywordLib, exportKeywordLib, importKeywordLib, resetToDefaults, getCustomKeywords } from './keyword-lib.js';
import { parseTags } from './tag-parser.js';
import { runChecks, countByType } from './check-engine.js';
import {
  createFileState, checkWriteSupport, loadFromDirectory, loadFiles,
  getActiveFile, switchFile, closeTab, updateFileContent,
  saveFile, hasUnsavedChanges, getModifiedFiles,
  hasImageExtension, getBaseName,
} from './file-manager.js';
import { createEditor, updateHighlights, resetEditorContent, getContent, navigateTo } from './editor.js';

// ─── State ────────────────────────────────────────────────
const fileState = createFileState();
const keywordLib = loadKeywordLib();
let originalEditorView = null;  // Top: read-only original content + highlights
let previewEditorView = null;   // Bottom: editable preview
let currentIssues = [];
let tempKeywords = []; // Session-only keywords from quick panel
let pendingUnsavedAction = null; // Callback to execute after unsaved dialog resolves
let checkedFiles = new Set(); // Indices of checked files in the file list

// Image zoom/pan state
let imageScale = 1;
let imagePanX = 0;
let imagePanY = 0;

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
  editorSplit: $('#editor-split'),
  originalEditorContainer: $('#original-editor-container'),
  previewEditorContainer: $('#preview-editor-container'),
  editorDivider: $('#editor-divider'),
  sidebarDivider: $('#sidebar-divider'),
  panelDivider: $('#panel-divider'),
  appContainer: $('#app'),
  imagePreview: $('#image-preview'),
  imagePreviewImg: $('#image-preview-img'),
  imageDivider: $('#image-divider'),
  btnImageFit: $('#btn-image-fit'),
  tabBar: $('#tab-bar'),
  statusTags: $('#status-tags'),
  statusModified: $('#status-modified'),
  statusSkipped: $('#status-skipped'),
  btnSelectFolder: $('#btn-select-folder'),
  btnSelectFiles: $('#btn-select-files'),
  fileInputHidden: $('#file-input-hidden'),
  filesInputHidden: $('#files-input-hidden'),
  bannerReadonly: $('#banner-readonly'),
  btnCloseFolder: $('#btn-close-folder'),
  btnBatchDelete: $('#btn-batch-delete'),
  btnBatchDeleteFiles: $('#btn-batch-delete-files'),
  btnBatchSaveFiles: $('#btn-batch-save-files'),
  chkSelectAll: $('#chk-select-all'),
  btnSavePreview: $('#btn-save-preview'),
  kwPanel: $('#kw-panel'),
  kwInput: $('#kw-input'),
  kwTags: $('#kw-tags'),
  kwBtnAdd: $('#btn-kw-add'),
  kwBtnDeleteOnly: $('#btn-kw-delete-only'),
  kwBtnManage: $('#btn-kw-manage'),
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
  bindDeleteButton();
  bindKeywordPanel();
  bindSaveButton();
  bindDividerDrag();
  bindSidebarDrag();
  bindPanelDrag();
  bindImageDividerDrag();
  bindImageZoomPan();
  bindBatchFileOperations();
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
        try {
          const entry = await item.getAsFileSystemHandle?.();
          if (entry) {
            entries.push(entry);
          } else {
            // Fallback for browsers without getAsFileSystemHandle
            const file = item.getAsFile();
            if (file) entries.push(file);
          }
        } catch (err) {
          const file = item.getAsFile();
          if (file) entries.push(file);
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
      if (e.name !== 'AbortError') {
        console.error('Folder select error:', e);
      }
    }
  });

  // File select button
  dom.btnSelectFiles.addEventListener('click', () => {
    dom.filesInputHidden.click();
  });

  // Traditional file input (webkitdirectory fallback)
  dom.fileInputHidden.addEventListener('change', async () => {
    const allFiles = [...dom.fileInputHidden.files];
    // Build image map from all files in the directory
    const imageMap = buildImageMapFromFiles(allFiles);
    await loadFiles(allFiles, fileState, onProgress, 0, imageMap);
    dom.fileListContainer.style.display = 'block';
    renderFileList();
    openActiveFile();
  });

  dom.filesInputHidden.addEventListener('change', async () => {
    const allFiles = [...dom.filesInputHidden.files];
    const imageMap = buildImageMapFromFiles(allFiles);
    await loadFiles(allFiles, fileState, onProgress, 0, imageMap);
    dom.fileListContainer.style.display = 'block';
    renderFileList();
    openActiveFile();
  });

  // Close folder button
  dom.btnCloseFolder.addEventListener('click', () => {
    closeFolder();
  });
}

async function handleEntries(entries) {
  // Separate into directories and files
  const dirs = [];
  const files = [];
  const imageMap = new Map();

  for (const entry of entries) {
    if (entry.kind === 'directory') {
      dirs.push(entry);
    } else if (entry.kind === 'file') {
      const name = entry.name;
      if (name.toLowerCase().endsWith('.txt')) {
        files.push({ handle: entry, name });
      } else if (hasImageExtension(name)) {
        const base = getBaseName(name);
        if (!imageMap.has(base)) {
          imageMap.set(base, entry);
        }
      }
    } else if (entry instanceof File) {
      const name = entry.name;
      if (name.toLowerCase().endsWith('.txt')) {
        files.push(entry);
      } else if (hasImageExtension(name)) {
        const base = getBaseName(name);
        if (!imageMap.has(base)) {
          imageMap.set(base, entry); // File object stored directly
        }
      }
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
    await loadFiles(files, fileState, onProgress, totalSkipped, imageMap);
  }

  dom.fileListContainer.style.display = 'block';
  renderFileList();
  openActiveFile();
}

/** Build image map from a flat list of File objects (for file inputs) */
function buildImageMapFromFiles(allFiles) {
  const imageMap = new Map();
  for (const f of allFiles) {
    if (hasImageExtension(f.name)) {
      const base = getBaseName(f.name);
      if (!imageMap.has(base)) {
        imageMap.set(base, f);
      }
    }
  }
  return imageMap;
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

  // Update select-all checkbox state
  if (dom.chkSelectAll) {
    const allChecked = fileState.files.length > 0 && checkedFiles.size === fileState.files.length;
    const someChecked = checkedFiles.size > 0 && checkedFiles.size < fileState.files.length;
    dom.chkSelectAll.checked = allChecked;
    dom.chkSelectAll.indeterminate = someChecked;
  }

  for (let i = 0; i < fileState.files.length; i++) {
    const f = fileState.files[i];
    const li = document.createElement('li');
    if (i === fileState.activeFileIndex) li.classList.add('active');

    // Checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'file-check';
    cb.dataset.index = i;
    cb.checked = checkedFiles.has(i);
    cb.addEventListener('click', e => {
      e.stopPropagation();
      if (cb.checked) {
        checkedFiles.add(i);
      } else {
        checkedFiles.delete(i);
      }
      renderFileList();
    });

    // File name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = f.name;

    // Modified dot
    if (f.modified) {
      const dot = document.createElement('span');
      dot.className = 'modified-dot';
      dot.textContent = '●';
      li.appendChild(dot);
    }
    li.appendChild(cb);
    li.appendChild(nameSpan);

    li.addEventListener('click', e => {
      // Don't open file if clicking the checkbox
      if (e.target.tagName === 'INPUT') return;
      if (fileState.activeFileIndex >= 0) {
        const active = fileState.files[fileState.activeFileIndex];
        if (active && active.modified) {
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
    if (!f) continue;
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
      if (fileState.activeFileIndex >= 0 && fileState.activeFileIndex !== idx) {
        const active = fileState.files[fileState.activeFileIndex];
        if (active && active.modified) {
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
  // Remove empty state
  const emptyEl = dom.editorContainer.querySelector('.empty-state');
  if (emptyEl) emptyEl.remove();
  // Also show editor-split in case it was hidden
  if (dom.editorSplit) dom.editorSplit.style.display = '';

  const f = switchFile(fileState, index);
  if (!f) return;

  renderFileList();
  renderTabs();

  // Show/hide associated image
  if (f.imageUrl) {
    dom.imagePreviewImg.src = f.imageUrl;
    dom.imagePreview.style.display = 'flex';
    if (dom.imageDivider) dom.imageDivider.style.display = '';
    // Reset zoom/pan state
    resetImageTransform();
  } else {
    dom.imagePreview.style.display = 'none';
    if (dom.imageDivider) dom.imageDivider.style.display = 'none';
    dom.imagePreviewImg.src = '';
  }

  // Destroy old editors if they exist
  if (originalEditorView) { originalEditorView.destroy(); originalEditorView = null; }
  if (previewEditorView) { previewEditorView.destroy(); previewEditorView = null; }

  // Top: read-only original editor with highlights
  originalEditorView = createEditor(
    dom.originalEditorContainer, f.content,
    null,  // read-only — no onChange needed
    { readOnly: true }
  );

  // Bottom: editable preview editor (starts identical to original)
  previewEditorView = createEditor(
    dom.previewEditorContainer, f.content,
    (newContent) => {
      // Manual edits in preview — update save button state only
      const active = getActiveFile(fileState);
      updateSaveButtonState(active ? newContent !== active.originalContent : false);
    }
  );

  rerunChecks();
  updateSaveButtonState(false);
  updateStatusBar();
}

function closeFileTab(index) {
  const f = fileState.files[index];
  if (f && f.modified) {
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
  if (originalEditorView) {
    originalEditorView.destroy();
    originalEditorView = null;
  }
  if (previewEditorView) {
    previewEditorView.destroy();
    previewEditorView = null;
  }
  currentIssues = [];
  dom.imagePreview.style.display = 'none';
  if (dom.imageDivider) dom.imageDivider.style.display = 'none';
  dom.imagePreviewImg.src = '';
  resetImageTransform();
  updateSummary();
  updateStatusBar();
  updateSaveButtonState(false);

  // Hide split and show empty state
  if (dom.editorSplit) dom.editorSplit.style.display = 'none';
  if (!dom.editorContainer.querySelector('.empty-state')) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="empty-icon">📄</div><p>选择文件以开始检查</p>';
    dom.editorContainer.appendChild(empty);
  }
}

function closeFolder() {
  // Check unsaved changes first
  if (hasUnsavedChanges(fileState)) {
    pendingUnsavedAction = () => doCloseFolder();
    showUnsavedDialog('有未保存的修改，关闭文件夹前是否保存？');
    return;
  }
  doCloseFolder();
}

function doCloseFolder() {
  // Revoke all image blob URLs
  for (const f of fileState.files) {
    if (f.imageUrl) {
      URL.revokeObjectURL(f.imageUrl);
    }
  }

  // Clear all state
  fileState.files = [];
  fileState.activeFileIndex = -1;
  fileState.activeTabIds = [];
  checkedFiles.clear();

  // Destroy editors if exist
  if (originalEditorView) {
    originalEditorView.destroy();
    originalEditorView = null;
  }
  if (previewEditorView) {
    previewEditorView.destroy();
    previewEditorView = null;
  }

  // Clear UI
  currentIssues = [];
  dom.fileListContainer.style.display = 'none';
  dom.fileList.innerHTML = '';
  dom.tabBar.innerHTML = '';
  dom.statusTags.textContent = '0 个标签';
  dom.statusModified.style.display = 'none';
  dom.statusSkipped.style.display = 'none';
  dom.imagePreview.style.display = 'none';
  if (dom.imageDivider) dom.imageDivider.style.display = 'none';
  dom.imagePreviewImg.src = '';
  if (dom.editorSplit) dom.editorSplit.style.display = 'none';
  updateSaveButtonState(false);
  updateSummary();

  // Show empty state
  if (!dom.editorContainer.querySelector('.empty-state')) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="empty-icon">📁</div><p>拖拽文件夹或选择文件以开始</p>';
    dom.editorContainer.appendChild(empty);
  }
}

function openActiveFile() {
  if (fileState.activeFileIndex >= 0) {
    openFile(fileState.activeFileIndex);
  }
}

// ─── Check Logic ──────────────────────────────────────────
function rerunChecks() {
  if (!originalEditorView) return;
  const content = getContent(originalEditorView);
  if (!content || !content.trim()) {
    currentIssues = [];
    updateHighlights(originalEditorView, []);
    updateSummary();
    return;
  }

  const tags = parseTags(content);
  dom.statusTags.textContent = `${tags.length} 个标签`;

  // Merge temp keywords into runtime lib
  const runtimeLib = { ...keywordLib };
  runtimeLib.customKeywords = [
    ...(keywordLib.customKeywords || []),
    ...tempKeywords,
  ];
  currentIssues = runChecks(tags, checks, runtimeLib);
  updateHighlights(originalEditorView, currentIssues);
  updateSummary();
}

// Debounce utility
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const debouncedRerun = debounce(rerunChecks, 300);

function updateSummary() {
  const counts = countByType(currentIssues);
  for (const item of dom.summaryItems) {
    const type = item.dataset.type;
    const count = counts[type] || 0;
    const prefix = { badTags: '🟠 不良', custom: '🟣 自定义', duplicate: '🟡 重复', character: '🔴 角色', style: '🟢 风格' };
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
      if (firstIssue && originalEditorView) {
        navigateTo(originalEditorView, firstIssue.startIndex);
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

// ─── Batch Delete ─────────────────────────────────────────
function bindDeleteButton() {
  if (dom.btnBatchDelete) {
    dom.btnBatchDelete.addEventListener('click', () => batchDeleteTags());
  }
}

function batchDeleteTags() {
  if (!originalEditorView || !previewEditorView) return;

  const originalText = originalEditorView.state.doc.toString();

  // Filter out empty issues
  const issues = currentIssues.filter(i => i.startIndex < i.endIndex);
  if (issues.length === 0) {
    alert('当前没有可删除的标签。请先勾选检查选项。');
    return;
  }

  // Build confirmation message
  const counts = countByType(issues);
  const typeNames = {
    badTags: '不良标签', custom: '自定义规则', duplicate: '冗余重复',
    character: '角色特征', style: '风格相关',
  };
  const parts = [];
  for (const [type, count] of Object.entries(counts)) {
    if (count > 0) parts.push(`  ${typeNames[type]}: ${count} 个`);
  }
  const msg = `将删除以下类型的标签：\n\n${parts.join('\n')}\n\n结果将显示在下方预览窗口。确认删除？`;

  if (!confirm(msg)) return;

  // Compute result on original text
  const resultText = computeDeleteResult(originalText, issues);

  // Update preview editor
  resetEditorContent(previewEditorView, resultText);
  const active = getActiveFile(fileState);
  updateSaveButtonState(active ? resultText !== active.originalContent : false);
}

/**
 * Compute the result of deleting the given issues from text.
 * Pure function — does not modify any editor state.
 * @param {string} text - Original text
 * @param {Array} issues - Array of {type, startIndex, endIndex, ...}
 * @returns {string} Result text after deletions
 */
function computeDeleteResult(text, issues) {
  // Separate duplicate issues for special handling
  const duplicateIssues = issues.filter(i => i.type === 'duplicate');
  const otherIssues = issues.filter(i => i.type !== 'duplicate');

  let ranges = [];

  // For duplicates: group by tag text, keep first occurrence, delete the rest
  if (duplicateIssues.length > 0) {
    const grouped = new Map();
    for (const issue of duplicateIssues) {
      const key = issue.tag.toLowerCase().trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(issue);
    }
    for (const [, group] of grouped) {
      group.sort((a, b) => a.startIndex - b.startIndex);
      // Skip index 0 (first occurrence — keep it)
      for (let i = 1; i < group.length; i++) {
        ranges.push({ from: group[i].startIndex, to: group[i].endIndex });
      }
    }
  }

  // Add other issues (non-duplicate)
  for (const issue of otherIssues) {
    ranges.push({ from: issue.startIndex, to: issue.endIndex });
  }

  if (ranges.length === 0) {
    return text;
  }

  // Merge overlapping ranges
  ranges.sort((a, b) => a.from - b.from);
  const merged = [];
  for (const r of ranges) {
    if (merged.length > 0 && r.from <= merged[merged.length - 1].to) {
      merged[merged.length - 1].to = Math.max(merged[merged.length - 1].to, r.to);
    } else {
      merged.push({ from: r.from, to: r.to });
    }
  }

  // Extend to ONE separator — prefer trailing, fall back to leading
  const extended = merged.map(({ from, to }) => {
    let ef = from, et = to;
    let trailingEaten = false;
    while (et < text.length && ',\t '.includes(text[et])) { et++; trailingEaten = true; }
    if (et < text.length && text[et] === '\n') { et++; trailingEaten = true; }
    if (!trailingEaten) {
      while (ef > 0 && ',\t '.includes(text[ef - 1])) ef--;
      if (ef > 0 && text[ef - 1] === '\n') ef--;
    }
    return { from: ef, to: et };
  });

  // Re-merge after extension
  extended.sort((a, b) => a.from - b.from);
  const finalRanges = [];
  for (const r of extended) {
    if (finalRanges.length > 0 && r.from <= finalRanges[finalRanges.length - 1].to) {
      finalRanges[finalRanges.length - 1].to = Math.max(finalRanges[finalRanges.length - 1].to, r.to);
    } else {
      finalRanges.push({ from: r.from, to: r.to });
    }
  }

  // Apply deletions from end to start (string slicing)
  finalRanges.sort((a, b) => b.from - a.from);
  let result = text;
  for (const { from, to } of finalRanges) {
    result = result.slice(0, from) + result.slice(to);
  }

  // Cleanup: normalize commas and whitespace
  result = result
    .replace(/,{2,}/g, ',')
    .replace(/^[\s,]+/, '')
    .replace(/[\s,]+$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/,\s*,/g, ',');

  return result;
}

// ─── Save Preview ──────────────────────────────────────────
function bindSaveButton() {
  if (dom.btnSavePreview) {
    dom.btnSavePreview.addEventListener('click', () => savePreviewToFile());
  }
}

async function savePreviewToFile() {
  if (!previewEditorView || fileState.activeFileIndex < 0) return;
  const previewContent = getContent(previewEditorView);
  const activeFile = getActiveFile(fileState);

  if (previewContent === activeFile.originalContent) {
    alert('没有修改需要保存。');
    return;
  }

  // Update file state
  updateFileContent(fileState, fileState.activeFileIndex, previewContent);

  // Save to disk
  const result = await saveFile(fileState, fileState.activeFileIndex);
  if (result.success) {
    // Update original editor to reflect saved content
    resetEditorContent(originalEditorView, previewContent, { readOnly: true });
    rerunChecks();
    updateSaveButtonState(false);
    renderFileList();
    renderTabs();
    updateStatusBar();
  } else {
    alert(result.message);
  }
}

function updateSaveButtonState(hasChanges) {
  const btn = dom.btnSavePreview;
  if (!btn) return;
  btn.style.opacity = hasChanges ? '1' : '0.5';
  btn.style.pointerEvents = hasChanges ? 'auto' : 'none';
  btn.title = hasChanges ? '保存修改到本地文件' : '没有修改';
}

// ─── Divider Drag ──────────────────────────────────────────
function bindDividerDrag() {
  if (!dom.editorDivider || !dom.editorSplit) return;
  const divider = dom.editorDivider;
  let dragging = false, startY = 0, startTopHeight = 0;

  divider.addEventListener('mousedown', e => {
    dragging = true;
    startY = e.clientY;
    divider.classList.add('dragging');
    const originalContainer = dom.originalEditorContainer;
    startTopHeight = originalContainer ? originalContainer.getBoundingClientRect().height : 200;
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging || !dom.originalEditorContainer || !dom.previewEditorContainer) return;
    const dy = e.clientY - startY;
    const newTopH = Math.max(80, startTopHeight + dy);
    dom.originalEditorContainer.style.flex = `0 0 ${newTopH}px`;
    dom.previewEditorContainer.style.flex = '1 1 0%';
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      divider.classList.remove('dragging');
      // Refresh CodeMirror editors after resize
      if (originalEditorView) originalEditorView.requestMeasure();
      if (previewEditorView) previewEditorView.requestMeasure();
    }
  });
}

// ─── Sidebar Drag ──────────────────────────────────────────
function bindSidebarDrag() {
  if (!dom.sidebarDivider || !dom.appContainer) return;
  const divider = dom.sidebarDivider;
  let dragging = false, startX = 0, startSidebarW = 0;

  divider.addEventListener('mousedown', e => {
    dragging = true;
    startX = e.clientX;
    divider.classList.add('dragging');
    const sidebar = document.getElementById('sidebar');
    startSidebarW = sidebar ? sidebar.getBoundingClientRect().width : 240;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const newW = Math.max(140, Math.min(startSidebarW + dx, window.innerWidth * 0.5));
    dom.appContainer.style.gridTemplateColumns = `${newW}px 5px 1fr 5px ${getPanelWidth()}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    // Persist the current sidebar width so it doesn't reset
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      dom.appContainer.style.gridTemplateColumns = `${sidebar.getBoundingClientRect().width}px 5px 1fr 5px ${getPanelWidth()}px`;
    }
    // Refresh editors after resize
    if (originalEditorView) originalEditorView.requestMeasure();
    if (previewEditorView) previewEditorView.requestMeasure();
  });
}

// ─── Panel Drag ────────────────────────────────────────────
function bindPanelDrag() {
  if (!dom.panelDivider || !dom.appContainer) return;
  const divider = dom.panelDivider;
  let dragging = false, startX = 0, startPanelW = 0;

  divider.addEventListener('mousedown', e => {
    dragging = true;
    startX = e.clientX;
    divider.classList.add('dragging');
    const panel = document.getElementById('panel');
    startPanelW = panel ? panel.getBoundingClientRect().width : 280;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = startX - e.clientX; // reversed: dragging left = panel gets wider
    const newW = Math.max(180, Math.min(startPanelW + dx, window.innerWidth * 0.5));
    dom.appContainer.style.gridTemplateColumns = `${getSidebarWidth()}px 5px 1fr 5px ${newW}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    // Persist
    const panel = document.getElementById('panel');
    if (panel) {
      dom.appContainer.style.gridTemplateColumns = `${getSidebarWidth()}px 5px 1fr 5px ${panel.getBoundingClientRect().width}px`;
    }
    if (originalEditorView) originalEditorView.requestMeasure();
    if (previewEditorView) previewEditorView.requestMeasure();
  });
}

/** Read current sidebar width from the DOM */
function getSidebarWidth() {
  const sidebar = document.getElementById('sidebar');
  return sidebar ? sidebar.getBoundingClientRect().width : 240;
}

/** Read current panel width from the DOM */
function getPanelWidth() {
  const panel = document.getElementById('panel');
  return panel ? panel.getBoundingClientRect().width : 280;
}

// ─── Image Area Divider Drag ───────────────────────────────
function bindImageDividerDrag() {
  if (!dom.imageDivider || !dom.imagePreview) return;
  const divider = dom.imageDivider;
  let dragging = false, startY = 0, startHeight = 0;

  divider.addEventListener('mousedown', e => {
    dragging = true;
    startY = e.clientY;
    divider.classList.add('dragging');
    startHeight = dom.imagePreview.getBoundingClientRect().height;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    const newH = Math.max(80, startHeight + dy);
    dom.imagePreview.style.height = newH + 'px';
    // Refresh CodeMirror editors after resize
    if (originalEditorView) originalEditorView.requestMeasure();
    if (previewEditorView) previewEditorView.requestMeasure();
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
}

// ─── Image Zoom & Pan ──────────────────────────────────────
function bindImageZoomPan() {
  if (!dom.imagePreview || !dom.imagePreviewImg) return;

  let panning = false, panStartX = 0, panStartY = 0;
  let panOrigX = 0, panOrigY = 0;

  // Wheel → zoom centered on cursor
  dom.imagePreview.addEventListener('wheel', e => {
    if (dom.imagePreview.style.display === 'none') return;
    e.preventDefault();
    const rect = dom.imagePreview.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Cursor position in image space before zoom
    const ix = (mx - imagePanX) / imageScale;
    const iy = (my - imagePanY) / imageScale;

    // Apply multiplicative zoom
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    imageScale = Math.max(0.1, Math.min(20, imageScale * factor));

    // Adjust pan to keep the point under cursor stationary
    imagePanX = mx - ix * imageScale;
    imagePanY = my - iy * imageScale;

    updateImageTransform();
  }, { passive: false });

  // Right-click drag → pan
  dom.imagePreview.addEventListener('mousedown', e => {
    if (e.button !== 2) return;
    e.preventDefault();
    panning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panOrigX = imagePanX;
    panOrigY = imagePanY;
    dom.imagePreviewImg.classList.add('panning');
  });

  document.addEventListener('mousemove', e => {
    if (!panning) return;
    imagePanX = panOrigX + (e.clientX - panStartX);
    imagePanY = panOrigY + (e.clientY - panStartY);
    updateImageTransform();
  });

  document.addEventListener('mouseup', () => {
    if (!panning) return;
    panning = false;
    dom.imagePreviewImg.classList.remove('panning');
  });

  // Prevent context menu on image area
  dom.imagePreview.addEventListener('contextmenu', e => {
    e.preventDefault();
  });

  // Click to open in new tab (left click, no drag)
  dom.imagePreviewImg.addEventListener('click', e => {
    if (e.button !== 0) return;
    if (dom.imagePreviewImg.src) {
      window.open(dom.imagePreviewImg.src, '_blank');
    }
  });

  // Fit button → reset zoom/pan to fit container
  if (dom.btnImageFit) {
    dom.btnImageFit.addEventListener('click', e => {
      e.stopPropagation();
      resetImageTransform();
    });
  }
}

function updateImageTransform() {
  if (!dom.imagePreviewImg) return;
  dom.imagePreviewImg.style.transform = `translate(${imagePanX}px, ${imagePanY}px) scale(${imageScale})`;
}

function resetImageTransform() {
  imageScale = 1;
  imagePanX = 0;
  imagePanY = 0;
  updateImageTransform();
}

// ─── Batch File Operations ──────────────────────────────────
function bindBatchFileOperations() {
  // Select-all checkbox
  if (dom.chkSelectAll) {
    dom.chkSelectAll.addEventListener('change', () => {
      if (dom.chkSelectAll.checked) {
        for (let i = 0; i < fileState.files.length; i++) {
          checkedFiles.add(i);
        }
      } else {
        checkedFiles.clear();
      }
      renderFileList();
    });
  }

  // Batch delete tags from checked files
  if (dom.btnBatchDeleteFiles) {
    dom.btnBatchDeleteFiles.addEventListener('click', () => batchDeleteCheckedFiles());
  }

  // Batch save checked files
  if (dom.btnBatchSaveFiles) {
    dom.btnBatchSaveFiles.addEventListener('click', () => batchSaveCheckedFiles());
  }
}

async function batchDeleteCheckedFiles() {
  if (checkedFiles.size === 0) {
    alert('请先在文件列表中勾选要处理的文件。');
    return;
  }

  // Count total issues across all checked files
  let totalIssues = 0;
  const runtimeLib = { ...keywordLib, customKeywords: [...(keywordLib.customKeywords || []), ...tempKeywords] };
  for (const idx of checkedFiles) {
    const f = fileState.files[idx];
    if (!f) continue;
    const tags = parseTags(f.content);
    const issues = runChecks(tags, checks, runtimeLib);
    totalIssues += issues.filter(i => i.startIndex < i.endIndex).length;
  }

  if (totalIssues === 0) {
    alert('勾选的文件中没有可删除的标签。请先勾选检查选项。');
    return;
  }

  if (!confirm(`将对 ${checkedFiles.size} 个文件执行标签删除（共 ${totalIssues} 个标签）。\n\n此操作会直接保存到本地文件，是否继续？`)) return;

  let successCount = 0, failCount = 0;
  for (const idx of checkedFiles) {
    const f = fileState.files[idx];
    if (!f) continue;
    try {
      const tags = parseTags(f.content);
      const issues = runChecks(tags, checks, runtimeLib).filter(i => i.startIndex < i.endIndex);
      if (issues.length > 0) {
        const newContent = computeDeleteResult(f.content, issues);
        updateFileContent(fileState, idx, newContent);
        const result = await saveFile(fileState, idx);
        if (result.success) successCount++;
        else failCount++;
      }
    } catch (err) {
      failCount++;
      console.error(`Failed to process ${f.name}:`, err);
    }
  }

  // Refresh UI
  renderFileList();
  renderTabs();
  if (fileState.activeFileIndex >= 0) openFile(fileState.activeFileIndex);
  alert(`批量删除完成：${successCount} 个成功，${failCount} 个失败。`);
}

async function batchSaveCheckedFiles() {
  if (checkedFiles.size === 0) {
    alert('请先在文件列表中勾选要保存的文件。');
    return;
  }

  const toSave = [];
  for (const idx of checkedFiles) {
    const f = fileState.files[idx];
    if (f && f.modified) toSave.push(idx);
  }

  if (toSave.length === 0) {
    alert('勾选的文件中没有已修改的内容需要保存。');
    return;
  }

  if (!confirm(`将保存 ${toSave.length} 个已修改的文件到本地，是否继续？`)) return;

  let successCount = 0, failCount = 0;
  for (const idx of toSave) {
    try {
      const result = await saveFile(fileState, idx);
      if (result.success) successCount++;
      else failCount++;
    } catch (err) {
      failCount++;
      console.error(`Failed to save file:`, err);
    }
  }

  renderFileList();
  renderTabs();
  if (fileState.activeFileIndex >= 0) openFile(fileState.activeFileIndex);
  alert(`批量保存完成：${successCount} 个成功，${failCount} 个失败。`);
}

// ─── Custom Keywords Panel ────────────────────────────────
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

  // Manage button → open settings to custom keywords tab
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
      if (!originalEditorView || !previewEditorView) return;
      const issues = currentIssues.filter(i => i.type === 'custom' && i.startIndex < i.endIndex);
      if (issues.length === 0) {
        alert('当前没有自定义关键词匹配的标签可删除。');
        return;
      }
      if (!confirm(`将仅删除自定义关键词匹配的 ${issues.length} 个标签。\n结果将显示在下方预览窗口。确认删除？`)) return;

      const originalText = originalEditorView.state.doc.toString();
      const resultText = computeDeleteResult(originalText, issues);

      resetEditorContent(previewEditorView, resultText);
      const active = getActiveFile(fileState);
      updateSaveButtonState(active ? resultText !== active.originalContent : false);
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
  await savePreviewToFile();
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

  // Custom keywords tab
  renderCustomKeywordsTab();

  // Import/Export tab
  renderIOTab();
}

function renderKeywordGroup(containerId, category, catName) {
  const container = document.getElementById(containerId);
  if (!container) return;
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
      const saveBtn = document.createElement('button');
      saveBtn.textContent = '保存';
      saveBtn.dataset.cat = catName;
      saveBtn.className = 'btn-save-triggers';
      row.appendChild(saveBtn);
      div.appendChild(row);

      saveBtn.addEventListener('click', () => {
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
        tag.innerHTML = `${word} <span class="kw-remove" data-word="${escapeHtmlAttr(word)}" data-group="${group}" data-cat="${catName}">&times;</span>`;
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
  if (!container) return;
  container.innerHTML = '';

  // Negative quality
  const divNQ = document.createElement('div');
  divNQ.className = 'kw-group';
  divNQ.innerHTML = `<h4>负面质量描述</h4><div class="kw-tags" id="kw-bad-quality"></div>`;
  container.appendChild(divNQ);
  renderSimpleKwList('kw-bad-quality', keywordLib.badTags.negativeQuality);

  // Overfit risk
  const divOF = document.createElement('div');
  divOF.className = 'kw-group';
  divOF.innerHTML = `<h4>过拟合风险</h4><div class="kw-tags" id="kw-overfit"></div>`;
  container.appendChild(divOF);
  renderSimpleKwList('kw-overfit', keywordLib.badTags.overfitRisk);
}

function renderSimpleKwList(containerId, array) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const renderTags = () => {
    container.innerHTML = '';
    for (const word of array) {
      const tag = document.createElement('span');
      tag.className = 'kw-tag';
      tag.innerHTML = `${word} <span class="kw-remove" data-word="${escapeHtmlAttr(word)}">&times;</span>`;
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
  if (!container) return;
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

function renderCustomKeywordsTab() {
  const container = $('#tab-custom-rules');
  if (!container) return;
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
        tagsDiv.innerHTML = '<span style="color:#9999bb;font-size:12px;">暂无关键词，请在下方添加</span>';
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
    hint.textContent = '💡 持久化关键词自动保存。右侧面板可临时追加关键词，不影响此列表。';
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

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addKw(); }
    });
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

function renderIOTab() {
  const container = $('#tab-io');
  if (!container) return;
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

  // Bind IO events
  const btnExport = document.getElementById('btn-export-kw');
  if (btnExport) btnExport.addEventListener('click', () => exportKeywordLib(keywordLib));

  const importFile = document.getElementById('import-kw-file');
  if (importFile) {
    importFile.addEventListener('change', async e => {
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
  }

  const btnReset = document.getElementById('btn-reset-kw');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('确定要重置所有词库到默认值吗？此操作不可撤销。')) {
        const fresh = resetToDefaults();
        Object.assign(keywordLib, fresh);
        renderSettingsTabs();
        rerunChecks();
        alert('已重置到默认词库');
      }
    });
  }
}

function saveSettingsFromForm() {
  // Settings are edited in-place in keywordLib, so they're already saved.
  // This function exists for future form-based settings.
}

// ─── Unsaved Changes Dialog ───────────────────────────────
function bindUnsavedDialog() {
  const saveBtn = $('#unsaved-save');
  const discardBtn = $('#unsaved-discard');
  const cancelBtn = $('#unsaved-cancel');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await saveCurrentFile();
      dom.unsavedModal.style.display = 'none';
      if (pendingUnsavedAction) {
        pendingUnsavedAction();
        pendingUnsavedAction = null;
      }
    });
  }

  if (discardBtn) {
    discardBtn.addEventListener('click', () => {
      dom.unsavedModal.style.display = 'none';
      if (pendingUnsavedAction) {
        pendingUnsavedAction();
        pendingUnsavedAction = null;
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      dom.unsavedModal.style.display = 'none';
      pendingUnsavedAction = null;
    });
  }
}

function showUnsavedDialog(message) {
  if (dom.unsavedMessage) {
    dom.unsavedMessage.textContent = message || '当前文件已修改，是否保存？';
  }
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

// ─── Helpers ───────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeHtmlAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Global drag feedback ──────────────────────────────────
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

// ─── Start ────────────────────────────────────────────────
init();
