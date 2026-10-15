// components/Editor/ImagePasteHandler.js
import { BLOCK_TYPES } from './DocumentEngine';

/**
 * ImagePasteHandler - Google Docs-style image pasting functionality
 * Handles clipboard image pasting, image selection, deletion, and resizing
 */
export class ImagePasteHandler {
  constructor(documentEngine, editorRef) {
    this.documentEngine = documentEngine;
    this.editorRef = editorRef;
    this.isImageItem = (item) => 
      item && item.kind === "file" && /^image\//i.test(item.type);
  }

  /**
   * Handle image pasting from clipboard
   */
  async handleImagePaste(evt, targetContentEl) {
    const dt = evt.clipboardData || evt.originalEvent?.clipboardData;
    if (!dt) return false;

    let imageProcessed = false;

    // Only handle direct image files from clipboard (screenshots, copied images)
    // Do NOT handle HTML clipboard data containing images, as that should be
    // processed by the PasteHandler to maintain text content alongside images
    const imgItem = Array.from(dt.items || []).find(this.isImageItem);
    if (imgItem) {
      const file = imgItem.getAsFile();
      if (file) {
        evt.preventDefault(); // Only prevent default for direct image files
        const objectURL = URL.createObjectURL(file);

        // Get natural dimensions
        const dims = await this.getImageDimensions(objectURL);

        // Insert image at current selection
        await this.insertImageAtSelection(
          { src: objectURL, ...dims, alt: file.name || "" }, 
          targetContentEl
        );
        imageProcessed = true;
      }
    }

    // Do NOT process HTML clipboard data here - let PasteHandler handle it
    // This is the key fix: when HTML contains both text and images,
    // we let the PasteHandler process everything together

    return imageProcessed; // Return true only if a direct image file was processed
  }

  /**
   * Get image dimensions asynchronously
   */
  getImageDimensions(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        resolve({ 
          width: img.naturalWidth, 
          height: img.naturalHeight 
        });
      };
      img.onerror = () => {
        resolve({ width: 300, height: 200 }); // fallback dimensions
      };
      img.src = src;
    });
  }

  /**
   * Insert image at current selection, splitting paragraph if needed
   */
  async insertImageAtSelection({ src, width, height, alt }, targetContentEl) {
    const engine = this.documentEngine;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    let el = range.startContainer.nodeType === 1
      ? range.startContainer
      : range.startContainer.parentElement;
    
    const blockEl = el?.closest?.("[data-block-id]");
    const pg = engine.getCurrentPage();

    // If no text block exists, create one
    if (!blockEl) {
      const firstHost = targetContentEl || this.getActivePageContent() || this.ensureOnePage()?.querySelector(".page-content");
      if (firstHost && !firstHost.querySelector("[data-block-id]")) {
        const b0 = engine.createBlock(BLOCK_TYPES.PARAGRAPH, "");
        engine.addBlock(b0);
        const p0 = document.createElement("p");
        p0.setAttribute("data-block-id", b0.id);
        p0.contentEditable = "true";
        firstHost.appendChild(p0);
        const r0 = document.createRange();
        r0.setStart(p0, 0);
        r0.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r0);
        el = p0;
      }
    }

    const activeBlockEl = el?.closest?.("[data-block-id]");
    let beforeText = "", afterText = "";
    let insertIndex = pg.blocks.length;

    if (activeBlockEl) {
      const blockId = activeBlockEl.getAttribute("data-block-id");
      const block = engine.getBlock(blockId);
      const fullText = activeBlockEl.textContent ?? "";

      // Get caret position within the block
      const rPre = document.createRange();
      rPre.selectNodeContents(activeBlockEl);
      rPre.setEnd(range.startContainer, range.startOffset);
      const caretPos = rPre.toString().length;

      beforeText = fullText.slice(0, caretPos);
      afterText = fullText.slice(caretPos);

      const idx = pg.blocks.findIndex((b) => b.id === blockId);
      insertIndex = Math.max(0, idx + 1);

      // Split paragraph in engine
      engine.updateBlock(blockId, { content: beforeText });
      if (afterText.length) {
        const rightBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, afterText);
        engine.addBlock(rightBlock, insertIndex);
        insertIndex += 1;
      }

      // Split in DOM
      activeBlockEl.textContent = beforeText;
      if (afterText.length) {
        const rightEl = document.createElement("p");
        const rightId = pg.blocks[insertIndex - 1].id;
        rightEl.setAttribute("data-block-id", rightId);
        rightEl.contentEditable = "true";
        rightEl.textContent = afterText;
        activeBlockEl.parentElement.insertBefore(rightEl, activeBlockEl.nextSibling);
      }
    }

    // Create image block in engine
    const imgBlock = engine.createImageBlock ? 
      engine.createImageBlock(src, width, height, alt) : 
      this.createImageBlock(src, width, height, alt);
    engine.addBlock(imgBlock, insertIndex);

    // Create DOM node (figure)
    const fig = this.createImageFigure(imgBlock, src, width, height, alt);

    // Insert figure into DOM
    const host = targetContentEl || activeBlockEl?.parentElement || this.getActivePageContent();
    const refNode = host?.querySelector(`[data-block-id="${pg.blocks[insertIndex - 1]?.id}"]`);
    if (refNode && refNode.nextSibling) {
      host.insertBefore(fig, refNode.nextSibling);
    } else {
      host?.appendChild(fig);
    }

    // Place caret AFTER the image (new empty paragraph like Docs)
    const afterPara = document.createElement("p");
    const afterBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, "");
    engine.addBlock(afterBlock, insertIndex + 1);
    afterPara.setAttribute("data-block-id", afterBlock.id);
    afterPara.contentEditable = "true";
    fig.parentElement.insertBefore(afterPara, fig.nextSibling);

    // Store the paragraph after the image for cursor positioning
    this._lastInsertedBlockId = afterBlock.id;

    const r = document.createRange();
    r.setStart(afterPara, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);

    // Trigger pagination and sync
    this.schedulePaginate?.();
    this.syncAndNotify?.();
  }

  /**
   * Create image block for the engine
   */
  createImageBlock(src, width, height, alt = "") {
    const imageData = { src, width, height, alt };
    return {
      id: this.generateId(),
      type: BLOCK_TYPES.IMAGE,
      content: JSON.stringify(imageData),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Create image figure element for DOM
   */
  createImageFigure(imgBlock, src, width, height, alt) {
    const fig = document.createElement("figure");
    fig.className = "img-block";
    fig.setAttribute("data-block-id", imgBlock.id);
    fig.setAttribute("data-type", "image");
    const align = imgBlock.metadata?.align || 'left';
    
    fig.setAttribute("data-align", align);
    fig.setAttribute("contenteditable", "false");

    const img = document.createElement("img");
    img.src = src;
    img.alt = alt || "";
    if (width) img.width = width;
    if (height) img.height = height;
    img.draggable = false;

    fig.appendChild(img);

    // Add all 8 resize handles (4 corners + 4 edges)
    const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    directions.forEach(dir => {
      const handle = document.createElement("span");
      handle.className = "img-resize-handle";
      handle.setAttribute("data-resize", dir);
      fig.appendChild(handle);
    });

    return fig;
  }

  /**
   * Handle image selection (click to select)
   */
  handleImageSelection(e) {
    const fig = e.target.closest?.("figure.img-block");
    
    // If clicking on an image, select it
    if (fig) {
      // Remove previous selection (don't paginate during selection change to avoid double pagination)
      this.deselectAllImages(false);
      
      fig.classList.add("selected");
      // Move selection to the figure (so Backspace works)
      const r = document.createRange();
      r.selectNode(fig);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      e.preventDefault();
    } else {
      // If clicking elsewhere, deselect all images with pagination enabled
      this.deselectAllImages(true);
    }
  }

  /**
   * Deselect all images
   */
  deselectAllImages(shouldPaginate = true) {
    const root = this.editorRef?.current;
    if (root) {
      const selectedImgs = root.querySelectorAll("figure.img-block.selected");
      if (selectedImgs.length > 0) {
        selectedImgs.forEach(n => n.classList.remove("selected"));
        if (shouldPaginate) {
          this.schedulePaginate?.();
        }
      }
    }
  }

  /**
   * Handle image deletion (Backspace/Delete)
   */
  handleImageDeletion(event) {
    if (event.key !== "Backspace" && event.key !== "Delete") return false;

    const sel = window.getSelection?.();
    const node = sel?.rangeCount ? sel.getRangeAt(0).startContainer : null;
    const fig = (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.("figure.img-block.selected")
      || document.querySelector("figure.img-block.selected");

    if (!fig) return false;

    event.preventDefault();
    const id = fig.getAttribute("data-block-id");
    const engine = this.documentEngine;
    const pg = engine.getCurrentPage();
    const idx = pg.blocks.findIndex(b => b.id === id);
    
    if (idx !== -1) {
      pg.blocks.splice(idx, 1); // Remove block from engine
    }

    // Place caret in a safe spot: previous paragraph or create one
    let caretHost = fig.previousElementSibling;
    if (!caretHost || !caretHost.hasAttribute("data-block-id")) {
      const p = document.createElement("p");
      const b = engine.createBlock(BLOCK_TYPES.PARAGRAPH, "");
      engine.addBlock(b, Math.max(0, idx));
      p.setAttribute("data-block-id", b.id);
      p.contentEditable = "true";
      fig.parentElement.insertBefore(p, fig);
      caretHost = p;
    }
    
    fig.remove();

    const r = document.createRange();
    r.selectNodeContents(caretHost);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);

    this.schedulePaginate?.();
    this.syncAndNotify?.();
    return true;
  }

  /**
   * Handle image resizing — pure dimension change only.
   * The CSS alignment (data-align) keeps the image anchored correctly:
   *   left-aligned  → left edge stays fixed
   *   center-aligned → center stays fixed
   *   right-aligned  → right edge stays fixed
   */
  handleImageResize(e) {
    const handle = e.target.closest?.(".img-resize-handle");
    if (!handle) return;

    const fig = handle.closest("figure.img-block");
    const img = fig?.querySelector("img");
    if (!fig || !img) return;

    e.preventDefault();
    e.stopPropagation();

    const direction = handle.getAttribute("data-resize") || "se";
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = img.width || img.naturalWidth || 300;
    const startH = img.height || img.naturalHeight || 200;
    const aspectRatio = startW / startH;
    const MIN_SIZE = 32;

    fig.classList.add("selected", "resizing");
    document.body.style.userSelect = "none";
    document.body.style.cursor = getComputedStyle(handle).cursor;

    const onMove = (moveEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let newW = startW;
      let newH = startH;

      // Directions that grow when dragging right/down use +dx/+dy,
      // directions that grow when dragging left/up use -dx/-dy.
      switch (direction) {
        case 'se': case 'e': case 'ne':
          newW = Math.max(MIN_SIZE, startW + dx);
          newH = Math.round(newW / aspectRatio);
          break;
        case 'sw': case 'w': case 'nw':
          newW = Math.max(MIN_SIZE, startW - dx);
          newH = Math.round(newW / aspectRatio);
          break;
        case 's':
          newH = Math.max(MIN_SIZE, startH + dy);
          newW = Math.round(newH * aspectRatio);
          break;
        case 'n':
          newH = Math.max(MIN_SIZE, startH - dy);
          newW = Math.round(newH * aspectRatio);
          break;
        default:
          newW = Math.max(MIN_SIZE, startW + dx);
          newH = Math.round(newW / aspectRatio);
      }

      // Clamp to container width
      const container = fig.closest(".page-content");
      if (container) {
        const maxW = container.clientWidth - 4;
        if (newW > maxW) {
          newW = maxW;
          newH = Math.round(newW / aspectRatio);
        }
      }

      img.width = newW;
      img.height = newH;
      img.setAttribute("width", newW);
      img.setAttribute("height", newH);
      img.style.width = newW + "px";
      img.style.height = newH + "px";
    };

    const onUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      fig.classList.remove("resizing");

      // Persist size to engine
      const id = fig.getAttribute("data-block-id");
      const engine = this.documentEngine;
      const blk = engine.getBlock(id);
      if (blk && blk.type === BLOCK_TYPES.IMAGE) {
        let data;
        try {
          data = JSON.parse(blk.content || "{}");
        } catch (e) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = blk.content || '';
          const imgEl = tempDiv.querySelector('img');
          data = {
            src: imgEl?.src || '',
            width: imgEl?.width || img.width,
            height: imgEl?.height || img.height,
            alt: imgEl?.alt || '',
            align: imgEl?.getAttribute('data-align') || imgEl?.dataset?.align || blk.metadata?.align || 'left'
          };
        }
        
        data.width = img.width;
        data.height = img.height;
        engine.updateBlock(id, { 
          content: JSON.stringify(data),
          metadata: { ...blk.metadata, width: data.width, height: data.height }
        });
        this.syncAndNotify?.();
        this.schedulePaginate?.();
      }

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /**
   * Handle drag-to-reposition: user clicks on a selected image and
   * drags it horizontally to change its alignment (left / center / right).
   */
  handleImageDrag(e) {
    const fig = e.target.closest?.("figure.img-block");
    if (!fig) return;

    const container = fig.closest(".page-content");
    if (!container) return;

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const containerRect = container.getBoundingClientRect();
    let isDragging = false;
    let finalAlign = fig.getAttribute("data-align") || "left";

    fig.classList.add("dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor = "move";

    const onMove = (moveEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startX;

      // Only enter drag mode after a small threshold
      if (!isDragging && Math.abs(dx) < 5) return;
      isDragging = true;

      fig.style.transform = `translateX(${dx}px)`;

      // Determine which third of the page the image center is in
      const figRect = fig.getBoundingClientRect();
      const centerX = figRect.left + figRect.width / 2;
      const relativeCenter = (centerX - containerRect.left) / containerRect.width;

      if (relativeCenter < 0.33) {
        finalAlign = "left";
      } else if (relativeCenter > 0.67) {
        finalAlign = "right";
      } else {
        finalAlign = "center";
      }
      
      fig.setAttribute("data-drag-zone", finalAlign);
    };

    const onUp = () => {
      fig.classList.remove("dragging");
      fig.removeAttribute("data-drag-zone");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";

      if (isDragging) {
        // Set final alignment from the zone we determined during move
        fig.setAttribute("data-align", finalAlign);
        // Clear transform AFTER setting alignment so it stays in place
        fig.style.transform = "";

        // Persist alignment to engine
        const id = fig.getAttribute("data-block-id");
        const engine = this.documentEngine;
        const blk = engine.getBlock(id);
        if (blk) {
          let data;
          try { 
            data = JSON.parse(blk.content || "{}"); 
          } catch (e) { 
            // Fallback if content was raw src or HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = blk.content || '';
            const imgEl = tempDiv.querySelector('img');
            data = { 
              src: imgEl?.src || blk.content, 
              width: imgEl?.width || blk.metadata?.width, 
              height: imgEl?.height || blk.metadata?.height,
              align: imgEl?.getAttribute('data-align') || imgEl?.dataset?.align || blk.metadata?.align || 'left'
            };
          }
          data.align = finalAlign;
          engine.updateBlock(id, { 
            content: JSON.stringify(data),
            metadata: { ...blk.metadata, align: finalAlign, width: data.width, height: data.height }
          });
          
          // Force immediate sync to ensure state is captured before any re-renders
          this.syncAndNotify?.();
          this.schedulePaginate?.();
        }
      } else {
        fig.style.transform = "";
      }

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /**
   * Setup event listeners for image interactions.
   * Uses a single root mousedown handler to route to the correct action.
   */
  setupImageEventListeners() {
    const root = this.editorRef?.current;
    if (!root) return;

    // Single unified handler for all image mousedown interactions
    const handleRootMouseDown = (e) => {
      const handle = e.target.closest?.(".img-resize-handle");
      const fig = e.target.closest?.("figure.img-block");

      // 1. Click on a resize handle → resize
      if (handle) {
        this.handleImageResize(e);
        return;
      }

      // 2. Click on an image figure
      if (fig) {
        const wasAlreadySelected = fig.classList.contains("selected");

        // Always select it
        this.deselectAllImages(false);
        fig.classList.add("selected");

        // Move selection to figure (for Backspace/Delete)
        const r = document.createRange();
        r.selectNode(fig);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        e.preventDefault();

        // If it was already selected, start drag-to-reposition
        if (wasAlreadySelected) {
          this.handleImageDrag(e);
        }
        return;
      }

      // 3. Click outside any image → deselect
      // (only within the editor root, not the whole document)
    };
    root.addEventListener("mousedown", handleRootMouseDown);

    // Deselect when clicking outside images
    const handleDocumentClick = (e) => {
      if (!e.target.closest?.("figure.img-block")) {
        setTimeout(() => this.deselectAllImages(true), 10);
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);

    // Deselect on Escape
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.deselectAllImages(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // Refocus listener to ensure reflow after returning to the editor
    const handleFocus = () => {
      this.schedulePaginate?.();
    };
    root.addEventListener("focus", handleFocus, true);

    return () => {
      root.removeEventListener("mousedown", handleRootMouseDown);
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
      root.removeEventListener("focus", handleFocus, true);
    };
  }

  /**
   * Helper methods (to be provided by the editor)
   */
  getActivePageContent() {
    // This should be provided by the editor
    return this.editorRef?.current?.querySelector(".page-content");
  }

  ensureOnePage() {
    // This should be provided by the editor
    return this.editorRef?.current?.querySelector(".page");
  }

  generateId() {
    // Simple ID generator - replace with your preferred method
    return 'img_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Update image block in engine with new dimensions
   */
  updateImageBlock(blockId, newData) {
    const engine = this.documentEngine;
    const block = engine.getBlock(blockId);
    if (block && block.type === 'image') {
      let currentData;
      try {
        // Try to parse as JSON first (new format)
        currentData = JSON.parse(block.content || '{}');
      } catch (e) {
        // Fallback to old HTML format - extract src from img tag
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = block.content || '';
        const imgEl = tempDiv.querySelector('img');
        currentData = {
          src: imgEl?.src || '',
          width: imgEl?.width || 0,
          height: imgEl?.height || 0,
          alt: imgEl?.alt || '',
          align: imgEl?.getAttribute('data-align') || imgEl?.dataset?.align || block.metadata?.align || 'left'
        };
      }
      
      const updatedData = { ...currentData, ...newData };
      engine.updateBlock(blockId, { content: JSON.stringify(updatedData) });
    }
  }

  /**
   * Migrate old HTML format image blocks to new JSON format
   */
  migrateOldImageBlocks() {
    const engine = this.documentEngine;
    const allBlocks = engine.getAllBlocks();
    
    allBlocks.forEach(block => {
      if (block.type === BLOCK_TYPES.IMAGE && block.content && block.content.startsWith('<img')) {
        // This is an old HTML format image block, convert it
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = block.content;
        const imgEl = tempDiv.querySelector('img');
        
        if (imgEl) {
          const imageData = {
            src: imgEl.src || '',
            width: imgEl.width || imgEl.getAttribute('width') || 0,
            height: imgEl.height || imgEl.getAttribute('height') || 0,
            alt: imgEl.alt || '',
            align: imgEl.getAttribute('data-align') || imgEl.dataset?.align || block.metadata?.align || 'left'
          };
          
          // Update the block with new JSON format
          engine.updateBlock(block.id, { 
            content: JSON.stringify(imageData),
            metadata: {
              ...block.metadata,
              updatedAt: new Date().toISOString()
            }
          });
        }
      }
    });
  }

  /**
   * Set callbacks from the editor
   */
  setCallbacks({ schedulePaginate, syncAndNotify }) {
    this.schedulePaginate = schedulePaginate;
    this.syncAndNotify = syncAndNotify;
  }
  
  /**
   * Get the ID of the last inserted block for cursor positioning
   */
  getLastInsertedBlockId() {
    return this._lastInsertedBlockId;
  }
  
  /**
   * Clear the last inserted block ID
   */
  clearLastInsertedBlockId() {
    this._lastInsertedBlockId = null;
  }
}

export default ImagePasteHandler;