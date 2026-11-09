import io, re
from collections import Counter
errs = io.open('../frontend/tsc-front.txt', encoding='utf-16', errors='replace').read().splitlines()
pat = Counter()
samples = {}
for e in errs:
    m = re.match(r'(\S+?)\((\d+),(\d+)\): error TS2339: (.*)', e)
    if not m:
        continue
    f, ln, col, msg = m.groups()
    pm = re.match(r"Property '([^']+)' does not exist on type '([^']+)'", msg)
    if not pm:
        pat[('OTHER', msg[:60])] += 1
        continue
    prop, typ = pm.groups()
    key = typ if len(typ) < 60 else typ[:60]
    pat[key] += 1
    samples.setdefault(key, []).append(f + ':' + ln)
for k, v in pat.most_common(40):
    print(v, repr(k), (samples.get(k) or [''])[:2])
