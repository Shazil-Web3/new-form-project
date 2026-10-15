import { useEffect, useCallback, useRef } from 'react';
import { socket } from '../../../utils/SocketProvider';

/**
 * Centralized Socket.io hook for template real-time synchronization
 * Used by both UnifiedTextEditor and UnifiedCommentSystem
 * 
 * @param {string} templateId - ID of the template to sync
 * @param {string} mode - Editor mode ('create' | 'preview' | 'review')
 * @param {object} callbacks - Event callbacks
 * @param {function} callbacks.onContentUpdate - Called when content is updated
 * @param {function} callbacks.onCommentAdded - Called when a comment is added
 * @param {function} callbacks.onSuggestionAdded - Called when a suggestion is added
 * @param {function} callbacks.onCommentUpdated - Called when a comment is updated
 * @param {function} callbacks.onSuggestionUpdated - Called when a suggestion is updated
 * @param {function} callbacks.onCommentDeleted - Called when a comment is deleted
 * @param {function} callbacks.onSuggestionDeleted - Called when a suggestion is deleted
 * 
 * @returns {object} Emit functions for broadcasting changes
 */
export const useTemplateSocket = (templateId, mode, callbacks = {}) => {
  const callbacksRef = useRef(callbacks);

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Join template room and set up listeners
  useEffect(() => {
    if (!templateId) {
      return;
    }

    socket.emit('joinTemplate', { templateId, mode });

    // Content updates
    const handleContentUpdate = (data) => {
      callbacksRef.current.onContentUpdate?.(data);
    };

    // Comment events
    const handleCommentAdded = (data) => {
      callbacksRef.current.onCommentAdded?.(data);
    };

    const handleCommentUpdated = (data) => {
      callbacksRef.current.onCommentUpdated?.(data);
    };

    const handleCommentDeleted = (data) => {
      callbacksRef.current.onCommentDeleted?.(data);
    };

    // Suggestion events
    const handleSuggestionAdded = (data) => {
      callbacksRef.current.onSuggestionAdded?.(data);
    };

    const handleSuggestionUpdated = (data) => {
      callbacksRef.current.onSuggestionUpdated?.(data);
    };

    const handleSuggestionDeleted = (data) => {
      callbacksRef.current.onSuggestionDeleted?.(data);
    };

    // Register listeners
    socket.on('templateContentUpdated', handleContentUpdate);
    socket.on('templateCommentAdded', handleCommentAdded);
    socket.on('templateCommentUpdated', handleCommentUpdated);
    socket.on('templateCommentDeleted', handleCommentDeleted);
    socket.on('templateSuggestionAdded', handleSuggestionAdded);
    socket.on('templateSuggestionUpdated', handleSuggestionUpdated);
    socket.on('templateSuggestionDeleted', handleSuggestionDeleted);

    // Cleanup
    return () => {
      socket.off('templateContentUpdated', handleContentUpdate);
      socket.off('templateCommentAdded', handleCommentAdded);
      socket.off('templateCommentUpdated', handleCommentUpdated);
      socket.off('templateCommentDeleted', handleCommentDeleted);
      socket.off('templateSuggestionAdded', handleSuggestionAdded);
      socket.off('templateSuggestionUpdated', handleSuggestionUpdated);
      socket.off('templateSuggestionDeleted', handleSuggestionDeleted);
      socket.emit('leaveTemplate', { templateId });
    };
  }, [templateId, mode]);

  // Emit functions
  const emitContentChange = useCallback((data) => {
    if (!templateId) {
      return;
    }
    // data can be a string (legacy) or an object { content, headerHTML, footerHTML }
    if (typeof data === 'string') {
      socket.emit('updateTemplateContent', { templateId, content: data });
    } else {
      socket.emit('updateTemplateContent', { templateId, ...data });
    }
  }, [templateId]);

  const emitCommentAdded = useCallback((comment) => {
    if (!templateId) {
      return;
    }
    socket.emit('addTemplateComment', { templateId, comment });
  }, [templateId]);

  const emitCommentUpdated = useCallback((comment) => {
    if (!templateId) {
      return;
    }
    socket.emit('updateTemplateComment', { templateId, comment });
  }, [templateId]);

  const emitCommentDeleted = useCallback((commentId) => {
    if (!templateId) {
      return;
    }
    socket.emit('deleteTemplateComment', { templateId, commentId });
  }, [templateId]);

  const emitSuggestionAdded = useCallback((suggestion) => {
    if (!templateId) {
      return;
    }
    socket.emit('addTemplateSuggestion', { templateId, suggestion });
  }, [templateId]);

  const emitSuggestionUpdated = useCallback((suggestion) => {
    if (!templateId) {
      return;
    }
    socket.emit('updateTemplateSuggestion', { templateId, suggestion });
  }, [templateId]);

  const emitSuggestionDeleted = useCallback((suggestionId) => {
    if (!templateId) {
      return;
    }
    socket.emit('deleteTemplateSuggestion', { templateId, suggestionId });
  }, [templateId]);

  return {
    emitContentChange,
    emitCommentAdded,
    emitCommentUpdated,
    emitCommentDeleted,
    emitSuggestionAdded,
    emitSuggestionUpdated,
    emitSuggestionDeleted,
  };
};

export default useTemplateSocket;
