/**
 * @file ReviseFileHub.test.jsx
 * @description Unit tests for ReviseFileHub editor component, verifying read-only and author permissions.
 * @author Codegen
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ReviseFileHub from '../ReviseFileHub';
import { useAuth } from '../../../../utils/authService';

import { getDocument, updateDocument } from '../../../../api/documents';
import { getTemplate, updateTemplate, getTemplateHistory, listCategories } from '../../../../api/templates';
import { listOrgMembers, listDepartments, listSites } from '../../../../api/users';
import { getAttachments } from '../../../../api/attachments';

jest.mock('../../../../api/documents');
jest.mock('../../../../api/templates');
jest.mock('../../../../api/users');
jest.mock('../../../../api/attachments');
jest.mock('../../../../utils/authService');
jest.mock('../../../../utils/alerts', () => ({
  successAlert: jest.fn(),
  errorAlert: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ docId: '201', tempId: '202' }),
  MemoryRouter: ({ children }) => <div>{children}</div>,
}));

// Mock TipTap editor to avoid rendering complexity in Jest
jest.mock('../../../../components/Unified/UnifiedTextEditor', () => {
  return function MockEditor({ mode }) {
    return <div data-testid="mock-tiptap-editor">Mode: {mode}</div>;
  };
});

const mockAuthorUser = { id: 1, name: 'Author Name', role: 'creator' };
const mockViewerUser = { id: 99, name: 'Viewer Name', role: 'viewer' };

const mockDocument = {
  id: 201,
  title: 'Operational Safety Guidelines',
  status: 'draft',
  created_by: 1,
  version: '1.0',
  created_at: '2026-07-10T12:00:00Z',
  content: '<p>Standard Safety Procedures</p>',
  tasks: [],
  participants: [],
  approvers: JSON.stringify({ reviewers: [], approvers: [] }),
};

describe('ReviseFileHub Component Permissions & Tabs Redesign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listOrgMembers.mockResolvedValue([]);
    listDepartments.mockResolvedValue([]);
    listSites.mockResolvedValue([]);
    listCategories.mockResolvedValue([]);
    getTemplateHistory.mockResolvedValue([]);
    getAttachments.mockResolvedValue([]);
  });

  test('renders in Edit mode for the author of a Draft document', async () => {
    useAuth.mockReturnValue({ user: mockAuthorUser });
    getDocument.mockResolvedValue(mockDocument);

    render(
      <MemoryRouter>
        <ReviseFileHub isDocument={true} />
      </MemoryRouter>
    );

    // Wait for loader to disappear
    await waitFor(() => {
      expect(screen.queryByText(/Loading workspace.../)).not.toBeInTheDocument();
    });

    // Check header info
    expect(screen.getByText(/Document: Operational Safety Guidelines/)).toBeInTheDocument();

    // The update dropdown should be visible (not read-only mode badge)
    expect(screen.getByText(/Update Document/)).toBeInTheDocument();
    expect(screen.queryByText(/Read Only Mode/)).not.toBeInTheDocument();
  });

  test('renders in Read Only mode for a non-author viewing a Draft document', async () => {
    useAuth.mockReturnValue({ user: mockViewerUser });
    getDocument.mockResolvedValue(mockDocument);

    render(
      <MemoryRouter>
        <ReviseFileHub isDocument={true} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading workspace.../)).not.toBeInTheDocument();
    });

    // Read Only Mode label should be shown
    expect(screen.getByText(/Read Only Mode/)).toBeInTheDocument();
    expect(screen.queryByText(/Update Document/)).not.toBeInTheDocument();
  });

  test('switches tabs correctly', async () => {
    useAuth.mockReturnValue({ user: mockAuthorUser });
    getDocument.mockResolvedValue(mockDocument);

    render(
      <MemoryRouter>
        <ReviseFileHub isDocument={true} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading workspace.../)).not.toBeInTheDocument();
    });

    // Click Content tab
    const contentTabButton = screen.getByText('Content');
    fireEvent.click(contentTabButton);

    // TipTap Editor should render
    expect(screen.getByTestId('mock-tiptap-editor')).toBeInTheDocument();
  });

  test('renders and switches to Notes tab in Draft mode', async () => {
    useAuth.mockReturnValue({ user: mockAuthorUser });
    getDocument.mockResolvedValue({
      ...mockDocument,
      notes: JSON.stringify([{ id: 'n1', text: 'Initial author note', user: { name: 'Author Name', email: 'author@test.com' }, timestamp: '2026-07-10T12:00:00Z' }])
    });

    render(
      <MemoryRouter>
        <ReviseFileHub isDocument={true} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading workspace.../)).not.toBeInTheDocument();
    });

    // Notes tab button should exist in document tabs
    const notesTabButton = screen.getByText('Notes');
    expect(notesTabButton).toBeInTheDocument();
    fireEvent.click(notesTabButton);

    // Notes content should be visible
    await waitFor(() => {
      expect(screen.getByText('Initial author note')).toBeInTheDocument();
    });
  });
});
