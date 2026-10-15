module.exports = function registerTemplateCollaboration(socket, { io, pool }) {
  // Socket.io connection handler 1: Template room presence and updates
  console.log('🔌 New client connected');

  // Handle joining template room
  socket.on('joinTemplateRoom', (data) => {
    const { templateId, userId, userName, userEmail, role } = data;
    const roomId = `template:${templateId}`;

    console.log(`👥 User ${userName} joining room ${roomId}`);

    // Join the room
    socket.join(roomId);

    // Broadcast user presence to others in the room
    socket.to(roomId).emit('userPresence', {
      type: 'joined',
      templateId,
      userId,
      userName,
      userEmail,
      role,
      timestamp: Date.now()
    });
  });

  // Handle content changes
  socket.on('templateContentChange', (data) => {
    const { templateId, content, userId, userName } = data;
    const roomId = `template:${templateId}`;

    console.log(`📝 Content update from ${userName} in ${roomId}`);

    // Broadcast to all clients except sender
    socket.to(roomId).emit('templateContentUpdate', {
      templateId,
      content,
      userId,
      userName,
      timestamp: Date.now()
    });
  });

  // Handle cursor position updates
  socket.on('templateCursorUpdate', (data) => {
    const { templateId, userId, userName, position } = data;
    const roomId = `template:${templateId}`;

    socket.to(roomId).emit('templateCursorUpdate', {
      templateId,
      userId,
      userName,
      position,
      timestamp: Date.now()
    });
  });

  // Handle leaving template room
  socket.on('leaveTemplateRoom', (data) => {
    const { templateId } = data;
    const roomId = `template:${templateId}`;

    console.log(`👋 Client leaving room ${roomId}`);
    socket.leave(roomId);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('👋 Client disconnected');
  });

  // Socket.io template editor and review handlers
  socket.on("joinTemplateEditor", ({ userId, userName }) => {
    socket.join("template-editor");
  });

  // Handle joining template review room
  socket.on("joinTemplateReview", ({ templateId, userId, userName }) => {
    const room = `template-review-${templateId}`;
    socket.join(room);
  });

  // Handle template comment events
  socket.on("addTemplateComment", ({ templateId, comment }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("receiveTemplateComment", { comment });
    console.log(`Template comment added: 
    - Template ID: ${templateId}
    - Comment ID: ${comment.id}
    - Author: ${comment.user}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template suggestion events
  socket.on("addTemplateSuggestion", ({ templateId, suggestion }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("receiveTemplateSuggestion", { suggestion });
    console.log(`Template suggestion added: 
    - Template ID: ${templateId}
    - Suggestion ID: ${suggestion.id}
    - Author: ${suggestion.user}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template comment deletion
  socket.on("removeTemplateComment", async ({ templateId, commentId }) => {
    try {
      // 1. Try to treat as a document first
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [templateId]
      );

      if (documents.length > 0) {
        let elements = documents[0].elements ? JSON.parse(documents[0].elements) : { comments: [], suggestedEdits: [] };
        elements.comments = (elements.comments || []).filter(c => c.id !== commentId);

        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(elements), templateId]
        );

        // Notify document room
        io.to(templateId).emit("commentRemoved", { commentId });
        console.log(`Document comment removed: ${commentId} from ${templateId}`);
        return;
      }

      // 2. Fallback to template logic
      const room = `template-review-${templateId}`;
      socket.to(room).emit("templateCommentRemoved", { commentId });
      console.log(`Template comment removed: 
      - Template ID: ${templateId}
      - Comment ID: ${commentId}
      - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error removing comment:', error);
    }
  });

  // Handle template suggestion deletion
  socket.on("removeTemplateSuggestion", async ({ templateId, suggestionId }) => {
    try {
      // 1. Try to treat as a document first
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [templateId]
      );

      if (documents.length > 0) {
        let elements = documents[0].elements ? JSON.parse(documents[0].elements) : { comments: [], suggestedEdits: [] };
        elements.suggestedEdits = (elements.suggestedEdits || []).filter(s => s.id !== suggestionId);

        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(elements), templateId]
        );

        // Notify document room
        io.to(templateId).emit("suggestedEditRemoved", { suggestededitId: suggestionId });
        console.log(`Document suggestion removed: ${suggestionId} from ${templateId}`);
        return;
      }

      // 2. Fallback to template logic
      const room = `template-review-${templateId}`;
      socket.to(room).emit("templateSuggestionRemoved", { suggestionId });
      console.log(`Template suggestion removed: 
      - Template ID: ${templateId}
      - Suggestion ID: ${suggestionId}
      - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error removing suggestion:', error);
    }
  });

  // Handle template comment replies
  socket.on("addTemplateCommentReply", ({ templateId, commentId, reply }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("receiveTemplateCommentReply", { commentId, reply });
    console.log(`Template comment reply added: 
    - Template ID: ${templateId}
    - Comment ID: ${commentId}
    - Reply ID: ${reply.id}
    - Author: ${reply.user}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template suggestion replies
  socket.on("addTemplateSuggestionReply", ({ templateId, suggestionId, reply }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("receiveTemplateSuggestionReply", { suggestionId, reply });
    console.log(`Template suggestion reply added: 
    - Template ID: ${templateId}
    - Suggestion ID: ${suggestionId}
    - Reply ID: ${reply.id}
    - Author: ${reply.user}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template comment reply removal
  socket.on("removeTemplateCommentReply", ({ templateId, commentId, replyId }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("templateCommentReplyRemoved", { commentId, replyId });
    console.log(`Template comment reply removed: 
    - Template ID: ${templateId}
    - Comment ID: ${commentId}
    - Reply ID: ${replyId}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template suggestion reply removal
  socket.on("removeTemplateSuggestionReply", ({ templateId, suggestionId, replyId }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("templateSuggestionReplyRemoved", { suggestionId, replyId });
    console.log(`Template suggestion reply removed: 
    - Template ID: ${templateId}
    - Suggestion ID: ${suggestionId}
    - Reply ID: ${replyId}
    - Timestamp: ${new Date().toISOString()}`);
  });


  // Enhanced template content changes with better error handling and logging
  socket.on('templateContentChange', async (data) => {
    try {
      const { templateId, content, userId, userName, userEmail, timestamp } = data;
      const roomId = `template:${templateId}`;

      console.log(`📝 Template content change received:`, {
        templateId,
        userId,
        userName,
        contentLength: content ? content.length : 0,
        timestamp: new Date().toISOString()
      });

      // Save to database if needed (content is usually saved via API endpoint)
      // This is kept as a backup for direct socket saves
      if (content && process.env.DIRECT_SOCKET_SAVE === 'true') {
        try {
          // Get existing data first
          const [currentTemplate] = await pool.execute(
            'SELECT comments FROM templates WHERE id = ?',
            [templateId]
          );

          let existingComments = [];
          let existingSuggestions = [];

          if (currentTemplate.length > 0 && currentTemplate[0].comments) {
            try {
              const commentsData = JSON.parse(currentTemplate[0].comments);
              existingComments = commentsData.comments || [];
              existingSuggestions = commentsData.suggestions || [];
            } catch (e) {
              console.warn('Could not parse existing comments in socket handler:', e.message);
            }
          }

          const updatedCommentsData = {
            ...(currentTemplate[0].comments ? JSON.parse(currentTemplate[0].comments) : {}),
            content: content,
            comments: existingComments,
            suggestions: existingSuggestions,
            lastModified: new Date().toISOString(),
            lastModifiedBy: userId
          };

          await pool.execute(
            'UPDATE templates SET content = ?, comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [content, JSON.stringify(updatedCommentsData), templateId]
          );
          console.log(`💾 Template content saved via socket: ${templateId}`);
        } catch (dbError) {
          console.error('❌ Database update error in socket handler:', dbError);
        }
      }

      // Broadcast to all clients except sender
      socket.to(roomId).emit('templateContentUpdate', {
        templateId,
        content,
        userId,
        userName,
        userEmail,
        timestamp: Date.now()
      });

      console.log(`📡 Broadcasted template update to room: ${roomId}`);
    } catch (error) {
      console.error('❌ Error handling template content change:', error);
      socket.emit('templateError', { error: 'Failed to process content change' });
    }
  });

  // ========== NEW SOCKET.IO HANDLERS FOR REAL-TIME SYNC ==========

  // Handle joining template room
  socket.on('joinTemplate', ({ templateId, mode }) => {
    const roomId = `template-${templateId}`;
    socket.join(roomId);
    console.log(`[Socket] User joined template room: ${roomId} (mode: ${mode})`);
  });

  // Handle leaving template room
  socket.on('leaveTemplate', ({ templateId }) => {
    const roomId = `template-${templateId}`;
    socket.leave(roomId);
    console.log(`[Socket] User left template room: ${roomId}`);
  });

  // Handle template content updates from unified editor
  socket.on('updateTemplateContent', async (data) => {
    const { templateId, content, headerHTML, footerHTML, userId, timestamp } = data;
    console.log(`[Socket] updateTemplateContent from user ${userId} for template ${templateId}`);

    try {
      // Broadcast to all users in the template room (including sender for confirmation)
      io.to(`template-${templateId}`).emit('templateContentUpdated', {
        templateId,
        content,
        headerHTML,
        footerHTML,
        userId,
        timestamp: timestamp || Date.now()
      });

      console.log(`[Socket] Broadcasted templateContentUpdated to template-${templateId} room`);
    } catch (error) {
      console.error('[Socket] Error broadcasting template content:', error);
    }
  });

  // Handle comment add/update/delete
  socket.on('addComment', ({ templateId, comment }) => {
    console.log(`[Socket] Comment added to template ${templateId}`);
    io.to(`template-${templateId}`).emit('commentAdded', { templateId, comment });
  });

  socket.on('updateComment', ({ templateId, commentId, updates }) => {
    console.log(`[Socket] Comment ${commentId} updated in template ${templateId}`);
    io.to(`template-${templateId}`).emit('commentUpdated', { templateId, commentId, updates });
  });

  socket.on('deleteComment', ({ templateId, commentId }) => {
    console.log(`[Socket] Comment ${commentId} deleted from template ${templateId}`);
    io.to(`template-${templateId}`).emit('commentDeleted', { templateId, commentId });
  });

  // Handle suggestion add/update/delete
  socket.on('addSuggestion', ({ templateId, suggestion }) => {
    console.log(`[Socket] Suggestion added to template ${templateId}`);
    io.to(`template-${templateId}`).emit('suggestionAdded', { templateId, suggestion });
  });

  socket.on('updateSuggestion', ({ templateId, suggestionId, updates }) => {
    console.log(`[Socket] Suggestion ${suggestionId} updated in template ${templateId}`);
    io.to(`template-${templateId}`).emit('suggestionUpdated', { templateId, suggestionId, updates });
  });

  socket.on('deleteSuggestion', ({ templateId, suggestionId }) => {
    console.log(`[Socket] Suggestion ${suggestionId} deleted from template ${templateId}`);
    io.to(`template-${templateId}`).emit('suggestionDeleted', { templateId, suggestionId });
  });

  // ========== END NEW SOCKET.IO HANDLERS ==========

  // Handle user presence updates
  socket.on('templateUserPresence', (data) => {
    try {
      const { templateId, userId, userName, userEmail, action } = data;
      const roomId = `template:${templateId}`;

      console.log(`👥 User presence update:`, {
        templateId,
        userId,
        userName,
        action,
        timestamp: new Date().toISOString()
      });

      // Broadcast presence to others in room
      socket.to(roomId).emit('userPresence', {
        templateId,
        userId,
        userName,
        userEmail,
        action,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Error handling user presence:', error);
    }
  });
};
