/**
 * UnifiedTextEditor - Router Component
 * 
 * This is the main entry point for the Unified Text Editor system.
 * It routes to the appropriate mode-specific editor component:
 * - CreateEditor: For creating new templates (full editing, no comments)
 * - PreviewEditor: For previewing templates (read-only, with comments)
 * - ReviewEditor: For reviewing templates (suggestions + comments + approval)
 * 
 * All mode components share the same EditorCore logic with DOM manipulation
 * for pagination, ensuring consistent behavior across all modes.
 */

import React from 'react';
import CreateEditor from './CreateEditor';
import PreviewEditor from './PreviewEditor';
import ReviewEditor from './ReviewEditor';

const UnifiedTextEditor = ({ mode = 'preview', isDocument = false, ...props }) => {
  // Router logic - determines which mode component to render
  switch (mode) {
    case 'create':
      return <CreateEditor isDocument={isDocument} {...props} />;
      
    case 'preview':
      return <PreviewEditor isDocument={isDocument} {...props} />;
      
    case 'review':
      return <ReviewEditor isDocument={isDocument} {...props} />;
      
    default:
      return <PreviewEditor isDocument={isDocument} {...props} />;
  }
};

export { default as useFindReplace } from './hooks/useFindReplace';
export { default as FindReplaceModal } from './components/FindReplaceModal';

export default UnifiedTextEditor;
