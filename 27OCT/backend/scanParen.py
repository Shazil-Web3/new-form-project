import io, glob, re
for f in glob.glob('../frontend/src/**/*.ts*', recursive=True):
    try:
        s = io.open(f, encoding='utf-8', errors='replace').read()
    except Exception:
        continue
    for i, l in enumerate(s.splitlines()):
        # single-paren callback annotation missing its opening paren:
        # word(ident: any) =>  without (( 
        if re.search(r'\w\(\s*[A-Za-z_$][\w$]*\s*:\s*any\s*\)\s*=>', l) \
                and not re.search(r'\(\(\s*[A-Za-z_$][\w$]*\s*:\s*any\s*\)\s*=>', l):
            # verify paren balance around it
            print(f.replace('../frontend/', '') + ':' + str(i + 1) + ': ' + l.strip()[:130])
