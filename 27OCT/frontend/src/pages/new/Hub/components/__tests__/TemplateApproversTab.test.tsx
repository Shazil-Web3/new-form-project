/**
 * @file TemplateApproversTab.test.jsx
 * @description Unit tests for TemplateApproversTab component.
 * @dependencies @testing-library/react, @testing-library/jest-dom
 * @author Codegen
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TemplateApproversTab from '../TemplateApproversTab';

jest.mock('../../../../../components/new/tailwind/SearchableSelect', () =>
  function MockSearchableSelect({ placeholder, onChange, value }) {
    return (
      <select
        data-testid="searchable-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      >
        <option value="">{placeholder}</option>
        <option value="Dept A">Dept A</option>
        <option value="1">Stage 1</option>
      </select>
    );
  }
);

const defaultProps = {
  approvers: [],
  departments: [
    { id: 1, name: 'Dept A' },
    { id: 2, name: 'Dept B' },
  ],
  onAddApprover: jest.fn(),
  onRemoveApprover: jest.fn(),
  onApproverChange: jest.fn(),
  onApproverDepartmentChange: jest.fn(),
};

describe('TemplateApproversTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the section heading', () => {
    render(<TemplateApproversTab {...defaultProps} />);
    expect(screen.getByText('Template Approvers Configuration')).toBeInTheDocument();
  });

  it('renders Add Approver button when not disabled', () => {
    render(<TemplateApproversTab {...defaultProps} />);
    expect(screen.getByText('Add Approver')).toBeInTheDocument();
  });

  it('calls onAddApprover when Add Approver button clicked', () => {
    render(<TemplateApproversTab {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Approver'));
    expect(defaultProps.onAddApprover).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no approvers', () => {
    render(<TemplateApproversTab {...defaultProps} />);
    expect(screen.getByText('No approvers added yet.')).toBeInTheDocument();
  });

  it('renders approver row with Department, Mandatory, Stage when approvers exist', () => {
    const approvers = [{ key: 1, department: 'Dept A', mandatory: false, stage: 1 }];
    render(<TemplateApproversTab {...defaultProps} approvers={approvers} />);
    expect(screen.getAllByText('Department').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mandatory').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Stage').length).toBeGreaterThan(0);
  });

  it('calls onRemoveApprover when delete button is clicked', () => {
    const approvers = [{ key: 1, department: 'Dept A', mandatory: false, stage: 1 }];
    render(<TemplateApproversTab {...defaultProps} approvers={approvers} />);
    const deleteBtn = screen.getByTitle('Remove approver');
    fireEvent.click(deleteBtn);
    expect(defaultProps.onRemoveApprover).toHaveBeenCalledWith(1);
  });

  it('calls onApproverChange when mandatory checkbox toggled', () => {
    const approvers = [{ key: 1, department: 'Dept A', mandatory: false, stage: 1 }];
    render(<TemplateApproversTab {...defaultProps} approvers={approvers} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(defaultProps.onApproverChange).toHaveBeenCalledWith(1, 'mandatory', true);
  });

  it('does not render Add Approver button when disabled', () => {
    render(<TemplateApproversTab {...defaultProps} disabled={true} />);
    expect(screen.queryByText('Add Approver')).not.toBeInTheDocument();
  });

  it('renders info note when approvers exist', () => {
    const approvers = [{ key: 1, department: 'Dept A', mandatory: true, stage: 1 }];
    render(<TemplateApproversTab {...defaultProps} approvers={approvers} />);
    const mandatoryEls = screen.getAllByText(/Mandatory/i);
    expect(mandatoryEls.length).toBeGreaterThan(0);
  });
});
