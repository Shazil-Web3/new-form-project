import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Checks whether the current logged-in user is an active reviewer or approver
 * with a pending action on the given template/document.
 */
export const checkPendingWorkflowAction = (item, currentUser) => {
  if (!item || !currentUser) {
    return { isPending: false, type: null, actionName: null, roleName: null, itemType: 'document' };
  }

  const userEmail = String(currentUser?.email || '').trim().toLowerCase();
  const userId = String(currentUser?.id || currentUser?.userId || '');
  const status = String(item.status || '').toLowerCase();
  const isDoc = Boolean(item.document_id || item.doc_id || item.type === 'document' || item.document_type);
  const itemType = isDoc ? 'document' : 'template';

  const approversData = item.template_approvers || {};
  const reviewersList = Array.isArray(approversData.reviewers)
    ? approversData.reviewers
    : (Array.isArray(item.reviewers) ? item.reviewers : []);
  const approversList = Array.isArray(approversData.approvers)
    ? approversData.approvers
    : (Array.isArray(item.approvers) ? item.approvers : []);

  if (status === 'pending_review') {
    const reviewer = reviewersList.find((r) => {
      const rEmail = String(r?.email || '').trim().toLowerCase();
      const rId = String(r?.userId || r?.id || '');
      return (userEmail && rEmail && rEmail === userEmail) || (userId && rId && rId === userId);
    });

    if (reviewer) {
      const rStatus = String(reviewer.status || 'pending').toLowerCase();
      if (rStatus === 'pending') {
        return {
          isPending: true,
          type: 'review',
          roleName: 'Reviewer',
          actionName: 'Review',
          itemType
        };
      }
    }
  } else if (status === 'pending_approval') {
    const approver = approversList.find((a) => {
      const aEmail = String(a?.email || '').trim().toLowerCase();
      const aId = String(a?.userId || a?.id || '');
      return (userEmail && aEmail && aEmail === userEmail) || (userId && aId && aId === userId);
    });

    if (approver) {
      const aStatus = String(approver.status || 'pending').toLowerCase();
      if (aStatus === 'pending') {
        return {
          isPending: true,
          type: 'approval',
          roleName: 'Approver',
          actionName: 'Approval',
          itemType
        };
      }
    }
  }

  return { isPending: false, type: null, actionName: null, roleName: null, itemType };
};

/**
 * Hook to enforce exit confirmation for reviewers and approvers when review/approval is pending.
 */
export const useWorkflowNavigationGuard = (item, currentUser) => {
  const navigate = useNavigate();
  const [modalVisible, setModalVisible] = useState(false);
  const pendingCallbackRef = useRef(null);
  const bypassGuardRef = useRef(false);
  // Tracks whether we have pushed an extra guard history entry that must be
  // compensated for when the in-app back button triggers Leave Anyway.
  const guardStatePushedRef = useRef(false);

  const pendingInfo = useMemo(() => {
    return checkPendingWorkflowAction(item, currentUser);
  }, [item, currentUser]);

  // Programmatic Navigation Guard (for in-website back buttons or custom links)
  const guardNavigation = useCallback((onProceed) => {
    if (!pendingInfo.isPending || bypassGuardRef.current) {
      if (typeof onProceed === 'function') onProceed();
      return;
    }

    pendingCallbackRef.current = () => {
      bypassGuardRef.current = true;
      if (typeof onProceed === 'function') {
        onProceed();
        // If the guard pushed an extra history entry (guardStatePushedRef), the
        // onProceed above (usually navigate(-1)) only pops the guard copy and
        // lands on the same page URL. We must go back one more step so the user
        // actually leaves the page. bypassGuardRef is already true so the
        // popstate handler will not re-intercept this navigation.
        if (guardStatePushedRef.current) {
          setTimeout(() => window.history.go(-1), 0);
        }
      }
    };
    setModalVisible(true);
  }, [pendingInfo.isPending]);

  const handleStay = useCallback(() => {
    setModalVisible(false);
    pendingCallbackRef.current = null;
  }, []);

  const handleLeaveAnyway = useCallback(() => {
    const cb = pendingCallbackRef.current;
    pendingCallbackRef.current = null;
    setModalVisible(false);

    if (typeof cb === 'function') {
      cb();
    }
  }, []);

  // 1. Intercept Browser Tab Close / Window Close / Reload (beforeunload)
  useEffect(() => {
    if (!pendingInfo.isPending) return;

    const message = `${pendingInfo.actionName || 'Review'} is currently pending. Are you sure you want to leave without completing your ${pendingInfo.actionName?.toLowerCase() || 'review'}?`;

    const handleBeforeUnload = (e) => {
      if (bypassGuardRef.current) return;
      e.preventDefault();
      // Set returnValue with custom message (modern browsers show standard prompt for security)
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pendingInfo.isPending, pendingInfo.actionName]);

  // 2. Intercept Browser History Back Button (the browser back arrow)
  useEffect(() => {
    if (!pendingInfo.isPending) return;

    const currentUrl = window.location.href;
    // Push an extra history entry on the same URL so clicking browser Back keeps the user on the route
    window.history.pushState({ workflowGuard: true }, '', currentUrl);
    guardStatePushedRef.current = true;

    const handlePopState = () => {
      if (bypassGuardRef.current) {
        // Once we let navigation through, the guard entry is consumed.
        guardStatePushedRef.current = false;
        return;
      }

      // Re-push the guard state to prevent React Router from unmounting
      window.history.pushState({ workflowGuard: true }, '', currentUrl);
      // guardStatePushedRef remains true since we re-pushed.

      // Open reminder modal — this path is for the BROWSER back button.
      // The popstate already consumed one history entry so we need go(-2) to
      // skip both the re-pushed guard entry and the popped-and-re-pushed one.
      pendingCallbackRef.current = () => {
        bypassGuardRef.current = true;
        guardStatePushedRef.current = false;
        if (window.history && window.history.length > 2) {
          window.history.go(-2);
        } else {
          navigate('/dashboard');
        }
      };
      setModalVisible(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      guardStatePushedRef.current = false;
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pendingInfo.isPending, navigate]);

  // 3. Intercept React Router SPA pushState navigations (e.g. sidebar, topbar, or internal links)
  useEffect(() => {
    if (!pendingInfo.isPending) return;

    const originalPushState = window.history.pushState;
    window.history.pushState = function (state, title, url) {
      if (bypassGuardRef.current || !url || (state && state.workflowGuard)) {
        return originalPushState.apply(this, arguments);
      }

      try {
        const targetUrl = new URL(url, window.location.origin);
        if (targetUrl.pathname !== window.location.pathname) {
          guardNavigation(() => {
            bypassGuardRef.current = true;
            originalPushState.call(window.history, state, title, url);
            window.dispatchEvent(new Event('popstate'));
          });
          return;
        }
      } catch (_) {}

      return originalPushState.apply(this, arguments);
    };

    return () => {
      window.history.pushState = originalPushState;
    };
  }, [pendingInfo.isPending, guardNavigation]);

  return {
    isPending: pendingInfo.isPending,
    pendingInfo,
    modalVisible,
    guardNavigation,
    handleStay,
    handleLeaveAnyway
  };
};

export default useWorkflowNavigationGuard;
