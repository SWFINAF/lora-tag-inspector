// file-manager.js — File loading, management, save

import { readFileWithEncoding, isLargeFile } from './tag-parser.js';

/** Supported image extensions for matching with .txt files */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];

/**
 * Check if a filename has an image extension.
 */
export function hasImageExtension(name) {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * Get the base name without extension. E.g., "cat_001.txt" → "cat_001"
 */
export function getBaseName(fileName) {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot >= 0 ? fileName.substring(0, lastDot) : fileName;
}

/**
 * Create a blob URL from either a File object or a FileSystemFileHandle.
 */
async function createImageBlobUrl(source) {
  let file;
  if (source instanceof File) {
    file = source;
  } else {
    // FileSystemFileHandle
    file = await source.getFile();
  }
  return URL.createObjectURL(file);
}

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
  const txtEntries = [];
  const imageEntries = [];

  async function scanDir(handle, prefix = '') {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'file') {
        const fullName = prefix + name;
        if (name.toLowerCase().endsWith('.txt')) {
          txtEntries.push({ handle: entry, name: fullName });
        } else if (hasImageExtension(name)) {
          imageEntries.push({ handle: entry, name: fullName });
        }
      } else if (entry.kind === 'directory') {
        await scanDir(entry, prefix + name + '/');
      }
    }
  }

  await scanDir(dirHandle);

  if (txtEntries.length === 0) {
    throw new Error('文件夹中未找到 .txt 文件');
  }

  // Match images to txt by base name (same subdirectory prefix preserved)
  const imageMap = new Map();
  for (const img of imageEntries) {
    const base = getBaseName(img.name);
    if (!imageMap.has(base)) {
      imageMap.set(base, img.handle);
    }
  }

  return loadFiles(txtEntries, fileState, onProgress, 0, imageMap);
}

/**
 * Load files from drag/drop or file input.
 * @param {File[]|{handle: FileSystemFileHandle, name: string}[]} fileEntries
 * @param {object} fileState
 * @param {function} onProgress
 * @returns {Promise<object>} updated fileState
 */
export async function loadFiles(fileEntries, fileState, onProgress, skipped = 0, imageMap = null) {
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

      // Find associated image by base name
      let imageUrl = null;
      if (imageMap) {
        const base = getBaseName(name);
        const imgSource = imageMap.get(base);
        if (imgSource) {
          try {
            imageUrl = await createImageBlobUrl(imgSource);
          } catch (e) {
            console.warn(`Failed to load image for "${name}":`, e);
          }
        }
      }

      newFiles.push({
        name,
        content,
        originalContent: content,
        modified: false,
        fileHandle,
        encoding,
        imageUrl,
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
      // Clean up old image blob URL
      const oldFile = fileState.files[existingIdx];
      if (oldFile.imageUrl && oldFile.imageUrl !== nf.imageUrl) {
        URL.revokeObjectURL(oldFile.imageUrl);
      }
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
