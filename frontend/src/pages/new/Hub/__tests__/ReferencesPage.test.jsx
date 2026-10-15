import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReferencesPage from '../ReferencesPage';
import { useAuth } from '../../../../utils/authService';
import * as refApi from '../../../../api/references';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  MemoryRouter: ({ children }) => <div>{children}</div>,
}), { virtual: true });

jest.mock('../../../../utils/authService', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../../components/new/tailwind/MainLayout', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

jest.mock('../../../../api/references', () => ({
  getReferences: jest.fn(),
  syncHistoricalReferences: jest.fn(),
}));

describe('ReferencesPage Component', () => {
  const mockReferencesData = [
    {
      id: 1,
      sourceType: 'document',
      sourceId: 'doc-source-1',
      sourceTitle: 'System Safety Plan',
      sourceStatus: 'draft',
      sourceVersion: '1.0',
      sourceAuthor: 'Alice Author',
      sourceDepartment: 'Engineering',
      targetType: 'document',
      targetId: 'doc-target-1',
      targetTitle: 'Standard Operating Procedures',
      targetStatus: 'published',
      targetVersion: '2.0',
      targetAuthor: 'Bob Publisher',
      createdAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 2,
      sourceType: 'template',
      sourceId: 'temp-source-2',
      sourceTitle: 'Audit Checklist Template',
      sourceStatus: 'published',
      sourceVersion: '1.2',
      sourceAuthor: 'Admin User',
      sourceDepartment: 'Quality',
      targetType: 'document',
      targetId: 'doc-target-2',
      targetTitle: 'ISO 9001 Guidelines',
      targetStatus: 'published',
      targetVersion: '1.0',
      targetAuthor: 'Carol Quality',
      createdAt: '2026-09-02T10:00:00.000Z',
    }
  ];

  const mockMetrics = {
    totalReferences: 2,
    referencingDocuments: 1,
    referencingTemplates: 1,
    uniqueReferencedTargets: 2,
    byStatus: {
      all: 2,
      draft: 1,
      pending_review: 0,
      pending_approval: 0,
      published: 1,
      archived: 0
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: 1, role: 'admin', email: 'admin@example.com' }
    });
    refApi.getReferences.mockResolvedValue({
      success: true,
      data: mockReferencesData,
      metrics: mockMetrics,
      roleScope: 'admin'
    });
  });

  test('renders references page header, metrics, and references table', async () => {
    render(<ReferencesPage />);

    // Header checks
    expect(await screen.findByText('References & Citations')).toBeInTheDocument();
    expect(await screen.findByText('Organization Scope')).toBeInTheDocument();

    // Metrics cards check
    expect(screen.getByText('Total References')).toBeInTheDocument();
    expect(screen.getByText('Referencing Docs')).toBeInTheDocument();
    expect(screen.getByText('Referencing Templates')).toBeInTheDocument();
    expect(screen.queryByText('Cited Targets')).not.toBeInTheDocument();

    // Verify 'View Target' action button is omitted
    expect(screen.queryByText('View Target')).not.toBeInTheDocument();

    // Reference items rendered
    expect(screen.getByText('System Safety Plan')).toBeInTheDocument();
    expect(screen.getByText('Standard Operating Procedures')).toBeInTheDocument();
    expect(screen.getByText('Audit Checklist Template')).toBeInTheDocument();
    expect(screen.getByText('ISO 9001 Guidelines')).toBeInTheDocument();
  });

  test('verifies status tabs are removed and filters references using scope buttons', async () => {
    render(<ReferencesPage />);

    await screen.findByText('System Safety Plan');

    // Confirm status tabs are removed
    expect(screen.queryByRole('button', { name: /All References/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /In Review/i })).not.toBeInTheDocument();

    // Click Documents scope button (only item 1 is a document)
    const docsBtn = screen.getByRole('button', { name: /Documents/i });
    fireEvent.click(docsBtn);

    expect(screen.getByText('System Safety Plan')).toBeInTheDocument();
    expect(screen.queryByText('Audit Checklist Template')).not.toBeInTheDocument();

    // Click Templates scope button (only item 2 is a template)
    const templatesBtn = screen.getByRole('button', { name: /Templates/i });
    fireEvent.click(templatesBtn);

    expect(screen.queryByText('System Safety Plan')).not.toBeInTheDocument();
    expect(screen.getByText('Audit Checklist Template')).toBeInTheDocument();
  });

  test('filters references using search input', async () => {
    render(<ReferencesPage />);

    await screen.findByText('System Safety Plan');

    const searchInput = screen.getByPlaceholderText('Search reference or target...');
    fireEvent.change(searchInput, { target: { value: 'Audit' } });

    expect(screen.queryByText('System Safety Plan')).not.toBeInTheDocument();
    expect(screen.getByText('Audit Checklist Template')).toBeInTheDocument();
  });

  test('opens reference connection details modal when clicking details button', async () => {
    render(<ReferencesPage />);

    await screen.findByText('System Safety Plan');

    const detailsButtons = screen.getAllByTitle('Inspect Reference Connection');
    fireEvent.click(detailsButtons[0]);

    expect(screen.getByText('Reference Connection Details')).toBeInTheDocument();
    expect(screen.getByText('Open in Editor')).toBeInTheDocument();
    expect(screen.getByText('Open Reference View')).toBeInTheDocument();
  });
});
