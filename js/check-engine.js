// check-engine.js — Execute checks on parsed tags

import { findDuplicates } from './tag-parser.js';
import {
  flattenCategory,
  getConflictingPairs,
  getNegativeQualitySet,
  getOverfitRiskSet,
  getCustomKeywords,
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
  /^[\x00-\x1f]+$/,         // Control characters
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

  // 2. Custom Keywords (priority 2)
  if (checks.custom) {
    allIssues.push(...checkCustomKeywords(tags, keywordLib));
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
