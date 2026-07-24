import urllib.request
import re
import sys

# Set stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

url = 'https://gemini.google.com/share/a7d22d33d3cb'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

print(f"HTML length: {len(html)}")

# Gemini share pages embed conversation data in the page's JavaScript
# Look for AF_initDataCallback patterns or WIZ_global_data
# Also look for protobuf-like encoded strings

# Strategy: Search for long text strings that look like natural language
# Gemini data is usually inside AF_initDataCallback({"key": ..., "data": [...]})

# Find all AF_initDataCallback sections
af_matches = re.findall(r'AF_initDataCallback\(({.*?})\)', html, re.DOTALL)
print(f"\nAF_initDataCallback matches: {len(af_matches)}")

# Search for the specific share data - usually contains conversation in nested arrays
# Look for strings with newlines that are long
long_strings = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', html)
print(f"\nTotal quoted strings: {len(long_strings)}")

chat_candidates = []
for s in long_strings:
    # Unescape
    s2 = s.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"').replace('\\\\', '\\')
    # Filter: must be longer than 50 chars, contain spaces (natural language), not be a URL or CSS
    if (len(s2) > 50 and 
        ' ' in s2 and 
        not s2.startswith('http') and 
        not s2.startswith('//') and
        not s2.startswith('{') and
        not re.match(r'^[A-Za-z_]+\(', s2) and
        s2.count(' ') > 5):
        chat_candidates.append(s2)

print(f"\nChat-like candidates: {len(chat_candidates)}")
print("\n=== TOP CANDIDATES ===")
# Sort by length descending - longer = more likely to be real content  
chat_candidates.sort(key=len, reverse=True)
for i, c in enumerate(chat_candidates[:20]):
    print(f"\n[{i}] (len={len(c)})")
    print(c[:500])
    print("-"*60)

# Save output to file too
with open('scratch/gemini_chat_output.txt', 'w', encoding='utf-8') as f:
    for i, c in enumerate(chat_candidates[:50]):
        f.write(f"\n[{i}] (len={len(c)})\n")
        f.write(c[:1000])
        f.write("\n" + "-"*60 + "\n")
print("\nSaved to scratch/gemini_chat_output.txt")
