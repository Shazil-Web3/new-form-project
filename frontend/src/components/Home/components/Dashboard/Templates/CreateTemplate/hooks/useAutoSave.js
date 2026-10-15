import { useState, useEffect, useRef } from 'react';
import { debounce } from 'lodash';

export const useAutoSave = ({
  currentTemplateId,
  currentDocumentId,
  form,
  contentData,
  onSave,
  titleField = 'name'
}) => {
  const savedEntityId = currentDocumentId ?? currentTemplateId;
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);
  
  // Ref to hold the latest content data to avoid stale closures in debounce
  const contentDataRef = useRef(contentData);
  const savedEntityIdRef = useRef(savedEntityId);
  useEffect(() => {
    contentDataRef.current = contentData;
  }, [contentData]);
  useEffect(() => {
    savedEntityIdRef.current = savedEntityId;
  }, [savedEntityId]);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Debounced save function (always invoke latest onSave via onSaveRef)
  const debouncedSave = useRef(
    debounce(() => {
      if (savedEntityIdRef.current || (form && form.getFieldValue(titleField))) {
        onSaveRef.current?.('draft', true, contentDataRef.current);
      }
    }, 2000)
  ).current;

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const performAutoSave = () => {
    onSaveRef.current?.('draft', true, contentDataRef.current);
  };

  return { 
    debouncedSave, 
    setAutoSaveTimer, 
    autoSaveTimer,
    performAutoSave 
  };
};
