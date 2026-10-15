/**
 * Checks whether there are any unaddressed (unresolved/pending) comments or suggestions.
 *
 * Addressed/Resolved = status is 'resolved', 'done', 'approved', 'declined', 'accepted', or 'rejected'.
 * Unaddressed = anything else (e.g. 'open', 'pending', empty string, undefined, null).
 *
 * Returns true if any unaddressed items are found.
 */

export const RESOLVED_STATUSES = new Set([
  'resolved',
  'done',
  'approved',
  'declined',
  'accepted',
  'rejected'
]);

export const isDraftComment = (comment, context = {}) => {
  if (!comment) return false;

  // 1. Explicit boolean flag
  if (comment.createdInDraft === true) return true;
  if (comment.createdInDraft === false) return false;

  // 2. Explicit origin or stage
  const origin = (comment.origin || '').toLowerCase().trim();
  const stage = (comment.stage || '').toLowerCase().trim();
  if (origin === 'draft' || stage === 'draft') return true;
  if (origin === 'review' || stage === 'review') return false;

  // 3. Reviewers' comments are never draft comments
  const creatorRole = String(comment.creatorRole || '').trim().toLowerCase();
  if (creatorRole === 'reviewer' || creatorRole === 'template_reviewer' || creatorRole === 'document_reviewer') {
    return false;
  }

  // 4. Timestamp comparison against review start (earliest reviewer received_at)
  const reviewers = context.reviewers || context.template_approvers?.reviewers || [];
  const reviewTimestamps = reviewers
    .map(r => r.received_at || r.assigned_at || r.createdAt)
    .filter(Boolean)
    .map(t => new Date(t).getTime())
    .filter(t => !isNaN(t));

  if (reviewTimestamps.length > 0 && comment.timestamp) {
    const earliestReview = Math.min(...reviewTimestamps);
    const commentTime = new Date(comment.timestamp).getTime();
    if (!isNaN(commentTime) && commentTime < earliestReview) {
      return true;
    }
  }

  return false;
};

export const hasUnaddressedItems = ({ comments = [], suggestions = [] } = {}, context = {}) => {
  // 1. Build lookup maps from state arrays (ground truth for item statuses)
  const commentsMap = new Map();
  (Array.isArray(comments) ? comments : []).forEach(c => {
    if (c && c.id != null) {
      commentsMap.set(String(c.id), c);
    }
  });

  const suggestionsMap = new Map();
  (Array.isArray(suggestions) ? suggestions : []).forEach(s => {
    if (s && s.id != null) {
      suggestionsMap.set(String(s.id), s);
    }
  });

  // 2. Check state arrays: If any comment or suggestion is unaddressed in state, return true
  // Note: Comments originating from Draft are for context/history only and must not block approval
  for (const comment of commentsMap.values()) {
    if (isDraftComment(comment, context)) {
      continue;
    }
    const status = (comment.status || '').toLowerCase().trim();
    if (!RESOLVED_STATUSES.has(status)) {
      return true;
    }
  }

  for (const suggestion of suggestionsMap.values()) {
    const status = (suggestion.status || '').toLowerCase().trim();
    if (!RESOLVED_STATUSES.has(status)) {
      return true;
    }
  }

  // 3. Scan live DOM — catches items created during this review session
  //    that may not yet be flushed back to state arrays
  if (typeof document !== 'undefined') {
    // A. Check comment spans
    const commentSpans = document.querySelectorAll('span[data-comment-id], span.comment-highlight');
    const seenCommentIds = new Set();

    for (const span of commentSpans) {
      const commentId = span.getAttribute('data-comment-id') || span.getAttribute('data-id');
      if (commentId) {
        if (seenCommentIds.has(commentId)) continue;
        seenCommentIds.add(commentId);

        // Check against state array first (source of truth)
        const matchedComment = commentsMap.get(String(commentId));
        if (matchedComment) {
          if (isDraftComment(matchedComment, context)) {
            continue;
          }
          const status = (matchedComment.status || '').toLowerCase().trim();
          if (RESOLVED_STATUSES.has(status)) {
            continue; // Resolved in state - do not flag
          }
          return true; // Unresolved comment in state
        }
      }

      // If not present in state array, check DOM attributes/classes
      if (
        span.getAttribute('data-comment-origin') === 'draft' ||
        span.getAttribute('data-comment-stage') === 'draft' ||
        span.getAttribute('data-created-in-draft') === 'true'
      ) {
        continue;
      }

      const status = (
        span.getAttribute('data-comment-status') ||
        span.getAttribute('data-status') ||
        ''
      ).toLowerCase().trim();
      const isResolved = span.classList.contains('comment-resolved') || RESOLVED_STATUSES.has(status);
      if (!isResolved) {
        return true;
      }
    }

    // B. Check suggestion spans
    const suggestionSpans = document.querySelectorAll(
      'span[data-suggestededit-id], span[data-suggestion-id], span.suggestion-highlight'
    );
    const seenSuggestionIds = new Set();

    for (const span of suggestionSpans) {
      const suggestionId =
        span.getAttribute('data-suggestededit-id') ||
        span.getAttribute('data-suggestion-id') ||
        span.getAttribute('data-id');

      if (suggestionId) {
        if (seenSuggestionIds.has(suggestionId)) continue;
        seenSuggestionIds.add(suggestionId);

        // Check against state array first
        const matchedSuggestion = suggestionsMap.get(String(suggestionId));
        if (matchedSuggestion) {
          const status = (matchedSuggestion.status || '').toLowerCase().trim();
          if (RESOLVED_STATUSES.has(status)) {
            continue; // Addressed in state - do not flag
          }
          return true; // Pending/unaddressed in state
        }
      }

      // If not present in state array, check DOM attributes/classes
      const status = (
        span.getAttribute('data-suggestion-status') ||
        span.getAttribute('data-status') ||
        ''
      ).toLowerCase().trim();
      const isResolved =
        span.classList.contains('suggestion-resolved') ||
        span.classList.contains('suggestion-approved') ||
        RESOLVED_STATUSES.has(status);
      if (!isResolved) {
        return true;
      }
    }

    // C. Fallback: Check other highlight spans (excluding citations/references)
    const highlighted = document.querySelectorAll('span.highlighted-text');
    for (const span of highlighted) {
      // Skip reference highlights
      if (span.hasAttribute('data-reference-id')) {
        continue;
      }

      // If it belongs to an already-recognized comment or suggestion, check state resolution
      const commentId = span.getAttribute('data-comment-id');
      if (commentId) {
        const matched = commentsMap.get(String(commentId));
        if (matched && (isDraftComment(matched, context) || RESOLVED_STATUSES.has((matched.status || '').toLowerCase().trim()))) {
          continue;
        }
      }

      const suggestionId =
        span.getAttribute('data-suggestededit-id') ||
        span.getAttribute('data-suggestion-id');
      if (suggestionId) {
        const matched = suggestionsMap.get(String(suggestionId));
        if (matched && RESOLVED_STATUSES.has((matched.status || '').toLowerCase().trim())) {
          continue;
        }
      }

      // Check draft origin on the span itself
      if (
        span.getAttribute('data-comment-origin') === 'draft' ||
        span.getAttribute('data-comment-stage') === 'draft' ||
        span.getAttribute('data-created-in-draft') === 'true'
      ) {
        continue;
      }

      const status = (
        span.getAttribute('data-comment-status') ||
        span.getAttribute('data-suggestion-status') ||
        span.getAttribute('data-status') ||
        ''
      ).toLowerCase().trim();

      const isResolved =
        span.classList.contains('comment-resolved') ||
        span.classList.contains('suggestion-resolved') ||
        span.classList.contains('suggestion-approved') ||
        RESOLVED_STATUSES.has(status);

      if (!isResolved) {
        // Only flag if it's explicitly identified as an unaddressed comment or suggestion
        if (commentId || suggestionId) {
          return true;
        }
        // Or if it's a temporary uncommitted comment/suggestion highlight
        if (
          span.classList.contains('temp-comment-highlight') ||
          span.classList.contains('temp-suggestion-highlight')
        ) {
          return true;
        }
      }
    }
  }

  return false;
};
