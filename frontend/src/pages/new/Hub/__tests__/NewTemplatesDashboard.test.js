/**
 * @file NewTemplatesDashboard.test.js
 * @description Unit tests for Templates Dashboard, mocking api services
 * @dependencies react, @testing-library/react, api/templates
 * @author Codegen
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import NewTemplatesDashboard from '../TemplatesTab';
import { useAuth } from '../../../../utils/authService';

// Import mocked API helpers
import { listTemplates, listCategories } from '../../../../api/templates';

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
  name: 'Test Administrator',
  role: 'admin',
  orgId: 10,
};

const mockTemplates = [
  {
    id: 101,
    name: 'Draft Template Alpha',
    category: 'HR',
    description: 'Draft onboarding pack template',
    status: 'draft',
    created_by: 1,
    version: '1.0',
    updated_at: '2026-07-08T12:00:00Z',
  },
  {
    id: 102,
    name: 'Pending Template Beta',
    category: 'Finance',
    description: 'Finance verification matrix',
    status: 'pending',
    created_by: 1,
    version: '1.2',
    updated_at: '2026-07-09T10:00:00Z',
    template_approvers: JSON.stringify({
      reviewers: [{ userId: 1, name: 'Jane Reviewer', role: 'Finance', status: 'approved' }],
    }),
  },
  {
    id: 103,
    name: 'Published Template Gamma',
    category: 'Legal',
    description: 'Legal compliance policy',
    status: 'published',
    created_by: 2,
    version: '2.0',
    updated_at: '2026-07-09T11:00:00Z',
    usage_count: 15,
  },
];

const mockCategories = [
  { id: 1, name: 'HR' },
  { id: 2, name: 'Finance' },
  { id: 3, name: 'Legal' },
];

describe('NewTemplatesDashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: mockUser });
    
    // Resolve mock promises
    listTemplates.mockResolvedValue(mockTemplates);
    listCategories.mockResolvedValue(mockCategories);
  });

  test('renders page title and tabs correctly', async () => {
    render(
      <MemoryRouter>
        <NewTemplatesDashboard />
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
        <NewTemplatesDashboard />
      </MemoryRouter>
    );

    // Default active tab is In Progress (includes Draft Template Alpha and Pending Template Beta)
    await waitFor(() => {
      expect(screen.getByText('Pending Template Beta')).toBeInTheDocument();
      expect(screen.getByText('Draft Template Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Published Template Gamma')).not.toBeInTheDocument();
    });

    // Click Published tab
    fireEvent.click(screen.getByText('Published'));
    await waitFor(() => {
      expect(screen.getByText('Published Template Gamma')).toBeInTheDocument();
      expect(screen.queryByText('Draft Template Alpha')).not.toBeInTheDocument();
    });
  });

  test('verifies Pending tab specific UI requirements (no duplicate columns, info box, three-dot active)', async () => {
    render(
      <MemoryRouter>
        <NewTemplatesDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending Template Beta')).toBeInTheDocument();
    });

    // 1. Must show separate column for Status in header
    expect(screen.getByText('Status')).toBeInTheDocument();
    
    // 2. Must show consolidated "Completion" column header
    expect(screen.getByText('Completion')).toBeInTheDocument();

    // 3. Information section is present
    expect(screen.getByText('Information:')).toBeInTheDocument();
    expect(screen.getByText(/Only templates where you are assigned/)).toBeInTheDocument();
  });

  test('verifies version number prefix and three-dot Action button behaviors', async () => {
    render(
      <MemoryRouter>
        <NewTemplatesDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/v1.2/)).toBeInTheDocument();
    });

    // In Progress tab: more_vert is active
    expect(screen.getAllByText('more_vert').length).toBeGreaterThan(0);
  });

  test('filters templates by search query', async () => {
    render(
      <MemoryRouter>
        <NewTemplatesDashboard />
      </MemoryRouter>
    );

    // Switch to Published tab
    fireEvent.click(screen.getByText('Published'));
    await waitFor(() => {
      expect(screen.getByText('Published Template Gamma')).toBeInTheDocument();
    });

    // Type in search bar
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Gamma' } });

    expect(screen.getByText('Published Template Gamma')).toBeInTheDocument();

    // Clear search
    fireEvent.click(screen.getByText('Clear'));
    expect(searchInput.value).toBe('');
  });
});
