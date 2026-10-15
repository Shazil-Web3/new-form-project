const mockPut = jest.fn().mockResolvedValue({ data: { success: true } });

jest.mock('axios', () => ({
  defaults: { baseURL: '' },
  interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  create: jest.fn().mockReturnValue({
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    get: jest.fn(),
    post: jest.fn(),
    put: mockPut,
    delete: jest.fn(),
  })
}));

jest.mock('../../../../../utils/authService', () => ({
  useAuth: () => ({ user: { id: 1, role: 'admin' } }),
}));

jest.mock('../../../../../utils/alerts', () => ({
  successAlert: jest.fn(),
  errorAlert: jest.fn(),
  warningAlert: jest.fn(),
}));

jest.mock('../../../../../api/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn().mockResolvedValue({ data: { success: true } }),
    post: jest.fn(),
    delete: jest.fn(),
  }
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApproverAvatars from '../ApproverAvatars';
import DashboardTable from '../DashboardTable';
import ReassignAuthorityModal from '../ReassignAuthorityModal';
import apiClient from '../../../../../api/apiClient';

describe('ApproverAvatars & Teams Header & Reassign Modal Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.put.mockResolvedValue({ data: { success: true } });
  });
  test('DashboardTable renders "Teams" header in In Progress tab instead of "Stage"', () => {
    const items = [
      {
        id: 1,
        title: 'Test Document',
        status: 'pending_review',
        itemType: 'document',
        created_by: 1,
        approvers: JSON.stringify({
          reviewers: [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }],
          approvers: []
        }),
      },
    ];

    render(
      <DashboardTable
        items={items}
        activeTab="In Progress"
        onAction={jest.fn()}
        currentUser={{ id: 1, role: 'admin' }}
        onTogglePin={jest.fn()}
        onProgressChange={jest.fn()}
        getDisplayCategory={() => 'General'}
        getMockedDueDate={() => '2026-10-01'}
        getApproversForTemplate={() => []}
        getApproversForDoc={() => [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }]}
        formatId={(id) => `DOC-${id}`}
        onPreviewItem={jest.fn()}
        onReassign={jest.fn()}
      />
    );

    // Verify "Teams" header is present
    expect(screen.getByText('Teams')).toBeInTheDocument();
    // Verify "Stage" column header is NOT present
    expect(screen.queryByText('Stage')).not.toBeInTheDocument();
    // Verify "Received At" header is present in In Progress tab
    expect(screen.getByText('Received At')).toBeInTheDocument();
  });

  test('DashboardTable shows "—" for Received At column when current user is the author', () => {
    const items = [
      {
        id: 1,
        title: 'Author Owned Doc',
        status: 'pending_review',
        itemType: 'document',
        created_by: 42,
        approvers: JSON.stringify({
          reviewers: [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending', received_at: '2026-09-14T10:30:00.000Z' }],
          approvers: []
        }),
      },
    ];

    render(
      <DashboardTable
        items={items}
        activeTab="In Progress"
        onAction={jest.fn()}
        currentUser={{ id: 42, role: 'author' }}
        onTogglePin={jest.fn()}
        onProgressChange={jest.fn()}
        getDisplayCategory={() => 'General'}
        getMockedDueDate={() => '2026-10-01'}
        getApproversForTemplate={() => []}
        getApproversForDoc={() => [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }]}
        formatId={(id) => `DOC-${id}`}
        onPreviewItem={jest.fn()}
        onReassign={jest.fn()}
      />
    );

    expect(screen.getByText('Received At')).toBeInTheDocument();
    // Author should see '—' because they created it, not received it
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('DashboardTable shows formatted received date & time when current user is a reviewer', () => {
    const receivedIso = '2026-09-14T16:45:30.000Z';
    const items = [
      {
        id: 2,
        title: 'Document Sent To Reviewer',
        status: 'pending_review',
        itemType: 'document',
        created_by: 99, // Author is someone else
        approvers: JSON.stringify({
          reviewers: [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending', received_at: receivedIso }],
          approvers: []
        }),
      },
    ];

    render(
      <DashboardTable
        items={items}
        activeTab="In Progress"
        onAction={jest.fn()}
        currentUser={{ id: 10, email: 'valerie@example.com', role: 'reviewer' }}
        onTogglePin={jest.fn()}
        onProgressChange={jest.fn()}
        getDisplayCategory={() => 'General'}
        getMockedDueDate={() => '2026-10-01'}
        getApproversForTemplate={() => []}
        getApproversForDoc={() => [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }]}
        formatId={(id) => `DOC-${id}`}
        onPreviewItem={jest.fn()}
        onReassign={jest.fn()}
      />
    );

    expect(screen.getByText('Received At')).toBeInTheDocument();
    const expectedDate = new Date(receivedIso).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  test('ApproverAvatars renders the Assign button when onReassign is provided', () => {
    const onReassign = jest.fn();
    const approvers = [
      { userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }
    ];

    render(<ApproverAvatars approvers={approvers} onReassign={onReassign} />);

    const assignBtn = screen.getByRole('button', { name: /assign/i });
    expect(assignBtn).toBeInTheDocument();

    fireEvent.click(assignBtn);
    expect(onReassign).toHaveBeenCalledTimes(1);
    expect(onReassign).toHaveBeenCalledWith(expect.objectContaining({ name: 'Valerie Standard' }));
  });

  test('ApproverAvatars renders fallback Role text when onReassign is not provided', () => {
    const approvers = [
      { userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }
    ];

    render(<ApproverAvatars approvers={approvers} />);

    expect(screen.queryByRole('button', { name: /assign/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Role:/i)).toBeInTheDocument();
  });

  test('DashboardTable does NOT show Assign button for non-owner approver', () => {
    const onReassign = jest.fn();
    const items = [
      {
        id: 1,
        title: 'Other User Template',
        status: 'pending_review',
        itemType: 'template',
        created_by: 42, // Created by someone else
        template_approvers: JSON.stringify({
          reviewers: [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }],
          approvers: []
        }),
      },
    ];

    // Current user is an approver with id 99 (not owner 42, and not admin)
    render(
      <DashboardTable
        items={items}
        activeTab="In Progress"
        onAction={jest.fn()}
        currentUser={{ id: 99, role: 'approver' }}
        onTogglePin={jest.fn()}
        onProgressChange={jest.fn()}
        getDisplayCategory={() => 'General'}
        getMockedDueDate={() => '2026-10-01'}
        getApproversForTemplate={() => [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }]}
        getApproversForDoc={() => []}
        formatId={(id) => `TEMP-${id}`}
        onPreviewItem={jest.fn()}
        onReassign={onReassign}
      />
    );

    // Verify Assign button is NOT shown to non-owner approver
    expect(screen.queryByRole('button', { name: /assign/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Role:/i)).toBeInTheDocument();
  });

  test('DashboardTable shows Assign button for template owner', () => {
    const onReassign = jest.fn();
    const items = [
      {
        id: 1,
        title: 'My Template',
        status: 'pending_review',
        itemType: 'template',
        created_by: 55, // Owned by current user
        template_approvers: JSON.stringify({
          reviewers: [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }],
          approvers: []
        }),
      },
    ];

    render(
      <DashboardTable
        items={items}
        activeTab="In Progress"
        onAction={jest.fn()}
        currentUser={{ id: 55, role: 'author' }}
        onTogglePin={jest.fn()}
        onProgressChange={jest.fn()}
        getDisplayCategory={() => 'General'}
        getMockedDueDate={() => '2026-10-01'}
        getApproversForTemplate={() => [{ userId: 10, name: 'Valerie Standard', role: 'REVIEW', status: 'pending' }]}
        getApproversForDoc={() => []}
        formatId={(id) => `TEMP-${id}`}
        onPreviewItem={jest.fn()}
        onReassign={onReassign}
      />
    );

    // Verify Assign button IS shown to owner
    expect(screen.getByRole('button', { name: /assign/i })).toBeInTheDocument();
  });

  test('ReassignAuthorityModal strictly filters by department and rejects users from other departments', async () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    const targetUser = {
      userId: 10,
      name: 'Alice Approver',
      email: 'approver@prodoc.com',
      department: 'Engineering',
      role: 'REVIEW',
      status: 'pending'
    };
    const item = {
      id: 101,
      title: 'Engineering Specs',
      itemType: 'template',
      created_by: 1,
      template_approvers: JSON.stringify({
        reviewers: [{ userId: 10, name: 'Alice Approver', email: 'approver@prodoc.com' }],
        approvers: []
      })
    };
    const users = [
      { id: 10, name: 'Alice Approver', email: 'approver@prodoc.com', department: 'Engineering' },
      { id: 20, name: 'Daniel Ventura', email: 'daniel@example.com', department: 'Design' }, // Design department!
      { id: 30, name: 'Dan Niel', email: 'dan@example.com', department: 'Engineering' }, // Same department
    ];

    const { container } = render(
      <ReassignAuthorityModal
        visible={true}
        onClose={onClose}
        targetUser={targetUser}
        item={item}
        currentUser={{ id: 1, role: 'admin' }}
        users={users}
        departments={[{ id: 1, name: 'Engineering', manager: 20 }]}
        onSuccess={onSuccess}
        initialAssignee="30"
      />
    );

    // Check modal displays target info
    expect(screen.getByText('Alice Approver')).toBeInTheDocument();
    expect(screen.getByText('Assign Template Authority')).toBeInTheDocument();

    // Verify Design department user (Daniel Ventura) is NOT present in the component options
    expect(screen.queryByText(/daniel@example.com/i)).not.toBeInTheDocument();

    // Click Assign button in modal footer
    const submitBtn = screen.getByRole('button', { name: 'Assign' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/templates/101/reassign',
        expect.objectContaining({
          currentUserId: 10,
          targetEmail: 'approver@prodoc.com',
          newUser: expect.objectContaining({
            id: 30,
            name: 'Dan Niel',
            department: 'Engineering'
          })
        })
      );
      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  test('ReassignAuthorityModal does NOT render for non-owner non-admin', () => {
    const targetUser = {
      userId: 10,
      name: 'Alice Approver',
      email: 'approver@prodoc.com',
      department: 'Engineering',
      role: 'REVIEW',
      status: 'pending'
    };
    const item = {
      id: 101,
      title: 'Engineering Specs',
      itemType: 'template',
      created_by: 50, // Owned by user 50
    };

    const { container } = render(
      <ReassignAuthorityModal
        visible={true}
        onClose={jest.fn()}
        targetUser={targetUser}
        item={item}
        currentUser={{ id: 99, role: 'approver' }} // Not owner 50, not admin, not targetUser 10
        users={[]}
        onSuccess={jest.fn()}
      />
    );

    // Should render nothing
    expect(container).toBeEmptyDOMElement();
  });

  test('DashboardTable shows Assign button for reviewer hovering on their own icon, but NOT on others', () => {
    const onReassign = jest.fn();
    const items = [
      {
        id: 1,
        title: 'Team Template',
        status: 'pending_review',
        itemType: 'template',
        created_by: 50, // Owned by user 50
        template_approvers: JSON.stringify({
          reviewers: [
            { userId: 10, name: 'Alice Approver', role: 'REVIEW', status: 'pending' },
            { userId: 20, name: 'Bob Reviewer', role: 'REVIEW', status: 'pending' }
          ],
          approvers: []
        }),
      },
    ];

    // Current user is Alice (userId 10), neither author (50) nor admin
    render(
      <DashboardTable
        items={items}
        activeTab="In Progress"
        onAction={jest.fn()}
        currentUser={{ id: 10, role: 'approver', email: 'alice@example.com' }}
        onTogglePin={jest.fn()}
        onProgressChange={jest.fn()}
        getDisplayCategory={() => 'Engineering'}
        getMockedDueDate={() => '2026-10-01'}
        getApproversForTemplate={() => [
          { userId: 10, name: 'Alice Approver', role: 'REVIEW', status: 'pending' },
          { userId: 20, name: 'Bob Reviewer', role: 'REVIEW', status: 'pending' }
        ]}
        getApproversForDoc={() => []}
        formatId={(id) => `TEMP-${id}`}
        onPreviewItem={jest.fn()}
        onReassign={onReassign}
      />
    );

    // Alice should see Assign button (for herself), and Bob shows Role text
    expect(screen.getByText('Assign')).toBeInTheDocument();
    expect(screen.getByText(/Role:/i)).toBeInTheDocument();
  });

  test('ReassignAuthorityModal renders and permits self-reassignment for the assigned reviewer', async () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    const targetUser = {
      userId: 10,
      name: 'Alice Approver',
      email: 'alice@example.com',
      department: 'Engineering',
      role: 'REVIEW',
      status: 'pending'
    };
    const item = {
      id: 101,
      title: 'Engineering Specs',
      itemType: 'document',
      created_by: 999, // Author is not Alice
    };
    const users = [
      { id: 10, name: 'Alice Approver', email: 'alice@example.com', department: 'Engineering' },
      { id: 30, name: 'Colleague Dan', email: 'dan@example.com', department: 'Engineering' },
    ];

    render(
      <ReassignAuthorityModal
        visible={true}
        onClose={onClose}
        targetUser={targetUser}
        item={item}
        currentUser={{ id: 10, role: 'reviewer', email: 'alice@example.com' }} // Alice herself
        users={users}
        onSuccess={onSuccess}
        initialAssignee="30"
      />
    );

    expect(screen.getByText('Alice Approver')).toBeInTheDocument();
    expect(screen.getByText('Assign Document Authority')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: 'Assign' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/documents/101/reassign',
        expect.objectContaining({
          currentUserId: 10,
          newUser: expect.objectContaining({
            id: 30,
            name: 'Colleague Dan'
          })
        })
      );
      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
