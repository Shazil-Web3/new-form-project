import React, { useState, useEffect, useCallback, memo } from "react";
import { calculateTOCNumbers } from "../../../utils/tocUtils";

const TOCSidebarView = memo(({ toc, sidebarWidth, setSidebarWidth }) => (
  <div className="toc-sidebar" style={{ width: `${sidebarWidth}px` }}>
    <div className="toc-header-row" style={{ display: 'flex', flexDirection: 'column', alignItems: sidebarWidth === 200 ? 'flex-start' : 'center', marginBottom: '8px', position: 'sticky', top: 0, zIndex: 10, background: 'inherit' }}>
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
        <ul className="list-unstyled">
          {toc.length === 0 ? (
            <p className="toc-empty">📜 No headings found</p>
          ) : (
            toc.map((item, index) => (
              <li key={item.id || index} style={{ paddingLeft: `${(Math.min(item.level, 3) - 1) * 15}px` }}>
                <a
                  href={`#${item.id}`}
                  className="toc-link text-dark"
                  onClick={(e) => {
                    e.preventDefault();
                    const headingEl = document.getElementById(item.id);
                    if (headingEl) {
                      let container = headingEl.parentElement;
                      while (container && container !== document.body && container !== document.documentElement) {
                        const style = window.getComputedStyle(container);
                        if ((style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') && container.scrollHeight > container.clientHeight) {
                          break;
                        }
                        container = container.parentElement;
                      }

                      const headingRect = headingEl.getBoundingClientRect();
                      const topOffset = 180;

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
                  }}
                >
                  <strong>{item.tocNumber}</strong> {item.text}
                </a>
              </li>
            ))
          )}
        </ul>
      </div>
    )}
    {sidebarWidth === 65 && (
      <div className="toc-icon" style={{ textAlign: 'center', marginTop: '20px', color: '#666', cursor: 'pointer' }} onClick={() => setSidebarWidth(200)} title="Click to expand Table of Contents">
        <i className="bi bi-list-ul" style={{ fontSize: '20px' }}></i>
      </div>
    )}
  </div>
));

const useTableOfContents = (editorRef, sidebarWidth, setSidebarWidth) => {
  const [toc, setToc] = useState([]);

  const updateTOC = useCallback(() => {
    if (!editorRef.current) return;

    const headings = Array.from(editorRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    const tocNumbers = calculateTOCNumbers(headings);
    const newToc = headings.map((heading, index) => {
      const id = `heading-${index}`;
      const tocNum = tocNumbers[index];

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
      observer.observe(editorRef.current, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, [editorRef, updateTOC]);

  const TOCComponent = useCallback(() => (
    <TOCSidebarView
      toc={toc}
      sidebarWidth={sidebarWidth}
      setSidebarWidth={setSidebarWidth}
    />
  ), [toc, sidebarWidth, setSidebarWidth]);

  return { updateTOC, TOCComponent };
};

export default useTableOfContents;