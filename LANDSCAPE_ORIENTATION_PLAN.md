# Architectural & Implementation Plan: True Landscape Orientation (297mm × 210mm)

## 1. Executive Summary & Objective

The goal of this initiative is to transition our rich-text document editor from an artificial square page in landscape mode ($297\text{ mm} \times 297\text{ mm}$) to standard physical landscape dimensions ($297\text{ mm} \times 210\text{ mm}$ for A4, $11'' \times 8.5''$ for Letter), matching Microsoft Outlook, Word, and Google Docs.

This document details the code-level analysis of how our DOM-based editor, pagination engine, event handlers, and export systems currently work, and provides the step-by-step development strategy to handle:
1. **Pagination & Usable Height Calculations**
2. **Page Breaks (Manual & Automatic)**
3. **Backspace & Reverse Merging Across Page Boundaries**
4. **Text Transfer (Forward Overflow & Backward Reflow)**
5. **Table Splitting, Row Movement & Header Continuity**
6. **Caret & Selection Preservation During Layout Reflows**
7. **Zero-Regression Isolation for Portrait Mode**

---

## 2. Codebase Architecture & Current Landscape Bottlenecks

### 2.1 Where Landscape Dimensions Are Hardcoded

Our code analysis identified three distinct places where landscape height is artificially kept at portrait height:

1. **`frontend/src/components/Unified/UnifiedTextEditor/styles/EditorCore.css` (Lines 73–92):**
   ```css
   /* CURRENT: Keeps vertical height at 297mm / 11in */
   .page.landscape.a4,
   .document-renderer .page.landscape.a4 {
     width: 297mm;
     min-height: 297mm; /* <- Must become 210mm */
     max-height: 297mm; /* <- Must become 210mm */
   }
   .page.landscape.letter,
   .document-renderer .page.landscape.letter {
     width: 11in;
     min-height: 11in;  /* <- Must become 8.5in */
     max-height: 11in;  /* <- Must become 8.5in */
   }
   ```

2. **`frontend/src/components/Editor/DocumentEngineClass.js` (Lines 54–58 & Lines 677–681):**
   ```javascript
   // CURRENT: Hardcoded portrait heights regardless of orientation
   let totalPaperHeight = 1123; // 297mm at 96 DPI
   if (paperSize === 'letter') totalPaperHeight = 1056; // 11in at 96 DPI
   else if (paperSize === 'legal') totalPaperHeight = 1344; // 14in at 96 DPI
   ```
   *Issue:* In landscape mode, `totalPaperHeight` must swap:
   - A4: $210\text{ mm} \times 3.7795 \approx 794\text{ px}$ (instead of $1123\text{ px}$).
   - Letter: $8.5'' \times 96 = 816\text{ px}$ (instead of $1056\text{ px}$).
   - Legal: $8.5'' \times 96 = 816\text{ px}$ (instead of $1344\text{ px}$).

3. **`frontend/src/components/Unified/UnifiedTextEditor/hooks/usePageManagement.js` (Lines 185–194 & Lines 211–213):**
   ```javascript
   // CURRENT fallback assumes portrait height
   if ((paperSize || "").toLowerCase() === "letter") pageHeight = 1056;
   else if ((paperSize || "").toLowerCase() === "legal") pageHeight = 1344;
   else pageHeight = 1123;
   ```

---

## 3. Deep-Dive: Handling Editor Subsystems Under Shorter Height

When switching to true landscape, usable vertical height drops from $\approx 750\text{ px}$ to $\approx 450\text{ px} - 500\text{ px}$ (after subtracting header $\approx 35\text{ px}$, footer $\approx 50\text{ px}$, logo $\approx 64\text{ px}$, and padding $\approx 36\text{ px}$). Here is how each subsystem will behave and how we will handle it:

```
+-----------------------------------------------------------+
| Landscape Page: 297mm Width (~1123px)                     |
|                                                           |
| +-------------------------------------------------------+ |
| | Header / Logo Strip: ~99px                            | |
| +-------------------------------------------------------+ |
| | Usable Content Height: ~450px - 500px                 | |
| |                                                       | |
| |  [ Text Blocks & Split Tables Reflow Dynamically ]    | |
| |                                                       | |
| +-------------------------------------------------------+ |
| | Footer: ~50px                                         | |
| +-------------------------------------------------------+ |
+-----------------------------------------------------------+
  Total Height: 210mm (~794px)
```

---

### 3.1 Pagination & Layout Engine (`DocumentEngineClass.js` & `usePageManagement.js`)

#### How it works:
1. `DocumentEngineClass.repaginate(firstContent)` runs off-screen using a sandbox mirror (`_createSandboxMirror()`).
2. It loops through all blocks in document order.
3. It measures each block using `_measureWithMargins(block, targetOrientation)`:
   - Uses an offscreen mirror matching `.document-renderer.landscape.a4 > .page > .page-content`.
   - Width is $297\text{ mm}$ ($\approx 1123\text{ px}$), meaning text is wider and occupies fewer vertical lines.
4. If a block fits in `remaining` height, it stays on the page.
5. If it exceeds `remaining` height, it triggers `_splitToFit()`.

#### What changes for Landscape:
* In `configureLayoutFromElement()` and `getUsableHeightForPage()`:
  ```javascript
  const isLandscape = orientation === 'landscape';
  let totalPaperHeight = isLandscape ? 794 : 1123;
  if (paperSize === 'letter') totalPaperHeight = isLandscape ? 816 : 1056;
  else if (paperSize === 'legal') totalPaperHeight = isLandscape ? 816 : 1344;
  ```
* **Guard against Infinite Loops on Large Blocks:**
  If an atomic block (e.g., a large image, a 300px diagram, or an indivisible embed) is taller than `usableHeightPx` ($\approx 450\text{ px}$), the paginator must not repeatedly create empty pages.
  *Existing safety net in lines 814–825 already verifies:*
  If `remaining === currentCapacity` (the block is already on a fresh page) and it still doesn't fit, it forces placement on the page and advances. We will add an explicit `maxPages = 200` safeguard as defense-in-depth.

---

### 3.2 Page Breaks (`useHandlePageBreak.js`)

#### How it works:
* User presses `Ctrl + Enter` or selects "Insert Page Break".
* `handlePageBreak()` splits the current block at cursor position into `beforeBlock`, creates a `BLOCK_TYPES.PAGE_BREAK` block, and a new `BLOCK_TYPES.PARAGRAPH` on the next page.
* During pagination (`_layoutBlocksIntoPages`):
  ```javascript
  if (b.type === BLOCK_TYPES.PAGE_BREAK) {
    if (cur.blocks.length === 0) {
      cur.blocks.push(this.createBlock(BLOCK_TYPES.PARAGRAPH, ''));
    }
    cur.blocks.push(b);
    newPage();
    continue;
  }
  ```

#### Landscape Impact:
* Page breaks have **0 height** (`box: 0, mt: 0, mb: 0`).
* They function identically regardless of page height: they immediately invoke `newPage()`.
* **Verdict:** Zero breaking risk. Full compatibility with landscape.

---

### 3.3 Backspace & Cross-Page Merging (`useBlockBackspace.js`)

There are two backspace scenarios:
1. **Collapsed cursor at offset 0 of a block on Page $N$:**
   * If the previous block is `PAGE_BREAK`:
     The page break is deleted from the engine and DOM, causing content on Page $N$ to reflow back onto Page $N-1$ up to the landscape usable height limit ($\approx 450\text{ px}$). Any remaining content cleanly stays on Page $N$.
   * If the previous block is a paragraph:
     The two paragraphs are joined into a single block. `renderFreshFromEngine` repaginates the merged block. If the combined text exceeds $\approx 450\text{ px}$, `_splitParagraph` splits it at the boundary.
2. **Cross-page selection deletion (`deleteAcrossHosts`):**
   * User drags a selection from the bottom of Page 1 to the top of Page 2 and hits Backspace.
   * `deleteAcrossHosts` merges the surviving head of Page 1 and tail of Page 2, removes intermediate blocks, and consolidates blocks before repaginating.

#### Landscape Safeguards:
* Because landscape pages are shorter, users reach page boundaries faster.
* The cursor restoration logic in `useBlockBackspace.js` (lines 84–105) uses text tree walking based on string offset:
  `walker.nextNode(); r.setStart(node, remaining);`
  This is coordinate-agnostic and relies strictly on character offsets, meaning it functions accurately regardless of page height.

---

### 3.4 Text Transfer: Forward Overflow & Backward Reflow

#### Forward Overflow (Typing near page bottom):
* When typing text in a paragraph at the bottom of Page 1:
  * In landscape, lines are wider ($\approx 1050\text{ px}$ content width vs $\approx 670\text{ px}$ in portrait).
  * A 300-word paragraph might only be 6 lines tall instead of 10 lines.
  * When content exceeds `usableHeightPx`:
    * `_splitParagraph` uses binary search (`moveRunBinarySearch`) to find the exact character split point that fits inside `boxBudget`.
    * It splits the paragraph into Part 1 (Page 1) and Part 2 (Page 2).
    * `usePageManagement.js` updates DOM children via `updatePageDOM(targetContentEl, pageBlocks)` without recreating DOM nodes where possible, preserving typing responsiveness.

#### Backward Reflow (Deleting text on Page 1):
* When text is deleted on Page 1:
  * `schedulePaginate` is triggered via `contentChangeHandlerRef`.
  * `_mergeAdjacentTableContinuations` and block consolidation gather the blocks.
  * As space opens up on Page 1, `_splitParagraph` / `_layoutBlocksIntoPages` re-evaluates capacity:
    * The head of Page 2 pulls back into Page 1 smoothly.
    * If an empty page is left over, it is pruned automatically.

---

### 3.5 Table Transfer: Splitting, Row Movement & Table Headers

Tables represent the most delicate part of document pagination:

#### How Table Splitting Operates (`_splitTable` in lines 1442–1540):
1. The engine renders a sandbox probe containing the table headers (`probe = this._renderBlockForMeasure(...)`).
2. It appends rows one by one:
   ```javascript
   for (let i = 0; i < rows.length; i++) {
     tbody.appendChild(tr);
     if (probe.getBoundingClientRect().height <= budget) {
       taken.push(rows[i]);
       lastFittingRow = i;
     } else {
       tbody.removeChild(tr);
       break;
     }
   }
   ```
3. It handles `rowspan` overlaps with `hasActiveRowSpanOverlap()`. If a spanned cell crosses the cutline, it pulls back rows until no span is cut.
4. If `taken.length === 0` (even row 1 cannot fit in remaining space on Page 1):
   * It returns `{ first: null, rest: block }`.
   * The paginator pushes the **entire table** to the top of Page 2!
5. If rows fit, it creates `block.id + '_p1'` for Page 1, and `block.id + '_p2'` for Page 2.

#### Landscape Table Advantages & Challenges:
* **Advantage (Horizontal Space):** In landscape, tables have $297\text{ mm}$ width. Columns do not feel squished, cells have fewer word wraps, and row heights are generally shorter.
* **Challenge (Vertical Space):** With only $\approx 450\text{ px}$ usable height, a table with 6 tall rows cannot fit on one page.
* **Solution Already in Engine:**
  * When row 4 overflows, rows 1–3 stay on Page 1, and rows 4–6 move to Page 2.
  * When repaginated later, `_mergeAdjacentTableContinuations` (lines 577–670) seamlessly merges `_p1` and `_p2` back into a unified table before re-splitting, ensuring no rows are lost or duplicated.

---

### 3.6 PDF Export Parity (`pdfExport.js`)

In [`pdfExport.js`](frontend/src/components/Unified/UnifiedTextEditor/utils/pdfExport.js):
* `getPageDimensionsMm(paperSize, orientation)` already returns `{ width: 297, height: 210 }` for landscape A4.
* However, lines 201–203 previously did:
  ```javascript
  const canvasAspect = canvas.width / canvas.height;
  const pdfWidthMm = widthMm;
  const pdfHeightMm = pdfWidthMm / canvasAspect;
  ```
  When the screen page was square ($297\text{ mm} \times 297\text{ mm}$), `canvasAspect` was 1.0, forcing the PDF to render as a non-standard 297x297 square.
* **With true landscape dimensions ($297\text{ mm} \times 210\text{ mm}$):**
  * `canvas.width / canvas.height` will be $\approx 1.414$ (exact $\sqrt{2}$ A4 ratio).
  * `pdfHeightMm` becomes exactly $210\text{ mm}$.
  * The PDF will match the editor screen **pixel-for-pixel**, with identical line breaks, table splits, and page counts.

---

## 4. Comprehensive Implementation Roadmap

### Phase 1: CSS & Metric Synchronization
1. **Edit `frontend/src/components/Unified/UnifiedTextEditor/styles/EditorCore.css`**:
   - Update `.page.landscape.a4` and `.document-renderer .page.landscape.a4` to:
     `width: 297mm; min-height: 210mm; max-height: 210mm;`
   - Update `.page.landscape.letter` to:
     `width: 11in; min-height: 8.5in; max-height: 8.5in;`
   - Update `.page.landscape.legal` to:
     `width: 14in; min-height: 8.5in; max-height: 8.5in;`
2. **Edit `frontend/src/styles/Editor/modules/editorOverrides.css`**:
   - Verify `.page.a4.landscape` is `width: 297mm; height: 210mm;`.

### Phase 2: Engine Height & Usable Space Synchronization
1. **Edit `frontend/src/components/Editor/DocumentEngineClass.js`**:
   - In `configureLayoutFromElement()` (lines 54–58), make `totalPaperHeight` orientation-aware:
     ```javascript
     const isLandscape = orientation === 'landscape';
     let totalPaperHeight = isLandscape ? 794 : 1123;
     if (paperSize === 'letter') totalPaperHeight = isLandscape ? 816 : 1056;
     else if (paperSize === 'legal') totalPaperHeight = isLandscape ? 816 : 1344;
     ```
   - In `getUsableHeightForPage()` (lines 677–681), apply the exact same orientation check using `this.getPageOrientationForPage(pageIndex)`.
2. **Edit `frontend/src/components/Unified/UnifiedTextEditor/hooks/usePageManagement.js`**:
   - In `getContentHeight(page)`, ensure the fallback height checks orientation:
     ```javascript
     const isLandscape = page?.classList?.contains('landscape') || orientation === 'landscape';
     let pageHeight = pageRect.height;
     if (!pageHeight || pageHeight <= 0) {
       if ((paperSize || "").toLowerCase() === "letter") pageHeight = isLandscape ? 816 : 1056;
       else if ((paperSize || "").toLowerCase() === "legal") pageHeight = isLandscape ? 816 : 1344;
       else pageHeight = isLandscape ? 794 : 1123;
     }
     ```

### Phase 3: Defensive Safeguards in Paginator
1. In `_layoutBlocksIntoPages()` in `DocumentEngineClass.js`:
   - Add a loop guard (`iterationCount > 500`) to guarantee an abnormal oversized block never freezes the browser.
   - Ensure that if a single table row is taller than `usableHeightPx`, it is accommodated on a single page without cyclic repagination.

### Phase 4: Systematic Verification & Testing
1. **Portrait Regression Test:** Open an existing portrait document; verify page dimensions, table rendering, page breaks, and PDF download remain 100% unaltered.
2. **Landscape Text Typing & Overflow Test:** Fill a landscape page with text; verify text smoothly cuts and wraps onto Page 2 at $210\text{ mm}$.
3. **Landscape Backspace Test:** Position cursor at start of Page 2, press Backspace; verify clean merge into Page 1.
4. **Landscape Page Break Test:** Insert `Ctrl + Enter`; verify new page spawns at $210\text{ mm}$ height.
5. **Landscape Table Splitting Test:** Insert an 8-row table; verify clean split across Page 1 and Page 2 with headers preserved.
6. **PDF Download Parity Test:** Export landscape document to PDF; verify exported pages are $297\text{ mm} \times 210\text{ mm}$ with zero clipping or extra blank pages.

---

## 5. Summary of Affected Files

| File | Changes Needed | Risk Level |
| :--- | :--- | :--- |
| `frontend/src/components/Unified/UnifiedTextEditor/styles/EditorCore.css` | Update `.page.landscape.*` heights from `297mm`/`11in` to `210mm`/`8.5in` | Very Low |
| `frontend/src/components/Editor/DocumentEngineClass.js` | Swap `totalPaperHeight` for landscape in `configureLayoutFromElement` and `getUsableHeightForPage` | Low |
| `frontend/src/components/Unified/UnifiedTextEditor/hooks/usePageManagement.js` | Update `getContentHeight` fallback height for landscape | Very Low |
| `frontend/src/components/Unified/UnifiedTextEditor/utils/pdfExport.js` | Verify canvas-to-PDF ratio matches $297\times 210\text{ mm}$ | Low |

Portrait mode is completely unaffected because every height calculation is gated by `isLandscape`.
