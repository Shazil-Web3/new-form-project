import io, glob, re
hits = []
for f in glob.glob('../frontend/src/**/*.*', recursive=True):
    if not (f.endswith('.ts') or f.endswith('.tsx')):
        continue
    try:
        s = io.open(f, encoding='utf-8', errors='replace').read()
    except Exception:
        continue
    for i, l in enumerate(s.splitlines()):
        if 'forwardRef' in l:
            hits.append((f.replace('../frontend/', ''), i + 1, l.strip()[:130]))
print(len(hits))
for h in hits[:60]:
    print(h)
