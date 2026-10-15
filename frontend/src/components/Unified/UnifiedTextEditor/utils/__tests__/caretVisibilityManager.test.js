import {
  CaretVisibilityManager,
  createCaretVisibilityManager,
  measureCaretRect,
} from "../caretVisibilityManager";

describe("CaretVisibilityManager", () => {
  let scrollContainer;
  let pagesContainer;
  let page1, page2, page3;
  let manager;

  beforeEach(() => {
    // Set up DOM structure mimicking UnifiedTextEditor
    scrollContainer = document.createElement("div");
    scrollContainer.className = "editor-container";
    Object.defineProperty(scrollContainer, "clientHeight", { value: 600, configurable: true });
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 3000, configurable: true });
    scrollContainer.scrollTop = 0;

    scrollContainer.getBoundingClientRect = () => ({
      top: 100,
      bottom: 700,
      left: 0,
      right: 800,
      width: 800,
      height: 600,
    });

    pagesContainer = document.createElement("div");
    pagesContainer.className = "document-renderer";
    scrollContainer.appendChild(pagesContainer);

    page1 = document.createElement("div");
    page1.className = "page page-1";
    const content1 = document.createElement("div");
    content1.className = "page-content";
    const p1 = document.createElement("p");
    p1.setAttribute("data-block-id", "block-1");
    p1.textContent = "Hello page 1";
    content1.appendChild(p1);
    page1.appendChild(content1);

    page2 = document.createElement("div");
    page2.className = "page page-2";
    const content2 = document.createElement("div");
    content2.className = "page-content";
    const p2 = document.createElement("p");
    p2.setAttribute("data-block-id", "block-2");
    p2.textContent = "Hello page 2";
    content2.appendChild(p2);
    page2.appendChild(content2);

    page3 = document.createElement("div");
    page3.className = "page page-3";
    const content3 = document.createElement("div");
    content3.className = "page-content";
    const p3 = document.createElement("p");
    p3.setAttribute("data-block-id", "block-3");
    p3.textContent = "Hello page 3";
    content3.appendChild(p3);
    page3.appendChild(content3);

    pagesContainer.appendChild(page1);
    pagesContainer.appendChild(page2);
    pagesContainer.appendChild(page3);

    document.body.appendChild(scrollContainer);

    manager = createCaretVisibilityManager({
      getPagesContainer: () => pagesContainer,
      topMargin: 60,
      bottomMargin: 80,
      smoothThreshold: 150,
    });
  });

  afterEach(() => {
    manager.destroy();
    document.body.innerHTML = "";
    delete window.isProgrammaticScroll;
    delete window.isUserScrollingEditor;
  });

  test("CASE 1: If caret is comfortably visible, do not scroll", () => {
    // Caret is at top: 300, bottom: 320 (comfortably between topMargin 160 and bottomMargin 620)
    const mockRange = {
      collapsed: true,
      getBoundingClientRect: () => ({
        top: 300,
        bottom: 320,
        left: 50,
        right: 50,
        width: 0,
        height: 20,
      }),
      getClientRects: () => [],
      startContainer: page1.querySelector("p").firstChild,
      endContainer: page1.querySelector("p").firstChild,
      startOffset: 0,
      endOffset: 0,
    };

    window.getSelection = () => ({
      rangeCount: 1,
      anchorNode: mockRange.startContainer,
      focusNode: mockRange.startContainer,
      focusOffset: 0,
      getRangeAt: () => mockRange,
    });

    const scrolled = manager.ensureCaretVisible();
    expect(scrolled).toBe(false);
    expect(scrollContainer.scrollTop).toBe(0);
  });

  test("CASE 2: Pressing Enter near bottom scrolls only the minimum required amount", () => {
    // Viewport is top: 100, bottom: 700. Bottom margin is 80 => allowedBottom = 620.
    // Caret is at top: 630, bottom: 650 (exceeds allowedBottom by 30px).
    const mockRange = {
      collapsed: true,
      getBoundingClientRect: () => ({
        top: 630,
        bottom: 650,
        left: 50,
        right: 50,
        width: 0,
        height: 20,
      }),
      getClientRects: () => [],
      startContainer: page1.querySelector("p").firstChild,
      endContainer: page1.querySelector("p").firstChild,
      startOffset: 0,
      endOffset: 0,
    };

    window.getSelection = () => ({
      rangeCount: 1,
      anchorNode: mockRange.startContainer,
      focusNode: mockRange.startContainer,
      focusOffset: 0,
      getRangeAt: () => mockRange,
    });

    const scrolled = manager.ensureCaretVisible();
    expect(scrolled).toBe(true);
    // Delta = 650 - 620 = 30px. Minimum scroll! Does NOT center caret (which would be ~300px).
    expect(scrollContainer.scrollTop).toBe(30);
  });

  test("CASE 3: Consecutive typing at bottom incrementally scrolls with minimum delta", () => {
    // Caret moves down another 24px: bottom is now 644 (relative to current scrollTop 30, it was 674)
    scrollContainer.scrollTop = 30;

    const mockRange = {
      collapsed: true,
      getBoundingClientRect: () => ({
        top: 624,
        bottom: 644,
        left: 50,
        right: 50,
        width: 0,
        height: 20,
      }),
      getClientRects: () => [],
      startContainer: page2.querySelector("p").firstChild,
      endContainer: page2.querySelector("p").firstChild,
      startOffset: 0,
      endOffset: 0,
    };

    window.getSelection = () => ({
      rangeCount: 1,
      anchorNode: mockRange.startContainer,
      focusNode: mockRange.startContainer,
      focusOffset: 0,
      getRangeAt: () => mockRange,
    });

    const scrolled = manager.ensureCaretVisible();
    expect(scrolled).toBe(true);
    // Delta = 644 - 620 = 24px. New scrollTop = 30 + 24 = 54px.
    expect(scrollContainer.scrollTop).toBe(54);
  });

  test("CASE 5 & 6: User manually scrolls away, then edits on Page 3", () => {
    // Caret is on Page 3 (say bottom is 1600px in document, viewport is at Page 1 where scrollTop = 0).
    // Viewport top: 100, bottom: 700.
    // Caret client top: 1580, bottom: 1600.
    const p3Node = page3.querySelector("p").firstChild;
    const mockRange = {
      collapsed: true,
      getBoundingClientRect: () => ({
        top: 1580,
        bottom: 1600,
        left: 50,
        right: 50,
        width: 0,
        height: 20,
      }),
      getClientRects: () => [],
      startContainer: p3Node,
      endContainer: p3Node,
      startOffset: 0,
      endOffset: 0,
    };

    window.getSelection = () => ({
      rangeCount: 1,
      anchorNode: p3Node,
      focusNode: p3Node,
      focusOffset: 0,
      getRangeAt: () => mockRange,
    });

    // 1. User manual scroll flag was set earlier:
    window.isUserScrollingEditor = true;

    // 2. User edits (e.g. presses Enter on Page 3):
    manager.onEditingAction("enter");

    // onEditingAction must have cleared the manual scroll lock:
    expect(window.isUserScrollingEditor).toBe(false);

    // 3. Distance is large (1600 - 620 = 980px > 150px smoothThreshold), so it uses smooth scroll
    scrollContainer.scrollTo = jest.fn();
    manager.ensureCaretVisible();

    expect(scrollContainer.scrollTo).toHaveBeenCalledWith({
      top: 980,
      behavior: "smooth",
    });
    expect(window.isProgrammaticScroll).toBe(true);
  });

  test("Interruption: Manual wheel or touch cancels programmatic scroll immediately", () => {
    manager.markProgrammaticScroll(true);
    expect(window.isProgrammaticScroll).toBe(true);

    // User spins mouse wheel:
    window.dispatchEvent(new Event("wheel"));
    expect(window.isProgrammaticScroll).toBe(false);
  });

  test("Caret above top margin scrolls up by minimum required delta", () => {
    // Current scrollTop = 500.
    // Allowed top is containerRect.top (100) + topMargin (60) = 160.
    // Caret top is at 130 (30px above allowed top).
    scrollContainer.scrollTop = 500;

    const p1Node = page1.querySelector("p").firstChild;
    const mockRange = {
      collapsed: true,
      getBoundingClientRect: () => ({
        top: 130,
        bottom: 150,
        left: 50,
        right: 50,
        width: 0,
        height: 20,
      }),
      getClientRects: () => [],
      startContainer: p1Node,
      endContainer: p1Node,
      startOffset: 0,
      endOffset: 0,
    };

    window.getSelection = () => ({
      rangeCount: 1,
      anchorNode: p1Node,
      focusNode: p1Node,
      focusOffset: 0,
      getRangeAt: () => mockRange,
    });

    const scrolled = manager.ensureCaretVisible();
    expect(scrolled).toBe(true);
    // Delta = 130 - 160 = -30. New scrollTop = 500 - 30 = 470.
    expect(scrollContainer.scrollTop).toBe(470);
  });

  test("Window-level scrolling when editor-container is not overflowing", () => {
    Object.defineProperty(scrollContainer, "clientHeight", { value: 3000, configurable: true });
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 3000, configurable: true });
    Object.defineProperty(document.documentElement, "clientHeight", { value: 800, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 4000, configurable: true });
    window.innerHeight = 800;
    window.scrollY = 0;
    window.scrollTo = jest.fn();

    const p3Node = page3.querySelector("p").firstChild;
    const mockRange = {
      collapsed: true,
      getBoundingClientRect: () => ({
        top: 850,
        bottom: 870,
        left: 50,
        right: 50,
        width: 0,
        height: 20,
      }),
      getClientRects: () => [],
      startContainer: p3Node,
      endContainer: p3Node,
      startOffset: 0,
      endOffset: 0,
    };

    window.getSelection = () => ({
      rangeCount: 1,
      anchorNode: p3Node,
      focusNode: p3Node,
      focusOffset: 0,
      getRangeAt: () => mockRange,
    });

    const scrolled = manager.ensureCaretVisible();
    expect(scrolled).toBe(true);
    // Viewport bottom = 800. Margin = 80 => allowedBottom = 720.
    // Caret bottom = 870. Delta = 870 - 720 = 150.
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({
      top: 150,
    }));
  });

  test("CASE 8: Caret on empty block with void <br> correctly measures and triggers scroll", () => {
    // Create an empty paragraph with a BR element
    const emptyP = document.createElement("p");
    emptyP.setAttribute("data-block-id", "block-empty");
    const br = document.createElement("br");
    emptyP.appendChild(br);
    page3.querySelector(".page-content").appendChild(emptyP);

    emptyP.getBoundingClientRect = () => ({
      top: 850,
      bottom: 874,
      left: 50,
      right: 50,
      width: 0,
      height: 24,
    });

    // Range positioned inside the BR (edge-case created by browser Enter)
    const mockRange = {
      collapsed: true,
      getBoundingClientRect: () => ({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
      }),
      getClientRects: () => [],
      startContainer: br,
      endContainer: br,
      startOffset: 0,
      endOffset: 0,
    };

    window.getSelection = () => ({
      rangeCount: 1,
      anchorNode: br,
      focusNode: br,
      focusOffset: 0,
      getRangeAt: () => mockRange,
    });

    const scrolled = manager.ensureCaretVisible();
    expect(scrolled).toBe(true);
    expect(scrollContainer.scrollTop).toBeGreaterThan(0);
  });

  test("Manual scrolling freedom: ensureCaretVisible does NOT scroll if window.isUserScrollingEditor is true without isEditingAction", () => {
    // Caret is at top: 630, bottom: 650 (exceeds allowedBottom by 30px)
    const mockRange = {
      collapsed: true,
      getBoundingClientRect: () => ({
        top: 630,
        bottom: 650,
        left: 50,
        right: 50,
        width: 0,
        height: 20,
      }),
      getClientRects: () => [],
      startContainer: page1.querySelector("p").firstChild,
      endContainer: page1.querySelector("p").firstChild,
      startOffset: 0,
      endOffset: 0,
    };

    window.getSelection = () => ({
      rangeCount: 1,
      anchorNode: mockRange.startContainer,
      focusNode: mockRange.startContainer,
      focusOffset: 0,
      getRangeAt: () => mockRange,
    });

    // User is actively scrolling manually:
    window.isUserScrollingEditor = true;

    // ensureCaretVisible must NOT scroll or fight the user:
    const scrolled = manager.ensureCaretVisible();
    expect(scrolled).toBe(false);
    expect(scrollContainer.scrollTop).toBe(0);
  });

  test("Interruption cancels needsEnsureCaret and pending RAF immediately", () => {
    manager.needsEnsureCaret = true;
    manager.pendingRAF = 12345;

    // User touches mouse wheel:
    window.dispatchEvent(new Event("wheel"));

    expect(manager.needsEnsureCaret).toBe(false);
    expect(manager.pendingRAF).toBeNull();
    expect(window.isUserScrollingEditor).toBe(true);
  });
});

