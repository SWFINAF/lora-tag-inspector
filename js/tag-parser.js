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
    if (!content.includes('')) {
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
