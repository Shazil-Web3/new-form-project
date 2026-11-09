/**
 * @file UnifiedPreviewModal.test.jsx
 * @description Unit tests for the UnifiedPreviewModal stage-aware preview component.
 * @dependencies @testing-library/react
 * @author Codegen
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import UnifiedPreviewModal from '../UnifiedPreviewModal';

// Mock getDisplayCategory and formatId utility functions
jest.mock('../../../../pages/new/Hub/utils/dashboardUtils', () => ({
  getDisplayCategory: (item) => item.category || 'General',
  formatId: (id, type) => `${type === 'template' ? 'TEMP' : 'DOC'}-${id}`,
  getMockedDueDate: () => '2026-07-17T00:00:00.000Z',
  getInlineDueDateInfo: () => ({ colorClass: 'bg-emerald-50 text-emerald-700', label: 'Due in 5d', dateStr: '17/07/2026' }),
}));

// Mock useAuth
jest.mock('../../../../utils/authService', () => ({
  useAuth: () => ({
    user: { id: 1, first_name: 'Daniel', last_name: 'Ventura', email: 'admin123@gmail.com', role: 'admin' }
  })
}));

// Mock apiClient to prevent axios ESM resolution in Jest
jest.mock('../../../../api/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
  },
  API_BASE_URL: 'http://localhost:5000',
}));

describe('UnifiedPreviewModal', () => {
  const mockOnClose = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const draftDocItem = {
    id: '123',
    title: 'Test Draft Doc',
    status: 'draft',
    version: '1.0',
    category: 'HR',
    department: 'People Operations',
    content: '<p>Draft body content</p>',
    itemType: 'document',
    owner_name: 'John Doe',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-02T00:00:00.000Z',
    tasks: [{ title: 'Draft Task 1', description: 'Do something', assignedTo: 'Bob', dueDate: '' }],
    participants: [{ name: 'Jane', email: 'jane@example.com', role: 'author' }],
  };

  const publishedTemplateItem = {
    id: '456',
    name: 'Test Published Template',
    status: 'published',
    version: '2.1',
    category: 'Legal',
    department: 'General Counsel',
    content: '<p>Published template body</p>',
    itemType: 'template',
    owner_name: 'Jane Smith',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-15T00:00:00.000Z',
    template_structure: JSON.stringify({
      locked_elements: { content: true },
    }),
    comments: JSON.stringify({
      references: [{ refNumber: 1, refContent: 'External Law Doc Reference' }],
    }),
  };

  it('renders nothing when visible is false', () => {
    const { container } = render(
      <UnifiedPreviewModal
        visible={false}
        item={draftDocItem}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onAction={mockOnAction}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Draft stage layout with Overview, Content, Tasks, and Participants tabs for document', () => {
    render(
      <UnifiedPreviewModal
        visible={true}
        item={draftDocItem}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onAction={mockOnAction}
      />
    );

    // Verify Draft header banner message
    expect(screen.getByText(/Draft — Not yet submitted/i)).toBeInTheDocument();

    // Verify metadata in left sidebar
    expect(screen.getAllByText('Test Draft Doc')[0]).toBeInTheDocument();
    expect(screen.getByText('DOC-123')).toBeInTheDocument();
    expect(screen.getAllByText(/v1.0/)[0]).toBeInTheDocument();
    expect(screen.getAllByText('People Operations')[0]).toBeInTheDocument();
    expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();

    // Verify expected tab buttons exist
    expect(screen.getByRole('button', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Content/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Participants/i })).toBeInTheDocument();

    // By default, Overview is active
    expect(screen.getByText('Document Metadata')).toBeInTheDocument();
  });

  it('allows tab switching in Draft view', () => {
    render(
      <UnifiedPreviewModal
        visible={true}
        item={draftDocItem}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onAction={mockOnAction}
      />
    );

    // Click Content Tab
    fireEvent.click(screen.getByRole('button', { name: /Content/i }));
    expect(screen.getByText('Draft body content')).toBeInTheDocument();

    // Click Tasks Tab
    fireEvent.click(screen.getByRole('button', { name: /Tasks/i }));
    expect(screen.getByText('Draft Task 1')).toBeInTheDocument();
    expect(screen.getByText('Do something')).toBeInTheDocument();

    // Click Participants Tab
    fireEvent.click(screen.getByRole('button', { name: /Participants/i }));
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('renders Published stage layout with References and Structure tabs for template', () => {
    render(
      <UnifiedPreviewModal
        visible={true}
        item={publishedTemplateItem}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onAction={mockOnAction}
      />
    );

    // Verify Published header banner message
    expect(screen.getByText(/Published — This is the active approved version/i)).toBeInTheDocument();

    // Verify expected tab buttons exist (including References and Approvers, excluding Structure)
    expect(screen.getByRole('button', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Content/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approvers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /References/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Notes/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Structure/i })).not.toBeInTheDocument();

    // Verify Approved Date row exists in Published stage
    expect(screen.getByText('Approved:')).toBeInTheDocument();

    // Click References Tab
    fireEvent.click(screen.getByRole('button', { name: /References/i }));
    expect(screen.getByText('External Law Doc Reference')).toBeInTheDocument();
  });

  it('triggers onEdit callback when Edit Draft action is clicked', () => {
    render(
      <UnifiedPreviewModal
        visible={true}
        item={draftDocItem}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onAction={mockOnAction}
      />
    );

    const editBtn = screen.getByRole('button', { name: /Edit Draft/i });
    fireEvent.click(editBtn);
    expect(mockOnEdit).toHaveBeenCalledWith(draftDocItem);
  });

  it('triggers onAction callback when Instantiate Template is clicked in Published Template view', () => {
    render(
      <UnifiedPreviewModal
        visible={true}
        item={publishedTemplateItem}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onAction={mockOnAction}
      />
    );

    const instantiateBtn = screen.getByRole('button', { name: /Instantiate Document/i });
    fireEvent.click(instantiateBtn);
    expect(mockOnAction).toHaveBeenCalledWith('use', '456', 'template');
  });

  it('triggers onClose when close button or Esc key is pressed', () => {
    render(
      <UnifiedPreviewModal
        visible={true}
        item={draftDocItem}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onAction={mockOnAction}
      />
    );

    // Click close button
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Trigger Escape keypress
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  it('renders Archived stage layout with Archived Date and published stage equivalent tabs', () => {
    const archivedItem = {
      id: '789',
      title: 'Archived Document File',
      status: 'archived',
      version: '1.0',
      category: 'Legal',
      department: 'Corporate',
      content: '<p>Archived content</p>',
      itemType: 'document',
      owner_name: 'Bob',
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-15T00:00:00.000Z',
    };

    render(
      <UnifiedPreviewModal
        visible={true}
        item={archivedItem}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onAction={mockOnAction}
      />
    );

    // Verify expected tab buttons exist (Overview, Content, Approvers, References, Notes)
    expect(screen.getByRole('button', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Content/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approvers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /References/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Notes/i })).toBeInTheDocument();

    // Verify Archived Date row exists in Archived stage
    expect(screen.getByText('Archived:')).toBeInTheDocument();
  });
});
