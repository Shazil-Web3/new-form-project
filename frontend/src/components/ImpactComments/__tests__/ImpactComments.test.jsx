import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../../api/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
  },
  API_BASE_URL: 'http://localhost:5000',
}));

jest.mock('../../../api/documents', () => ({
  saveDocumentImpactComment: jest.fn().mockResolvedValue({ success: true }),
  deleteDocumentImpactComment: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../../../api/templates', () => ({
  saveTemplateImpactComment: jest.fn().mockResolvedValue({ success: true }),
  deleteTemplateImpactComment: jest.fn().mockResolvedValue({ success: true }),
}));


import {
  ImpactCommentProvider,
  useImpactComments,
  ImpactCommentSidebar,
} from '../index';

// Test consumer component
function TestConsumer() {
  const {
    comments,
    filteredComments,
    isSidebarOpen,
    setIsSidebarOpen,
    addComment,
    addReply,
    toggleResolveComment,
    deleteComment,
  } = useImpactComments();

  return (
    <div>
      <button
        data-testid="toggle-sidebar"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        Toggle Sidebar
      </button>
      <button
        data-testid="add-btn"
        onClick={() =>
          addComment({
            text: 'Need clarification on Section 3',
            selectedText: 'Rollout begins in Phase 2',
          })
        }
      >
        Add Test Comment
      </button>
      {comments[0] && (
        <>
          <button
            data-testid="reply-btn"
            onClick={() => addReply(comments[0].id, 'Phase 2 date is confirmed.')}
          >
            Reply
          </button>
          <button
            data-testid="delete-btn"
            onClick={() => deleteComment(comments[0].id)}
          >
            Delete
          </button>
        </>
      )}
      <span data-testid="comments-count">{comments.length}</span>
      <span data-testid="filtered-count">{filteredComments.length}</span>
      <ImpactCommentSidebar />
    </div>
  );
}

describe('ImpactComments System', () => {
  const mockUser = {
    id: 'user-1',
    first_name: 'Reviewer',
    last_name: 'Jane',
    email: 'reviewer@company.com',
    role: 'Reviewer',
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders correctly and opens sidebar on toggle', () => {
    render(
      <ImpactCommentProvider currentUser={mockUser}>
        <TestConsumer />
      </ImpactCommentProvider>
    );

    expect(screen.getByTestId('comments-count')).toHaveTextContent('0');

    // Sidebar should be initially closed
    expect(screen.queryByText(/Impact Comments/i)).not.toBeInTheDocument();

    // Toggle sidebar
    fireEvent.click(screen.getByTestId('toggle-sidebar'));
    expect(screen.getByText(/Impact Comments/i)).toBeInTheDocument();
    expect(screen.getByText(/No comments yet/i)).toBeInTheDocument();
  });

  it('allows adding a comment thread with selected text snippet', async () => {
    const onCommentsChange = jest.fn();

    render(
      <ImpactCommentProvider currentUser={mockUser} onCommentsChange={onCommentsChange}>
        <TestConsumer />
      </ImpactCommentProvider>
    );

    // Add comment
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-btn'));
    });

    expect(screen.getByTestId('comments-count')).toHaveTextContent('1');
    expect(onCommentsChange).toHaveBeenCalled();

    // Verify comment displays in sidebar
    expect(screen.getByText('Need clarification on Section 3')).toBeInTheDocument();
    expect(screen.getByText('“Rollout begins in Phase 2”')).toBeInTheDocument();
    expect(screen.getByText('Reviewer Jane')).toBeInTheDocument();
  });

  it('supports threaded replies', async () => {
    render(
      <ImpactCommentProvider currentUser={mockUser}>
        <TestConsumer />
      </ImpactCommentProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-btn'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('reply-btn'));
    });

    expect(screen.getByText('Phase 2 date is confirmed.')).toBeInTheDocument();
  });

  it('renders ImpactCommentsGrid and supports field-level comment badges', async () => {
    const { ImpactCommentsGrid } = require('../index');

    function GridTestConsumer() {
      const { addComment } = useImpactComments();
      return (
        <div>
          <button
            data-testid="add-field-comment-btn"
            onClick={() =>
              addComment({
                text: 'Typo in field value',
                selectedText: 'oooo',
                isField: true,
                fieldName: 'Field 1',
                fieldValue: 'oooo',
                fieldIndex: 0,
              })
            }
          >
            Add Field Comment
          </button>
          <ImpactCommentsGrid />
        </div>
      );
    }

    render(
      <ImpactCommentProvider currentUser={mockUser}>
        <GridTestConsumer />
      </ImpactCommentProvider>
    );

    // Section title
    expect(screen.getByText(/Department Impact Assessment Comments/i)).toBeInTheDocument();

    // Add field comment
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-field-comment-btn'));
    });

    expect(screen.getByText('Typo in field value')).toBeInTheDocument();
    expect(screen.getByText(/Field 1/i)).toBeInTheDocument();
    expect(screen.getByText(/“oooo”/i)).toBeInTheDocument();
  });

  it('supports multi-persona conversations where different roles reply to a comment', async () => {
    const adminUser = { id: 'usr-admin', name: 'Admin Daniel', role: 'Admin' };
    const reviewerUser = { id: 'usr-reviewer', name: 'Reviewer Jane', role: 'Reviewer' };
    const approverUser = { id: 'usr-approver', name: 'Approver John', role: 'Approver' };

    function MultiPersonaConsumer() {
      const { comments, addComment, addReply } = useImpactComments();
      return (
        <div>
          <button
            data-testid="admin-add-comment"
            onClick={() =>
              addComment({
                text: 'Admin initial review: please verify section 2.',
                selectedText: 'Section 2 details',
                customAuthor: adminUser,
              })
            }
          >
            Admin Add Comment
          </button>
          {comments[0] && (
            <>
              <button
                data-testid="reviewer-reply-btn"
                onClick={() =>
                  addReply(comments[0].id, 'Reviewer: Section 2 verified and updated.', reviewerUser)
                }
              >
                Reviewer Reply
              </button>
              <button
                data-testid="approver-reply-btn"
                onClick={() =>
                  addReply(comments[0].id, 'Approver: Looks good to proceed.', approverUser)
                }
              >
                Approver Reply
              </button>
            </>
          )}
          <div data-testid="thread-container">
            {comments.map((c) => (
              <div key={c.id}>
                <div data-testid="comment-author">{c.author.name} ({c.author.role})</div>
                <div data-testid="comment-body">{c.text}</div>
                {c.replies?.map((r) => (
                  <div key={r.id} data-testid="reply-row">
                    <span data-testid="reply-author">{r.author.name} ({r.author.role})</span>: {r.text}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    render(
      <ImpactCommentProvider currentUser={adminUser}>
        <MultiPersonaConsumer />
      </ImpactCommentProvider>
    );

    // 1. Admin adds comment
    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-add-comment'));
    });

    expect(screen.getAllByTestId('comment-author')[0]).toHaveTextContent('Admin Daniel (Admin)');
    expect(screen.getAllByTestId('comment-body')[0]).toHaveTextContent('Admin initial review: please verify section 2.');

    // 2. Reviewer replies to admin comment
    await act(async () => {
      fireEvent.click(screen.getByTestId('reviewer-reply-btn'));
    });

    // 3. Approver replies to the same thread
    await act(async () => {
      fireEvent.click(screen.getByTestId('approver-reply-btn'));
    });

    const replyRows = screen.getAllByTestId('reply-row');
    expect(replyRows).toHaveLength(2);
    expect(replyRows[0]).toHaveTextContent('Reviewer Jane (Reviewer): Reviewer: Section 2 verified and updated.');
    expect(replyRows[1]).toHaveTextContent('Approver John (Approver): Approver: Looks good to proceed.');
  });

  it('toggles reply box, displays read-only persona without select, and closes box upon sending', async () => {
    const { default: ImpactCommentThread } = require('../ImpactCommentThread');

    const testComment = {
      id: 'cmt-test-1',
      text: 'First draft needs review',
      author: { id: 'usr-1', name: 'Admin Daniel', role: 'Admin' },
      createdAt: new Date().toISOString(),
      replies: [],
    };

    render(
      <ImpactCommentProvider currentUser={mockUser}>
        <ImpactCommentThread comment={testComment} />
      </ImpactCommentProvider>
    );

    // Initially reply box should NOT be open
    expect(screen.queryByPlaceholderText(/Write a reply as/i)).not.toBeInTheDocument();

    // Click reply button
    const replyTrigger = screen.getByText(/💬 Reply/i);
    fireEvent.click(replyTrigger);

    // Now reply box is open
    const replyTextarea = screen.getByPlaceholderText(/Write a reply as/i);
    expect(replyTextarea).toBeInTheDocument();

    // Check that persona display is read-only and no select dropdown exists
    expect(screen.getByText(/Replying as:/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    // Type reply and click send
    fireEvent.change(replyTextarea, { target: { value: 'Confirmed by reviewer' } });

    const sendBtn = screen.getByText(/^Send$/i);
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // The reply box must now be CLOSED!
    expect(screen.queryByPlaceholderText(/Write a reply as/i)).not.toBeInTheDocument();
  });
});
