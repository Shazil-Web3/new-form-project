import io, re
from collections import Counter
errs = io.open('../frontend/tsc-front.txt', encoding='utf-16', errors='replace').read().splitlines()
shapes = Counter()
examples = {}
for e in errs:
    m = re.match(r'(\S+?)\((\d+),(\d+)\): error TS2339: Property \'([^\']+)\' does not exist on type \'\{\}\'', e)
    if not m:
        continue
    f, ln, col, prop = m.groups()
    ln = int(ln)
    try:
        lines = io.open('../frontend/' + f, encoding='utf-8', errors='replace', newline='').read().splitlines()
    except Exception:
        continue
    pre = lines[ln - 1][:int(col) - 1]
    m2 = re.search(r'([A-Za-z_$][\w$]*)\s*\.\s*(?:' + re.escape(prop) + r')?\s*$', pre)
    if not m2:
        shapes[('NOOBJ', '')] += 1
        continue
    name = m2.group(1)
    # find declaration-ish lines mentioning name
    decl = None
    for i, l in enumerate(lines):
        s = l.strip()
        if re.search(r'\b(let|const|var)\s+' + re.escape(name) + r'\b', s):
            decl = s[:110]
            break
    if decl is None:
        for i, l in enumerate(lines):
            s = l.strip()
            if re.search(r'\b' + re.escape(name) + r'\s*=', s) and '==' not in s and '===' not in s and '=>' not in s.split('=')[0][-20:]:
                decl = s[:110]
                break
    key = decl if decl else 'NO-DECL-FOUND'
    shapes[key] += 1
    examples.setdefault(key, []).append(f + ':' + str(ln))
for k, v in shapes.most_common(50):
    print(v, repr(k), (examples.get(k) or [''])[:2])
