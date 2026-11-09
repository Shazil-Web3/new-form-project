import io, glob, re
n1 = n2 = 0
for f in glob.glob('../frontend/src/**/*.ts*', recursive=True):
    try:
        s = io.open(f, encoding='utf-8', errors='replace', newline='').read()
    except Exception:
        continue
    s2, a = re.subn(r'new Proxy\(\{\},', 'new Proxy({} as any,', s)
    s2, b = re.subn(r'useState\(null\)', 'useState<any>(null)', s2)
    if a or b:
        io.open(f, 'w', encoding='utf-8', newline='').write(s2)
        n1 += a
        n2 += b
print('proxy:', n1, 'useStateNull:', n2)
