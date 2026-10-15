/**
 * @file StructureTab.test.jsx
 * @description Unit tests for the redesigned StructureTab component.
 * @dependencies @testing-library/react, @testing-library/jest-dom
 * @author Codegen
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StructureTab from '../StructureTab';

const defaultProps = {
  lockedElements: {
    content: false,
    toc: false,
    fontSize: false,
    fontStyle: false,
    headerFooter: false,
  },
  onLockToggle: jest.fn(),
  includeTableOfContents: false,
  onIncludeTocChange: jest.fn(),
  allowAttachments: false,
  onAllowAttachmentsChange: jest.fn(),
};

describe('StructureTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the section heading', () => {
    render(<StructureTab {...defaultProps} />);
    expect(screen.getByText('Template Structure and Locked Elements')).toBeInTheDocument();
  });

  it('renders all 5 lock toggle switches', () => {
    render(<StructureTab {...defaultProps} />);
    expect(screen.getByText('Lock Contents')).toBeInTheDocument();
    expect(screen.getByText('Lock Table of Contents')).toBeInTheDocument();
    expect(screen.getByText('Lock Font Size')).toBeInTheDocument();
    expect(screen.getByText('Lock Font Style')).toBeInTheDocument();
    expect(screen.getByText('Lock Header/Footer')).toBeInTheDocument();
  });

  it('calls onLockToggle when a lock switch is clicked', () => {
    render(<StructureTab {...defaultProps} />);
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(defaultProps.onLockToggle).toHaveBeenCalledWith('content');
  });

  it('renders the Table of Contents checkbox', () => {
    render(<StructureTab {...defaultProps} />);
    expect(screen.getByText('Include Table of Contents (Index)')).toBeInTheDocument();
  });

  it('calls onIncludeTocChange when TOC checkbox is clicked', () => {
    render(<StructureTab {...defaultProps} />);
    const tocCheckbox = screen.getByLabelText(/Include Table of Contents/i, { exact: false });
    if (tocCheckbox) {
      fireEvent.click(tocCheckbox);
      expect(defaultProps.onIncludeTocChange).toHaveBeenCalledWith(true);
    }
  });

  it('renders the Allow Attachments checkbox', () => {
    render(<StructureTab {...defaultProps} />);
    expect(screen.getByText('Allow File Attachments')).toBeInTheDocument();
  });

  it('shows TOC checkbox as checked when includeTableOfContents is true', () => {
    render(<StructureTab {...defaultProps} includeTableOfContents={true} />);
    const checkboxes = screen.getAllByRole('checkbox');
    const tocCheckbox = checkboxes.find(cb => cb.checked);
    expect(tocCheckbox).toBeTruthy();
  });

  it('disables all interactive elements when disabled prop is true', () => {
    render(<StructureTab {...defaultProps} disabled={true} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => expect(cb).toBeDisabled());
  });
});
