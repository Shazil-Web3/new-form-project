/**
 * @file StructureTab.jsx
 * @description Template Structure & Locked Elements editor tab for CreateTemplateHub.
 *   1:1 field mapping from old StructureSettings.js (Content Locking, TOC, Attachments panels).
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * StructureTab - Template Layout Constraints & Structure Settings
 *
 * Two-column layout matching old StructureSettings.js:
 * - Left column: Content Locking toggles (content, toc, fontSize, fontStyle, headerFooter)
 * - Right column: Table of Contents inclusion + Allow Attachments checkbox
 */
export default function StructureTab({
  lockedElements = {},
  onLockToggle,
  includeTableOfContents = false,
  onIncludeTocChange,
  allowAttachments = false,
  onAllowAttachmentsChange,
  disabled = false,
}) {
  const locks = [
    {
      key: 'content',
      label: 'Lock Contents',
      desc: 'Prevents authors from overriding predefined section texts',
      icon: 'lock',
    },
    {
      key: 'toc',
      label: 'Lock Table of Contents',
      desc: 'Disables modification of index headings structures',
      icon: 'format_list_numbered',
    },
    {
      key: 'fontSize',
      label: 'Lock Font Size',
      desc: 'Restricts font-size updates in document edits',
      icon: 'format_size',
    },
    {
      key: 'fontStyle',
      label: 'Lock Font Style',
      desc: 'Restricts font-family overrides to maintain design standard',
      icon: 'text_format',
    },
    {
      key: 'headerFooter',
      label: 'Lock Header/Footer',
      desc: 'Prevents changes to page header and footer content',
      icon: 'space_dashboard',
    },
  ];

  return (
    <div className="space-y-4 select-none animate-fade-in">
      {/* Section header */}
      <div className="border-b border-outline-variant/60 pb-3 mb-1">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-label-md font-bold text-on-surface">Template Structure and Locked Elements</h3>
          <span
            className="material-symbols-outlined text-[16px] text-on-surface-variant/60 cursor-help"
            title="Define which elements of the template should be locked and cannot be modified by users."
          >
            info
          </span>
        </div>
        <p className="text-body-xs text-on-surface-variant font-medium">
          Set editing permissions for documents instantiated from this template.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Left column: Content Locking */}
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 space-y-1">
          <h4 className="text-label-sm font-bold text-on-surface mb-3 pb-2 border-b border-outline-variant/40">
            Content Locking
          </h4>
          {locks.map((lock) => (
            <label
              key={lock.key}
              className={`flex items-center justify-between gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                !disabled ? 'hover:bg-surface-container-high/50' : 'opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant/70 flex-shrink-0">
                  {lock.icon}
                </span>
                <div className="min-w-0">
                  <span className="text-body-sm font-semibold text-on-surface block truncate">
                    {lock.label}
                  </span>
                  <span className="text-body-xs text-on-surface-variant leading-tight">
                    {lock.desc}
                  </span>
                </div>
              </div>
              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={!!lockedElements[lock.key]}
                disabled={disabled}
                onClick={() => !disabled && onLockToggle(lock.key)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-700/50 ${
                  lockedElements[lock.key]
                    ? 'bg-blue-700 border-blue-700'
                    : 'bg-surface-container-highest border-outline-variant'
                } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    lockedElements[lock.key] ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          ))}
        </div>

        {/* Right column: TOC & Attachments options */}
        <div className="space-y-4">
          {/* Table of Contents card */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4">
            <h4 className="text-label-sm font-bold text-on-surface mb-2.5 pb-2 border-b border-outline-variant/40">
              Table of Contents
            </h4>
            <label className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <input
                type="checkbox"
                checked={!!includeTableOfContents}
                onChange={(e) => !disabled && onIncludeTocChange && onIncludeTocChange(e.target.checked)}
                disabled={disabled}
                className="mt-0.5 w-4 h-4 rounded border-outline-variant text-blue-700 focus:ring-blue-700/50 cursor-pointer flex-shrink-0"
              />
              <div>
                <span className="text-body-sm font-semibold text-on-surface block">
                  Include Table of Contents (Index)
                </span>
                <span className="text-body-xs text-on-surface-variant leading-relaxed">
                  A table of contents will be automatically generated based on the document structure.
                </span>
              </div>
            </label>
          </div>

          {/* Attachments card */}
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4">
            <h4 className="text-label-sm font-bold text-on-surface mb-2.5 pb-2 border-b border-outline-variant/40">
              Attachments
            </h4>
            <label className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <input
                type="checkbox"
                checked={!!allowAttachments}
                onChange={(e) => !disabled && onAllowAttachmentsChange && onAllowAttachmentsChange(e.target.checked)}
                disabled={disabled}
                className="mt-0.5 w-4 h-4 rounded border-outline-variant text-blue-700 focus:ring-blue-700/50 cursor-pointer flex-shrink-0"
              />
              <div>
                <span className="text-body-sm font-semibold text-on-surface block">
                  Allow File Attachments
                </span>
                <span className="text-body-xs text-on-surface-variant leading-relaxed">
                  Permit authors to attach supporting files when using this template.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

StructureTab.propTypes = {
  lockedElements: PropTypes.object.isRequired,
  onLockToggle: PropTypes.func.isRequired,
  includeTableOfContents: PropTypes.bool,
  onIncludeTocChange: PropTypes.func,
  allowAttachments: PropTypes.bool,
  onAllowAttachmentsChange: PropTypes.func,
  disabled: PropTypes.bool,
};
