const parser = require('@babel/parser');
const fs = require('fs');

const files = [
  'src/components/Unified/UnifiedCommentSystem/commentCore/RangeBlockHelpers.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/ReferencePreviewComponent.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/FloatingToolbarComponent.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/RailComposerComponent.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/StrikePopupComponent.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/RailCardComponent.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/RightRailComponent.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/useStrikeManager.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/useCommentOrphanObserver.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/useCommentSocketListeners.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/useRailLayout.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/useHighlightInteractions.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/useReplyActions.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/highlightDomUtils.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/useElementCreation.js',
  'src/components/Unified/UnifiedCommentSystem/commentCore/useCommentPermissions.js',
  'src/components/Unified/UnifiedCommentSystem/CommentCore.js'
];

let hasError = false;
files.forEach(f => {
  try {
    const code = fs.readFileSync(f, 'utf8');
    parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    console.log(`[OK] ${f}`);
  } catch (err) {
    console.error(`[ERR] ${f}:`, err.message);
    hasError = true;
  }
});

process.exit(hasError ? 1 : 0);
