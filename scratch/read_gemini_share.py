import json
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\bagyo\.gemini\antigravity-ide\brain\b5f16450-afb0-4089-a48d-a31d06be212d\.system_generated\logs\transcript.jsonl'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Scanning transcript steps...")
for line in lines:
    try:
        obj = json.loads(line)
        idx = obj.get("step_index", 0)
        if idx >= 2191:
            print(f"\n=== Step {idx}: {obj.get('type')} ({obj.get('status')}) ===")
            content = obj.get("content", "")
            if content:
                print(content[:1000])
    except Exception as e:
        print("Error parsing line:", e)
