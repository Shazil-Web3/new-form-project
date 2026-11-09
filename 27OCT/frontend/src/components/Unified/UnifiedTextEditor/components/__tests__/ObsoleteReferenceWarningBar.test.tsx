import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ObsoleteReferenceWarningBar from '../ObsoleteReferenceWarningBar';

describe('ObsoleteReferenceWarningBar Component', () => {
  const mockObsoleteDocs = [
    {
      id: 'doc-123',
      title: 'Safety Guidelines Protocol',
      version: '1.2',
      status: 'archived'
    }
  ];

  test('renders nothing when there are no obsolete documents', () => {
    const { container } = render(<ObsoleteReferenceWarningBar obsoleteDocs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders warning banner with exact obsolete document details', () => {
    render(
      <ObsoleteReferenceWarningBar
        obsoleteDocs={mockObsoleteDocs}
        itemType="document"
      />
    );

    expect(screen.getByText('Referenced Document Obsolete')).toBeInTheDocument();
    expect(screen.getByText(/Safety Guidelines Protocol/)).toBeInTheDocument();
    expect(screen.getByText(/which you have referenced in the text editor, has become obsolete/)).toBeInTheDocument();
    expect(screen.getByText(/You need to revise your document/)).toBeInTheDocument();
  });

  test('triggers onRevise when Revise Document button is clicked', () => {
    const handleRevise = jest.fn();
    render(
      <ObsoleteReferenceWarningBar
        obsoleteDocs={mockObsoleteDocs}
        itemType="document"
        canRevise={true}
        onRevise={handleRevise}
      />
    );

    const reviseBtn = screen.getByRole('button', { name: /Revise Document/i });
    expect(reviseBtn).toBeInTheDocument();
    fireEvent.click(reviseBtn);
    expect(handleRevise).toHaveBeenCalledTimes(1);
  });

  test('supports collapse to pill and expansion back', () => {
    render(
      <ObsoleteReferenceWarningBar
        obsoleteDocs={mockObsoleteDocs}
        itemType="template"
      />
    );

    // Click Minimize
    const minimizeBtn = screen.getByRole('button', { name: /Minimize/i });
    fireEvent.click(minimizeBtn);

    // Banner content should now be collapsed into the pill button
    expect(screen.queryByText(/which you have referenced in the text editor/)).not.toBeInTheDocument();
    const pillBtn = screen.getByRole('button', { name: /1 Obsolete Reference/i });
    expect(pillBtn).toBeInTheDocument();

    // Click pill to expand again
    fireEvent.click(pillBtn);
    expect(screen.getByText(/which you have referenced in the text editor/)).toBeInTheDocument();
  });

  test('dismisses warning banner when close button is clicked', () => {
    render(
      <ObsoleteReferenceWarningBar
        obsoleteDocs={mockObsoleteDocs}
        itemType="document"
      />
    );

    const closeBtn = screen.getByTitle('Dismiss warning for this session');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Referenced Document Obsolete')).not.toBeInTheDocument();
  });
});
