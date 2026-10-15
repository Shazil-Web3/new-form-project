import { useCallback } from "react";
import { handleKeyDown } from "./collaboration/Toolbar";
import { v4 as uuidv4 } from 'uuid';

// Template locking utility functions
export const useApplyTemplateLocking = (templateData, editorRef) => {
  return useCallback(() => {
    if (!templateData?.template_structure?.locked_elements || !editorRef.current) return;

    const lockedElements = templateData.template_structure.locked_elements;
    const editor = editorRef.current;

    // Lock TOC elements (headings)
    if (lockedElements.toc) {
      const headingElements = editor.querySelectorAll('.template-heading, h1, h2, h3, h4, h5, h6');
      headingElements.forEach(element => {
        element.contentEditable = false;
        element.style.cursor = 'not-allowed';
        element.style.opacity = '0.7';
        element.setAttribute('data-locked', 'true');
      });
    }

    // Lock content elements
    if (lockedElements.content) {
      const contentElements = editor.querySelectorAll('.template-content');
      contentElements.forEach(element => {
        // Check if element has template-editable class or contains editable children
        const hasEditableChildren = element.querySelectorAll('.template-editable').length > 0;
        
        if (!hasEditableChildren) {
          element.contentEditable = false;
          element.style.cursor = 'not-allowed';
          element.style.opacity = '0.7';
          element.setAttribute('data-locked', 'true');
        } else {
          // Make parent non-editable but allow editing of editable children
          element.contentEditable = false;
          element.setAttribute('data-locked', 'partial');
          
          // Enable editing for template-editable children
          const editableChildren = element.querySelectorAll('.template-editable');
          editableChildren.forEach(child => {
            child.contentEditable = true;
            child.style.cursor = 'text';
            child.style.opacity = '1';
            child.removeAttribute('data-locked');
          });
        }
      });
    }
  }, [templateData]);
};

// Custom key down handler that respects template locking
export const useHandleTemplateAwareKeyDown = (templateData, editorRef) => {
  return useCallback((e) => {
    if (!templateData?.template_structure?.locked_elements) {
      return handleKeyDown(e);
    }

    const lockedElements = templateData.template_structure.locked_elements;
    const target = e.target;
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    // Check if we're trying to edit locked content
    if (lockedElements.content) {
      let currentElement = range ? range.commonAncestorContainer : target;
      
      // Traverse up to find if we're in a locked element
      while (currentElement && currentElement !== editorRef.current) {
        if (currentElement.nodeType === Node.ELEMENT_NODE) {
          const element = currentElement;
          
          // If we're in a locked template-content that's not editable
          if (element.classList?.contains('template-content') && 
              element.getAttribute('data-locked') === 'true') {
            e.preventDefault();
            return;
          }
          
          // If we're in a partially locked template-content
          if (element.classList?.contains('template-content') && 
              element.getAttribute('data-locked') === 'partial') {
            // Check if we're inside a template-editable element
            let isInEditable = false;
            let checkElement = range ? range.commonAncestorContainer : target;
            
            while (checkElement && checkElement !== element) {
              if (checkElement.nodeType === Node.ELEMENT_NODE && 
                  checkElement.classList?.contains('template-editable')) {
                isInEditable = true;
                break;
              }
              checkElement = checkElement.parentNode;
            }
            
            if (!isInEditable) {
              e.preventDefault();
              return;
            }
          }
        }
        currentElement = currentElement.parentNode;
      }
    }

    // Check if we're trying to edit locked TOC elements
    if (lockedElements.toc) {
      let currentElement = range ? range.commonAncestorContainer : target;
      
      while (currentElement && currentElement !== editorRef.current) {
        if (currentElement.nodeType === Node.ELEMENT_NODE) {
          const element = currentElement;
          
          if ((element.classList?.contains('template-heading') || 
               ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) &&
              element.getAttribute('data-locked') === 'true') {
            e.preventDefault();
            return;
          }
        }
        currentElement = currentElement.parentNode;
      }
    }

    // If we reach here, editing is allowed
    return handleKeyDown(e);
  }, [templateData, handleKeyDown]);
};

// Prevent pasting into locked elements
export const useHandleTemplatePaste = (templateData, editorRef) => {
  return useCallback((e) => {
    if (!templateData?.template_structure?.locked_elements) return;

    const lockedElements = templateData.template_structure.locked_elements;
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    
    if (!range) return;

    let currentElement = range.commonAncestorContainer;
    
    // Check for locked content
    if (lockedElements.content) {
      while (currentElement && currentElement !== editorRef.current) {
        if (currentElement.nodeType === Node.ELEMENT_NODE) {
          const element = currentElement;
          
          if (element.classList?.contains('template-content') && 
              element.getAttribute('data-locked') === 'true') {
            e.preventDefault();
            return;
          }
          
          if (element.classList?.contains('template-content') && 
              element.getAttribute('data-locked') === 'partial') {
            // Check if we're inside a template-editable element
            let isInEditable = false;
            let checkElement = range.commonAncestorContainer;
            
            while (checkElement && checkElement !== element) {
              if (checkElement.nodeType === Node.ELEMENT_NODE && 
                  checkElement.classList?.contains('template-editable')) {
                isInEditable = true;
                break;
              }
              checkElement = checkElement.parentNode;
            }
            
            if (!isInEditable) {
              e.preventDefault();
              return;
            }
          }
        }
        currentElement = currentElement.parentNode;
      }
    }

    // Check for locked TOC elements
    if (lockedElements.toc) {
      currentElement = range.commonAncestorContainer;
      
      while (currentElement && currentElement !== editorRef.current) {
        if (currentElement.nodeType === Node.ELEMENT_NODE) {
          const element = currentElement;
          
          if ((element.classList?.contains('template-heading') || 
               ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) &&
              element.getAttribute('data-locked') === 'true') {
            e.preventDefault();
            return;
          }
        }
        currentElement = currentElement.parentNode;
      }
    }
  }, [templateData]);
};

// Debounced text change handler
export const useHandleTextChange = (editorRef, setIsTyping, socket, docId, updateTOCRef, realignFloatingItemsRef) => {
  return useCallback(() => {
    if (editorRef.current) {
      setIsTyping(true);
      const newContent = editorRef.current.innerHTML;

      // Emit the updated content to the server
      socket.emit("textChange", { docId, content: newContent });

      // Update TOC without overwriting the DOM
      updateTOCRef.current();
      
      // Add realignment after content changes
      setTimeout(() => realignFloatingItemsRef.current(), 50);
      
      // Reset typing state after a delay
      const typingTimer = setTimeout(() => setIsTyping(false), 500);
      return () => clearTimeout(typingTimer);
    }
  }, [docId]);
};

// Handle cursor movement
export const useHandleCursorMove = (editorRef, socket, docId, userName) => {
  return useCallback(() => {
    if (editorRef.current) {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      const cursorPosition = range.startOffset;
      const parentElement = range.startContainer.parentNode; 

      socket.emit("cursorMove", {
        docId,
        userId: socket.id,
        cursorPosition,
        parentId: parentElement ? parentElement.id : null,
        userName
      });
    }
  }, [docId, userName]);
};

// Handle selection change for floating buttons
export const useHandleSelectionChange = (editorRef, templateData, setFloatingButtonPosition, setShowFloatingButton) => {
  return useCallback(() => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed && editorRef.current) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();

      if (!rect || rect.top === 0) return;

      // Check if selection is in a locked area
      let isInLockedArea = false;
      if (templateData?.template_structure?.locked_elements) {
        const lockedElements = templateData.template_structure.locked_elements;
        let currentElement = range.commonAncestorContainer;
        
        while (currentElement && currentElement !== editorRef.current) {
          if (currentElement.nodeType === Node.ELEMENT_NODE) {
            const element = currentElement;
            
            // Check for locked content
            if (lockedElements.content && 
                element.classList?.contains('template-content') && 
                element.getAttribute('data-locked') === 'true') {
              isInLockedArea = true;
              break;
            }
            
            // Check for locked TOC
            if (lockedElements.toc && 
                ((element.classList?.contains('template-heading') || 
                  ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) &&
                 element.getAttribute('data-locked') === 'true')) {
              isInLockedArea = true;
              break;
            }
          }
          currentElement = currentElement.parentNode;
        }
      }

      if (!isInLockedArea) {
        const position = {
          top: rect.top - editorRect.top + editorRef.current.scrollTop,
          left: rect.right - editorRect.left + editorRef.current.scrollLeft + 30,
        };

        setFloatingButtonPosition({
          top: position.top,
          left: position.left
        });
        setShowFloatingButton(true);
      } else {
        setShowFloatingButton(false);
      }
    } else {
      setShowFloatingButton(false);
    }
  }, [templateData]);
};

// Handle adding a comment with range storing
export const useHandleAddComment = (editorRef, storeSelectedRange, setCommentPosition, setIsCommenting) => {
  return useCallback(() => {
    const selection = window.getSelection();
    if (!selection.rangeCount || !editorRef.current) return;

    // Store the selected range for highlighting
    if (storeSelectedRange()) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();

      if (!rect || rect.top === 0) return;

      const position = {
        top: rect.top - editorRect.top + editorRef.current.scrollTop,
        selectedText: selection.toString(),
        blockId: range.startContainer.nodeType === Node.TEXT_NODE 
          ? range.startContainer.parentElement?.closest('[data-block-id]')?.getAttribute('data-block-id') || null
          : range.startContainer?.closest('[data-block-id]')?.getAttribute('data-block-id') || null,
      };

      setCommentPosition(position);
      setIsCommenting(true);
    }
  }, [setCommentPosition, setIsCommenting, storeSelectedRange]);
};

// Handle submitting a comment
export const useHandleSubmitComment = (addFloatingElement, userName, commentText, commentPosition, adjustItemPositionsRef, realignFloatingItemsRef) => {
  return useCallback(() => {
    addFloatingElement("comment", userName, commentText, commentPosition);
    // Adjust positions after adding element
    setTimeout(() => {
      adjustItemPositionsRef.current();
      realignFloatingItemsRef.current(); // Add realignment after adding comment
    }, 50);
  }, [addFloatingElement, userName, commentText, commentPosition]);
};

// Handle adding a suggested edit with range storing
export const useHandleAddSuggestEdit = (editorRef, storeSelectedRange, setSuggestEditPosition, setIsSuggestingEdit) => {
  return useCallback(() => {
    const selection = window.getSelection();
    if (!selection.rangeCount || !editorRef.current) return;

    // Store the selected range for highlighting
    if (storeSelectedRange()) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();

      if (!rect || rect.top === 0) return;

      const position = {
        top: rect.top - editorRect.top + editorRef.current.scrollTop,
        selectedText: selection.toString(),
        blockId: range.startContainer.nodeType === Node.TEXT_NODE 
          ? range.startContainer.parentElement?.closest('[data-block-id]')?.getAttribute('data-block-id') || null
          : range.startContainer?.closest('[data-block-id]')?.getAttribute('data-block-id') || null,
      };

      setSuggestEditPosition(position);
      setIsSuggestingEdit(true);
    }
  }, [setSuggestEditPosition, setIsSuggestingEdit, storeSelectedRange]);
};

// Handle submitting a suggested edit
export const useHandleSubmitSuggestEdit = (addFloatingElement, userName, suggestEditText, suggestEditPosition, adjustItemPositionsRef, realignFloatingItemsRef) => {
  return useCallback(() => {
    addFloatingElement("suggestededit", userName, suggestEditText, suggestEditPosition);
    // Adjust positions after adding element
    setTimeout(() => {
      adjustItemPositionsRef.current();
      realignFloatingItemsRef.current(); // Add realignment after adding suggestion
    }, 50);
  }, [addFloatingElement, userName, suggestEditText, suggestEditPosition]);
};

// Handle editor click
export const useHandleEditorClick = (clearHighlight) => {
  return useCallback((e) => {
    if (!e.target.closest(".floating-comment, .floating-suggestededit")) {
      clearHighlight();
    }
  }, [clearHighlight]);
};

// ToggleLock System Utility Functions

// Toggle lock for specific blocks
export const useToggleSectionLock = (pages, setPages) => {
  return useCallback((pageId, blockId) => {
    setPages(prevPages =>
      prevPages.map(page => {
        if (page.id !== pageId) return page;
        return {
          ...page,
          content: page.content.map(block =>
            block.id === blockId
              ? {...block, locked: !block.locked}
              : block
          )
        };
      })
    );
  }, []);
};

// Handle making selected text editable/locked (ToggleLock functionality)
export const useHandleToggleLock = (pages, setPages) => {
  return useCallback(() => {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) return;

    // Find the page and block IDs
    let containerNode = range.commonAncestorContainer;
    if (containerNode.nodeType === Node.TEXT_NODE) {
      containerNode = containerNode.parentNode;
    }

    const pageWrapper = containerNode.closest('.page-wrapper');
    if (!pageWrapper) return;
    const pageId = pageWrapper.getAttribute('data-page-id');

    const existingBlockElement = containerNode.closest('[data-block-id]');
    const existingBlockId = existingBlockElement?.getAttribute('data-block-id');
    if (!existingBlockId) return;

    setPages((prevPages) =>
      prevPages.map((page) => {
        if (page.id !== pageId) return page;

        const newContent = [];
        for (const block of page.content) {
          if (block.id !== existingBlockId) {
            newContent.push(block);
            continue;
          }

          // Split the block text around the selection
          const blockText = block.content;
          const selectionStart = blockText.indexOf(selectedText);
          if (selectionStart === -1) {
            newContent.push(block);
            continue;
          }
          const selectionEnd = selectionStart + selectedText.length;

          const beforeText = blockText.slice(0, selectionStart);
          const selectedPart = blockText.slice(selectionStart, selectionEnd);
          const afterText = blockText.slice(selectionEnd);

          // Add before part if not empty
          if (beforeText) {
            newContent.push({
              id: uuidv4(),
              content: beforeText,
              locked: false,
            });
          }

          // Toggle lock for selected part
          const isCurrentlyLocked = block.locked && blockText === selectedPart;
          newContent.push({
            id: uuidv4(),
            content: selectedPart,
            locked: !isCurrentlyLocked,
          });

          // Add after part if not empty
          if (afterText) {
            newContent.push({
              id: uuidv4(),
              content: afterText,
              locked: false,
            });
          }
        }

        return {...page, content: newContent};
      })
    );

    // Clear selection
    selection.removeAllRanges();
  }, []);
};