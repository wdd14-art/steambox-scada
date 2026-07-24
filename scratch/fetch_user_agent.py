import urllib.request
import re
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

url = "https://share.gemini.google/CRdXSePlD9uX"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
}

print(f"Fetching {url} with User-Agent header...")
try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as response:
        html = response.read().decode('utf-8')
        
    print(f"Successfully fetched HTML. Total length: {len(html)} bytes.")
    
    # Check if we were redirected or if it's the home page
    if "Gemini" in html:
        print("Page title/content indicates Gemini.")
        
    # Search for dialogue keywords in Indonesian
    indonesian_keywords = ['saya', 'kamu', 'skrip', 'kita', 'pabrik', 'downtime', 'resep', 'tag', 'haiwell']
    matches = re.findall(r'"((?:[^"\\]|\\.)*)"', html)
    
    found_dialogues = []
    for m in matches:
        try:
            decoded = bytes(m, "utf-8").decode("unicode_escape")
            decoded_lower = decoded.lower()
            if any(k in decoded_lower for k in indonesian_keywords):
                if len(decoded) > 30 and len(decoded) < 5000:
                    clean = re.sub(r'<[^>]*>', ' ', decoded)
                    clean = ' '.join(clean.split())
                    if clean not in found_dialogues:
                        found_dialogues.append(clean)
        except:
            continue
            
    print(f"Found {len(found_dialogues)} relevant entries:")
    for idx, d in enumerate(found_dialogues[:20]):
        print(f"\n--- Entry {idx+1} ---")
        print(d[:1000])
        
except Exception as e:
    print(f"Error fetching URL: {e}")
