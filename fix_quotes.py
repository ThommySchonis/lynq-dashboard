#!/usr/bin/env python3
"""Fix broken JSX color/background values where opening quote was lost."""
import re, os

FILES = [
    'app/admin/page.js',
    'app/analytics/page.js',
    'app/home/page.js',
    'app/inbox/page.js',
    'app/performance/page.js',
    'app/services/page.js',
    'app/settings/page.js',
    'app/supply-chain/page.js',
    'app/time-tracking/page.js',
    'app/value-feed/page.js',
]

BASE = '/Users/thommy.schonisziggo.nl/projects/lynq-dashboard'

def process(content):
    # Fix: color:var(--text-X)' → color:'var(--text-X)'
    # These appear in JSX object literals where the opening quote was lost
    content = re.sub(
        r"(?<!')color:(var\(--text-[123]\))'",
        r"color:'\1'",
        content)
    # Fix: background:var(--bg-...)' → background:'var(--bg-...)'
    content = re.sub(
        r"(?<!')background:(var\(--bg-[a-z0-9-]+\))'",
        r"background:'\1'",
        content)
    # Also fix event handler colors that are still dark rgba
    # onMouseEnter/Leave with rgba(240,236,249,X) → use var() directly
    content = re.sub(
        r"\.color='rgba\(240,236,249,(0\.\d+)\)'",
        lambda m: ".color='var(--text-1)'" if float(m.group(1))>=0.75
                  else ".color='var(--text-2)'" if float(m.group(1))>=0.45
                  else ".color='var(--text-3)'",
        content)
    content = re.sub(
        r"\.color='rgba\(248,250,252,(0\.\d+)\)'",
        lambda m: ".color='var(--text-1)'" if float(m.group(1))>=0.75
                  else ".color='var(--text-2)'" if float(m.group(1))>=0.45
                  else ".color='var(--text-3)'",
        content)
    # Fix remaining inline rgba backgrounds in event handlers
    content = re.sub(
        r"\.background='rgba\(255,255,255,(0\.0[1-9]\d?)\)'",
        r".background='var(--bg-input)'",
        content)
    content = re.sub(
        r"\.borderColor='rgba\(255,255,255,(0\.\d+)\)'",
        r".borderColor='var(--border)'",
        content)
    # Fix -webkit-text-fill-color: #F0ECF9
    content = content.replace(
        '-webkit-text-fill-color: #F0ECF9',
        '-webkit-text-fill-color: var(--text-1)')
    # Fix dark modal backgrounds in JSX style objects
    content = re.sub(
        r"background:'rgba\(14,\d+,\d+,0\.\d+\)'",
        "background:'var(--bg-surface)'",
        content)
    # Fix dark toast error background
    content = content.replace("background:#2a1a1a", "background:var(--bg-surface)")
    content = re.sub(r"(background:\s*'#2a1a1a')", "background:'var(--bg-surface)'", content)
    # Fix JSX inline style with #F0ECF9 / #F8FAFC still left
    content = re.sub(r"(color:\s*'#F0ECF9')", "color:'var(--text-1)'", content)
    content = re.sub(r"(color:\s*'#F8FAFC')", "color:'var(--text-1)'", content)
    # Fix remaining rgba 240 in JSX style objects (not event handlers)
    content = re.sub(
        r"(color:\s*')rgba\(240,236,249,(0\.\d+)\)(')",
        lambda m: m.group(1) + (
            'var(--text-1)' if float(m.group(2))>=0.75
            else 'var(--text-2)' if float(m.group(2))>=0.45
            else 'var(--text-3)'
        ) + m.group(3),
        content)
    content = re.sub(
        r"(color:\s*')rgba\(248,250,252,(0\.\d+)\)(')",
        lambda m: m.group(1) + (
            'var(--text-1)' if float(m.group(2))>=0.75
            else 'var(--text-2)' if float(m.group(2))>=0.45
            else 'var(--text-3)'
        ) + m.group(3),
        content)
    # Fix inline JSX rgba backgrounds still left
    content = re.sub(
        r"(background:\s*')rgba\(255,255,255,0\.0[1-9]\d?\)(')",
        r"\1var(--bg-input)\2",
        content)
    return content

for rel_path in FILES:
    path = os.path.join(BASE, rel_path)
    if not os.path.exists(path):
        continue
    with open(path, 'r') as f:
        original = f.read()
    updated = process(original)
    if updated != original:
        with open(path, 'w') as f:
            f.write(updated)
        orig_set = set(original.splitlines())
        upd_set = set(updated.splitlines())
        n = len([l for l in upd_set if l not in orig_set])
        print(f'FIXED ({n} lines): {rel_path}')
    else:
        print(f'no changes: {rel_path}')

print('Done.')
