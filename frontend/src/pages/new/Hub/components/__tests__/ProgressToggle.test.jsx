import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ProgressToggle from '../ProgressToggle';

describe('ProgressToggle', () => {
  it('defers persistence until drag ends', () => {
    const onChange = jest.fn();

    render(<ProgressToggle value={40} onChange={onChange} canEdit />);

    const input = screen.getByTitle(/drag to update completion/i);
    fireEvent.change(input, { target: { value: '70' } });

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.mouseUp(input);

    expect(onChange).toHaveBeenCalledWith(70);
  });
});
