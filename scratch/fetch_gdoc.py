import urllib.request
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Try Google Docs export with different formats
doc_id = '19s5R6Jop0RSqJ1WemoDYVA3vERZuybScRCrX-3HLghY'

urls_to_try = [
    f'https://docs.google.com/document/d/{doc_id}/export?format=txt',
    f'https://docs.google.com/document/d/{doc_id}/pub?output=txt',
    f'https://docs.google.com/document/d/{doc_id}/pub',
    f'https://docs.google.com/feeds/download/documents/export/Export?id={doc_id}&exportFormat=txt',
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

for url in urls_to_try:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
            print(f"\n=== SUCCESS: {url} ===")
            print(f"Length: {len(content)}")
            print(content[:2000])
            break
    except Exception as e:
        print(f"FAILED: {url} -> {e}")
