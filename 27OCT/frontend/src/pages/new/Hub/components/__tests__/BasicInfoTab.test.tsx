/**
 * @file BasicInfoTab.test.jsx
 * @description Unit tests for the redesigned BasicInfoTab component.
 * @dependencies @testing-library/react, @testing-library/jest-dom
 * @author Codegen
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BasicInfoTab from '../BasicInfoTab';

// SearchableSelect renders a button/input combo; mock it simply
jest.mock('../../../../../components/new/tailwind/SearchableSelect', () =>
  function MockSearchableSelect({ placeholder, onChange }) {
    return (
      <select data-testid="searchable-select" onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        <option value="1">Option 1</option>
      </select>
    );
  }
);

const baseProps = {
  isDocument: false,
  values: { name: '', description: '', category_id: '', department_id: '' },
  onChange: jest.fn(),
  categories: [{ id: '1', name: 'Category A' }],
  departments: [{ id: '1', name: 'Dept A' }],
};

describe('BasicInfoTab (Template Mode)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders Template Name field', () => {
    render(<BasicInfoTab {...baseProps} />);
    expect(screen.getByPlaceholderText(/Enter template schema name/i)).toBeInTheDocument();
  });

  it('renders Description textarea', () => {
    render(<BasicInfoTab {...baseProps} />);
    expect(screen.getByPlaceholderText(/Describe what this template is used for/i)).toBeInTheDocument();
  });

  it('renders Category dropdown for templates', () => {
    render(<BasicInfoTab {...baseProps} />);
    expect(screen.getByText('Category')).toBeInTheDocument();
  });

  it('does not render Document Title or Base Template for template mode', () => {
    render(<BasicInfoTab {...baseProps} />);
    expect(screen.queryByPlaceholderText(/Enter document name/i)).not.toBeInTheDocument();
  });

  it('calls onChange when name input changes', () => {
    render(<BasicInfoTab {...baseProps} />);
    const input = screen.getByPlaceholderText(/Enter template schema name/i);
    fireEvent.change(input, { target: { value: 'My Template' } });
    expect(baseProps.onChange).toHaveBeenCalledWith('name', 'My Template');
  });

  it('calls onChange when description changes', () => {
    render(<BasicInfoTab {...baseProps} />);
    const textarea = screen.getByPlaceholderText(/Describe what this template is used for/i);
    fireEvent.change(textarea, { target: { value: 'Some description' } });
    expect(baseProps.onChange).toHaveBeenCalledWith('description', 'Some description');
  });
});

describe('BasicInfoTab (Document Mode)', () => {
  const docProps = {
    isDocument: true,
    values: { title: '', description: '', template_id: '', department_id: '', site_id: '', due_date: '' },
    onChange: jest.fn(),
    templates: [{ id: '1', name: 'Template A', version: '1.0' }],
    departments: [{ id: '1', name: 'Dept A' }],
    sites: [{ id: '1', name: 'Site A' }],
  };

  it('renders Document Title field', () => {
    render(<BasicInfoTab {...docProps} />);
    expect(screen.getByPlaceholderText(/Enter document name/i)).toBeInTheDocument();
  });

  it('renders Description textarea for documents', () => {
    render(<BasicInfoTab {...docProps} />);
    expect(screen.getByPlaceholderText(/Describe the purpose of this document/i)).toBeInTheDocument();
  });

  it('renders Base Template Layout dropdown for documents', () => {
    render(<BasicInfoTab {...docProps} />);
    expect(screen.getByText('Base Template Layout')).toBeInTheDocument();
  });

  it('renders Site and Due Date fields for documents', () => {
    render(<BasicInfoTab {...docProps} />);
    expect(screen.getByText('Site / Location')).toBeInTheDocument();
    expect(screen.getByText('Target Due Date')).toBeInTheDocument();
  });
});
