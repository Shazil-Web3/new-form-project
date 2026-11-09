import io, re
from collections import Counter
errs = io.open('../frontend/tsc-front.txt', encoding='utf-16', errors='replace').read().splitlines()
bycode = Counter()
byfile = Counter()
for e in errs:
    m = re.match(r'(\S+?)\((\d+),(\d+)\): error (TS\d+): (.*)', e)
    if not m:
        continue
    f, ln, col, code, msg = m.groups()
    bycode[code] += 1
    byfile[(code, f)] += 1
print('TOTAL', sum(bycode.values()))
for k, v in bycode.most_common(30):
    print(v, k)
print('=== top files ===')
for (code, f), v in sorted(byfile.items(), key=lambda x: -x[1])[:45]:
    print(v, code, f)
