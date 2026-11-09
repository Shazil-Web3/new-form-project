import io, re
from collections import Counter
errs = io.open('../frontend/tsc-front.txt', encoding='utf-16', errors='replace').read().splitlines()
want = {
    'src/components/Editor/ContentChangeHandler.ts',
    'src/components/Unified/UnifiedTextEditor/hooks/usePageManagement.tsx',
    'src/components/Editor/PasteHandler.tsx',
    'src/components/Unified/UnifiedTextEditor/Preview/components/OverviewProgressTab.tsx',
    'src/components/Unified/UnifiedTextEditor/hooks/editorEventHandlers/useLockedTextNavigation.tsx',
    'src/components/Unified/UnifiedTextEditor/EditorCore.tsx',
}
for target in sorted(want):
    print('==== ' + target)
    c = Counter()
    for e in errs:
        m = re.match(r'(\S+?)\((\d+),(\d+)\): error (TS\d+): (.*)', e)
        if not m or m.group(1) != target:
            continue
        f, ln, col, code, msg = m.groups()
        try:
            src = io.open('../frontend/' + f, encoding='utf-8', errors='replace').read().splitlines()[int(ln) - 1].strip()[:100]
        except Exception:
            src = '???'
        c[(code, msg.strip()[:80], src)] += 1
    for k, v in c.most_common(12):
        print(' ', v, k)
