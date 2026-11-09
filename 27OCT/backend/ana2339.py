import sys, io, re
from collections import Counter
c = Counter()
sites = {}
n = 0
for e in sys.stdin.read().splitlines():
    m = re.match(r'(\S+?)\((\d+),(\d+)\): error TS2339: (.*)', e)
    if not m:
        continue
    f, ln, col, msg = m.groups()
    n += 1
    try:
        line = io.open('../frontend/' + f, encoding='utf-8', errors='replace').read().splitlines()[int(ln) - 1].strip()[:110]
    except Exception:
        line = '???'
    key = (msg.strip()[:85],)
    c[key] += 1
    sites.setdefault(key, []).append(f + ':' + ln + ' :: ' + line)
print('TS2339 total', n)
for k, v in c.most_common(40):
    print(v, k[0])
    for s in sites[k][:2]:
        print('   ', s)
