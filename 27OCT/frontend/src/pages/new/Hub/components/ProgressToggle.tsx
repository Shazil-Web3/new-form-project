/**
 * @file ProgressToggle.jsx
 * @description Interactive completion rate slider with persistent percentage display at the right side
 * @dependencies react, prop-types
 * @author Codegen
 */

import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export default function ProgressToggle({ value, onChange, canEdit }) {
  const [displayValue, setDisplayValue] = useState(value);
  const committedValueRef = useRef(value);

  useEffect(() => {
    setDisplayValue(value);
    committedValueRef.current = value;
  }, [value]);

  const persistValue = React.useCallback(() => {
    if (committedValueRef.current !== displayValue) {
      committedValueRef.current = displayValue;
      onChange(displayValue);
    }
  }, [displayValue, onChange]);

  const handleSliderChange = (event) => {
    const nextValue = Number(event.target.value);
    setDisplayValue(nextValue);
  };

  const handleDragEnd = () => {
    persistValue();
  };

  // If the user cannot edit, render a sleek visual progress bar with the percentage next to it
  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 select-none min-w-[130px]" title={`Completion: ${value}%`}>
        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden min-w-[70px]">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[34px] text-right font-mono">
          {value}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 select-none min-w-[130px]">
      <div className="relative flex-1 flex items-center min-w-[70px]">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={displayValue}
          onBlur={handleDragEnd}
          onMouseUp={handleDragEnd}
          onTouchEnd={handleDragEnd}
          onChange={handleSliderChange}
          className="completion-slider w-full h-2 min-h-[8px] cursor-pointer"
          style={{
            background: `linear-gradient(to right, #2563eb ${displayValue}%, #e2e8f0 ${displayValue}%)`,
            touchAction: 'none',
          }}
          title="Drag to update completion"
        />
      </div>
      <span className="text-xs font-bold text-blue-700 dark:text-blue-400 min-w-[34px] text-right font-mono">
        {displayValue}%
      </span>
    </div>
  );
}

ProgressToggle.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
};

ProgressToggle.defaultProps = {
  canEdit: false,
};
