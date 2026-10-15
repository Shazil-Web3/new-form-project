import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionMenu from '../ActionMenu';
import { useAuth } from '../../../../../utils/authService';

jest.mock('../../../../../utils/authService', () => ({
  useAuth: jest.fn(),
}));

describe('ActionMenu Permissions', () => {
  const onAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders Publish button for Admin when item is approved in In Progress tab', () => {
    useAuth.mockReturnValue({
      user: { id: 1, role: 'admin' }
    });

    const item = {
      id: 101,
      itemType: 'document',
      created_by: 2, // Created by someone else
      status: 'approved'
    };

    render(<ActionMenu item={item} activeTab="In Progress" onAction={onAction} />);

    const menuButton = screen.getByTitle('More Actions');
    fireEvent.click(menuButton);

    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.getByText('Revert to Draft')).toBeInTheDocument();
  });

  test('does NOT render Publish button for Approver (non-admin) when item is approved', () => {
    useAuth.mockReturnValue({
      user: { id: 3, role: 'approver' }
    });

    const item = {
      id: 101,
      itemType: 'document',
      created_by: 3,
      status: 'approved'
    };

    render(<ActionMenu item={item} activeTab="In Progress" onAction={onAction} />);

    const menuButton = screen.getByTitle('More Actions');
    fireEvent.click(menuButton);

    expect(screen.queryByText('Publish')).not.toBeInTheDocument();
    expect(screen.getByText('Revert to Draft')).toBeInTheDocument();
  });

  test('does NOT render Publish button for Author (non-admin) when item is approved', () => {
    useAuth.mockReturnValue({
      user: { id: 4, role: 'author' }
    });

    const item = {
      id: 102,
      itemType: 'document',
      created_by: 4,
      status: 'approved'
    };

    render(<ActionMenu item={item} activeTab="In Progress" onAction={onAction} />);

    const menuButton = screen.getByTitle('More Actions');
    fireEvent.click(menuButton);

    expect(screen.queryByText('Publish')).not.toBeInTheDocument();
    expect(screen.getByText('Revert to Draft')).toBeInTheDocument();
  });

  test('does NOT render Approve/Decline Archive for Admin if not assigned as approver', () => {
    useAuth.mockReturnValue({
      user: { id: 1, role: 'admin', email: 'admin@example.com' }
    });

    const item = {
      id: 201,
      itemType: 'document',
      created_by: 1,
      status: 'pending_archive_approval',
      approvers: JSON.stringify({
        approvers: [
          { userId: 5, email: 'assigned@example.com', name: 'Assigned Approver', status: 'pending' }
        ]
      })
    };

    render(<ActionMenu item={item} activeTab="Archived" onAction={onAction} />);

    const menuButton = screen.getByTitle('More Actions');
    fireEvent.click(menuButton);

    expect(screen.queryByText('Approve Archive')).not.toBeInTheDocument();
    expect(screen.queryByText('Decline Archive')).not.toBeInTheDocument();
    expect(screen.getByText('Cancel Archive Request')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  test('renders Approve/Decline Archive for assigned approver', () => {
    useAuth.mockReturnValue({
      user: { id: 5, role: 'user', email: 'assigned@example.com' }
    });

    const item = {
      id: 201,
      itemType: 'document',
      created_by: 1,
      status: 'pending_archive_approval',
      approvers: JSON.stringify({
        approvers: [
          { userId: 5, email: 'assigned@example.com', name: 'Assigned Approver', status: 'pending' }
        ]
      })
    };

    render(<ActionMenu item={item} activeTab="Archived" onAction={onAction} />);

    const menuButton = screen.getByTitle('More Actions');
    fireEvent.click(menuButton);

    expect(screen.getByText('Approve Archive')).toBeInTheDocument();
    expect(screen.getByText('Decline Archive')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  test('renders Unsubmit button for Author when item is pending_review and triggers onAction with unsubmit', () => {
    useAuth.mockReturnValue({
      user: { id: 4, role: 'author' }
    });

    const item = {
      id: 301,
      itemType: 'document',
      created_by: 4,
      status: 'pending_review'
    };

    render(<ActionMenu item={item} activeTab="In Progress" onAction={onAction} />);

    const menuButton = screen.getByTitle('More Actions');
    fireEvent.click(menuButton);

    const unsubmitBtn = screen.getByText('Unsubmit');
    expect(unsubmitBtn).toBeInTheDocument();

    fireEvent.click(unsubmitBtn);
    expect(onAction).toHaveBeenCalledWith('unsubmit', 301, 'document');
  });

  test('renders Revert to Archive Draft when item is archive_reviewed and triggers onAction with revert', () => {
    useAuth.mockReturnValue({
      user: { id: 4, role: 'author' }
    });

    const item = {
      id: 302,
      itemType: 'template',
      created_by: 4,
      status: 'archive_reviewed'
    };

    render(<ActionMenu item={item} activeTab="In Progress" onAction={onAction} />);

    const menuButton = screen.getByTitle('More Actions');
    fireEvent.click(menuButton);

    const revertBtn = screen.getByText('Revert to Archive Draft');
    expect(revertBtn).toBeInTheDocument();

    fireEvent.click(revertBtn);
    expect(onAction).toHaveBeenCalledWith('revert', 302, 'template');
  });
});

