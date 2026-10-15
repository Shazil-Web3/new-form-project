import React, { useState, useEffect, useCallback, memo } from "react";
import { calculateTOCNumbers } from "../../../../utils/tocUtils";

// Standalone component so React preserves the DOM node and scroll position
const TOCSidebarView = memo(({ toc, isMobile, isFullScreen, sidebarWidth, setSidebarWidth }) => {
  const sidebarClasses = `toc-sidebar ${isMobile && isFullScreen && sidebarWidth > 0 ? 'toc-visible' : ''}`;
  const effectiveSidebarWidth = isMobile && isFullScreen && sidebarWidth === 0 ? 0 :
                               (sidebarWidth === 0 ? 65 : sidebarWidth);

  useEffect(() => {
    const documentRenderer = document.querySelector('.document-renderer');
    if (documentRenderer) {
      documentRenderer.classList.remove('toc-expanded', 'toc-collapsed');
      documentRenderer.classList.add(sidebarWidth === 200 ? 'toc-expanded' : 'toc-collapsed');
    }
  }, [sidebarWidth]);

  return (
    <div className={sidebarClasses} style={{ width: `${effectiveSidebarWidth}px` }}>
      {/* Header: square button on top, title below */}
      <div
        className="toc-header-row"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: sidebarWidth === 200 ? 'flex-start' : 'center',
          marginBottom: '8px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'inherit'
        }}
      >
        <button
          className="toc-toggle"
          onClick={() => setSidebarWidth(sidebarWidth === 200 ? 65 : 200)}
          title={sidebarWidth === 200 ? "Collapse sidebar" : "Expand sidebar"}
          style={{
            width: '32px',
            height: '32px',
            minWidth: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            border: '1px solid #d9d9d9',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#333',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            padding: 0,
            margin: 0
          }}
        >
          {sidebarWidth === 200 ? "◀" : "▶"}
        </button>

        {sidebarWidth === 200 && (
          <h5 className="toc-title" style={{ marginTop: '10px', marginBottom: '4px', textAlign: 'left', fontWeight: 'bold' }}>
            Table of Contents
          </h5>
        )}
      </div>

      {sidebarWidth === 200 && (
        <div className="toc-body">
          {toc.length === 0 ? (
            <p className="toc-empty" style={{ textAlign: 'left' }}>📜 No headings found</p>
          ) : (
            <ul className="list-unstyled" style={{ textAlign: 'left' }}>
              {toc.map((item, index) => (
                <li
                  key={item.id || index}
                  style={{
                    paddingLeft: `${(Math.min(item.level, 3) - 1) * 15}px`,
                    textAlign: 'left'
                  }}
                >
                  <a
                    href={`#${item.id}`}
                    className="toc-link"
                    onClick={(e) => {
                      e.preventDefault();
                      const headingEl = document.getElementById(item.id);
                      if (headingEl) {
                        // Find scrollable container
                        let container = headingEl.parentElement;
                        while (container && container !== document.body && container !== document.documentElement) {
                          const style = window.getComputedStyle(container);
                          if ((style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') && container.scrollHeight > container.clientHeight) {
                            break;
                          }
                          container = container.parentElement;
                        }

                        const headingRect = headingEl.getBoundingClientRect();
                        const topOffset = 180; // Margin below sticky toolbar header

                        if (container && container !== document.body && container !== document.documentElement) {
                          const containerRect = container.getBoundingClientRect();
                          const targetScrollTop = container.scrollTop + (headingRect.top - containerRect.top) - topOffset;
                          container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
                        } else {
                          const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                          const targetScrollTop = currentScrollTop + headingRect.top - topOffset;
                          window.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
                        }
                      }
                      if (isMobile && isFullScreen) {
                        setSidebarWidth(0);
                      }
                    }}
                  >
                    <strong>{item.tocNumber}</strong> {item.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sidebarWidth === 65 && (
        <div className="toc-icon" style={{ textAlign: 'center', marginTop: '30px' }}>
          <i className="bi bi-list-nested fs-5"></i>
        </div>
      )}
    </div>
  );
});

const useTableOfContents = (editorRef, sidebarWidth, setSidebarWidth) => {
  const [toc, setToc] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const updateTOC = useCallback(() => {
    if (!editorRef.current) return;

    const headings = Array.from(
      editorRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6")
    );
    const tocNumbers = calculateTOCNumbers(headings);

    const newToc = headings.map((heading, index) => {
      const id = `heading-${index}`;
      const tocNum = tocNumbers[index];

      // Only write the attribute when it actually needs to change.
      // Writing it unconditionally fires the MutationObserver again → infinite loop.
      if (heading.getAttribute("id") !== id) {
        heading.setAttribute("id", id);
      }
      if (heading.getAttribute("data-toc-number") !== tocNum) {
        heading.setAttribute("data-toc-number", tocNum);
      }

      return {
        id,
        text: (heading.textContent || heading.innerText || "").trim(),
        level: parseInt(heading.tagName.charAt(1), 10),
        tocNumber: tocNum
      };
    });

    setToc(prevToc => {
      if (
        prevToc.length === newToc.length &&
        prevToc.every((item, i) => item.id === newToc[i].id && item.text === newToc[i].text && item.level === newToc[i].level && item.tocNumber === newToc[i].tocNumber)
      ) {
        return prevToc;
      }
      return newToc;
    });
  }, [editorRef]);

  useEffect(() => {
    if (editorRef.current) {
      updateTOC();
      const observer = new MutationObserver(updateTOC);
      observer.observe(editorRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      });

      return () => observer.disconnect();
    }
  }, [editorRef, updateTOC]);

  const TOCComponent = useCallback(({ isFullScreen }) => (
    <TOCSidebarView
      toc={toc}
      isMobile={isMobile}
      isFullScreen={isFullScreen}
      sidebarWidth={sidebarWidth}
      setSidebarWidth={setSidebarWidth}
    />
  ), [toc, isMobile, sidebarWidth, setSidebarWidth]);

  return { updateTOC, TOCComponent };
};

export default useTableOfContents;