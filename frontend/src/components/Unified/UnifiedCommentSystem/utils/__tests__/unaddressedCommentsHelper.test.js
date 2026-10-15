import { hasUnaddressedItems, isDraftComment, RESOLVED_STATUSES } from '../unaddressedCommentsHelper';

describe('hasUnaddressedItems helper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('State arrays check', () => {
    test('returns false when there are no comments and no suggestions', () => {
      expect(hasUnaddressedItems({ comments: [], suggestions: [] })).toBe(false);
      expect(hasUnaddressedItems()).toBe(false);
    });

    test('returns false when all comments are resolved', () => {
      const comments = [
        { id: 'c1', status: 'resolved' },
        { id: 'c2', status: 'resolved' },
        { id: 'c3', status: 'done' },
      ];
      expect(hasUnaddressedItems({ comments, suggestions: [] })).toBe(false);
    });

    test('returns false when all suggestions are approved, accepted, declined, or rejected', () => {
      const suggestions = [
        { id: 's1', status: 'approved' },
        { id: 's2', status: 'accepted' },
        { id: 's3', status: 'declined' },
        { id: 's4', status: 'rejected' },
      ];
      expect(hasUnaddressedItems({ comments: [], suggestions })).toBe(false);
    });

    test('returns false when both comments and suggestions are all resolved/addressed', () => {
      const comments = [
        { id: 'c1', status: 'resolved' },
        { id: 'c2', status: 'done' },
      ];
      const suggestions = [
        { id: 's1', status: 'approved' },
        { id: 's2', status: 'accepted' },
      ];
      expect(hasUnaddressedItems({ comments, suggestions })).toBe(false);
    });

    test('returns true when at least one comment is open or pending', () => {
      const comments = [
        { id: 'c1', status: 'resolved' },
        { id: 'c2', status: 'open' },
      ];
      expect(hasUnaddressedItems({ comments, suggestions: [] })).toBe(true);

      const commentsPending = [
        { id: 'c3', status: 'pending' },
      ];
      expect(hasUnaddressedItems({ comments: commentsPending, suggestions: [] })).toBe(true);
    });

    test('returns true when at least one suggestion is pending', () => {
      const suggestions = [
        { id: 's1', status: 'approved' },
        { id: 's2', status: 'pending' },
      ];
      expect(hasUnaddressedItems({ comments: [], suggestions })).toBe(true);
    });

    test('does NOT trigger warning when unresolved comments originated from draft', () => {
      const draftComments = [
        { id: 'c1', status: 'open', createdInDraft: true },
        { id: 'c2', status: 'open', origin: 'draft' },
        { id: 'c3', status: 'pending', stage: 'draft' },
      ];
      expect(hasUnaddressedItems({ comments: draftComments, suggestions: [] })).toBe(false);
    });

    test('identifies draft comments based on timestamp earlier than reviewer assignment', () => {
      const context = {
        template_approvers: {
          reviewers: [
            { email: 'reviewer@test.com', received_at: '2026-06-01T12:00:00.000Z' }
          ]
        }
      };
      const comments = [
        // Created before review started
        { id: 'c1', status: 'open', timestamp: '2026-05-01T10:00:00.000Z', creatorRole: 'admin' }
      ];
      expect(hasUnaddressedItems({ comments, suggestions: [] }, context)).toBe(false);

      // But a comment created during review DOES trigger warning
      const reviewComments = [
        { id: 'c2', status: 'open', timestamp: '2026-06-02T10:00:00.000Z', creatorRole: 'reviewer' }
      ];
      expect(hasUnaddressedItems({ comments: reviewComments, suggestions: [] }, context)).toBe(true);
    });
  });

  describe('DOM check with highlights present', () => {
    test('does NOT trigger warning when resolved comments retain lightgreen highlights in DOM', () => {
      // Simulate text editor containing lightgreen highlight spans for resolved comments
      document.body.innerHTML = `
        <div class="editor-container">
          <p>
            Hello
            <span class="highlighted-text" data-comment-id="c1" style="background-color: lightgreen;">
              highlighted text
            </span>
            world.
          </p>
        </div>
      `;

      const comments = [
        { id: 'c1', status: 'resolved' },
      ];

      expect(hasUnaddressedItems({ comments, suggestions: [] })).toBe(false);
    });

    test('does NOT trigger warning when addressed suggestions retain lightblue highlights in DOM', () => {
      // Simulate text editor containing lightblue highlight spans for accepted/rejected suggestions
      document.body.innerHTML = `
        <div class="editor-container">
          <p>
            Hello
            <span class="highlighted-text" data-suggestededit-id="s1" style="background-color: lightblue;">
              suggested text
            </span>
            world.
          </p>
        </div>
      `;

      const suggestions = [
        { id: 's1', status: 'approved' },
      ];

      expect(hasUnaddressedItems({ comments: [], suggestions })).toBe(false);
    });

    test('does NOT trigger warning for reference citations (data-reference-id)', () => {
      document.body.innerHTML = `
        <div class="editor-container">
          <p>
            Reference text
            <span class="highlighted-text" data-reference-id="ref-1" style="background-color: rgb(240, 240, 240);">
              [1]
            </span>
          </p>
        </div>
      `;

      expect(hasUnaddressedItems({ comments: [], suggestions: [] })).toBe(false);
    });

    test('triggers warning when an unresolved comment highlight is in DOM even if comments array was empty', () => {
      document.body.innerHTML = `
        <div class="editor-container">
          <p>
            <span class="highlighted-text comment-highlight" data-comment-id="c-uncommitted" data-comment-status="open">
              unresolved comment
            </span>
          </p>
        </div>
      `;

      expect(hasUnaddressedItems({ comments: [], suggestions: [] })).toBe(true);
    });

    test('triggers warning when a pending suggestion highlight is in DOM and not in suggestions array', () => {
      document.body.innerHTML = `
        <div class="editor-container">
          <p>
            <span class="highlighted-text" data-suggestededit-id="s-uncommitted" data-suggestion-status="pending">
              pending suggestion
            </span>
          </p>
        </div>
      `;

      expect(hasUnaddressedItems({ comments: [], suggestions: [] })).toBe(true);
    });

    test('recognizes resolved comment marked by comment-resolved class in DOM', () => {
      document.body.innerHTML = `
        <div class="editor-container">
          <p>
            <span class="highlighted-text comment-resolved" data-comment-id="c-dom-only">
              resolved comment
            </span>
          </p>
        </div>
      `;

      expect(hasUnaddressedItems({ comments: [], suggestions: [] })).toBe(false);
    });
  });

  describe('RESOLVED_STATUSES set', () => {
    test('contains all expected resolution statuses', () => {
      expect(RESOLVED_STATUSES.has('resolved')).toBe(true);
      expect(RESOLVED_STATUSES.has('done')).toBe(true);
      expect(RESOLVED_STATUSES.has('approved')).toBe(true);
      expect(RESOLVED_STATUSES.has('declined')).toBe(true);
      expect(RESOLVED_STATUSES.has('accepted')).toBe(true);
      expect(RESOLVED_STATUSES.has('rejected')).toBe(true);
    });
  });

  describe('isDraftComment helper', () => {
    test('returns true when createdInDraft is true', () => {
      expect(isDraftComment({ createdInDraft: true })).toBe(true);
    });

    test('returns false when createdInDraft is false', () => {
      expect(isDraftComment({ createdInDraft: false })).toBe(false);
    });

    test('returns true when origin or stage is draft', () => {
      expect(isDraftComment({ origin: 'draft' })).toBe(true);
      expect(isDraftComment({ stage: 'draft' })).toBe(true);
    });

    test('returns false when origin or stage is review', () => {
      expect(isDraftComment({ origin: 'review' })).toBe(false);
      expect(isDraftComment({ stage: 'review' })).toBe(false);
    });

    test('returns false when creatorRole is reviewer', () => {
      expect(isDraftComment({ creatorRole: 'reviewer' })).toBe(false);
      expect(isDraftComment({ creatorRole: 'template_reviewer' })).toBe(false);
    });

    test('returns true when comment timestamp is before reviewer received_at', () => {
      const context = {
        template_approvers: {
          reviewers: [{ received_at: '2026-05-10T12:00:00Z' }]
        }
      };
      expect(isDraftComment({ timestamp: '2026-05-01T12:00:00Z' }, context)).toBe(true);
      expect(isDraftComment({ timestamp: '2026-05-15T12:00:00Z' }, context)).toBe(false);
    });
  });
});
