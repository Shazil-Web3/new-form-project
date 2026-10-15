const { assertUserDocumentAccess } = require('../documents/documentHelpers');

module.exports = function registerDocumentCollaboration(socket, { io, pool }) {
  socket.on("joinDocument", async ({ docId }) => {
    try {
      const userId = socket.user?.userId;
      if (!userId || !docId) {
        socket.emit("documentAccessDenied", { docId, error: "Authentication or document ID missing" });
        return;
      }

      // Authorize document access BEFORE joining room or retrieving data
      const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
      if (!isAuthorized) {
        console.warn(`🔒 Access denied: User ${userId} attempted to access unauthorized document ${docId}`);
        socket.emit("documentAccessDenied", { docId, error: "Access denied to document" });
        return;
      }

      // ONLY AFTER authorization: Join room
      socket.join(docId);

      // Fetch document content from database
      const [documents] = await pool.execute(
        'SELECT content, elements, structured_data FROM documents WHERE document_id = ?',
        [docId]
      );

      if (documents.length > 0) {
        const documentData = documents[0];
        const content = JSON.parse(documentData.content || '{}');
        const elements = JSON.parse(documentData.elements || '{}');
        const structuredData = JSON.parse(documentData.structured_data || '{"pages": [{"id": "page1", "blocks": []}]}');

        // Send both legacy content and structured data
        socket.emit("loadDocument", {
          content,
          blocks: structuredData.pages[0]?.blocks || [],
          document: structuredData
        });

        socket.emit("loadDocElements", {
          comments: elements.comments || [],
          suggestedEdits: elements.suggestedEdits || [],
          headerHTML: elements.headerHTML || '',
          footerHTML: elements.footerHTML || '',
          logo: elements.logo || null,
          logoText: elements.logoText || '',
          logoTextRight: elements.logoTextRight || ''
        });
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      socket.emit("documentError", { docId, error: "Failed to load document" });
    }
  });


  socket.on("textChange", async ({ docId, content, blocks, document, headerHTML, footerHTML, logo, logoText, logoTextRight }) => {
    try {
      if (!docId) return;

      const userId = socket.user?.userId;
      if (!userId) {
        socket.emit("documentAccessDenied", { docId, error: "Unauthenticated" });
        return;
      }

      // Template editor special case
      if (docId !== "template-editor") {
        const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
        if (!isAuthorized) {
          console.warn(`🔒 Access denied: User ${userId} attempted unauthorized textChange on document ${docId}`);
          socket.emit("documentAccessDenied", { docId, error: "Unauthorized document edit" });
          return;
        }
      }

      const pages = document?.pages || [{ id: 'page1', blocks: blocks || [] }];

      const structuredData = {
        pages,
        updatedAt: new Date().toISOString()
      };

      // Fetch existing elements to preserve comments/suggestions
      const [existingDocs] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let elements = {};
      if (existingDocs.length > 0 && existingDocs[0].elements) {
        try {
          elements = typeof existingDocs[0].elements === 'string' ? JSON.parse(existingDocs[0].elements) : existingDocs[0].elements;
        } catch (e) {
          console.error('Error parsing existing elements:', e);
        }
      }

      // Merge header/footer/logo if provided
      if (headerHTML !== undefined) elements.headerHTML = headerHTML;
      if (footerHTML !== undefined) elements.footerHTML = footerHTML;
      if (logo !== undefined) elements.logo = logo;
      if (logoText !== undefined) elements.logoText = logoText;
      if (logoTextRight !== undefined) elements.logoTextRight = logoTextRight;

      // Update content, structured_data, and elements
      await pool.execute(
        'UPDATE documents SET content = ?, structured_data = ?, elements = ? WHERE document_id = ?',
        [JSON.stringify(content), JSON.stringify(structuredData), JSON.stringify(elements), docId]
      );

      // Emit the changes to all clients in the document room
      io.to(docId).emit("updateDocument", {
        content,
        blocks: blocks || [],
        document: structuredData,
        headerHTML,
        footerHTML,
        logo: elements.logo,
        logoText: elements.logoText,
        logoTextRight: elements.logoTextRight
      });

      console.log(`Document content changed:
      - Document ID: ${docId}
      - Content Length: ${JSON.stringify(content).length} characters
      - Blocks Count: ${blocks ? blocks.length : 0}
      - Pages Count: ${pages.length}
      - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error updating document content:', error);
    }
  });

  socket.on("addDocElements", async (data) => {
    try {
      const { docId, comment, suggestededit } = data;
      if (!docId) return;

      const userId = socket.user?.userId;
      if (!userId) {
        socket.emit("documentAccessDenied", { docId, error: "Unauthenticated" });
        return;
      }

      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        if (comment) {
          io.to(docId).emit("receiveDocElements", { comment });
          console.log(`New template comment added: 
            - Comment ID: ${comment.id}
            - Author: ${comment.author || comment.user}
            - Timestamp: ${new Date().toISOString()}`);
        }

        if (suggestededit) {
          io.to(docId).emit("receiveDocElements", { suggestededit });
          console.log(`New template suggested edit added: 
            - Suggested Edit ID: ${suggestededit.id}
            - Author: ${suggestededit.author || suggestededit.user}
            - Timestamp: ${new Date().toISOString()}`);
        }
        return;
      }

      // Verify document authorization
      const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
      if (!isAuthorized) {
        console.warn(`🔒 Access denied: User ${userId} attempted unauthorized addDocElements on document ${docId}`);
        socket.emit("documentAccessDenied", { docId, error: "Unauthorized document edit" });
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      // Add new element
      if (comment) {
        currentElements.comments = currentElements.comments || [];
        currentElements.comments.push(comment);
      }

      if (suggestededit) {
        currentElements.suggestedEdits = currentElements.suggestedEdits || [];
        currentElements.suggestedEdits.push(suggestededit);
      }

      // Update elements in database
      await pool.execute(
        'UPDATE documents SET elements = ? WHERE document_id = ?',
        [JSON.stringify(currentElements), docId]
      );

      // Emit to all clients in the document
      if (comment) {
        io.to(docId).emit("receiveDocElements", { comment });
        console.log(`New comment added: 
          - Document ID: ${docId}
          - Comment ID: ${comment.id}
          - Author: ${comment.author || comment.user}
          - Timestamp: ${new Date().toISOString()}`);
      }

      if (suggestededit) {
        io.to(docId).emit("receiveDocElements", { suggestededit });
        console.log(`New suggested edit added: 
          - Document ID: ${docId}
          - Suggested Edit ID: ${suggestededit.id}
          - Author: ${suggestededit.author || suggestededit.user}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error adding document elements:', error);
    }
  });

  socket.on("removeComment", async ({ docId, commentId }) => {
    try {
      if (!docId || !commentId) return;

      const userId = socket.user?.userId;
      if (!userId) return;

      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("commentRemoved", { commentId });
        console.log(`Template comment removed: 
          - Comment ID: ${commentId}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Verify document authorization
      const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
      if (!isAuthorized) {
        console.warn(`🔒 Access denied: User ${userId} attempted unauthorized removeComment on document ${docId}`);
        socket.emit("documentAccessDenied", { docId, error: "Unauthorized" });
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      // Remove comment
      const removedComments = currentElements.comments.filter(
        comment => comment.id === commentId
      );

      currentElements.comments = currentElements.comments.filter(
        comment => comment.id !== commentId
      );

      // Update elements in database
      await pool.execute(
        'UPDATE documents SET elements = ? WHERE document_id = ?',
        [JSON.stringify(currentElements), docId]
      );

      io.to(docId).emit("commentRemoved", { commentId });

      console.log(`Comment removed: 
        - Document ID: ${docId}
        - Comment ID: ${commentId}
        - Removed Comment Details: ${JSON.stringify(removedComments[0])}
        - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error removing comment:', error);
    }
  });

  socket.on("removeSuggestedEdit", async ({ docId, suggestededitId }) => {
    try {
      if (!docId || !suggestededitId) return;

      const userId = socket.user?.userId;
      if (!userId) return;

      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("suggestedEditRemoved", { suggestededitId });
        console.log(`Template suggested edit removed: 
          - Suggested Edit ID: ${suggestededitId}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Verify document authorization
      const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
      if (!isAuthorized) {
        console.warn(`🔒 Access denied: User ${userId} attempted unauthorized removeSuggestedEdit on document ${docId}`);
        socket.emit("documentAccessDenied", { docId, error: "Unauthorized" });
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const removedEdits = currentElements.suggestedEdits.filter(
        edit => edit.id === suggestededitId
      );

      currentElements.suggestedEdits = currentElements.suggestedEdits.filter(
        edit => edit.id !== suggestededitId
      );

      // Update elements in database
      await pool.execute(
        'UPDATE documents SET elements = ? WHERE document_id = ?',
        [JSON.stringify(currentElements), docId]
      );

      io.to(docId).emit("suggestedEditRemoved", { suggestededitId });

      console.log(`Suggested edit removed: 
        - Document ID: ${docId}
        - Suggested Edit ID: ${suggestededitId}
        - Removed Edit Details: ${JSON.stringify(removedEdits[0])}
        - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error removing Suggested edit:', error);
    }
  });

  socket.on("batchDeleteElements", async ({ docId, deletions }) => {
    try {
      if (!docId || !Array.isArray(deletions)) return;

      const userId = socket.user?.userId;
      if (!userId) return;

      // Verify document authorization
      const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
      if (!isAuthorized) {
        console.warn(`🔒 Access denied: User ${userId} attempted unauthorized batchDeleteElements on document ${docId}`);
        socket.emit("documentAccessDenied", { docId, error: "Unauthorized" });
        return;
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // 1. Fetch current document state
        const [documents] = await connection.execute(
          'SELECT elements FROM documents WHERE document_id = ?',
          [docId]
        );

        let currentElements = documents[0]?.elements
          ? JSON.parse(documents[0].elements)
          : { comments: [], suggestedEdits: [] };

        // 2. Process deletions
        const removalReport = {
          timestamp: new Date().toISOString(),
          docId,
          removedComments: [],
          removedEdits: []
        };

        deletions.forEach(({ type, id }) => {
          if (type === 'comment') {
            const comment = currentElements.comments.find(c => c.id === id);
            if (comment) {
              removalReport.removedComments.push({
                id,
                user: comment.user,
                text: comment.text,
                timestamp: comment.timestamp
              });
              currentElements.comments = currentElements.comments.filter(c => c.id !== id);
            }
          } else if (type === 'suggestededit') {
            const edit = currentElements.suggestedEdits.find(e => e.id === id);
            if (edit) {
              removalReport.removedEdits.push({
                id,
                user: edit.user,
                originalText: edit.selectedText,
                suggestedText: edit.text,
                timestamp: edit.timestamp
              });
              currentElements.suggestedEdits = currentElements.suggestedEdits.filter(e => e.id !== id);
            }
          }
        });

        // 3. Update database
        await connection.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(currentElements), docId]
        );

        await connection.commit();

        // 4. Notify clients and log
        removalReport.removedComments.forEach(({ id }) => {
          io.to(docId).emit("commentRemoved", { commentId: id });
        });

        removalReport.removedEdits.forEach(({ id }) => {
          io.to(docId).emit("suggestedEditRemoved", { suggestededitId: id });
        });

        console.log(`Batch deletion processed:
        - Document: ${docId}
        - Total Removals: ${deletions.length}
        - Comments Removed: ${removalReport.removedComments.length}
        - Edits Removed: ${removalReport.removedEdits.length}
        - Details: ${JSON.stringify(removalReport, null, 2)}`);

      } catch (error) {
        await connection.rollback();
        console.error('Batch deletion failed:', {
          docId,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      } finally {
        connection.release();
      }
    } catch (outerErr) {
      console.error('Error in batchDeleteElements:', outerErr);
    }
  });

  socket.on("updateCommentStatus", async ({ docId, commentId, status }) => {
    try {
      if (!docId || !commentId) return;

      const userId = socket.user?.userId;
      if (!userId) return;

      // Verify document authorization
      const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
      if (!isAuthorized) {
        console.warn(`🔒 Access denied: User ${userId} attempted unauthorized updateCommentStatus on document ${docId}`);
        socket.emit("documentAccessDenied", { docId, error: "Unauthorized" });
        return;
      }

      // Fetch current elements
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const commentIndex = currentElements.comments.findIndex(
        (comment) => comment.id === commentId
      );

      if (commentIndex !== -1) {
        const oldStatus = currentElements.comments[commentIndex].status;
        currentElements.comments[commentIndex].status = status;

        // Update elements in database
        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(currentElements), docId]
        );

        io.to(docId).emit("updateCommentStatus", { commentId, status });

        console.log(`Comment status updated: 
          - Document ID: ${docId}
          - Comment ID: ${commentId}
          - Old Status: ${oldStatus}
          - New Status: ${status}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error updating comment status:', error);
    }
  });

  socket.on("updateCommentReplies", async ({ docId, commentId, reply }) => {
    try {
      if (!docId || !commentId) return;

      const userId = socket.user?.userId;
      if (!userId) return;

      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("updateCommentReplies", { commentId, reply });
        console.log(`Template comment reply added: 
          - Comment ID: ${commentId}
          - Reply Author: ${reply.author || reply.user}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Verify document authorization
      const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
      if (!isAuthorized) {
        console.warn(`🔒 Access denied: User ${userId} attempted unauthorized updateCommentReplies on document ${docId}`);
        socket.emit("documentAccessDenied", { docId, error: "Unauthorized" });
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const commentIndex = currentElements.comments.findIndex(
        (comment) => comment.id === commentId
      );

      if (commentIndex !== -1) {
        if (!currentElements.comments[commentIndex].replies) {
          currentElements.comments[commentIndex].replies = [];
        }
        currentElements.comments[commentIndex].replies.push(reply);

        // Update elements in database
        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(currentElements), docId]
        );

        io.to(docId).emit("updateCommentReplies", { commentId, reply });

        console.log(`Comment reply added: 
          - Document ID: ${docId}
          - Comment ID: ${commentId}
          - Reply Author: ${reply.author || reply.user}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error updating comment replies:', error);
    }
  });

  socket.on("updateSuggestedEditStatus", async ({ docId, suggestededitId, status }) => {
    try {
      if (!docId || !suggestededitId) return;

      const userId = socket.user?.userId;
      if (!userId) return;

      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("updateSuggestedEditStatus", { suggestededitId, status });
        console.log(`Template suggested edit status updated: 
          - Suggested Edit ID: ${suggestededitId}
          - New Status: ${status}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Verify document authorization
      const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
      if (!isAuthorized) {
        console.warn(`🔒 Access denied: User ${userId} attempted unauthorized updateSuggestedEditStatus on document ${docId}`);
        socket.emit("documentAccessDenied", { docId, error: "Unauthorized" });
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const editIndex = currentElements.suggestedEdits.findIndex(
        (edit) => edit.id === suggestededitId
      );

      if (editIndex !== -1) {
        const oldStatus = currentElements.suggestedEdits[editIndex].status;
        currentElements.suggestedEdits[editIndex].status = status;

        // Update elements in database
        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(currentElements), docId]
        );

        io.to(docId).emit("updateSuggestedEditStatus", { suggestededitId, status });

        console.log(`Suggested edit status updated: 
          - Document ID: ${docId}
          - Suggested Edit ID: ${suggestededitId}
          - Old Status: ${oldStatus}
          - New Status: ${status}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error updating suggested edit status:', error);
    }
  });

  socket.on("updateSuggestedEditReplies", async ({ docId, suggestededitId, reply }) => {
    try {
      if (!docId || !suggestededitId) return;

      const userId = socket.user?.userId;
      if (!userId) return;

      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("updateSuggestedEditReplies", { suggestededitId, reply });
        console.log(`Template suggested edit reply added: 
          - Suggested Edit ID: ${suggestededitId}
          - Reply Author: ${reply.author || reply.user}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Verify document authorization
      const isAuthorized = await assertUserDocumentAccess(docId, userId, pool);
      if (!isAuthorized) {
        console.warn(`🔒 Access denied: User ${userId} attempted unauthorized updateSuggestedEditReplies on document ${docId}`);
        socket.emit("documentAccessDenied", { docId, error: "Unauthorized" });
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const suggestededitIndex = currentElements.suggestedEdits.findIndex(
        (suggestededit) => suggestededit.id === suggestededitId
      );

      if (suggestededitIndex !== -1) {
        if (!currentElements.suggestedEdits[suggestededitIndex].replies) {
          currentElements.suggestedEdits[suggestededitIndex].replies = [];
        }
        currentElements.suggestedEdits[suggestededitIndex].replies.push(reply);

        // Update elements in database
        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(currentElements), docId]
        );

        io.to(docId).emit("updateSuggestedEditReplies", { suggestededitId, reply });

        console.log(`Suggested edit reply added: 
          - Document ID: ${docId}
          - Suggested Edit ID: ${suggestededitId}
          - Reply Author: ${reply.author || reply.user}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error updating suggested edit replies:', error);
    }
  });

  socket.on("cursorMove", ({ docId, cursorPosition }) => {
    if (!docId) return;
    const authUserId = socket.user?.userId;
    const authUserName = socket.user?.email || `User-${authUserId}`;
    socket.to(docId).emit("cursorUpdate", { userId: authUserId, cursorPosition, userName: authUserName });
  });

  socket.on("disconnect", () => {
  });
};
