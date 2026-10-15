/**
 * @file DocumentImpactTab.test.jsx
 * @description Unit tests for the redesigned DocumentImpactTab component.
 * @dependencies @testing-library/react, @testing-library/jest-dom
 * @author Codegen
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DocumentImpactTab from '../DocumentImpactTab';

// Mock ImpactFormEditor since it does complex HTML segment rendering
jest.mock('../../../../../components/Home/components/Dashboard/Documents/ImpactFormEditor', () =>
  function MockImpactFormEditor({ templateHtml, filledValues, readOnly, onChange }) {
    return (
      <div data-testid="impact-form-editor">
        <span>Template: {templateHtml}</span>
        <span>Filled: {JSON.stringify(filledValues)}</span>
        <span>ReadOnly: {String(readOnly)}</span>
        <button
          type="button"
          onClick={() => onChange && onChange(['edited_val'], ['edited_drop'])}
          data-testid="mock-editor-change"
        >
          Change Form Content
        </button>
      </div>
    );
  }
);

const defaultProps = {
  impactData: {
    departmentImpacts: ['Sales'],
    affectedSystems: 'CRM',
    implementationEffort: 'medium',
    trainingRequired: true,
    impactNotes: 'Needs training schedule',
  },
  setImpactData: jest.fn(),
  departments: [
    { id: 1, name: 'Sales' },
    { id: 2, name: 'Engineering' },
  ],
  readOnly: false,
};

describe('DocumentImpactTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders section title', () => {
    render(<DocumentImpactTab {...defaultProps} />);
    expect(screen.getByText('Organizational Impact & Effort')).toBeInTheDocument();
  });

  it('renders editable fields in edit mode (readOnly=false)', () => {
    render(<DocumentImpactTab {...defaultProps} readOnly={false} />);
    expect(screen.getByText('Affected Departments Scope')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. CRM, ERP Database/i)).toBeInTheDocument();
    expect(screen.getByText('Training Required')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/timelines, dependencies/i)).toBeInTheDocument();
  });

  it('triggers setImpactData when toggling a department', () => {
    render(<DocumentImpactTab {...defaultProps} readOnly={false} />);
    const engineeringCheckbox = screen.getByLabelText('Engineering');
    fireEvent.click(engineeringCheckbox);
    expect(defaultProps.setImpactData).toHaveBeenCalled();
  });

  it('triggers setImpactData when changing systems input', () => {
    render(<DocumentImpactTab {...defaultProps} readOnly={false} />);
    const systemsInput = screen.getByPlaceholderText(/e.g. CRM, ERP Database/i);
    fireEvent.change(systemsInput, { target: { value: 'New ERP' } });
    expect(defaultProps.setImpactData).toHaveBeenCalled();
  });

  it('triggers setImpactData when training checkbox is clicked', () => {
    render(<DocumentImpactTab {...defaultProps} readOnly={false} />);
    const trainingCheckbox = screen.getByRole('checkbox', { name: /training required/i });
    fireEvent.click(trainingCheckbox);
    expect(defaultProps.setImpactData).toHaveBeenCalled();
  });

  it('renders static fields in read-only mode', () => {
    render(<DocumentImpactTab {...defaultProps} readOnly={true} />);
    expect(screen.getByText('Impacted Departments')).toBeInTheDocument();
    expect(screen.getByText('Affected Systems')).toBeInTheDocument();
    expect(screen.getByText('Estimated organizational rollout effort')).toBeInTheDocument();
    expect(screen.getByText('Training & Readiness')).toBeInTheDocument();
  });

  it('renders ImpactFormEditor when template HTML exists', () => {
    const propsWithHtml = {
      ...defaultProps,
      impactData: {
        ...defaultProps.impactData,
        impactTemplateHtml: '<p>Standard Procedure</p>',
        impactFilledValues: ['one'],
      },
    };
    render(<DocumentImpactTab {...propsWithHtml} />);
    expect(screen.getByTestId('impact-form-editor')).toBeInTheDocument();
    expect(screen.getByText('Template: <p>Standard Procedure</p>')).toBeInTheDocument();
  });
});
