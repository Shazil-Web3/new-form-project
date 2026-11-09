import { useCallback } from "react";

/**
 * Hook to manage user permissions for acting on strikes and items.
 */
export const useCommentPermissions = ({
  user,
  userRole,
  disableAcceptReject,
  currentUserId,
  currentUserEmail,
  sessionCreatedIds
}) => {
  const canActOnStrike = useCallback((strikeEl) => {
    if (!strikeEl) return false;

    // Check role restriction: reviewer cannot act on admin text
    const creatorRole = strikeEl.getAttribute('data-creator-role') || (strikeEl.classList.contains('admin-edit') ? 'admin' : '');
    const rawRole = userRole || user?.role || '';
    const normalizedRole = String(rawRole).trim().toLowerCase();
    const isCurrentAdmin = normalizedRole === 'admin' || normalizedRole === '1' || normalizedRole === 'author';
    
    if (creatorRole === 'admin' && !isCurrentAdmin) {
      return false; // Reviewers cannot accept/reject admin (author) text
    }

    const creatorId = strikeEl.getAttribute('data-strike-created-by-id') || strikeEl.getAttribute('data-owner-id');
    const creatorEmail = (strikeEl.getAttribute('data-strike-created-by-email') || strikeEl.getAttribute('data-user-email') || '').toLowerCase();

    // Backward compatibility: if no ownership metadata exists, keep existing behavior.
    if (!creatorId && !creatorEmail) return true;
    if (currentUserId && creatorId && currentUserId === String(creatorId)) return false;
    if (currentUserEmail && creatorEmail && currentUserEmail === creatorEmail) return false;
    return true;
  }, [currentUserEmail, currentUserId, userRole, user]);

  const isCommentItem = (item) => {
    const t = String(item?.type || item?.elementType || 'comment').trim().toLowerCase();
    return t === 'comment';
  };

  const canApproveOrRejectItem = useCallback((item) => {
    if (disableAcceptReject) return false;
    if (!item) return false;
    
    // Check if current user is the creator of this item
    const creatorId = item.userId;
    const creatorEmail = (item.userEmail || item.email || '').toLowerCase();
    const isCurrentCreator = (currentUserId && creatorId && currentUserId === String(creatorId)) || 
                             (currentUserEmail && creatorEmail && currentUserEmail === creatorEmail);
                             
    if (isCurrentCreator) {
      if (!sessionCreatedIds.current.has(String(item.id))) {
        return false; // Creator cannot resolve/accept their own item after this session
      }
    }

    // Comments: reviewers (and others) may resolve author comments; only the creator rule above applies to them.
    if (isCommentItem(item)) {
      return true;
    }

    // Suggested edits: reviewers cannot accept/reject changes on author/admin-owned text.
    const creatorRole = String(item.creatorRole || '').trim().toLowerCase();
    const rawRole = userRole || user?.role || '';
    const normalizedRole = String(rawRole).trim().toLowerCase();
    const isCurrentAdmin = normalizedRole === 'admin' || normalizedRole === '1' || normalizedRole === 'author';
    const isCreatorAdmin = creatorRole === 'admin' || creatorRole === 'author';
    if (isCreatorAdmin && !isCurrentAdmin) {
      return false;
    }
    return true;
  }, [userRole, user, currentUserId, currentUserEmail, disableAcceptReject, sessionCreatedIds]);

  return {
    canActOnStrike,
    canApproveOrRejectItem
  };
};
