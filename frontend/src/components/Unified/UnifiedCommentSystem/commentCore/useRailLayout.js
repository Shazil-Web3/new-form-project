import { useMemo, useLayoutEffect } from "react";

export const useRailLayout = ({
  pagesContainerRef,
  railRef,
  effectiveIsDraft,
  activeRailTab,
  floatingElements,
  isCommenting,
  isSuggestingEdit,
  commentPosition,
  suggestEditPosition,
  commentText,
  suggestEditText,
  pageMetricsCacheRef,
  anchorPositionCacheRef,
  railUpdateKey,
  railMetrics,
  itemRefs,
  composerTextareaRef
}) => {
  // Calculate items to render with their positions
  const items = useMemo(() => {
    const list = [];
    const effectiveTab = effectiveIsDraft ? 'comments' : activeRailTab;

    // Add comments
    floatingElements.forEach(el => {
      if (el.type === 'comment' || (!effectiveIsDraft && el.type === 'suggestededit')) {
        const isMatch = (effectiveTab === 'comments' && el.type === 'comment') ||
                        (!effectiveIsDraft && effectiveTab === 'changes' && el.type === 'suggestededit');

        if (isMatch) {
          list.push({
            type: el.type,
            data: el,
            top: el.position?.top || 0,
            id: el.id
          });
        }
      }
    });

    // Add composer if active
    if (effectiveTab === 'comments' && isCommenting && commentPosition) {
      list.push({
        type: 'composer',
        data: {
          text: commentText,
          selectedText: commentPosition.selectedText
        },
        top: commentPosition.top,
        pageIndex: commentPosition.pageIndex,
        id: 'composer'
      });
    } else if (!effectiveIsDraft && effectiveTab === 'changes' && isSuggestingEdit && suggestEditPosition) {
      list.push({
        type: 'composer',
        data: {
          text: suggestEditText,
          selectedText: suggestEditPosition.selectedText
        },
        top: suggestEditPosition.top,
        pageIndex: suggestEditPosition.pageIndex,
        id: 'composer'
      });
    }

    // Sort by top position to ensure ranking
    list.sort((a, b) => a.top - b.top);

    return list;
  }, [floatingElements, isCommenting, isSuggestingEdit, commentPosition, suggestEditPosition, commentText, suggestEditText, activeRailTab, effectiveIsDraft]);

  // Group items by page for rendering
  const pageGroups = useMemo(() => {
    if (!pagesContainerRef.current) return [];

    const pages = Array.from(pagesContainerRef.current?.querySelectorAll('.page') || []);
    const groups = pageMetricsCacheRef.current.length > 0
      ? pageMetricsCacheRef.current.map(p => ({ ...p, items: [] }))
      : Array.from(pagesContainerRef.current?.querySelectorAll('.page') || []).map((pageEl, index) => {
        const rect = pageEl.getBoundingClientRect();
        const containerRect = pagesContainerRef.current?.getBoundingClientRect();
        return {
          index,
          top: rect.top - (containerRect?.top || 0) + (pagesContainerRef.current?.scrollTop || 0),
          height: rect.height,
          items: []
        };
      });

    items.forEach(item => {
      let pageIndex = -1;

      if (item.type === 'composer') {
        pageIndex = item.pageIndex ?? 0;
      } else {
        const cachedAnchorTop = anchorPositionCacheRef.current.get(item.id);
        if (cachedAnchorTop !== undefined) {
          // Find which page this top belongs to using cached page metrics
          const page = pageMetricsCacheRef.current.find(p =>
            cachedAnchorTop >= p.top && cachedAnchorTop < p.top + p.height
          );
          pageIndex = page ? page.index : 0;
        } else {
          pageIndex = item.data?.position?.pageIndex ?? 0;
        }
      }

      const idx = pageIndex >= 0 ? pageIndex : (item.data?.position?.pageIndex ?? 0);
      if (groups[idx]) {
        groups[idx].items.push(item);
      }
    });

    return groups;
  }, [items, pagesContainerRef, railUpdateKey, railMetrics.width, pageMetricsCacheRef, anchorPositionCacheRef]);

  // Layout effect: collision avoidance PER PAGE RAIL
  useLayoutEffect(() => {
    if (!pagesContainerRef.current || !railRef.current) return;

    const gap = 8;

    pageGroups.forEach(group => {
      let currentY = group.index === 0 ? 48 : 0;

      // Sort items by their anchor position within the group
      const sortedItems = [...group.items].sort((a, b) => {
        const getTop = (item) => {
          if (item.type === 'composer') return (isCommenting ? commentPosition?.top : suggestEditPosition?.top) || 0;
          return anchorPositionCacheRef.current.get(item.id) ?? (item.data?.position?.top || 0);
        };
        return getTop(a) - getTop(b);
      });

      sortedItems.forEach(item => {
        const el = itemRefs.current.get(item.id);
        if (!el) return;

        // Ideal top relative to page
        let idealTop = 0;
        if (item.type === 'composer') {
          const pos = isCommenting ? commentPosition : suggestEditPosition;
          idealTop = (pos?.top || 0) - group.top;
        } else {
          const cachedTop = anchorPositionCacheRef.current.get(item.id);
          if (cachedTop !== undefined) {
            idealTop = cachedTop - group.top;
          } else if (item.data?.position?.top) {
            idealTop = item.data.position.top - group.top;
          }
        }

        // Collision avoidance with top margin
        const minTop = 15; // Minimum 15px from the top of the page rail
        const finalTop = Math.max(idealTop, currentY, (currentY === 0 ? minTop : 0));
        el.style.top = `${finalTop}px`;
        currentY = finalTop + el.offsetHeight + gap;
      });
    });

    // Auto-focus composer if it just appeared
    const composerItem = items.find(i => i.type === 'composer');
    if (composerItem && composerTextareaRef.current) {
      if (document.activeElement !== composerTextareaRef.current) {
        composerTextareaRef.current.focus({ preventScroll: true });
      }
    }
  }, [pageGroups, items, isCommenting, isSuggestingEdit, commentPosition, suggestEditPosition, pagesContainerRef, railRef, anchorPositionCacheRef, itemRefs, composerTextareaRef]);

  return {
    items,
    pageGroups
  };
};
