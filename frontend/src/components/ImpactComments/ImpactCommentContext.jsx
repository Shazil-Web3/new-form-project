import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../api/apiClient';
import { saveDocumentImpactComment, deleteDocumentImpactComment } from '../../api/documents';
import { saveTemplateImpactComment, deleteTemplateImpactComment } from '../../api/templates';

const ImpactCommentContext = createContext(null);

export const useImpactComments = () => {
  const context = useContext(ImpactCommentContext);
  if (!context) {
    throw new Error('useImpactComments must be used within an ImpactCommentProvider');
  }
  return context;
};

const DEFAULT_ACTORS = [
  { id: 'usr-admin', name: 'Admin (Daniel Ventura)', role: 'Admin', email: 'admin@company.com' },
  { id: 'usr-reviewer', name: 'Reviewer (Jane Doe)', role: 'Reviewer', email: 'reviewer@company.com' },
  { id: 'usr-approver', name: 'Approver (John Smith)', role: 'Approver', email: 'approver@company.com' },
  { id: 'usr-member', name: 'Member (Alex Taylor)', role: 'Member', email: 'member@company.com' },
];

export const ImpactCommentProvider = ({
  children,
  initialComments = [],
  onCommentsChange,
  documentId = null,
  templateId = null,
  currentUser = null,
}) => {
  // Safe parsing of initialComments (could be string or array)
  const parseComments = useCallback((raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }, []);

  const storageKey = `impact_comments_cache_${documentId || templateId || 'draft'}`;

  const [comments, setComments] = useState(() => {
    const parsed = parseComments(initialComments);
    if (parsed.length > 0) return parsed;
    try {
      const cached = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
      if (cached) {
        const parsedCached = JSON.parse(cached);
        if (Array.isArray(parsedCached) && parsedCached.length > 0) {
          return parsedCached;
        }
      }
    } catch (e) {}
    return [];
  });

  const [activeCommentId, setActiveCommentId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'open' | 'resolved'

  // Text selection state
  const [selectionState, setSelectionState] = useState(null); // { text, rect, context, fieldIndex }
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Available actors for conversation simulation (Reviewer, Admin, Approver, Member)
  const [availableActors, setAvailableActors] = useState(DEFAULT_ACTORS);
  const [activeActorId, setActiveActorId] = useState(() => {
    try {
      const mock = localStorage.getItem('mock_user_override');
      if (mock) {
        const parsed = JSON.parse(mock);
        if (parsed?.id) return String(parsed.id);
      }
    } catch (e) {}
    return currentUser?.id ? String(currentUser.id) : DEFAULT_ACTORS[0].id;
  });

  // Fetch real org users to populate available actors
  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const res = await apiClient.get('/api/users');
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        if (isMounted && list.length > 0) {
          const mapped = list.map((u) => {
            const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email || 'User';
            const role = u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'Member';
            return {
              id: String(u.id),
              name: fullName,
              first_name: u.first_name || '',
              last_name: u.last_name || '',
              email: u.email || '',
              role,
            };
          });
          setAvailableActors(mapped);
        }
      } catch (err) {
        // Fallback to DEFAULT_ACTORS
      }
    };
    fetchUsers();
    return () => { isMounted = false; };
  }, []);

  // Listen to Topbar Permissions Actor changes via localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const mock = localStorage.getItem('mock_user_override');
        if (mock) {
          const parsed = JSON.parse(mock);
          if (parsed?.id) setActiveActorId(String(parsed.id));
        }
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Fetch server comments on mount if documentId is provided
  useEffect(() => {
    if (!documentId) return;
    let isMounted = true;
    const loadBackendComments = async () => {
      try {
        const res = await apiClient.get(`/api/documents/${documentId}/impact-comments`);
        const serverComments = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        if (isMounted && serverComments.length > 0) {
          setComments(serverComments);
          try {
            sessionStorage.setItem(storageKey, JSON.stringify(serverComments));
            localStorage.setItem(storageKey, JSON.stringify(serverComments));
          } catch (e) {}
        }
      } catch (err) {
        // Gracefully ignore if document is new or offline
      }
    };
    loadBackendComments();
    return () => { isMounted = false; };
  }, [documentId, storageKey]);

  // Sync when initialComments prop changes externally (skip if self-dispatched)
  const lastInitialCommentsRef = useRef(null);
  const lastSelfDispatchedRef = useRef(null);

  useEffect(() => {
    const rawStr = typeof initialComments === 'string' ? initialComments : JSON.stringify(initialComments || []);
    if (lastInitialCommentsRef.current === null) {
      lastInitialCommentsRef.current = rawStr;
      const parsed = parseComments(initialComments);
      if (parsed.length > 0) {
        setComments(parsed);
      }
      return;
    }
    if (lastSelfDispatchedRef.current === rawStr) {
      // Ignored: update originated from this context
      return;
    }
    if (lastInitialCommentsRef.current !== rawStr) {
      lastInitialCommentsRef.current = rawStr;
      const parsed = parseComments(initialComments);
      if (parsed.length > 0) {
        setComments(parsed);
      }
    }
  }, [initialComments, parseComments]);

  // Keep ref to onCommentsChange to avoid stale closures
  const onCommentsChangeRef = useRef(onCommentsChange);
  useEffect(() => {
    onCommentsChangeRef.current = onCommentsChange;
  }, [onCommentsChange]);

  // Resolve current active user info
  const resolveUser = useCallback((customAuthor = null) => {
    if (customAuthor) return customAuthor;

    // 1. If an actor is explicitly chosen in activeActorId
    if (activeActorId && availableActors && availableActors.length > 0) {
      const match = availableActors.find((a) => String(a.id) === String(activeActorId));
      if (match) return match;
    }

    // 2. Check Topbar mock user override in localStorage
    try {
      const mock = localStorage.getItem('mock_user_override');
      if (mock) {
        const parsed = JSON.parse(mock);
        if (parsed) {
          const fullName = `${parsed.first_name || parsed.firstName || ''} ${parsed.last_name || parsed.lastName || ''}`.trim() || parsed.name || parsed.username || 'User';
          return {
            id: String(parsed.id || parsed.userId || 'usr-mock'),
            name: fullName,
            first_name: parsed.first_name || parsed.firstName || fullName,
            last_name: parsed.last_name || parsed.lastName || '',
            email: parsed.email || '',
            role: parsed.role ? (parsed.role.charAt(0).toUpperCase() + parsed.role.slice(1)) : 'Admin',
          };
        }
      }
    } catch (e) {}

    // 3. Check currentUser prop
    if (currentUser) {
      const fullName = [currentUser.first_name || currentUser.firstName, currentUser.last_name || currentUser.lastName].filter(Boolean).join(' ') || currentUser.name || currentUser.username || 'User';
      return {
        id: String(currentUser.id || currentUser.userId || 'usr-curr'),
        name: fullName,
        first_name: currentUser.first_name || currentUser.firstName || fullName,
        last_name: currentUser.last_name || currentUser.lastName || '',
        email: currentUser.email || '',
        role: currentUser.role || (currentUser.is_admin ? 'Admin' : 'Member'),
      };
    }

    // 4. Check localStorage user
    try {
      const stored = localStorage.getItem('user') || localStorage.getItem('currentUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) return parsed;
      }
    } catch (e) {}

    return DEFAULT_ACTORS[0];
  }, [activeActorId, availableActors, currentUser]);

  // Persistence helper
  const persistComments = useCallback(async (updatedComments, commentToSave = null) => {
    lastSelfDispatchedRef.current = JSON.stringify(updatedComments);

    // 1. Immediately cache locally so switching tabs never loses data
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(updatedComments));
      localStorage.setItem(storageKey, JSON.stringify(updatedComments));
    } catch (e) {}

    // 2. Notify parent component
    if (onCommentsChangeRef.current) {
      onCommentsChangeRef.current(updatedComments);
    }

    // 3. Save to backend if documentId or templateId is available
    try {
      if (documentId) {
        await saveDocumentImpactComment(documentId, {
          comment: commentToSave,
          comments: updatedComments
        });
      } else if (templateId) {
        await saveTemplateImpactComment(templateId, {
          comment: commentToSave,
          comments: updatedComments
        });
      }
    } catch (err) {
      console.warn('Could not auto-save impact comments to backend endpoint:', err);
    }
  }, [documentId, templateId, storageKey]);

  // Add a new comment thread
  const addComment = useCallback(async ({
    text,
    selectedText,
    context = '',
    fieldIndex = null,
    isField = false,
    fieldName = null,
    fieldValue = null,
    fields = [],
    customAuthor = null,
  }) => {
    if (!text || !text.trim()) return;

    const user = resolveUser(customAuthor);
    const authorName = [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(' ') || user.name || user.username || 'User';

    const newComment = {
      id: `impact-cmt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      selectedText: selectedText || '',
      context: context || '',
      fieldIndex: fieldIndex,
      isField: Boolean(isField),
      fieldName: fieldName || null,
      fieldValue: fieldValue || null,
      fields: Array.isArray(fields) ? fields : [],
      author: {
        id: user.id || user.userId || 'usr-anon',
        name: authorName,
        email: user.email || '',
        role: user.role || (user.is_admin ? 'Admin' : 'Member')
      },
      text: text.trim(),
      createdAt: new Date().toISOString(),
      status: 'open',
      replies: []
    };

    const updated = [newComment, ...comments];
    setComments(updated);
    setActiveCommentId(newComment.id);
    setIsSidebarOpen(true);
    setIsComposerOpen(false);
    setSelectionState(null);

    await persistComments(updated, newComment);
    return newComment;
  }, [comments, resolveUser, persistComments]);

  // Add reply to an existing comment
  const addReply = useCallback(async (commentId, replyText, customAuthor = null) => {
    if (!replyText || !replyText.trim()) return;

    const user = resolveUser(customAuthor);
    const authorName = [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(' ') || user.name || user.username || 'User';

    const newReply = {
      id: `impact-rep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      author: {
        id: user.id || user.userId || 'usr-anon',
        name: authorName,
        email: user.email || '',
        role: user.role || (user.is_admin ? 'Admin' : 'Member')
      },
      text: replyText.trim(),
      createdAt: new Date().toISOString()
    };

    let modifiedComment = null;
    const updated = comments.map(c => {
      if (c.id === commentId) {
        modifiedComment = {
          ...c,
          replies: [...(c.replies || []), newReply]
        };
        return modifiedComment;
      }
      return c;
    });

    setComments(updated);
    await persistComments(updated, modifiedComment);
    return newReply;
  }, [comments, resolveUser, persistComments]);

  // Toggle resolve / reopen
  const toggleResolveComment = useCallback(async (commentId) => {
    let modifiedComment = null;
    const updated = comments.map(c => {
      if (c.id === commentId) {
        const nextStatus = c.status === 'resolved' ? 'open' : 'resolved';
        modifiedComment = {
          ...c,
          status: nextStatus,
          resolvedAt: nextStatus === 'resolved' ? new Date().toISOString() : null
        };
        return modifiedComment;
      }
      return c;
    });

    setComments(updated);
    await persistComments(updated, modifiedComment);
  }, [comments, persistComments]);

  // Delete an entire comment thread
  const deleteComment = useCallback(async (commentId) => {
    const updated = comments.filter(c => c.id !== commentId);
    setComments(updated);
    if (activeCommentId === commentId) {
      setActiveCommentId(null);
    }

    if (onCommentsChangeRef.current) {
      onCommentsChangeRef.current(updated);
    }

    try {
      if (documentId) {
        await deleteDocumentImpactComment(documentId, commentId);
      } else if (templateId) {
        await deleteTemplateImpactComment(templateId, commentId);
      }
    } catch (err) {
      console.warn('Backend delete impact comment fallback update:', err);
      // Fallback: sync updated array
      await persistComments(updated);
    }
  }, [comments, activeCommentId, documentId, templateId, persistComments]);

  // Delete a specific reply
  const deleteReply = useCallback(async (commentId, replyId) => {
    let modifiedComment = null;
    const updated = comments.map(c => {
      if (c.id === commentId) {
        modifiedComment = {
          ...c,
          replies: (c.replies || []).filter(r => r.id !== replyId)
        };
        return modifiedComment;
      }
      return c;
    });

    setComments(updated);
    await persistComments(updated, modifiedComment);
  }, [comments, persistComments]);

  // Filtered comments getter
  const filteredComments = comments.filter(c => {
    if (filter === 'open') return c.status !== 'resolved';
    if (filter === 'resolved') return c.status === 'resolved';
    return true;
  });

  const value = {
    comments,
    filteredComments,
    activeCommentId,
    setActiveCommentId,
    isSidebarOpen,
    setIsSidebarOpen,
    filter,
    setFilter,
    selectionState,
    setSelectionState,
    isComposerOpen,
    setIsComposerOpen,
    addComment,
    addReply,
    toggleResolveComment,
    deleteComment,
    deleteReply,
    resolveUser,
    availableActors,
    activeActorId,
    setActiveActorId,
  };

  return (
    <ImpactCommentContext.Provider value={value}>
      {children}
    </ImpactCommentContext.Provider>
  );
};
