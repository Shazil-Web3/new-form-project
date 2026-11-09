import io, glob, re
from collections import Counter
bad = Counter()
n_eq = 0
for f in glob.glob('../frontend/src/**/*.*', recursive=True):
    if not (f.endswith('.ts') or f.endswith('.tsx')):
        continue
    try:
        s = io.open(f, encoding='utf-8', errors='replace', newline='').read()
    except Exception:
        continue
    for m in re.finditer(r'=\s*\{\s*\}', s):
        n_eq += 1
        pre = s[max(0, m.start() - 30):m.start()]
        post = s[m.end():m.end() + 15]
        if re.search(r'==\s*$', pre):
            bad['equality'] += 1
        elif re.search(r'=>\s*$', pre):
            bad['arrow'] += 1
        elif re.search(r'<\w[\w\s,]*$', pre):
            bad['generic?'] += 1
        elif 'as any' in post[:10]:
            bad['already-any'] += 1
        elif re.search(r'!=\s*$', pre):
            bad['inequality'] += 1
        elif re.search(r'typeof\s*$', pre):
            bad['typeof'] += 1
print('total:', n_eq)
print(bad)
