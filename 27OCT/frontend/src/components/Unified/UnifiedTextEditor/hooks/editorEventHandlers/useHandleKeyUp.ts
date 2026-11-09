export const useHandleKeyUp = ({
  readOnly,
  shiftPressedCellRef,
  shiftHadOtherKeysRef,
  handleTableCellNavigation,
}) => {
  function handleKeyUp(event) {
    if (readOnly) return;
    if (event.key === "Shift" && shiftPressedCellRef.current) {
      const cell = shiftPressedCellRef.current;
      const hadOtherKeys = shiftHadOtherKeysRef.current;
      shiftPressedCellRef.current = null;
      shiftHadOtherKeysRef.current = false;

      if (!hadOtherKeys) {
        event.preventDefault();
        event.stopPropagation();
        handleTableCellNavigation(cell, true);
      }
    }
  }

  // Return the event handlers and the check function (in case parent needs it)

  return {
    handleKeyUp,
  };
};

export default useHandleKeyUp;
