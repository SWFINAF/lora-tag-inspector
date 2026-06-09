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

  customKeywords: [],
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
  if (userLib.customKeywords && Array.isArray(userLib.customKeywords)) {
    merged.customKeywords = userLib.customKeywords;
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
  const custom = { character: {}, style: {}, badTags: {}, customKeywords: lib.customKeywords || [] };
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
    const builtinArr = BUILTIN.badTags[group] || [];
    const current = lib.badTags[group] || [];
    // Compare as JSON strings for simplicity
    if (JSON.stringify(builtinArr) !== JSON.stringify(current)) {
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

/** Get custom keywords array */
export function getCustomKeywords(lib) {
  return (lib.customKeywords) || [];
}

/** @deprecated Use getCustomKeywords instead — always returns empty array */
export function getCustomRules(_lib) {
  return [];
}

export { BUILTIN, STORAGE_KEY };
