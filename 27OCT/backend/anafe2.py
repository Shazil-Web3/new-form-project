import io, re
from collections import Counter
errs = io.open('../frontend/tsc-front.txt', encoding='utf-16', errors='replace').read().splitlines()
print('lines', len(errs))
callee2554 = Counter()
n_match = 0
for e in errs:
    m = re.match(r'(\S+?)\((\d+),(\d+)\): error (TS\d+): (.*)', e)
    if not m:
        continue
    n_match += 1
    f, ln, col, code, msg = m.groups()
    if code == 'TS2554':
        try:
            lines = io.open('../frontend/' + f, encoding='utf-8', errors='replace').read().splitlines()
            src = lines[int(ln) - 1] if int(ln) - 1 < len(lines) else '???'
        except Exception:
            src = '???'
        cm = re.findall(r'([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(', src)
        callee2554[(msg.strip()[:60], tuple(cm[:3]))] += 1
print('matched', n_match)
print('=== TS2554 top 40 ===')
for k, v in callee2554.most_common(40):
    print(v, k)
