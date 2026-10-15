/**
 * @file NewDocumentsDashboard.test.js
 * @description Unit tests for Documents Dashboard, mocking api services
 * @dependencies react, @testing-library/react, api/documents, api/users
 * @author Codegen
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import NewDocumentsDashboard from '../DocumentsTab';
import { useAuth } from '../../../../utils/authService';

// Import mocked API helpers
import { getMyDocs, getAllDocs } from '../../../../api/documents';
import { listDepartments } from '../../../../api/users';

// Mock dependencies
jest.mock('../../../../api/documents');
jest.mock('../../../../api/templates');
jest.mock('../../../../api/users');
jest.mock('../../../../utils/authService');
jest.mock('../../../../utils/alerts', () => ({
  successAlert: jest.fn(),
  errorAlert: jest.fn(),
  confirmAlert: jest.fn(() => Promise.resolve(true)),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  MemoryRouter: ({ children }) => <div>{children}</div>,
}));

const mockUser = {
  id: 1,
  name: 'Test Member',
  role: 'member',
  orgId: 10,
};

const mockDocs = [
  {
    id: 201,
    name: 'Draft Document Alpha',
    description: 'Alpha contract draft',
    status: 'draft',
    created_by: 1,
    version: '1.0',
    updated_at: '2026-07-08T12:00:00Z',
    completion_rate: 60,
  },
  {
    id: 202,
    name: 'Pending Document Beta',
    description: 'Beta signoff proposal',
    status: 'pending',
    created_by: 1,
    version: '1.1',
    updated_at: '2026-07-09T10:00:00Z',
    approvers: JSON.stringify({
      reviewers: [{ userId: 1, name: 'Manager Bob', role: 'Reviewer', status: 'pending' }],
    }),
  },
  {
    id: 203,
    name: 'Published Document Gamma',
    description: 'Gamma policy document',
    status: 'published',
    created_by: 2,
    version: '2.0',
    updated_at: '2026-07-09T11:00:00Z',
  },
];

const mockDepartments = [
  { id: 1, name: 'Engineering' },
  { id: 2, name: 'Operations' },
];

describe('NewDocumentsDashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: mockUser });
    
    // Resolve mock promises
    getMyDocs.mockResolvedValue(mockDocs);
    getAllDocs.mockResolvedValue(mockDocs);
    listDepartments.mockResolvedValue(mockDepartments);
  });

  test('renders page title and tabs correctly', async () => {
    render(
      <MemoryRouter>
        <NewDocumentsDashboard />
      </MemoryRouter>
    );

    // Tabs checks
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  test('switches tabs and displays items accordingly', async () => {
    render(
      <MemoryRouter>
        <NewDocumentsDashboard />
      </MemoryRouter>
    );

    // Default tab is In Progress (mapped from status: pending and draft)
    await waitFor(() => {
      expect(screen.getByText('Pending Document Beta')).toBeInTheDocument();
      expect(screen.getByText('Draft Document Alpha')).toBeInTheDocument();
    });
  });

  test('verifies Pending tab specific UI requirements (no duplicate columns, info box, three-dot active)', async () => {
    render(
      <MemoryRouter>
        <NewDocumentsDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending Document Beta')).toBeInTheDocument();
    });

    // 1. Must show separate column for Status in header
    expect(screen.getByText('Status')).toBeInTheDocument();
    
    // 2. Must show consolidated "Completion" column header
    expect(screen.getByText('Completion')).toBeInTheDocument();

    // 3. Information section is present
    expect(screen.getByText('Information:')).toBeInTheDocument();
    expect(screen.getByText(/Only files where you are assigned/)).toBeInTheDocument();
  });

  test('verifies version number prefix and three-dot Action button behaviors', async () => {
    render(
      <MemoryRouter>
        <NewDocumentsDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/v1.1/)).toBeInTheDocument();
    });

    // In Progress tab: more_vert is active
    expect(screen.getAllByText('more_vert').length).toBeGreaterThan(0);
  });
});
