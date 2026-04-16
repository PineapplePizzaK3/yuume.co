import re
from pathlib import Path
s = Path(r'd:\delivery\logo\yumc_1svg.svg').read_text(encoding='utf-8', errors='ignore')
vb = re.search(r'viewBox="0\s+0\s+([0-9.]+)\s+([0-9.]+)"', s)
print('viewBox', vb.group(1), vb.group(2))
uses = re.findall(r'<use\b([^/]*)/>', s)
print('uses', len(uses))
for i,b in enumerate(uses,1):
    rid = re.search(r'xlink:href="#(_Image\d+)"', b).group(1)
    x = float(re.search(r'\bx="([^\"]+)"', b).group(1).replace('px',''))
    y = float(re.search(r'\by="([^\"]+)"', b).group(1).replace('px',''))
    w = float(re.search(r'\bwidth="([^\"]+)"', b).group(1).replace('px',''))
    h = float(re.search(r'\bheight="([^\"]+)"', b).group(1).replace('px',''))
    tm = re.search(r'transform="([^\"]+)"', b)
    tr = tm.group(1) if tm else ''
    print(i, rid, x, y, w, h, tr)
