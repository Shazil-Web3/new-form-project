import sys, re
from collections import Counter
bycode = Counter()
byfile = Counter()
for e in sys.stdin.read().splitlines():
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
for (code, f), v in sorted(byfile.items(), key=lambda x: -x[1])[:35]:
    print(v, code, f)
