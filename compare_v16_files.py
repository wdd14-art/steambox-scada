from pathlib import Path
from difflib import unified_diff

p1 = Path('tmp_v16_utf8.txt')
p2 = Path('tmp_v16_bug_utf8.txt')

a = p1.read_text(encoding='utf-8').splitlines()
b = p2.read_text(encoding='utf-8').splitlines()
print('LINES', len(a), len(b))
print('IDENTICAL' if a == b else 'DIFFERENT')
if a != b:
    diff = list(unified_diff(a, b, fromfile='v16', tofile='v16_bug', n=3))
    for line in diff[:200]:
        print(line)
    print('TOTAL_DIFF_LINES', len(diff))
