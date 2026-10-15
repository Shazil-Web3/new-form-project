import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Get physical dimensions in millimeters for a given paper size and orientation.
 */
export function getPageDimensionsMm(paperSize = "a4", orientation = "portrait") {
  const sizeLower = paperSize.toLowerCase();
  const isLandscape = orientation === "landscape";

  let widthMm = 210;
  let heightMm = 297;

  if (sizeLower === "letter") {
    widthMm = 215.9;
    heightMm = 279.4;
  } else if (sizeLower === "legal") {
    widthMm = 215.9;
    heightMm = 355.6;
  } else {
    // Default A4
    widthMm = 210;
    heightMm = 297;
  }

  if (isLandscape) {
    return { width: heightMm, height: widthMm };
  }
  return { width: widthMm, height: heightMm };
}

/**
 * Custom Live Node PDF Export Engine
 * 
 * Captures live editor page DOM nodes directly to preserve 100% font rendering,
 * paddings, line heights, and margins with zero off-screen layout shifts or text clipping.
 */
export async function exportDocumentToPdf({
  pagesContainerRef,
  paperSize = "a4",
  orientation = "portrait",
  pagesState = [],
  documentTitle = "Document",
  onProgress = null,
  includeApproversPage = false,
  approvers = [],
}) {
  const container = pagesContainerRef?.current;
  if (!container) {
    throw new Error("Pages container reference is not available.");
  }

  const pageElements = Array.from(container.querySelectorAll(".page"));
  if (pageElements.length === 0) {
    throw new Error("No pages found in the document to export.");
  }

  // Ensure all custom web fonts have finished loading
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn("Fonts ready check warning:", e);
    }
  }

  let pdf = null;
  const totalOriginalPages = pageElements.length;
  const shouldAddApproversPage = Boolean(includeApproversPage && Array.isArray(approvers) && approvers.length > 0);
  const totalPdfPages = shouldAddApproversPage ? totalOriginalPages + 1 : totalOriginalPages;

  for (let i = 0; i < totalOriginalPages; i++) {
    const pageEl = pageElements[i];

    if (onProgress) {
      onProgress(i + 1, totalPdfPages, `Processing page ${i + 1} of ${totalPdfPages}...`);
    }

    // Determine individual page orientation
    const stateOrientation = pagesState[i]?.orientation;
    const classOrientation = pageEl.classList.contains("landscape")
      ? "landscape"
      : pageEl.classList.contains("portrait")
      ? "portrait"
      : null;
    const pageOrientation = stateOrientation || classOrientation || orientation || "portrait";

    const { width: widthMm, height: heightMm } = getPageDimensionsMm(
      paperSize,
      pageOrientation
    );

    // 1. Temporarily hide editor-only interactive controls
    const hiddenElements = Array.from(
      pageEl.querySelectorAll(
        ".video-resize-handle, .table-context-menu, .temp-comment-highlight, .temp-suggestion-highlight, .editor-control-btn, .page-break-indicator, .floating-merge-cells-btn"
      )
    );
    hiddenElements.forEach((el) => {
      el.dataset.prevDisplay = el.style.display;
      el.style.display = "none";
    });

    // 2. Temporarily remove contenteditable outline indicators
    const editables = Array.from(pageEl.querySelectorAll("[contenteditable]"));
    editables.forEach((el) => {
      el.dataset.prevContentEditable = el.getAttribute("contenteditable");
      el.removeAttribute("contenteditable");
    });

    // 3. Temporarily set overflow: visible on page & page-content to guarantee ZERO bottom text clipping
    const prevPageOverflow = pageEl.style.overflow;
    pageEl.style.overflow = "visible";

    const pageContent = pageEl.querySelector(".page-content");
    let prevContentOverflow = "";
    let prevContentMaxHeight = "";
    if (pageContent) {
      prevContentOverflow = pageContent.style.overflow;
      prevContentMaxHeight = pageContent.style.maxHeight;
      pageContent.style.overflow = "visible";
      pageContent.style.maxHeight = "none";
    }

    // 4. Ensure all images inside the live page are loaded
    const images = Array.from(pageEl.querySelectorAll("img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    try {
      // High-resolution canvas capture directly from the live editor node
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: (clonedDoc) => {
          // 1. Sanitize all <style> tags in clonedDoc to replace modern CSS color(...) / color-mix(...) functions
          try {
            const styles = clonedDoc.querySelectorAll('style');
            styles.forEach((styleTag) => {
              if (styleTag.textContent && (styleTag.textContent.includes('color(') || styleTag.textContent.includes('color-mix('))) {
                styleTag.textContent = styleTag.textContent
                  .replace(/color\([^)]+\)/gi, '#000000')
                  .replace(/color-mix\([^)]+\)/gi, '#000000');
              }
            });
          } catch (_) {}

          // 2. Sanitize inline element styles
          try {
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach((el) => {
              if (el.style) {
                ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'].forEach((prop) => {
                  const val = el.style[prop];
                  if (val && typeof val === 'string' && (val.includes('color(') || val.includes('color-mix('))) {
                    el.style[prop] = '#000000';
                  }
                });
              }
            });
          } catch (_) {}

          // 3. Override getComputedStyle proxy in cloned window to sanitize computed styles returning unsupported color() strings
          try {
            const win = clonedDoc.defaultView || window;
            const origGetComputedStyle = win.getComputedStyle;
            if (origGetComputedStyle) {
              win.getComputedStyle = function (el, pseudo) {
                const style = origGetComputedStyle.call(win, el, pseudo);
                if (!style) return style;
                return new Proxy(style, {
                  get(target, prop) {
                    const val = target[prop];
                    if (typeof val === 'string' && (val.includes('color(') || val.includes('color-mix('))) {
                      return val.replace(/color\([^)]+\)/gi, '#000000').replace(/color-mix\([^)]+\)/gi, '#000000');
                    }
                    return typeof val === 'function' ? val.bind(target) : val;
                  }
                });
              };
            }
          } catch (_) {}
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      // Compute exact PDF page dimensions matching captured canvas aspect ratio to guarantee ZERO STRETCHING
      const canvasAspect = canvas.width / canvas.height;
      const pdfWidthMm = widthMm;
      const pdfHeightMm = pdfWidthMm / canvasAspect;

      if (i === 0) {
        pdf = new jsPDF({
          orientation: pdfWidthMm > pdfHeightMm ? "landscape" : "portrait",
          unit: "mm",
          format: [pdfWidthMm, pdfHeightMm],
          compress: true,
        });
      } else {
        pdf.addPage([pdfWidthMm, pdfHeightMm], pdfWidthMm > pdfHeightMm ? "landscape" : "portrait");
      }

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidthMm, pdfHeightMm, undefined, "FAST");
    } catch (pageErr) {
      console.error(`Error generating canvas for page ${i + 1}:`, pageErr);
      throw new Error(`Failed capturing page ${i + 1}: ${pageErr.message || pageErr}`);
    } finally {
      // Restore live editor node state
      hiddenElements.forEach((el) => {
        el.style.display = el.dataset.prevDisplay || "";
      });
      editables.forEach((el) => {
        if (el.dataset.prevContentEditable) {
          el.setAttribute("contenteditable", el.dataset.prevContentEditable);
        }
      });
      pageEl.style.overflow = prevPageOverflow;
      if (pageContent) {
        pageContent.style.overflow = prevContentOverflow;
        pageContent.style.maxHeight = prevContentMaxHeight;
      }
    }
  }

  // ─── Optional: Add Approvers Sign-off Page ───
  if (shouldAddApproversPage) {
    if (onProgress) {
      onProgress(totalPdfPages, totalPdfPages, `Generating approvers sign-off page (${totalPdfPages} of ${totalPdfPages})...`);
    }

    const { width: approverPageWidthMm, height: approverPageHeightMm } = getPageDimensionsMm(
      paperSize,
      "portrait"
    );

    // Reference page width in pixels from existing page or fallback standard
    const refWidthPx = pageElements[0]?.offsetWidth || 794;
    const refHeightPx = Math.round(refWidthPx * (approverPageHeightMm / approverPageWidthMm));

    const approversPageEl = document.createElement("div");
    approversPageEl.className = `page portrait ${paperSize.toLowerCase()} approvers-signoff-page`;
    approversPageEl.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: ${refWidthPx}px;
      min-height: ${refHeightPx}px;
      background-color: #ffffff;
      color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 44px 48px;
      box-sizing: border-box;
      z-index: -9999;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    `;

    const formattedDate = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const approversHtml = approvers.map((person) => {
      const isReviewer = String(person.role || '').toLowerCase().includes('review');
      const roleLabel = isReviewer ? 'Reviewer' : 'Approver';
      const roleBg = isReviewer ? '#e6fffa' : '#fef3c7';
      const roleColor = isReviewer ? '#0d9488' : '#b45309';
      const roleBorder = isReviewer ? '#99f6e4' : '#fde68a';
      const dept = person.department || person.selectedDepartment || 'Engineering';
      const stage = person.stage ? `Stage ${person.stage}` : 'Stage 1';

      return `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 5px solid #52c41a; border-radius: 6px; padding: 14px 18px; margin-bottom: 14px; box-sizing: border-box;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px;">
            <div style="font-size: 13px; color: #64748b;">
              <span style="color: #64748b;">Name:</span> <strong style="color: #0f172a; margin-left: 4px;">${person.name || person.email || 'Participant'}</strong>
            </div>
            <div style="font-size: 13px; color: #64748b;">
              <span style="color: #64748b;">Email:</span> <span style="color: #334155; margin-left: 4px;">${person.email || '—'}</span>
            </div>
            <div style="font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 6px;">
              <span style="color: #64748b;">Department:</span> 
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;">${dept}</span>
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff;">${stage}</span>
            </div>
            <div style="font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 6px;">
              <span style="color: #64748b;">Role:</span>
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${roleBg}; color: ${roleColor}; border: 1px solid ${roleBorder};">${roleLabel}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    approversPageEl.innerHTML = `
      <div style="display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="margin-bottom: 20px;">
          <div style="display: inline-block; padding: 4px 12px; background: #e0f2fe; color: #0369a1; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
            Document Approvers
          </div>
          <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; line-height: 1.3;">
            ${documentTitle || 'Document'}
          </h1>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0;">
            <span>Generated on ${formattedDate}</span>
            <span><strong>${approvers.length}</strong> Configured Approver${approvers.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <!-- Approvers List -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 14px;">
            Configured Approvers (Pre-set from Template)
          </div>
          ${approversHtml}
        </div>
      </div>

      <!-- Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11px; color: #94a3b8; margin-top: 24px;">
        <span>ProDoc Enterprise &bull; Official Record</span>
        <span>Page ${totalPdfPages} of ${totalPdfPages}</span>
      </div>
    `;

    document.body.appendChild(approversPageEl);

    try {
      const approverCanvas = await html2canvas(approversPageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const approverImgData = approverCanvas.toDataURL("image/jpeg", 0.98);
      const canvasAspect = approverCanvas.width / approverCanvas.height;
      const pdfWidthMm = approverPageWidthMm;
      const pdfHeightMm = pdfWidthMm / canvasAspect;

      if (!pdf) {
        pdf = new jsPDF({
          orientation: pdfWidthMm > pdfHeightMm ? "landscape" : "portrait",
          unit: "mm",
          format: [pdfWidthMm, pdfHeightMm],
          compress: true,
        });
      } else {
        pdf.addPage([pdfWidthMm, pdfHeightMm], pdfWidthMm > pdfHeightMm ? "landscape" : "portrait");
      }

      pdf.addImage(approverImgData, "JPEG", 0, 0, pdfWidthMm, pdfHeightMm, undefined, "FAST");
    } catch (approverErr) {
      console.error("Error generating approvers page in PDF:", approverErr);
      throw new Error(`Failed capturing approvers page: ${approverErr.message || approverErr}`);
    } finally {
      if (approversPageEl.parentNode) {
        approversPageEl.parentNode.removeChild(approversPageEl);
      }
    }
  }

  if (!pdf) {
    throw new Error("PDF generation failed: no pages were rendered.");
  }

  if (onProgress) {
    onProgress(totalPdfPages, totalPdfPages, "Finalizing PDF download...");
  }

  const safeTitle = (documentTitle || "Document")
    .replace(/[^a-z0-9_-]/gi, "_")
    .toLowerCase();
  pdf.save(`${safeTitle}.pdf`);

  return true;
}
