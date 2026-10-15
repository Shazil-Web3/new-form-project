import { useEffect } from 'react';
import axios from 'axios';
import { HTMLToBlocksParser } from '../PasteHandler';
import { BLOCK_TYPES } from '../DocumentEngineConstants';

export function useEditorSocketSync({
  docId,
  user,
  userName,
  socket,
  pagesContainerRef,
  documentEngineRef,
  setDocumentData,
  setUsers,
  setDepartments,
  setComments,
  setSuggestedEdits,
  setHeaderHTML,
  setFooterHTML,
  setTemplateUpdateNotice,
  setDocumentUpdateNotice,
  setLogo,
  setDocumentLoaded,
  documentLoaded,
  isPaginatingRef,
  clearPages,
  ensureOnePage,
  createPage,
  schedulePaginate,
  updateTOC,
  renderFreshFromEngine,
}) {
  // Load document with enhanced parsing
  useEffect(() => {
    const loadDocument = async () => {
      try {
        // Fetch document data
        const docResponse = await axios.get(`/api/documents/${docId}`);
        const docData = docResponse.data;
        if (setDocumentData) setDocumentData(docData);

        if (user?.id) {
          const usersResponse = await axios.get(`/api/org_members/${user.id}`);
          if (setUsers) setUsers(usersResponse.data);
        }
        
        if (user?.orgId) {
          const deptResponse = await axios.get(`/api/departments/${user.orgId}`);
          if (setDepartments) setDepartments(deptResponse.data);
        }

        // Initialize comments and suggestions from document data if available
        if (docData?.elements) {
          try {
            const elements = typeof docData.elements === 'string' ? JSON.parse(docData.elements) : docData.elements;
            if (elements.comments && setComments) setComments(elements.comments);
            if (elements.suggestedEdits && setSuggestedEdits) setSuggestedEdits(elements.suggestedEdits);
            if (elements.headerHTML && setHeaderHTML) setHeaderHTML(elements.headerHTML);
            if (elements.footerHTML && setFooterHTML) setFooterHTML(elements.footerHTML);
          } catch (e) {
            console.error("Error parsing document elements:", e);
          }
        }

        // Check if a newer version of the template is available
        try {
          const noticeRes = await axios.get(`/api/template-update-notice/${docId}`);
          if (noticeRes.data?.hasNewerVersion && setTemplateUpdateNotice) {
            setTemplateUpdateNotice(noticeRes.data);
          }
        } catch (e) {
          // Non-critical — silently ignore
          console.warn('Could not check template update notice:', e);
        }

        // Check if a newer version of the document is available (revisions)
        try {
          const docNoticeRes = await axios.get(`/api/document-update-notice/${docId}`);
          if (docNoticeRes.data?.hasNewerVersion && setDocumentUpdateNotice) {
            setDocumentUpdateNotice(docNoticeRes.data);
          }
        } catch (e) {
          console.warn('Could not check document update notice:', e);
        }

        if (socket) {
          socket.emit("joinDocument", { docId, userId: socket.id, userName });

          // Listen for document elements from socket
          socket.on("loadDocElements", ({ comments, suggestedEdits, headerHTML: h, footerHTML: f }) => {
            console.log('[Editor] Loaded elements from socket:', { 
              commentsCount: comments?.length, 
              suggestionsCount: suggestedEdits?.length,
              hasHeader: !!h,
              hasFooter: !!f
            });
            if (comments && setComments) setComments(comments);
            if (suggestedEdits && setSuggestedEdits) setSuggestedEdits(suggestedEdits);
            if (h !== undefined && setHeaderHTML) setHeaderHTML(h || "");
            if (f !== undefined && setFooterHTML) setFooterHTML(f || "");
          });

          socket.on("receiveDocElements", ({ comment, suggestededit }) => {
            if (comment && setComments) {
              setComments(prev => {
                const exists = prev.some(c => c.id === comment.id);
                return exists ? prev : [...prev, comment];
              });
            }
            if (suggestededit && setSuggestedEdits) {
              setSuggestedEdits(prev => {
                const exists = prev.some(s => s.id === suggestededit.id);
                return exists ? prev : [...prev, suggestededit];
              });
            }
          });

          socket.on("commentRemoved", ({ commentId }) => {
            if (setComments) setComments(prev => prev.filter(c => c.id !== commentId));
          });

          socket.on("suggestedEditRemoved", ({ suggestededitId }) => {
            if (setSuggestedEdits) setSuggestedEdits(prev => prev.filter(s => s.id !== suggestededitId));
          });

          socket.on("documentAccessDenied", ({ docId: deniedDocId, error }) => {
            console.warn(`[Editor] Access denied for document ${deniedDocId}:`, error);
          });

          socket.on("documentError", ({ docId: errDocId, error }) => {
            console.error(`[Editor] Error on document ${errDocId}:`, error);
          });

          socket.on("loadDocument", ({ content, blocks }) => {
            if (pagesContainerRef.current) {
              const documentEngine = documentEngineRef.current;
              
              // Check for localStorage backup if server content is empty
              let hasContent = false;
              let backupData = null;
              
              if ((!blocks || blocks.length === 0) && (!content || (typeof content === 'string' && (content.trim() === '{}' || content.trim() === '')))) {
                try {
                  const backup = localStorage.getItem(`doc_backup_${docId}`);
                  if (backup) {
                    backupData = JSON.parse(backup);
                    // Only use backup if it's recent (within 1 hour)
                    if (Date.now() - backupData.timestamp < 3600000) {
                      console.log('Loading document from localStorage backup');
                      hasContent = true;
                    }
                  }
                } catch (e) {
                  console.warn('Failed to load backup from localStorage:', e);
                }
              }
              
              // If we have structured blocks, use them
              if (blocks && blocks.length > 0) {
                hasContent = true;
                // Clear existing blocks
                documentEngine.document.pages = [{ id: 'page1', blocks: [] }];
                
                // Add blocks from server
                blocks.forEach(block => {
                  documentEngine.addBlock(block);
                });
              } else if ((typeof content === 'string' && content.trim() !== '{}' && content.trim() !== '') || (content && typeof content === 'object' && content.content)) {
                const htmlToParse = typeof content === 'string' ? content : content.content;
                const logoData = (content && typeof content === 'object') ? content.logo : null;
                if (logoData && setLogo) setLogo(logoData);
                hasContent = true;
                // Parse existing HTML
                const parser = new HTMLToBlocksParser(documentEngine);
                const parsedBlocks = parser.parseHTML(htmlToParse);
                
                // Clear existing blocks and add parsed ones
                documentEngine.document.pages = [{ id: 'page1', blocks: [] }];
                parsedBlocks.forEach(block => {
                  documentEngine.addBlock(block);
                });
              } else if (backupData && hasContent) {
                // Use backup data
                if (backupData.blocks && backupData.blocks.length > 0) {
                  documentEngine.document.pages = [{ id: 'page1', blocks: [] }];
                  backupData.blocks.forEach(block => {
                    documentEngine.addBlock(block);
                  });
                } else if (backupData.content) {
                  const parser = new HTMLToBlocksParser(documentEngine);
                  const parsedBlocks = parser.parseHTML(backupData.content);
                  documentEngine.document.pages = [{ id: 'page1', blocks: [] }];
                  parsedBlocks.forEach(block => {
                    documentEngine.addBlock(block);
                  });
                }
              }
              
              // If still no content, add initial paragraph
              if (!hasContent) {
                documentEngine.document.pages = [{ id: 'page1', blocks: [] }];
                documentEngine.addBlock(
                  documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, '')
                );
              }

              // Render into the first page-content
              clearPages?.();
              const firstPage = ensureOnePage?.();
              if (firstPage) {
                const firstContent = firstPage.querySelector(".page-content");
                firstContent.innerHTML = documentEngine.toHTML();
                
                // Configure layout and paginate using the new system
                if (documentEngine.configureLayoutFromElement && documentEngine.repaginate) {
                  documentEngine.configureLayoutFromElement(firstContent);
                  documentEngine.repaginate(firstContent);
                  
                  // Update the DOM with the paginated content
                  const pages = documentEngine.document.pages;
                  clearPages?.();
                  
                  pages.forEach((page, index) => {
                    const pageEl = createPage?.(index + 1);
                    if (pageEl) {
                      const pageContent = pageEl.querySelector('.page-content');
                      pageContent.innerHTML = page.blocks.map(block => documentEngine.blockToHTML(block)).join('');
                      pagesContainerRef.current?.appendChild(pageEl);
                    }
                  });
                } else {
                  // Fallback to old pagination method
                  setTimeout(() => schedulePaginate?.(), 0);
                }
              }
              
              updateTOC?.();
              if (setDocumentLoaded) setDocumentLoaded(true);
            }
          });
        }
      } catch (error) {
        console.error('Error loading document:', error);
      }
    };

    loadDocument();

    return () => {
      if (socket) {
        socket.off("loadDocument");
      }
    };
  }, [docId, user?.id, user?.orgId, userName, updateTOC, socket]);

  // Safety net: Re-render from engine if the DOM was cleared by a React re-render
  // but ONLY if we are not in the middle of a transition.
  useEffect(() => {
    if (documentLoaded && pagesContainerRef.current && pagesContainerRef.current.children.length === 0 && !isPaginatingRef?.current) {
      console.log('[Editor] Container empty but document loaded, re-rendering from engine...');
      renderFreshFromEngine?.();
    }
  }, [documentLoaded, renderFreshFromEngine, isPaginatingRef, pagesContainerRef]);

  // Handle document updates from other users
  useEffect(() => {
    if (!socket) return;

    const handleUpdateDocument = ({ content, blocks }) => {
      if (window.isResizingTable) {
        console.log('[Editor] Collaborative update ignored during table resize');
        return;
      }
      const ae = document.activeElement;
      const editing = !!ae?.closest?.('.page-content');
      if (pagesContainerRef.current && !editing) {
        const documentEngine = documentEngineRef.current;
        
        // Update with structured blocks if available
        if (blocks && blocks.length > 0) {
          documentEngine.getCurrentPage().blocks = [];
          blocks.forEach(block => {
            documentEngine.addBlock(block);
          });
        } else if (content && typeof content === 'string') {
          // Fallback to HTML parsing
          const parser = new HTMLToBlocksParser(documentEngine);
          const parsedBlocks = parser.parseHTML(content);
          
          documentEngine.getCurrentPage().blocks = [];
          parsedBlocks.forEach(block => {
            documentEngine.addBlock(block);
          });
        }

        // Update the first page content using new pagination
        const firstPage = pagesContainerRef.current?.querySelector('.page .page-content');
        if (firstPage && documentEngine.configureLayoutFromElement && documentEngine.repaginate) {
          documentEngine.configureLayoutFromElement(firstPage);
          documentEngine.repaginate(firstPage);
          
          // Update the DOM with the paginated content
          const pages = documentEngine.document.pages;
          clearPages?.();
          
          pages.forEach((page, index) => {
            const pageEl = createPage?.(index + 1);
            if (pageEl) {
              const pageContent = pageEl.querySelector('.page-content');
              pageContent.innerHTML = page.blocks.map(block => documentEngine.blockToHTML(block)).join('');
              pagesContainerRef.current?.appendChild(pageEl);
            }
          });
        } else {
          // Fallback to old pagination method
          renderFreshFromEngine?.();
        }
        
        updateTOC?.();
      }
    };

    socket.on("updateDocument", handleUpdateDocument);

    return () => {
      socket.off("updateDocument", handleUpdateDocument);
    };
  }, [updateTOC, renderFreshFromEngine, socket, clearPages, createPage, documentEngineRef, pagesContainerRef]);
}

export default useEditorSocketSync;
