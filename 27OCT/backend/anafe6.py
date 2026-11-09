import io, re
from collections import Counter
errs = io.open('../frontend/tsc-front.txt', encoding='utf-16', errors='replace').read().splitlines()
c = Counter()
for e in errs:
    m = re.match(r'(\S+?)\((\d+),(\d+)\): error (TS2741|TS2739|TS2559|TS2322): (.*)', e)
    if not m:
        continue
    f, ln, col, code, msg = m.groups()
    c[(code, msg.strip()[:110])] += 1
for k, v in c.most_common(40):
    print(v, k)
