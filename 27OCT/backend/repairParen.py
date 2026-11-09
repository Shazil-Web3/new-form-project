import io, re
fixes = [
    ('../frontend/src/components/Editor/PasteHandler.tsx', 'rows.map(tr: any) => {', 'rows.map((tr: any) => {'),
    ('../frontend/src/components/Editor/PasteHandler.tsx', '.map(li: any) => li.innerHTML)', '.map((li: any) => li.innerHTML)'),
    ('../frontend/src/components/Unified/UnifiedCommentSystem/CommentCore.tsx', 'setPillPos(p: any) => ({ ...p, show: false }));', 'setPillPos((p: any) => ({ ...p, show: false })));'),
    ('../frontend/src/components/Unified/UnifiedTextEditor/components/Toolbar.tsx', '.filter(el: any) => {', '.filter((el: any) => {'),
    ('../frontend/src/components/Unified/UnifiedTextEditor/hooks/editorEventHandlers/useHandleEnter.ts', '.map(l: any) => l.innerHTML)', '.map((l: any) => l.innerHTML)'),
    ('../frontend/src/components/Unified/UnifiedTextEditor/hooks/editorEventHandlers/useHandleKeyDown.tsx', '.forEach(fig: any) => fig.remove())', '.forEach((fig: any) => fig.remove())'),
]
for f, old, new in fixes:
    s = io.open(f, encoding='utf-8', newline='').read()
    assert s.count(old) == 1, (f, old, s.count(old))
    io.open(f, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))
    print('repaired', f.split('/')[-1])
