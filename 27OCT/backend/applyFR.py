import io, glob, re
n = 0
for f in glob.glob('../frontend/src/base44training/components/ui/*.tsx'):
    s = io.open(f, encoding='utf-8', errors='replace', newline='').read()
    s2, a = re.subn(r'forwardRef\(\(\{', 'forwardRef<any, any>(({', s)
    s2, b = re.subn(r'\}, ref\) =>', '}: any, ref: any) =>', s2)
    if a or b:
        io.open(f, 'w', encoding='utf-8', newline='').write(s2)
        n += a
print('forwardRef sites fixed:', n)
