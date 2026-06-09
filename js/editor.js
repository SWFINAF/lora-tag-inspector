// editor.js — CodeMirror 6 wrapper with highlight decorations

import {
  EditorState,
  StateField,
  StateEffect,
  RangeSet,
} from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  Decoration,
  WidgetType,
  GutterMarker,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

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
export function createEditor(parent, initialContent, onChange, { readOnly = false } = {}) {
  const extensions = [
    lineNumbers(),
    EditorView.lineWrapping,
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
  ];

  if (readOnly) {
    extensions.push(EditorState.readOnly.of(true));
    extensions.push(EditorView.editable.of(false));
  }

  if (onChange) {
    extensions.push(EditorView.updateListener.of(update => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }));
  }

  const startState = EditorState.create({
    doc: initialContent || '',
    extensions,
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
  view.focus();
}

/**
 * Get current editor content.
 */
export function getContent(view) {
  return view.state.doc.toString();
}

/**
 * Reset editor content (used when switching files).
 * @param {EditorView} view
 * @param {string} content
 */
export function resetEditorContent(view, content, { readOnly = false } = {}) {
  const extensions = [
    lineNumbers(),
    EditorView.lineWrapping,
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
  ];

  if (readOnly) {
    extensions.push(EditorState.readOnly.of(true));
    extensions.push(EditorView.editable.of(false));
  }

  // Preserve onChange callback from the view
  if (view._onChange) {
    extensions.push(EditorView.updateListener.of(update => {
      if (update.docChanged) {
        view._onChange(update.state.doc.toString());
      }
    }));
  }

  const newState = EditorState.create({
    doc: content || '',
    extensions,
  });
  view.setState(newState);
}

export { HIGHLIGHT_CLASSES, HIGHLIGHT_COLORS };
