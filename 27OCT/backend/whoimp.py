import io, glob
hits = 0
for f in glob.glob('../frontend/src/**/*.*', recursive=True):
    if not (f.endswith('.ts') or f.endswith('.tsx')):
        continue
    try:
        s = io.open(f, encoding='utf-8', errors='replace').read()
    except Exception:
        continue
    for i, l in enumerate(s.splitlines()):
        if 'editor_functions' in l and 'src/editor_functions' not in f:
            print(f.replace('../frontend/', '') + ':' + str(i + 1) + ': ' + l.strip()[:140])
            hits += 1
            if hits > 15:
                raise SystemExit
