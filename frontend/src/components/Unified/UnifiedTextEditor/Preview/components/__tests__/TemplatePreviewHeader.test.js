import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock('../TemplateApproversBar', () => () => <div data-testid="approvers-bar">ApproversBar</div>);

import TemplatePreviewHeader from '../TemplatePreviewHeader';

describe('TemplatePreviewHeader Publish Permissions', () => {
  let originalConsoleError;

  beforeAll(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  const baseProps = {
    parsedTemplate: {
      id: 55,
      document_id: 55,
      created_by: 10,
      status: 'approved',
      template_approvers: { reviewers: [], approvers: [] }
    },
    onCancel: jest.fn(),
    handleSubmit: jest.fn(),
    isDocument: true
  };

  test('Approver does NOT see Publish Document button or author menu when document is approved', () => {
    const approverUser = { id: 20, email: 'approver@org.com', role: 'approver' };

    render(
      <TemplatePreviewHeader {...baseProps} currentUser={approverUser} />
    );

    // Standalone green button
    expect(screen.queryByRole('button', { name: /publish document/i })).not.toBeInTheDocument();
    // Circulate Document dropdown
    expect(screen.queryByRole('button', { name: /(?:circulate|update) document/i })).not.toBeInTheDocument();
  });

  test('Admin DOES see Publish Document button and Circulate Document menu when document is approved', () => {
    const adminUser = { id: 1, email: 'admin@org.com', role: 'admin' };

    render(
      <TemplatePreviewHeader {...baseProps} currentUser={adminUser} />
    );

    expect(screen.getByRole('button', { name: /publish document/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /(?:circulate|update) document/i })).toBeInTheDocument();
  });

  test('Author (non-admin) does NOT see Publish Document button when document is approved', () => {
    const authorUser = { id: 10, email: 'author@org.com', role: 'author' };

    render(
      <TemplatePreviewHeader {...baseProps} currentUser={authorUser} />
    );

    expect(screen.queryByRole('button', { name: /publish document/i })).not.toBeInTheDocument();
    // But author can still see Circulate Document dropdown to Save as Draft / submit
    expect(screen.getByRole('button', { name: /(?:circulate|update) document/i })).toBeInTheDocument();
  });
});
