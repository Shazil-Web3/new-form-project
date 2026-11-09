import io, glob, re

touched = {}
# 1: = {}  ->  = {} as any
for f in glob.glob('../frontend/src/**/*.ts*', recursive=True):
    try:
        s = io.open(f, encoding='utf-8', errors='replace', newline='').read()
    except Exception:
        continue
    s2, n1 = re.subn(r'=\s*\{\s*\}', '= {} as any', s)
    # 2: return {}; -> return {} as any;
    s2, n2 = re.subn(r'return\s*\{\s*\}\s*;', 'return {} as any;', s2)
    # 3: let/var X = null; -> : any
    s2, n3 = re.subn(r'\b(let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*null\s*;', r'\1 \2: any = null;', s2)
    # 4: useRef() -> useRef<any>()
    s2, n4 = re.subn(r'useRef\(\)', 'useRef<any>()', s2)
    if n1 or n2 or n3 or n4:
        io.open(f, 'w', encoding='utf-8', newline='').write(s2)
        touched[f] = (n1, n2, n3, n4)
print('files:', len(touched))
tot = [0, 0, 0, 0]
for f, t in touched.items():
    tot = [a + b for a, b in zip(tot, t)]
print('replacements (eq/return/null/useRef):', tot)
