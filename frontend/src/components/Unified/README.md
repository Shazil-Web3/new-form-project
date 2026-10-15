# Unified Text Editor System

## Overview

The Unified Text Editor is a modular, mode-aware text editing system that consolidates multiple editor implementations into a single, maintainable architecture.

## Architecture

### Modular Design

Instead of one large monolithic file, the system uses **separate component files for each mode**:

```
Unified/
├── hooks/
│   └── useTemplateSocket.js       # Centralized Socket.io for all modes
│
└── UnifiedTextEditor/
    ├── index.js                   # Router - selects mode component
    ├── CreateEditor.js            # Create mode (full editing)
    ├── PreviewEditor.js           # Preview mode (read-only + comments)
    ├── ReviewEditor.js            # Review mode (suggestions + approvals)
    └── styles/
        ├── CreateEditor.css
        ├── PreviewEditor.css
        └── ReviewEditor.css
```

### Modes

1. **Create Mode** (`mode="create"`)
   - Full editing capabilities
   - Toolbar enabled
   - NO comments or Socket.io
   - Used in: `CreateTemplate.js`

2. **Preview Mode** (`mode="preview"`)
   - Read-only display
   - Comments enabled
   - Socket.io for real-time updates
   - Used in: `TemplatePreview.js` (pending review)

3. **Review Mode** (`mode="review"`)
   - Editable for suggestions
   - Comments + approval actions
   - Socket.io enabled
   - Used in: `PendingReview.js`, `ReviseTemplate.js`

## Usage

```javascript
import UnifiedTextEditor from './components/Unified/UnifiedTextEditor';

// Create mode
<UnifiedTextEditor
  mode="create"
  user={currentUser}
  initialContent={htmlContent}
  onContentChange={handleChange}
/>

// Preview mode
<UnifiedTextEditor
  mode="preview"
  user={currentUser}
  initialContent={template.content}
  templateId={template.id}
  socketEnabled={true}
  comments={template.comments}
  suggestions={template.suggestions}
/>

// Review mode
<UnifiedTextEditor
  mode="review"
  user={currentUser}
  initialContent={template.content}
  templateId={template.id}
  socketEnabled={true}
  comments={template.comments}
  suggestions={template.suggestions}
  showToolbar={true}
/>
```

## Current Status

### ✅ Completed (Phase 1)

- Directory structure
- Centralized Socket.io hook (`useTemplateSocket.js`)
- Router component (`index.js`)
- Mode-specific components (CreateEditor, PreviewEditor, ReviewEditor)
- Mode-specific CSS files
- Test component for verification

### 🚧 In Progress (Phase 2)

- Extracting `EditorCore.js` from `TemplateEditor.js`
- Creating `useEditorCore` hook
- Building shared UI components

### 📋 Next Steps (Phase 3)

- Integrate with `CreateTemplate.js`
- Integrate with `TemplatePreview.js`
- Test Socket.io sync between modes

## Important Notes

> **⚠️ NEVER DELETE OLD FILES**
>
> Keep `TemplateEditor.js`, `CommentEditSystem.js`, and all existing editor files for reference. Only comment them out after the new system is fully tested.

## Testing

Use the `TestUnifiedEditor.js` component to test mode switching:

```javascript
import TestUnifiedEditor from './components/Test/TestUnifiedEditor';

// In your test page
<TestUnifiedEditor />
```

This will render buttons to switch between create, preview, and review modes.

## Socket.io Architecture

All modes use the same `useTemplateSocket` hook for consistency:

```javascript
const { emitContentChange, emitCommentAdded } = useTemplateSocket(
  templateId,
  mode,  // 'create' | 'preview' | 'review'
  {
    onContentUpdate: (data) => { /* handle */ },
    onCommentAdded: (data) => { /* handle */ },
  }
);
```

This ensures CreateTemplate ↔ TemplatePreview communication continues to work seamlessly.
