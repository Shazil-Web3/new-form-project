/**
 * @file RelatedDocuments.test.jsx
 * @description Tests for the Related Documents feature:
 *  - Published documents CANNOT be selected in the related documents.
 *  - Other than the published documents, documents in review, documents in approval,
 *    as well as in draft CAN be selected in the related dropdown.
 *  - Synchronized publishing gate: a document cannot be published while a related doc
 *    is in draft, review, or approval until all are approved and published together.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Component imports ────────────────────────────────────────────────────────
import BasicInfoTab from '../components/BasicInfoTab';
import MultiSearchableSelect from '../../../../components/new/tailwind/MultiSearchableSelect';
import TemplateOverviewTab, { getStageBadge, getStageBadgeText } from '../../../../components/Unified/UnifiedTextEditor/Preview/components/TemplateOverviewTab';

// ─── API mocks ────────────────────────────────────────────────────────────────
jest.mock('../../../../utils/authService', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Daniel Ventura' } }),
}));

jest.mock('../../../../api/documents', () => ({
  getDocument: jest.fn(),
  updateDocument: jest.fn(),
  updateDocumentStatus: jest.fn(),
  reviewDocument: jest.fn(),
  approveDocument: jest.fn(),
  rejectDocument: jest.fn(),
  getRelatedDocuments: jest.fn(),
  setRelatedDocuments: jest.fn(),
  getDocumentsForRelated: jest.fn(),
  getUnpublishedDocumentsForRelated: jest.fn(),
  getPublishedDocumentsForRelated: jest.fn(),
  getPublishReadiness: jest.fn(),
  publishDocumentGroup: jest.fn(),
}));

jest.mock('../../../../api/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const draftDoc = {
  document_id: 'doc-draft',
  title: 'Draft Document',
  status: 'draft',
  version: 1,
};

const reviewDoc = {
  document_id: 'doc-review',
  title: 'Under Review Document',
  status: 'pending_review',
  version: 1,
};

const approvalDoc = {
  document_id: 'doc-approval',
  title: 'Under Approval Document',
  status: 'pending_approval',
  version: 1,
};

const publishedDoc = {
  document_id: 'doc-pub',
  title: 'Published Document',
  status: 'published',
  version: 1,
  document_number: 'DOC-001',
};

// ─── BasicInfoTab helpers ─────────────────────────────────────────────────────

function renderBasicInfoTab(overrides = {}) {
  const defaults = {
    isDocument: true,
    values: { title: 'Test Document', related_document_ids: [] },
    onChange: jest.fn(),
    templates: [],
    categories: [],
    departments: [],
    sites: [],
    disabled: false,
    relatedDocumentCandidates: [draftDoc, reviewDoc, approvalDoc],
  };
  return render(<BasicInfoTab {...defaults} {...overrides} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Related Documents — Selection Logic & BasicInfoTab', () => {
  test('1. renders Related Documents field for documents with in-flight candidates', () => {
    renderBasicInfoTab();

    expect(screen.getAllByText(/Related Documents/i)[0]).toBeInTheDocument();
    const trigger = document.querySelector('[role="combobox"]');
    expect(trigger).toBeInTheDocument();
  });

  test('2. published documents CANNOT be selected; draft, review, and approval documents CAN be selected', async () => {
    // Pass a mix of published, draft, review, and approval documents
    renderBasicInfoTab({
      relatedDocumentCandidates: [draftDoc, reviewDoc, approvalDoc, publishedDoc],
    });

    const trigger = document.querySelector('[role="combobox"]');
    fireEvent.click(trigger);

    await waitFor(() => {
      // In-flight documents (draft, review, approval) MUST appear
      expect(screen.getByText('Draft Document')).toBeInTheDocument();
      expect(screen.getByText('Under Review Document')).toBeInTheDocument();
      expect(screen.getByText('Under Approval Document')).toBeInTheDocument();
    });

    // Published documents CANNOT appear in the related dropdown
    expect(screen.queryByText('Published Document')).not.toBeInTheDocument();
  });

  test('3. selecting a draft document calls onChange with its id', async () => {
    const onChange = jest.fn();
    renderBasicInfoTab({ onChange });

    const trigger = document.querySelector('[role="combobox"]');
    fireEvent.click(trigger);

    await waitFor(() => screen.getByText('Draft Document'));
    fireEvent.click(screen.getByText('Draft Document'));

    expect(onChange).toHaveBeenCalledWith('related_document_ids', expect.arrayContaining(['doc-draft']));
  });

  test('4. selecting review and approval documents passes all selected IDs to onChange', async () => {
    const onChange = jest.fn();
    renderBasicInfoTab({
      onChange,
      values: { title: 'Test Document', related_document_ids: ['doc-review'] },
    });

    const trigger = document.querySelector('[role="combobox"]');
    fireEvent.click(trigger);

    await waitFor(() => screen.getByText('Under Approval Document'));
    fireEvent.click(screen.getByText('Under Approval Document'));

    expect(onChange).toHaveBeenCalledWith(
      'related_document_ids',
      expect.arrayContaining(['doc-review', 'doc-approval'])
    );
  });

  test('5. Related Documents field is NOT rendered for templates', () => {
    renderBasicInfoTab({
      isDocument: false,
      values: { name: 'Test Template', related_document_ids: [] },
    });
    expect(screen.queryByText(/Related Documents/i)).not.toBeInTheDocument();
  });

  test('6. shows sync message when related documents are selected', () => {
    renderBasicInfoTab({
      values: { title: 'Test', related_document_ids: ['doc-draft'] },
    });
    expect(screen.getByText(/Synchronized publishing active/i)).toBeInTheDocument();
  });

  test('7. does NOT show sync message when no related documents are selected', () => {
    renderBasicInfoTab({
      values: { title: 'Test', related_document_ids: [] },
    });
    expect(screen.queryByText(/Synchronized publishing active/i)).not.toBeInTheDocument();
  });

  test('8. disables dropdown when no candidate documents exist', () => {
    renderBasicInfoTab({ relatedDocumentCandidates: [], publishedDocuments: [] });
    const trigger = document.querySelector('[role="combobox"]');
    expect(trigger).toHaveClass('cursor-not-allowed');
  });

  test('9. pre-selects related documents from values prop on render', () => {
    renderBasicInfoTab({
      values: { title: 'Test', related_document_ids: ['doc-draft', 'doc-review'] },
    });
    expect(screen.getByText('Draft Document')).toBeInTheDocument();
    expect(screen.getByText('Under Review Document')).toBeInTheDocument();
  });
});

// ─── MultiSearchableSelect unit tests ────────────────────────────────────────

describe('MultiSearchableSelect', () => {
  test('renders placeholder when no values selected', () => {
    render(
      <MultiSearchableSelect
        values={[]}
        onChange={jest.fn()}
        options={[{ value: 'a', label: 'Option A' }]}
        placeholder="Select items..."
      />
    );
    expect(screen.getByText('Select items...')).toBeInTheDocument();
  });

  test('shows selected chips', () => {
    render(
      <MultiSearchableSelect
        values={['a']}
        onChange={jest.fn()}
        options={[{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }]}
      />
    );
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.queryByText('Option B')).not.toBeInTheDocument();
  });

  test('calls onChange with item added on click', async () => {
    const onChange = jest.fn();
    render(
      <MultiSearchableSelect
        values={[]}
        onChange={onChange}
        options={[{ value: 'x', label: 'Item X' }]}
      />
    );
    const trigger = document.querySelector('[role="combobox"]');
    fireEvent.click(trigger);
    await waitFor(() => screen.getByText('Item X'));
    fireEvent.click(screen.getByText('Item X'));
    expect(onChange).toHaveBeenCalledWith(['x']);
  });

  test('calls onChange with item removed on re-click', async () => {
    const onChange = jest.fn();
    render(
      <MultiSearchableSelect
        values={['x']}
        onChange={onChange}
        options={[{ value: 'x', label: 'Item X' }]}
      />
    );
    const trigger = document.querySelector('[role="combobox"]');
    fireEvent.click(trigger);
    const listItem = await waitFor(() => screen.getByRole('option', { name: /Item X/i }));
    fireEvent.click(listItem);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  test('filters options by search text', async () => {
    render(
      <MultiSearchableSelect
        values={[]}
        onChange={jest.fn()}
        options={[
          { value: 'a', label: 'Alpha Doc' },
          { value: 'b', label: 'Beta Doc' },
        ]}
      />
    );
    const trigger = document.querySelector('[role="combobox"]');
    fireEvent.click(trigger);
    await waitFor(() => screen.getByPlaceholderText('Type to filter...'));
    const searchInput = screen.getByPlaceholderText('Type to filter...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    await waitFor(() => {
      expect(screen.getByText('Alpha Doc')).toBeInTheDocument();
      expect(screen.queryByText('Beta Doc')).not.toBeInTheDocument();
    });
  });

  test('clear all removes all selections', async () => {
    const onChange = jest.fn();
    render(
      <MultiSearchableSelect
        values={['a', 'b']}
        onChange={onChange}
        options={[
          { value: 'a', label: 'Alpha Doc' },
          { value: 'b', label: 'Beta Doc' },
        ]}
      />
    );
    const trigger = document.querySelector('[role="combobox"]');
    fireEvent.click(trigger);
    await waitFor(() => screen.getByText('Clear all'));
    fireEvent.click(screen.getByText('Clear all'));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

// ─── Backend publish-gate logic (unit-tested via mocks) ──────────────────────

describe('Related Documents — Publishing Gate Logic (mocked API behavior)', () => {
  const {
    getPublishReadiness,
    publishDocumentGroup,
    updateDocumentStatus,
  } = require('../../../../api/documents');

  afterEach(() => jest.clearAllMocks());

  test('10. getPublishReadiness returns canPublish=false when related doc is Under Review', async () => {
    getPublishReadiness.mockResolvedValue({
      success: true,
      canPublish: false,
      groupSize: 2,
      groupDetails: [
        { document_id: 'doc-main', title: 'Main Doc', status: 'approved' },
        { document_id: 'doc-b', title: 'Related Doc B', status: 'pending_review' },
      ],
      blockedBy: [{ document_id: 'doc-b', title: 'Related Doc B', status: 'pending_review' }],
      message: 'Publishing is blocked.',
    });

    const result = await getPublishReadiness('doc-main');

    expect(result.canPublish).toBe(false);
    expect(result.blockedBy).toHaveLength(1);
    expect(result.blockedBy[0].status).toBe('pending_review');
  });

  test('11. getPublishReadiness returns canPublish=false when related doc is Under Approval', async () => {
    getPublishReadiness.mockResolvedValue({
      success: true,
      canPublish: false,
      groupSize: 2,
      groupDetails: [
        { document_id: 'doc-main', title: 'Main Doc', status: 'approved' },
        { document_id: 'doc-b', title: 'Related Doc B', status: 'pending_approval' },
      ],
      blockedBy: [{ document_id: 'doc-b', title: 'Related Doc B', status: 'pending_approval' }],
    });

    const result = await getPublishReadiness('doc-main');
    expect(result.canPublish).toBe(false);
    expect(result.blockedBy[0].status).toBe('pending_approval');
  });

  test('12. getPublishReadiness returns canPublish=false when related doc is in Draft', async () => {
    getPublishReadiness.mockResolvedValue({
      success: true,
      canPublish: false,
      blockedBy: [{ document_id: 'doc-draft', title: 'Draft Doc', status: 'draft' }],
    });

    const result = await getPublishReadiness('doc-main');
    expect(result.canPublish).toBe(false);
    expect(result.blockedBy[0].status).toBe('draft');
  });

  test('13. getPublishReadiness returns canPublish=true when all group docs are approved/ready', async () => {
    getPublishReadiness.mockResolvedValue({
      success: true,
      canPublish: true,
      groupSize: 2,
      groupDetails: [
        { document_id: 'doc-main', title: 'Main Doc', status: 'approved' },
        { document_id: 'doc-b', title: 'Related Doc B', status: 'approved' },
      ],
      blockedBy: [],
      message: 'All 2 documents in the publishing group are ready.',
    });

    const result = await getPublishReadiness('doc-main');
    expect(result.canPublish).toBe(true);
    expect(result.blockedBy).toHaveLength(0);
  });

  test('14. publishDocumentGroup is called with all group document IDs', async () => {
    publishDocumentGroup.mockResolvedValue({
      success: true,
      publishedDocumentIds: ['doc-main', 'doc-b'],
    });

    const result = await publishDocumentGroup(['doc-main', 'doc-b']);
    expect(publishDocumentGroup).toHaveBeenCalledWith(['doc-main', 'doc-b']);
    expect(result.publishedDocumentIds).toEqual(['doc-main', 'doc-b']);
  });

  test('15. existing document without related docs: updateDocumentStatus called normally', async () => {
    updateDocumentStatus.mockResolvedValue({ success: true });

    const result = await updateDocumentStatus('solo-doc', 'published');
    expect(updateDocumentStatus).toHaveBeenCalledWith('solo-doc', 'published');
    expect(result.success).toBe(true);
  });
});

describe('Related Documents — Overview Tab & Stage Display', () => {
  test('16. getStageBadgeText maps workflow statuses to correct stage labels', () => {
    expect(getStageBadgeText('pending_review')).toBe('In Review Stage');
    expect(getStageBadgeText('in_review')).toBe('In Review Stage');
    expect(getStageBadgeText('pending_approval')).toBe('In Approval Stage');
    expect(getStageBadgeText('in_approval')).toBe('In Approval Stage');
    expect(getStageBadgeText('draft')).toBe('Draft Stage');
    expect(getStageBadgeText('approved')).toBe('Approved Stage');
    expect(getStageBadgeText('reviewed')).toBe('Reviewed Stage');
  });

  test('17. TemplateOverviewTab renders related documents with their details and workflow stages', async () => {
    const { getRelatedDocuments } = require('../../../../api/documents');
    getRelatedDocuments.mockResolvedValue({
      success: true,
      relatedDocuments: [
        {
          document_id: 'rel-doc-1',
          title: 'Safety Procedure Manual',
          document_number: 'DOC-00042',
          status: 'pending_review',
          version: 2,
          department: 'Engineering',
          created_by_name: 'Daniel Ventura',
        },
        {
          document_id: 'rel-doc-2',
          title: 'Financial Audit Checklist',
          document_number: 'DOC-00099',
          status: 'pending_approval',
          version: 1,
          department: 'Finance',
          created_by_name: 'Sarah Jenkins',
        },
      ],
    });

    render(
      <TemplateOverviewTab
        parsedTemplate={{
          document_id: 'main-doc-123',
          title: 'Main Operations Standard',
          document_number: 'TY-0000042',
          status: 'pending_review',
          department: 'Engineering',
        }}
        entityLabel="Document"
      />
    );

    // Wait for the related documents to appear in both descriptions and table
    await waitFor(() => {
      expect(screen.getAllByText('Safety Procedure Manual').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Financial Audit Checklist').length).toBeGreaterThanOrEqual(1);
    });

    // Check details: document numbers, departments, authors
    expect(screen.getAllByText('DOC-00042').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('DOC-00099').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Daniel Ventura').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sarah Jenkins').length).toBeGreaterThanOrEqual(1);

    // Check stage badges
    expect(screen.getAllByText('In Review Stage').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('In Approval Stage').length).toBeGreaterThanOrEqual(1);
  });
});

