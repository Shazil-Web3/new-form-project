/**
 * @file SearchableSelect.test.jsx
 * @description Unit tests for the SearchableSelect reusable component.
 * @dependencies @testing-library/react, @testing-library/user-event
 * @author Codegen
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchableSelect from '../SearchableSelect';

const options = [
  { value: '1', label: 'Alice Smith (alice@example.com)' },
  { value: '2', label: 'Bob Jones (bob@example.com)' },
  { value: '3', label: 'Charlie Brown (charlie@example.com)' },
];

describe('SearchableSelect', () => {
  it('renders placeholder when no value is selected', () => {
    render(<SearchableSelect value="" onChange={() => {}} options={options} placeholder="Pick one..." />);
    expect(screen.getByText('Pick one...')).toBeInTheDocument();
  });

  it('displays the selected option label when value is set', () => {
    render(<SearchableSelect value="2" onChange={() => {}} options={options} />);
    expect(screen.getByText('Bob Jones (bob@example.com)')).toBeInTheDocument();
  });

  it('opens the dropdown panel on trigger click', () => {
    render(<SearchableSelect value="" onChange={() => {}} options={options} placeholder="Pick one..." />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Type to filter...')).toBeInTheDocument();
  });

  it('filters options by search term', () => {
    render(<SearchableSelect value="" onChange={() => {}} options={options} placeholder="Pick one..." />);
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('Type to filter...');
    fireEvent.change(input, { target: { value: 'bob' } });
    expect(screen.getByText('Bob Jones (bob@example.com)')).toBeInTheDocument();
    expect(screen.queryByText('Alice Smith (alice@example.com)')).not.toBeInTheDocument();
  });

  it('calls onChange with the correct value when an option is clicked', () => {
    const handleChange = jest.fn();
    render(<SearchableSelect value="" onChange={handleChange} options={options} placeholder="Pick one..." />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Alice Smith (alice@example.com)'));
    expect(handleChange).toHaveBeenCalledWith('1');
  });

  it('closes the dropdown after selection', async () => {
    render(<SearchableSelect value="" onChange={() => {}} options={options} placeholder="Pick one..." />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Alice Smith (alice@example.com)'));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Type to filter...')).not.toBeInTheDocument();
    });
  });

  it('shows no-match message when search yields no results', () => {
    render(<SearchableSelect value="" onChange={() => {}} options={options} placeholder="Pick one..." />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Type to filter...'), { target: { value: 'xyz' } });
    expect(screen.getByText(/No options match/)).toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(<SearchableSelect value="" onChange={() => {}} options={options} disabled placeholder="Pick one..." />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByPlaceholderText('Type to filter...')).not.toBeInTheDocument();
  });
});
