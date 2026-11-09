import { useCallback } from "react";
import { socket } from "../../../../utils/SocketProvider";

export const useReplyActions = ({
  triggerBeforeAction,
  replyText,
  setReplyText,
  setActiveReplyId,
  getUserDisplayName,
  docId,
  setFloatingElements,
  floatingElementsRef,
  onCommentsChange,
  onSuggestionsChange
}) => {
  // Reply to comment
  const replyComment = useCallback((userData, commentId) => {
    triggerBeforeAction();
    if (!replyText.trim()) {
      console.warn("Cannot reply with empty text");
      return;
    }

    const userDisplayName = getUserDisplayName(userData);

    console.log("Adding reply to comment:", commentId, "by user:", userDisplayName);

    const reply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      // Standardized reply format for both systems
      user: userDisplayName,
      email: userData?.email || null,
      text: replyText,
      timestamp: new Date().toISOString(),
      avatar: userData?.avatar || null,
      // Additional fields for full compatibility
      author: userDisplayName,
      userId: userData?.id || null,
      userEmail: userData?.email || null,
    };

    // Emit to socket - use template-specific reply event
    socket.emit("addTemplateCommentReply", { templateId: docId, commentId, reply });

    // Update local state
    setFloatingElements((prev) =>
      prev.map((item) =>
        item.id === commentId
          ? { ...item, replies: [...item.replies, reply] }
          : item
      )
    );

    // NEW: Trigger instant save callback
    setTimeout(() => {
      if (onCommentsChange) {
        const updatedComments = floatingElementsRef.current.filter(el => el.type === 'comment');
        onCommentsChange(updatedComments);
      }
    }, 0);

    setReplyText("");
    setActiveReplyId(null);

    console.log("Successfully added reply to comment:", commentId);
  }, [replyText, getUserDisplayName, triggerBeforeAction, docId, setFloatingElements, onCommentsChange, floatingElementsRef, setReplyText, setActiveReplyId]);

  // Reply to suggested edit
  const replySuggestedEdit = useCallback((userData, suggestededitId) => {
    triggerBeforeAction();
    if (!replyText.trim()) {
      console.warn("Cannot reply with empty text");
      return;
    }

    const userDisplayName = getUserDisplayName(userData);

    console.log("Adding reply to suggested edit:", suggestededitId, "by user:", userDisplayName);

    const reply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      // Standardized reply format for both systems
      user: userDisplayName,
      email: userData?.email || null,
      text: replyText,
      timestamp: new Date().toISOString(),
      avatar: userData?.avatar || null,
      // Additional fields for full compatibility
      author: userDisplayName,
      userId: userData?.id || null,
      userEmail: userData?.email || null,
    };

    // Emit to socket - use template-specific reply event
    socket.emit("addTemplateSuggestionReply", { templateId: docId, suggestionId: suggestededitId, reply });

    // Update local state
    setFloatingElements((prev) =>
      prev.map((item) =>
        item.id === suggestededitId
          ? { ...item, replies: [...item.replies, reply] }
          : item
      )
    );

    // NEW: Trigger instant save callback
    setTimeout(() => {
      if (onSuggestionsChange) {
        const updatedSuggestions = floatingElementsRef.current.filter(el => el.type === 'suggestededit');
        onSuggestionsChange(updatedSuggestions);
      }
    }, 0);

    setReplyText("");
    setActiveReplyId(null);

    console.log("Successfully added reply to suggested edit:", suggestededitId);
  }, [replyText, getUserDisplayName, triggerBeforeAction, docId, setFloatingElements, onSuggestionsChange, floatingElementsRef, setReplyText, setActiveReplyId]);

  // Delete a reply from a comment or suggestion
  const deleteReply = useCallback((elementId, replyId, elementType) => {
    triggerBeforeAction();
    console.log(`[CommentCore] Deleting reply ${replyId} from ${elementType} ${elementId}`);

    setFloatingElements((prev) => {
      // Find the element first to check if we need to update
      const element = prev.find(el => el.id === elementId);
      if (!element || !element.replies.some(r => r.id === replyId)) {
        return prev;
      }

      const updated = prev.map((item) => {
        if (item.id === elementId) {
          return {
            ...item,
            replies: item.replies.filter((r) => r.id !== replyId)
          };
        }
        return item;
      });

      // Emit to socket
      const eventName = elementType === 'comment' ? "removeTemplateCommentReply" : "removeTemplateSuggestionReply";
      const idKey = elementType === 'comment' ? 'commentId' : 'suggestionId';

      socket.emit(eventName, {
        templateId: docId,
        [idKey]: elementId,
        replyId
      });

      // Trigger instant save callbacks
      setTimeout(() => {
        if (elementType === 'comment' && onCommentsChange) {
          onCommentsChange(updated.filter(el => el.type === 'comment'));
        } else if (elementType === 'suggestededit' && onSuggestionsChange) {
          onSuggestionsChange(updated.filter(el => el.type === 'suggestededit'));
        }
      }, 0);

      return updated;
    });
  }, [triggerBeforeAction, docId, setFloatingElements, onCommentsChange, onSuggestionsChange]);

  return {
    replyComment,
    replySuggestedEdit,
    deleteReply
  };
};
