import { useEffect } from "react";
import { socket } from "../../../../utils/SocketProvider";

export const useCommentSocketListeners = ({
  user,
  getUserDisplayName,
  processedPropsElementIdsRef,
  deletedElementIdsRef,
  pagesContainerRef,
  setFloatingElements,
  reconstructHighlight
}) => {
  useEffect(() => {
    // IMPORTANT: Use the shared ref instead of local Set to prevent duplicates across
    // both props loading AND socket events

    // Join template editor room
    socket.emit("joinTemplateEditor", {
      userId: user?.id || "anonymous",
      userName: getUserDisplayName(user)
    });

    const handleReceiveTemplateComment = ({ comment }) => {
      // Check both the shared ref AND DOM for existing highlight
      if (comment && !processedPropsElementIdsRef.current.has(comment.id)) {
        const existingInDOM = pagesContainerRef.current?.querySelector(`[data-comment-id="${comment.id}"]`);
        if (existingInDOM) {
          console.log('[CommentCore] Socket comment already in DOM, skipping:', comment.id);
          processedPropsElementIdsRef.current.add(comment.id);
          return;
        }

        processedPropsElementIdsRef.current.add(comment.id);

        setFloatingElements((prev) => {
          if (prev.some(item => item.id === comment.id)) {
            return prev;
          }
          return [...prev, comment];
        });

        setTimeout(() => {
          // Final DOM check before reconstruction
          const stillMissing = !pagesContainerRef.current?.querySelector(`[data-comment-id="${comment.id}"]`);
          if (stillMissing) {
            reconstructHighlight(comment, "comment");
          }
        }, 100);
      }
    };

    const handleReceiveTemplateSuggestion = ({ suggestion }) => {
      // Check both the shared ref AND DOM for existing highlight
      if (suggestion && !processedPropsElementIdsRef.current.has(suggestion.id)) {
        const existingInDOM = pagesContainerRef.current?.querySelector(`[data-suggestededit-id="${suggestion.id}"]`);
        if (existingInDOM) {
          console.log('[CommentCore] Socket suggestion already in DOM, skipping:', suggestion.id);
          processedPropsElementIdsRef.current.add(suggestion.id);
          return;
        }

        processedPropsElementIdsRef.current.add(suggestion.id);

        setFloatingElements((prev) => {
          if (prev.some(item => item.id === suggestion.id)) {
            return prev;
          }
          return [...prev, suggestion];
        });

        setTimeout(() => {
          // Final DOM check before reconstruction
          const stillMissing = !pagesContainerRef.current?.querySelector(`[data-suggestededit-id="${suggestion.id}"]`);
          if (stillMissing) {
            reconstructHighlight(suggestion, "suggestededit");
          }
        }, 100);
      }
    };

    // Remove previous listeners to prevent duplication
    socket.off("receiveTemplateComment");
    socket.off("receiveTemplateSuggestion");
    socket.off("receiveTemplateCommentReply");
    socket.off("receiveTemplateSuggestionReply");
    socket.off("templateCommentRemoved");
    socket.off("templateSuggestionRemoved");
    socket.off("templateCommentReplyRemoved");
    socket.off("templateSuggestionReplyRemoved");
    socket.off("updateSuggestedEditStatus");

    // Add new template-specific listeners
    socket.on("receiveTemplateComment", handleReceiveTemplateComment);
    socket.on("receiveTemplateSuggestion", handleReceiveTemplateSuggestion);

    socket.on("updateSuggestedEditStatus", ({ suggestededitId, status }) => {
      setFloatingElements((prev) =>
        prev.map((item) =>
          item.id === suggestededitId ? { ...item, status } : item
        )
      );
      const root = pagesContainerRef.current || (typeof document !== 'undefined' ? document : null);
      const wrappers = root?.querySelectorAll(`[data-suggestededit-id="${suggestededitId}"], [data-suggestion-id="${suggestededitId}"]`);
      wrappers?.forEach(w => {
        w.setAttribute('data-suggestion-status', status);
        w.classList.add('suggestion-resolved');
      });
    });

    socket.on("updateCommentStatus", ({ commentId, status }) => {
      setFloatingElements((prev) =>
        prev.map((item) =>
          item.id === commentId ? { ...item, status } : item
        )
      );
      if (status === 'resolved' || status === 'done') {
        const root = pagesContainerRef.current || (typeof document !== 'undefined' ? document : null);
        const highlights = root?.querySelectorAll(`[data-comment-id="${commentId}"]`);
        highlights?.forEach(highlight => {
          highlight.setAttribute('data-comment-status', 'resolved');
          highlight.classList.add('comment-resolved');
        });
      }
    });

    // For comment replies
    socket.on("receiveTemplateCommentReply", ({ commentId, reply }) => {
      setFloatingElements((prev) => {
        const existingComment = prev.find(item => item.id === commentId);
        if (existingComment && existingComment.replies.some(r => r.id === reply.id)) {
          return prev;
        }
        return prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, replies: [...comment.replies, reply] }
            : comment
        );
      });
    });

    // For suggestion replies
    socket.on("receiveTemplateSuggestionReply", ({ suggestionId, reply }) => {
      setFloatingElements((prev) => {
        const existingEdit = prev.find(item => item.id === suggestionId);
        if (existingEdit && existingEdit.replies.some(r => r.id === reply.id)) {
          return prev;
        }
        return prev.map((suggestion) =>
          suggestion.id === suggestionId
            ? { ...suggestion, replies: [...suggestion.replies, reply] }
            : suggestion
        );
      });
    });

    const handleCommentRemoved = ({ commentId }) => {
      deletedElementIdsRef.current.add(commentId);
      setFloatingElements((prev) =>
        prev.filter((element) => element.id !== commentId)
      );

      const container = pagesContainerRef.current;
      const highlights = container
        ? container.querySelectorAll(`[data-comment-id="${commentId}"]`)
        : document.querySelectorAll(`[data-comment-id="${commentId}"]`);

      highlights?.forEach(highlight => {
        const parent = highlight.parentNode;
        if (parent) {
          while (highlight.firstChild) {
            parent.insertBefore(highlight.firstChild, highlight);
          }
          parent.removeChild(highlight);
          try {
            parent.normalize();
          } catch {}
        }
      });
    };

    socket.on("templateCommentRemoved", handleCommentRemoved);
    socket.on("commentRemoved", handleCommentRemoved);

    socket.on("templateSuggestionRemoved", ({ suggestionId }) => {
      setFloatingElements((prev) =>
        prev.filter((element) => element.id !== suggestionId)
      );
    });

    socket.on("templateCommentReplyRemoved", ({ commentId, replyId }) => {
      setFloatingElements((prev) =>
        prev.map((item) =>
          item.id === commentId
            ? { ...item, replies: item.replies.filter((r) => r.id !== replyId) }
            : item
        )
      );
    });

    socket.on("templateSuggestionReplyRemoved", ({ suggestionId, replyId }) => {
      setFloatingElements((prev) =>
        prev.map((item) =>
          item.id === suggestionId
            ? { ...item, replies: item.replies.filter((r) => r.id !== replyId) }
            : item
        )
      );
    });

    return () => {
      socket.off("receiveTemplateComment");
      socket.off("receiveTemplateSuggestion");
      socket.off("receiveTemplateCommentReply");
      socket.off("receiveTemplateSuggestionReply");
      socket.off("templateCommentRemoved", handleCommentRemoved);
      socket.off("commentRemoved", handleCommentRemoved);
      socket.off("templateSuggestionRemoved");
      socket.off("templateCommentReplyRemoved");
      socket.off("templateSuggestionReplyRemoved");
      socket.off("updateSuggestedEditStatus");
    };
  }, [
    user,
    getUserDisplayName,
    processedPropsElementIdsRef,
    deletedElementIdsRef,
    pagesContainerRef,
    setFloatingElements,
    reconstructHighlight
  ]);
};
