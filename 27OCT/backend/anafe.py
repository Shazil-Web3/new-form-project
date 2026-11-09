import io, re
from collections import Counter
errs = io.open('../frontend/tsc-front.txt', encoding='utf-8', errors='replace').read().splitlines()
callee2554 = Counter()
others = Counter()
for e in errs:
    m = re.match(r'(\S+?)\((\d+),(\d+)\): error (TS\d+): (.*)', e)
    if not m:
        continue
    f, ln, col, code, msg = m.groups()
    if code == 'TS2554':
        try:
            src = io.open('../frontend/' + f, encoding='utf-8', errors='replace').read().splitlines()[int(ln) - 1]
        except Exception:
            src = '???'
        # guess callee: identifier before '(' near col
        cm = re.findall(r'([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(', src)
        key = (msg.strip()[:60], tuple(cm[:3]))
        callee2554[key] += 1
    elif code in ('TS2339', 'TS2322', 'TS2345'):
        try:
            src = io.open('../frontend/' + f, encoding='utf-8', errors='replace').read().splitlines()[int(ln) - 1].strip()[:100]
        except Exception:
            src = '???'
        others[(code, msg.strip()[:70])] += 1
print('=== TS2554 by (msg, callees) top 40 ===')
for k, v in callee2554.most_common(40):
    print(v, k)
print('=== other top 30 ===')
for k, v in others.most_common(30):
    print(v, k)
