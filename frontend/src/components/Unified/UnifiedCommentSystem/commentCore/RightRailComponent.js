import React, { useState, useEffect, useCallback, useRef } from "react";
import { RailCardComponent } from "./RailCardComponent";

const RightRailComponent = ({ system }) => {
  const {
    railRef, railMetrics, pageGroups, itemRefs,
    composerTextareaRef, handleRailResizeStart, isRailResizing,
    activeRailTab, floatingElements, isCommenting, isSuggestingEdit,
    flashingTab, manualSwitchTab, handleManualTabSwitch, isDraft, isRevise
  } = system;

  const effectiveIsDraft = isRevise ? false : Boolean(isDraft);

  const suggestionCount = floatingElements.filter(el =>
    el.type === 'suggestededit' && el.status !== 'approved' && el.status !== 'declined' && el.status !== 'resolved'
  ).length;
  const commentCount = floatingElements.filter(el =>
    el.type === 'comment' && el.status !== 'approved' && el.status !== 'declined' && el.status !== 'resolved'
  ).length;

  // Cache initial default top so the buttons stay fixed right below the toolbar
  const initialTopRef = useRef(null);

  // Track the rail's fixed viewport coordinates so the buttons stay 100% stuck/pinned in place
  const [fixedHeaderPos, setFixedHeaderPos] = useState({
    top: 0,
    right: 0,
    width: railMetrics?.width || 330,
    ready: false
  });

  const updateFixedHeaderPos = useCallback(() => {
    const railEl = railRef.current;
    if (!railEl) return;
    const rect = railEl.getBoundingClientRect();

    // Look for the toolbar (the Portrait / Landscape toolbar or editor-container boundary)
    const toolbarEl = document.querySelector('.editor-toolbar, .toolbar');
    let targetTop = null;
    if (toolbarEl) {
      const tbRect = toolbarEl.getBoundingClientRect();
      if (tbRect.bottom > 0) {
        targetTop = tbRect.bottom;
      }
    }

    // If toolbar is found, stick immediately below it.
    // Otherwise, capture the initial top on first render and lock to it.
    if (targetTop === null) {
      if (initialTopRef.current === null && rect.top > 0) {
        initialTopRef.current = rect.top;
      }
      targetTop = initialTopRef.current !== null ? initialTopRef.current : Math.max(0, rect.top);
    } else {
      initialTopRef.current = targetTop;
    }

    setFixedHeaderPos({
      top: targetTop,
      right: Math.max(0, window.innerWidth - rect.right),
      width: rect.width || railMetrics?.width || 330,
      ready: true
    });
  }, [railRef, railMetrics?.width]);

  useEffect(() => {
    updateFixedHeaderPos();

    window.addEventListener('resize', updateFixedHeaderPos);
    window.addEventListener('scroll', updateFixedHeaderPos, true);

    const scrollContainers = document.querySelectorAll(
      '.editor-container, .main-container, .review-editor-wrapper, .template-editor-wrapper, .create-editor-wrapper, .content-container'
    );
    scrollContainers.forEach(c => c.addEventListener('scroll', updateFixedHeaderPos, { passive: true }));

    let ro = null;
    if (window.ResizeObserver && railRef.current) {
      ro = new ResizeObserver(() => {
        updateFixedHeaderPos();
      });
      ro.observe(railRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateFixedHeaderPos);
      window.removeEventListener('scroll', updateFixedHeaderPos, true);
      scrollContainers.forEach(c => c.removeEventListener('scroll', updateFixedHeaderPos));
      if (ro) ro.disconnect();
    };
  }, [updateFixedHeaderPos, railRef]);

  const renderTabsHeader = (railWidth) => {
    const currentWidth = fixedHeaderPos.ready ? fixedHeaderPos.width : railWidth;
    const tabFontSize = Math.max(10, Math.min(13, 10 + (currentWidth - 180) * (3 / 100)));
    const badgeFontSize = Math.max(9, Math.min(11, 9 + (currentWidth - 180) * (2 / 100)));
    const tabPadding = Math.max(2, Math.min(8, 2 + (currentWidth - 180) * (6 / 100)));

    return (
      <div
        className="doc-rail__tabs-header"
        style={{
          position: 'fixed',
          top: fixedHeaderPos.top,
          right: fixedHeaderPos.right,
          width: currentWidth,
          height: '48px',
          zIndex: 1200,
          background: '#f8f9fa',
          borderBottom: '1px solid #dadce0',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'auto',
          boxSizing: 'border-box'
        }}
      >
        <button
          type="button"
          className={`doc-rail__tab-btn ${activeRailTab === 'comments' ? 'active' : ''} ${flashingTab === 'comments' ? 'flashing-tab-comments' : ''} ${manualSwitchTab === 'comments' ? 'manual-switch-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleManualTabSwitch('comments');
          }}
          style={{
            fontSize: `${tabFontSize}px`,
            paddingLeft: `${tabPadding}px`,
            paddingRight: `${tabPadding}px`,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Comments</span>
          <span className="doc-rail__tab-count" style={{ fontSize: `${badgeFontSize}px` }}>{commentCount}</span>
        </button>
        {!effectiveIsDraft && (
          <button
            type="button"
            className={`doc-rail__tab-btn ${activeRailTab === 'changes' ? 'active' : ''} ${flashingTab === 'changes' ? 'flashing-tab-changes' : ''} ${manualSwitchTab === 'changes' ? 'manual-switch-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleManualTabSwitch('changes');
            }}
            style={{
              fontSize: `${tabFontSize}px`,
              paddingLeft: `${tabPadding}px`,
              paddingRight: `${tabPadding}px`,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Suggestions</span>
            <span className="doc-rail__tab-count" style={{ fontSize: `${badgeFontSize}px` }}>{suggestionCount}</span>
          </button>
        )}
      </div>
    );
  };

  if (!isCommenting && !isSuggestingEdit && floatingElements.length === 0) {
    // Rail is always visible — render empty state stub so it never disappears
    return (
      <div
        ref={railRef}
        className={`doc-rail ${isRailResizing ? 'is-resizing' : ''}`}
        style={{
          right: 0,
          width: railMetrics.width,
          zIndex: 1000,
          position: 'absolute',
          top: railMetrics.top || 0,
          bottom: 0,
          overflow: 'visible',
          pointerEvents: 'auto',
          padding: 0
        }}
      >
        <div className="doc-rail__resize-handle" onMouseDown={handleRailResizeStart} title="Drag to resize comments panel" />
        {renderTabsHeader(railMetrics?.width || 330)}
        <div style={{ padding: '24px 16px', color: '#9aa0a6', fontSize: '12px', textAlign: 'center', marginTop: '64px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>💬</div>
          <div>No {effectiveIsDraft || activeRailTab === 'comments' ? 'comments' : 'suggestions'} yet.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={railRef}
      className={`doc-rail ${isRailResizing ? 'is-resizing' : ''}`}
      style={{
        right: 0,
        width: railMetrics.width,
        zIndex: 1000,
        position: 'absolute',
        top: railMetrics.top || 0,
        bottom: 0,
        overflow: 'visible',
        pointerEvents: 'auto',
        padding: 0
      }}
      onMouseDown={(e) => { if (e.target !== e.currentTarget) e.stopPropagation(); }}
      onClick={(e) => { if (e.target !== e.currentTarget) e.stopPropagation(); }}
    >
      <div
        className="doc-rail__resize-handle"
        onMouseDown={handleRailResizeStart}
        title="Drag to resize comments panel"
      />
      {renderTabsHeader(railMetrics?.width || 330)}
      {pageGroups.map((group) => (
        <div
          key={group.index}
          className="doc-rail__page-rail"
          style={{
            top: group.top,
            height: group.height,
            pointerEvents: 'auto',
            paddingLeft: '8px',
            paddingRight: '8px'
          }}
        >
          {group.items.map(item => (
            <div
              key={item.id}
              ref={el => {
                if (el) itemRefs.current.set(item.id, el);
                else itemRefs.current.delete(item.id);
              }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                pointerEvents: 'auto'
              }}
            >
              <RailCardComponent item={item} system={system} composerTextareaRef={composerTextareaRef} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default RightRailComponent;
export { RightRailComponent };
