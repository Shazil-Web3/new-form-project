/**
 * VideoResizeHandler.js
 * Dedicated standalone handler for video block selection, 8-corner/edge resizing, alignment, and deletion.
 */

export class VideoResizeHandler {
  constructor(pagesContainerRef, callbacks = {}) {
    this.pagesContainerRef = pagesContainerRef;
    this.callbacks = callbacks;
    this.activeResize = null;
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Helper to attach 8 resize handles (4 corners + 4 edges) to a video figure
   */
  static attachResizeHandles(figureEl) {
    if (!figureEl || figureEl.querySelector(".video-resize-handle")) return;

    const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    directions.forEach((dir) => {
      const handle = document.createElement("span");
      handle.className = "video-resize-handle";
      handle.setAttribute("data-resize", dir);
      figureEl.appendChild(handle);
    });
  }

  /**
   * Deselect all video blocks within the container
   */
  deselectAllVideos() {
    const root = this.pagesContainerRef?.current;
    if (!root) return;
    const selectedVideos = root.querySelectorAll("figure.video-block.selected");
    selectedVideos.forEach((v) => v.classList.remove("selected"));
  }

  /**
   * Main event listener setup
   */
  setupEventListeners() {
    const root = this.pagesContainerRef?.current;
    if (!root) return () => {};

    const handleMouseDown = (e) => {
      const handle = e.target.closest?.(".video-resize-handle");
      const fig = e.target.closest?.("figure.video-block");

      // 1. CLICK ON RESIZE HANDLE -> START DRAG RESIZE
      if (handle && fig) {
        e.preventDefault();
        e.stopPropagation();

        const direction = handle.getAttribute("data-resize") || "se";
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = fig.getBoundingClientRect();
        const startW = rect.width || fig.offsetWidth || 480;
        const startH = rect.height || fig.offsetHeight || 320;
        const aspectRatio = startW / startH || (16 / 9);
        const MIN_W = 140;
        const MIN_H = 90;

        fig.classList.add("selected", "resizing");
        document.body.classList.add("video-resizing-active");
        document.body.style.cursor = getComputedStyle(handle).cursor;

        // Create temporary overlay mask to swallow all pointer events during drag (prevents iframe flicker)
        const mask = document.createElement("div");
        mask.style.position = "fixed";
        mask.style.top = "0";
        mask.style.left = "0";
        mask.style.width = "100vw";
        mask.style.height = "100vh";
        mask.style.zIndex = "999999";
        mask.style.cursor = getComputedStyle(handle).cursor;
        document.body.appendChild(mask);

        const onMouseMove = (moveEvt) => {
          moveEvt.preventDefault();
          const dx = moveEvt.clientX - startX;
          const dy = moveEvt.clientY - startY;

          let newW = startW;
          let newH = startH;

          switch (direction) {
            // CORNERS (nw, ne, se, sw)
            case "se":
              newW = Math.max(MIN_W, startW + dx);
              newH = Math.max(MIN_H, Math.round(newW / aspectRatio));
              break;
            case "sw":
              newW = Math.max(MIN_W, startW - dx);
              newH = Math.max(MIN_H, Math.round(newW / aspectRatio));
              break;
            case "ne":
              newW = Math.max(MIN_W, startW + dx);
              newH = Math.max(MIN_H, Math.round(newW / aspectRatio));
              break;
            case "nw":
              newW = Math.max(MIN_W, startW - dx);
              newH = Math.max(MIN_H, Math.round(newW / aspectRatio));
              break;

            // EDGES (e, w, s, n)
            case "e":
              newW = Math.max(MIN_W, startW + dx);
              break;
            case "w":
              newW = Math.max(MIN_W, startW - dx);
              break;
            case "s":
              newH = Math.max(MIN_H, startH + dy);
              break;
            case "n":
              newH = Math.max(MIN_H, startH - dy);
              break;
            default:
              newW = Math.max(MIN_W, startW + dx);
              newH = Math.max(MIN_H, Math.round(newW / aspectRatio));
          }

          // Container boundary limit
          const pageContainer = fig.closest(".page-content");
          if (pageContainer) {
            const maxW = pageContainer.clientWidth - 16;
            if (newW > maxW) {
              newW = maxW;
              if (["se", "sw", "ne", "nw"].includes(direction)) {
                newH = Math.max(MIN_H, Math.round(newW / aspectRatio));
              }
            }
          }

          // Apply dimensions directly to DOM without reflow flickering
          fig.style.width = `${newW}px`;
          fig.style.height = `${newH}px`;
          fig.style.maxWidth = "100%";

          const wrapper = fig.querySelector(".video-wrapper");
          if (wrapper) {
            wrapper.style.width = "100%";
            wrapper.style.height = "100%";
          }
        };

        const onMouseUp = () => {
          document.body.classList.remove("video-resizing-active");
          document.body.style.cursor = "";
          fig.classList.remove("resizing");
          if (mask && mask.parentNode) {
            mask.parentNode.removeChild(mask);
          }

          const blockId = fig.getAttribute("data-block-id");
          const engine = this.callbacks.documentEngineRef?.current;
          if (engine && blockId) {
            const blk = engine.getBlock(blockId);
            const currentW = parseInt(fig.style.width, 10) || fig.offsetWidth;
            const currentH = parseInt(fig.style.height, 10) || fig.offsetHeight;
            if (blk) {
              let data = {};
              try {
                data = typeof blk.content === "object" ? blk.content : JSON.parse(blk.content || "{}");
              } catch (e) {}
              data.width = currentW;
              data.height = currentH;
              engine.updateBlock(blockId, {
                content: JSON.stringify(data),
                metadata: { ...blk.metadata, width: currentW, height: currentH }
              });
            }
          }

          // Persist and trigger callbacks after drag release
          this.callbacks.syncDOMToBlocksSync?.();
          this.callbacks.schedulePaginate?.();
          this.callbacks.syncAndNotify?.();

          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return;
      }

      // 2. CLICK ON VIDEO BLOCK -> SELECT IT
      if (fig) {
        const isMediaEl = e.target.closest?.("video, iframe, .video-wrapper");
        if (isMediaEl) {
          e.stopPropagation();
        }
        this.deselectAllVideos();
        fig.classList.add("selected");
        return;
      }

      // 3. CLICK OUTSIDE -> DESELECT
      if (!e.target.closest?.("figure.video-block")) {
        this.deselectAllVideos();
      }
    };

    const handleMediaClick = (e) => {
      const mediaEl = e.target.closest?.("video, iframe, .video-wrapper");
      if (mediaEl) {
        e.stopPropagation();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        const selectedFig = root.querySelector("figure.video-block.selected");
        if (selectedFig) {
          e.preventDefault();
          this.callbacks.pushToUndo?.();
          let targetCaret = selectedFig.previousElementSibling || selectedFig.nextElementSibling;
          selectedFig.remove();
          if (targetCaret && targetCaret.hasAttribute("data-block-id")) {
            const r = document.createRange();
            r.selectNodeContents(targetCaret);
            r.collapse(false);
            const s = window.getSelection();
            s?.removeAllRanges();
            s?.addRange(r);
          }
          this.callbacks.syncDOMToBlocksSync?.();
          this.callbacks.schedulePaginate?.();
          this.callbacks.syncAndNotify?.();
        }
      } else if (e.key === "Escape") {
        this.deselectAllVideos();
      }
    };

    root.addEventListener("mousedown", handleMouseDown);
    root.addEventListener("click", handleMediaClick);
    root.addEventListener("pointerdown", handleMediaClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      root.removeEventListener("mousedown", handleMouseDown);
      root.removeEventListener("click", handleMediaClick);
      root.removeEventListener("pointerdown", handleMediaClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }
}

export default VideoResizeHandler;
