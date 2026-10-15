/**
 * @file useObsoleteReferences.js
 * @description Hook to detect whether any referenced document has become obsolete (archived)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkObsoleteReferences } from '../../../../api/references';

export function useObsoleteReferences({ sourceType = 'document', sourceId = null, content = null, elements = null }) {
  const [obsoleteDocs, setObsoleteDocs] = useState([]);
  const [hasObsolete, setHasObsolete] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const timeoutRef = useRef(null);

  const check = useCallback(async () => {
    try {
      setIsChecking(true);
      const res = await checkObsoleteReferences({
        sourceType,
        sourceId,
        content: typeof content === 'object' ? JSON.stringify(content) : content,
        elements
      });

      if (res?.success) {
        setHasObsolete(!!res.hasObsolete);
        setObsoleteDocs(res.obsoleteDocuments || []);
      }
    } catch (err) {
      console.warn('Notice checking obsolete references:', err.message);
    } finally {
      setIsChecking(false);
    }
  }, [sourceType, sourceId, content, elements]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce checking to avoid excessive calls during active typing
    timeoutRef.current = setTimeout(() => {
      check();
    }, 400);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [check]);

  return {
    obsoleteDocs,
    hasObsolete,
    isChecking,
    recheck: check
  };
}
