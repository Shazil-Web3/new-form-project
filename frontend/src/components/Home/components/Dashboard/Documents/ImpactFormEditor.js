import React, { useMemo, useState, useEffect, useRef } from 'react';
import { debounce } from 'lodash';
import {
  ImpactCommentProvider,
  useImpactComments,
  ImpactTextSelectionPopover,
  ImpactCommentComposer,
  ImpactCommentsGrid,
} from '../../../../ImpactComments';


// ─── Blank detection ─────────────────────────────────────────────────────────
const BLANK_REGEX = /_{3,}/g;

// ─── Styles ───────────────────────────────────────────────────────────────────
const blankInputStyle = {
  border: 'none',
  borderBottom: '2px solid #1890ff',
  background: 'rgba(24, 144, 255, 0.06)',
  minWidth: 100,
  maxWidth: '100%',
  padding: '0 6px 1px',
  fontSize: 'inherit',
  lineHeight: 'inherit',
  color: '#1890ff',
  fontWeight: 500,
  borderRadius: '3px',
  outline: 'none',
  verticalAlign: 'baseline',
  transition: 'border-color 0.2s, background 0.2s',
  cursor: 'text',
};

const blankInputReadOnlyStyle = {
  ...blankInputStyle,
  borderBottomColor: '#d9d9d9',
  color: '#595959',
  background: 'transparent',
  cursor: 'default',
};

const dropdownSelectStyle = {
  width: '100%',
  border: '1px solid #91caff',
  borderRadius: 4,
  background: 'rgba(24, 144, 255, 0.06)',
  padding: '4px 8px',
  fontSize: 'inherit',
  lineHeight: 'inherit',
  color: '#1890ff',
  fontWeight: 500,
  cursor: 'pointer',
  boxSizing: 'border-box',
};

const dropdownSelectReadOnlyStyle = {
  ...dropdownSelectStyle,
  borderColor: '#d9d9d9',
  color: '#595959',
  background: 'transparent',
  cursor: 'default',
};

const tableWrapperStyle = {
  overflowX: 'auto',
  margin: '12px 0',
};

const tableStyle = {
  borderCollapse: 'collapse',
  width: '100%',
  fontSize: 'inherit',
  lineHeight: 1.5,
};

const tableCellStyle = {
  border: '1px solid #d9d9d9',
  padding: '8px 12px',
  verticalAlign: 'top',
};

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'table',
  'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr',
  'colgroup', 'caption',
]);

const INLINE_TAGS = new Set([
  'span', 'a', 'strong', 'b', 'em', 'i', 'u', 's',
  'code', 'mark', 'sub', 'sup', 'small', 'label', 'br',
]);

const VOID_TAGS = new Set(['br', 'hr', 'col', 'input']);

const ATTRS_TO_KEEP = [
  'class', 'style', 'colspan', 'rowspan', 'align', 'valign', 'width',
  'data-type', 'data-options',
];

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function extractElementAttrs(node) {
  const attrs = {};
  ATTRS_TO_KEEP.forEach((name) => {
    const val = node.getAttribute(name);
    if (val != null && val !== '') attrs[name] = val;
  });
  return attrs;
}

function getDropdownOptionsFromSelect(selectEl) {
  if (!selectEl) return [];
  return Array.from(selectEl.options).map((o) => o.value || o.textContent || '');
}

function attrsToReactProps(attrs) {
  const props = {};
  if (!attrs) return props;

  if (attrs.class) props.className = attrs.class;
  if (attrs.style) {
    const styleObj = cssStringToObject(attrs.style);
    if (styleObj) props.style = styleObj;
  }

  ['colspan', 'rowspan', 'align', 'valign', 'width'].forEach((name) => {
    if (attrs[name] != null) props[name] = attrs[name];
  });

  if (attrs['data-type']) props['data-type'] = attrs['data-type'];
  if (attrs['data-options']) props['data-options'] = attrs['data-options'];

  return props;
}

// ─── DOM → Segment tree parser ────────────────────────────────────────────────

/**
 * Walk a DOM node and emit a flat segment array describing the content.
 * Segments can be:
 *   { type: 'text',    value: string }
 *   { type: 'blank',   index: number }
 *   { type: 'dropdown', index: number, options: string[] }
 *   { type: 'element', tag, attrs, children: segment[] }
 */
function parseNodeToSegments(node, counter) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    if (!text) return [];

    const segments = [];
    const parts = text.split(BLANK_REGEX);

    parts.forEach((part, i) => {
      if (part) segments.push({ type: 'text', value: part });
      if (i < parts.length - 1) {
        segments.push({ type: 'blank', index: counter.current++ });
      }
    });

    return segments;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const tagName = node.tagName.toLowerCase();

    if (['script', 'style', 'meta', 'link'].includes(tagName)) return [];

    if (tagName === 'select' && node.classList.contains('cell-dropdown')) {
      const options = getDropdownOptionsFromSelect(node);
      if (options.length) {
        return [{ type: 'dropdown', index: counter.current++, options }];
      }
    }

    const childSegments = [];
    Array.from(node.childNodes).forEach((child) => {
      childSegments.push(...parseNodeToSegments(child, counter));
    });

    return [{
      type: 'element',
      tag: tagName,
      attrs: extractElementAttrs(node),
      children: childSegments,
    }];
  }

  return [];
}

function cssStringToObject(cssString) {
  if (!cssString) return undefined;
  const style = {};
  cssString.split(';').forEach((rule) => {
    const colonIdx = rule.indexOf(':');
    if (colonIdx === -1) return;
    const prop = rule.slice(0, colonIdx).trim();
    const val = rule.slice(colonIdx + 1).trim();
    if (!prop || !val) return;
    const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    style[camel] = val;
  });
  return Object.keys(style).length ? style : undefined;
}

function parseHtmlToSegments(html) {
  if (!html || typeof html !== 'string') {
    return { segments: [], totalBlanks: 0, totalDropdowns: 0 };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    'text/html'
  );

  const counter = { current: 0 };
  const segments = [];
  Array.from(doc.body.childNodes).forEach((node) => {
    segments.push(...parseNodeToSegments(node, counter));
  });

  let totalBlanks = 0;
  let totalDropdowns = 0;
  const countSegments = (list) => {
    list.forEach((seg) => {
      if (seg.type === 'blank') totalBlanks += 1;
      if (seg.type === 'dropdown') totalDropdowns += 1;
      if (seg.type === 'element' && Array.isArray(seg.children)) countSegments(seg.children);
    });
  };
  countSegments(segments);

  return { segments, totalBlanks, totalDropdowns };
}

// ─── Recursive React renderer ─────────────────────────────────────────────────

function SegmentRenderer({
  segments,
  filledValues,
  dropdownValues,
  onBlankChange,
  onDropdownChange,
  readOnly,
}) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <React.Fragment key={i}>{seg.value}</React.Fragment>;
        }

        if (seg.type === 'blank') {
          const val = filledValues?.[seg.index] ?? '';
          const displayVal = val ? (val.endsWith('\n') ? val + ' ' : val) : 'fill in…';
          return (
            <span
              key={i}
              className="impact-blank-wrapper"
              data-field-wrapper="true"
              data-field-index={seg.index}
              data-field-name={`Field ${seg.index + 1}`}
              data-field-value={val || ''}
              data-field-type="blank"
              style={{
                position: 'relative',
                display: 'inline-block',
                minWidth: 100,
                maxWidth: '100%',
                verticalAlign: 'baseline',
              }}
            >
              <span
                className="impact-blank-sizer"
                style={{
                  visibility: 'hidden',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  display: 'inline-block',
                  minWidth: 100,
                  maxWidth: '100%',
                  padding: '0 6px 1px',
                  fontSize: 'inherit',
                  fontWeight: 500,
                  lineHeight: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                {displayVal}
              </span>
              <textarea
                value={val}
                placeholder="fill in…"
                readOnly={readOnly}
                aria-label={`Blank field ${seg.index + 1}`}
                data-field-index={seg.index}
                data-field-name={`Field ${seg.index + 1}`}
                data-field-type="blank"
                rows={1}
                style={{
                  ...(readOnly ? blankInputReadOnlyStyle : blankInputStyle),
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  boxSizing: 'border-box',
                  minWidth: 'unset',
                  maxWidth: 'unset',
                  resize: 'none',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'inherit',
                }}
                onChange={(e) => {
                  if (readOnly) return;
                  const next = [...(filledValues || [])];
                  next[seg.index] = e.target.value;
                  onBlankChange(next);
                }}
                onFocus={(e) => {
                  if (!readOnly) e.target.style.borderBottomColor = '#40a9ff';
                }}
                onBlur={(e) => {
                  if (!readOnly) e.target.style.borderBottomColor = '#1890ff';
                }}
              />
            </span>
          );
        }

        if (seg.type === 'dropdown') {
          const options = seg.options || [];
          const val = dropdownValues?.[seg.index] ?? options[0] ?? '';
          return (
            <span
              key={i}
              className="impact-dropdown-wrapper"
              data-field-wrapper="true"
              data-field-index={seg.index}
              data-field-name={`Dropdown ${seg.index + 1}`}
              data-field-value={val || ''}
              data-field-type="dropdown"
              style={{ display: 'inline-block' }}
            >
              <select
                className="cell-dropdown"
                value={val}
                disabled={readOnly}
                aria-label={`Dropdown field ${seg.index + 1}`}
                data-field-index={seg.index}
                data-field-name={`Dropdown ${seg.index + 1}`}
                data-field-type="dropdown"
                style={readOnly ? dropdownSelectReadOnlyStyle : dropdownSelectStyle}
                onChange={(e) => {
                  if (readOnly) return;
                  const next = [...(dropdownValues || [])];
                  next[seg.index] = e.target.value;
                  onDropdownChange(next);
                }}
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </span>
          );
        }

        if (seg.type === 'element') {
          const Tag = BLOCK_TAGS.has(seg.tag) || INLINE_TAGS.has(seg.tag)
            ? seg.tag
            : 'span';

          const props = attrsToReactProps(seg.attrs);

          if (Tag === 'table') {
            return (
              <div key={i} style={tableWrapperStyle}>
                <table {...props} style={{ ...tableStyle, ...(props.style || {}) }}>
                  <SegmentRenderer
                    segments={seg.children}
                    filledValues={filledValues}
                    dropdownValues={dropdownValues}
                    onBlankChange={onBlankChange}
                    onDropdownChange={onDropdownChange}
                    readOnly={readOnly}
                  />
                </table>
              </div>
            );
          }

          if (Tag === 'td' || Tag === 'th') {
            props.style = { ...tableCellStyle, ...(props.style || {}) };
          }

          if (VOID_TAGS.has(Tag)) {
            return <Tag key={i} {...props} />;
          }

          return (
            <Tag key={i} {...props}>
              <SegmentRenderer
                segments={seg.children}
                filledValues={filledValues}
                dropdownValues={dropdownValues}
                onBlankChange={onBlankChange}
                onDropdownChange={onDropdownChange}
                readOnly={readOnly}
              />
            </Tag>
          );
        }

        return null;
      })}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ImpactFormEditor
 *
 * Renders a published template's HTML as a protected "form":
 *   • Template text is display-only (cannot be edited or deleted).
 *   • Every occurrence of three-or-more underscores (______) is replaced
 *     with an editable inline input field.
 *   • Table cells marked as dropdown options are rendered as select fields.
 *   • `filledValues` maps blank index → user value.
 *   • `dropdownValues` maps dropdown index → selected option.
 *   • Calls `onChange(filledValues, dropdownValues)` whenever any field changes.
 */
const ImpactFormEditorInner = ({
  templateHtml,
  filledValues = [],
  dropdownValues = [],
  onChange,
  readOnly = false,
}) => {
  const containerRef = useRef(null);
  const { comments } = useImpactComments();

  const { segments, totalBlanks, totalDropdowns } = useMemo(
    () => parseHtmlToSegments(templateHtml),
    [templateHtml]
  );

  const [localFilledValues, setLocalFilledValues] = useState(filledValues || []);
  const [localDropdownValues, setLocalDropdownValues] = useState(dropdownValues || []);

  useEffect(() => {
    setLocalFilledValues(filledValues || []);
  }, [filledValues]);

  useEffect(() => {
    setLocalDropdownValues(dropdownValues || []);
  }, [dropdownValues]);

  const debouncedOnChange = useMemo(() => {
    return debounce((filled, dropdown) => {
      if (onChange) {
        onChange(filled, dropdown);
      }
    }, 400);
  }, [onChange]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  if (!templateHtml) return null;

  const filledBlankCount = (localFilledValues || []).filter((v) => v && String(v).trim()).length;
  const totalFields = totalBlanks + totalDropdowns;

  const handleBlankChange = (nextFilled) => {
    setLocalFilledValues(nextFilled);
    debouncedOnChange(nextFilled, localDropdownValues);
  };

  const handleDropdownChange = (nextDropdown) => {
    setLocalDropdownValues(nextDropdown);
    debouncedOnChange(localFilledValues, nextDropdown);
  };

  const scrollToComments = () => {
    const el = document.getElementById('impact-comments-grid-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="impact-comment-system-root">
      <div
        ref={containerRef}
        className="impact-form-editor impact-form-content-area"
        style={{
          background: '#f6f9ff',
          border: '1px solid #d6e4ff',
          borderRadius: 8,
          padding: '16px 20px 20px',
          marginBottom: 16,
          fontSize: 14,
          lineHeight: 1.9,
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: '1px solid #d6e4ff',
          }}
        >
          <span style={{ fontWeight: 600, color: '#2f54eb', fontSize: 13 }}>
            📋 Impact Form
          </span>

          {totalFields > 0 && (
            <span
              style={{
                marginLeft: 10,
                fontSize: 12,
                color: filledBlankCount === totalBlanks && totalBlanks > 0 ? '#52c41a' : '#8c8c8c',
                fontWeight: filledBlankCount === totalBlanks && totalBlanks > 0 ? 600 : 400,
              }}
            >
              {totalBlanks > 0
                ? `${filledBlankCount}/${totalBlanks} blanks filled`
                : null}
              {totalBlanks > 0 && totalDropdowns > 0 ? ' · ' : null}
              {totalDropdowns > 0
                ? `${totalDropdowns} dropdown${totalDropdowns > 1 ? 's' : ''}`
                : null}
            </span>
          )}

          {readOnly && (
            <span
              style={{
                marginLeft: 'auto',
                marginRight: 8,
                fontSize: 11,
                color: '#8c8c8c',
                fontStyle: 'italic',
                background: '#f0f0f0',
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              Read-only
            </span>
          )}

          <button
            type="button"
            className="impact-header-comment-trigger"
            style={{ marginLeft: readOnly ? 0 : 'auto' }}
            onClick={scrollToComments}
            title="Jump to Department Impact Assessment comments below"
          >
            <span>💬 Comments</span>
            {comments.length > 0 && (
              <span className="trigger-count">{comments.length}</span>
            )}
          </button>
        </div>

        <div style={{ lineHeight: 2.1 }}>
          <SegmentRenderer
            segments={segments}
            filledValues={localFilledValues}
            dropdownValues={localDropdownValues}
            onBlankChange={handleBlankChange}
            onDropdownChange={handleDropdownChange}
            readOnly={readOnly}
          />
        </div>

        {totalFields === 0 && (
          <p style={{ color: '#8c8c8c', fontStyle: 'italic', textAlign: 'center', margin: '8px 0 0' }}>
            No fillable fields found. Template content is shown for reference.
          </p>
        )}
      </div>

      {/* Floating text selection pill and inline composer */}
      <ImpactTextSelectionPopover containerRef={containerRef} />
      <ImpactCommentComposer />

      {/* Comments UI Grid - Placed directly below the fields and above Department Impact Assessment */}
      <ImpactCommentsGrid />
    </div>
  );
};

const ImpactFormEditor = (props) => {
  return (
    <ImpactCommentProvider
      initialComments={props.comments}
      onCommentsChange={props.onCommentsChange}
      documentId={props.documentId}
      templateId={props.templateId}
      currentUser={props.currentUser}
    >
      <ImpactFormEditorInner {...props} />
    </ImpactCommentProvider>
  );
};

export default ImpactFormEditor;
