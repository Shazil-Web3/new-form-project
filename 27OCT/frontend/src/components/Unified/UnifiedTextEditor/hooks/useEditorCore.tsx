/**
 * useEditorCore Hook
 * 
 * React hook wrapper for EditorCore (extracted from TemplateEditor.js)
 * This hook provides access to all editor functionality with DOM manipulation preserved
 * 
 * Usage:
 * const editorProps = useEditorCore({ initialContent, onContentChange, isEditable });
 * <EditorCore {...editorProps} />
 */

import { useMemo } from 'react';

export const useEditorCore = ({ 
  initialContent = '', 
  onContentChange,
  isEditable = true,
  user,
  ...otherProps 
}) => {
  // EditorCore is a full React component (TemplateEditor.js copied)
  // So we just pass through the props
  // The component already has all hooks, refs, and DOM manipulation inside
  
  const editorProps = useMemo(() => ({
    user,
    initialContent,
    onContentChange,
    ...otherProps
  }), [user, initialContent, onContentChange, otherProps]);

  return editorProps;
};

export default useEditorCore;
