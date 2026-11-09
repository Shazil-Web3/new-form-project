/**
 * useCommentCore Hook
 * 
 * React hook wrapper for CommentCore (extracted from CommentEditSystem.js)
 * This hook provides access to all comment functionality
 * 
 * Usage:
 * const commentProps = useCommentCore({ user, pagesContainerRef });
 * <CommentCore {...commentProps} />
 */

import { useMemo } from 'react';

export const useCommentCore = ({ 
  user,
  pagesContainerRef,
  onContentChange,
  ...otherProps 
}) => {
  // CommentCore is a full React component (CommentEditSystem.js copied)
  // So we just pass through the props
  
  const commentProps = useMemo(() => ({
    user,
    pagesContainerRef,
    onContentChange,
    ...otherProps
  }), [user, pagesContainerRef, onContentChange, otherProps]);

  return commentProps;
};

export default useCommentCore;
