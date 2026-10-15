import { useEffect } from "react";

export const useHighlightInteractions = ({
  pagesContainerRef,
  references,
  triggerTabFlash,
  setReferencePreview,
  activeRailTabRef
}) => {
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const handleMouseOver = (e) => {
      // Handle comment/suggestion highlights
      const highlight = e.target.closest('[data-comment-id], [data-suggestededit-id]');
      if (highlight) {
        const elementId = highlight.getAttribute('data-comment-id') || highlight.getAttribute('data-suggestededit-id');
        if (elementId) {
          highlight.classList.add('editor-highlight-hovered');
          const railCard = document.querySelector(`.doc-rail__card[data-element-id="${elementId}"]`);
          if (railCard) railCard.classList.add('hovered');
        }
      }

      // Handle reference superscript hover
      const refSup = e.target.closest('sup.reference-number');
      if (refSup) {
        const refId = refSup.getAttribute('data-reference-id');
        const ref = references.find(r => r.refAnchor === refId);
        if (ref) {
          const rect = refSup.getBoundingClientRect();
          const parentRect = container.parentElement.getBoundingClientRect();
          setReferencePreview({
            show: true,
            top: rect.top - parentRect.top + container.parentElement.scrollTop - 10,
            left: rect.left - parentRect.left + container.parentElement.scrollLeft,
            ref
          });
        }
      }
    };

    const handleMouseOut = (e) => {
      // Handle comment/suggestion highlights
      const highlight = e.target.closest('[data-comment-id], [data-suggestededit-id]');
      if (highlight) {
        highlight.classList.remove('editor-highlight-hovered');
        const elementId = highlight.getAttribute('data-comment-id') || highlight.getAttribute('data-suggestededit-id');
        if (elementId) {
          const railCard = document.querySelector(`.doc-rail__card[data-element-id="${elementId}"]`);
          if (railCard) railCard.classList.remove('hovered');
        }
      }

      // Handle reference superscript hover out
      const refSup = e.target.closest('sup.reference-number');
      if (refSup) {
        setReferencePreview(prev => ({ ...prev, show: false }));
      }
    };

    const handleDoubleClick = (e) => {
      // Handle both superscript and the highlighted wrapper
      const refElement = e.target.closest('sup.reference-number, .reference-citation-wrapper');

      if (refElement) {
        const refId = refElement.getAttribute('data-reference-id');
        const ref = references.find(r => r.refAnchor === refId || r.id === refId);
        if (ref) {
          // Find the tab container and switch to Reference tab
          const tabs = document.querySelector('.ant-tabs');
          if (tabs) {
            // This is a bit hacky but works for Ant Design Tabs
            const refTab = document.querySelector('.ant-tabs-tab-btn[id*="-tab-references"]');
            if (refTab) {
              refTab.click();
            } else {
              // Fallback: try to find any tab that looks like References
              const allTabs = document.querySelectorAll('.ant-tabs-tab-btn');
              const foundRefTab = Array.from(allTabs).find(t => t.textContent.includes('Reference'));
              if (foundRefTab) foundRefTab.click();
            }

            // Scroll to the reference entry in the list
            setTimeout(() => {
              const refEntry = document.getElementById(`ref-entry-${ref.id}`);
              if (refEntry) {
                refEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                refEntry.classList.add('highlight-glow');
                setTimeout(() => refEntry.classList.remove('highlight-glow'), 2000);
              }
            }, 150);
          }
        }
      }
    };

    const handleClick = (e) => {
      const highlight = e.target.closest('[data-comment-id], [data-suggestededit-id]');
      if (!highlight) return;

      const isComment = highlight.hasAttribute('data-comment-id') || highlight.getAttribute('data-type') === 'comment';
      const isSuggestion = highlight.hasAttribute('data-suggestededit-id') || highlight.getAttribute('data-type') === 'suggestededit';

      if (isSuggestion) {
        if (activeRailTabRef.current === 'comments') {
          // Clicked a suggestion while viewing comments column -> flash suggestions tab!
          triggerTabFlash('changes');
        }
      } else if (isComment) {
        if (activeRailTabRef.current === 'changes') {
          // Clicked a comment while viewing suggestions column -> flash comments tab!
          triggerTabFlash('comments');
        }
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);
    container.addEventListener('dblclick', handleDoubleClick);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('click', handleClick);
    };
  }, [pagesContainerRef, references, triggerTabFlash, setReferencePreview, activeRailTabRef]);
};
