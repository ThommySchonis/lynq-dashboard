#!/usr/bin/env python3
"""Fix remaining rgba colors in JSX ternary expressions and specific patterns."""
import re, os

BASE = '/Users/thommy.schonisziggo.nl/projects/lynq-dashboard'

def opacity_to_text(op):
    v = float(op)
    return 'var(--text-1)' if v >= 0.75 else 'var(--text-2)' if v >= 0.45 else 'var(--text-3)'

def fix_rgba_in_strings(content):
    # Fix 'rgba(240,236,249,X)' → appropriate text var (inside JS string quotes)
    def repl240(m):
        return "'" + opacity_to_text(m.group(1)) + "'"
    content = re.sub(r"'rgba\(240,236,249,(0\.\d+)\)'", repl240, content)

    # Fix 'rgba(248,250,252,X)' → appropriate text var
    def repl248(m):
        return "'" + opacity_to_text(m.group(1)) + "'"
    content = re.sub(r"'rgba\(248,250,252,(0\.\d+)\)'", repl248, content)

    # Fix '#F0ECF9' → 'var(--text-1)'
    content = re.sub(r"'#F0ECF9'", "'var(--text-1)'", content)

    # Fix low-opacity white bg in ternary: 'rgba(255,255,255,0.04)' → 'var(--bg-input)'
    content = re.sub(r"'rgba\(255,255,255,0\.0[1-9]\d?\)'", "'var(--bg-input)'", content)
    # 0.10-0.15 range → bg-surface-2
    content = re.sub(r"'rgba\(255,255,255,0\.1[0-5]?\)'", "'var(--bg-surface-2)'", content)

    # Fix STATUS.closed bg/border (very low opacity white)
    content = content.replace(
        "bg:'rgba(255,255,255,0.07)'",
        "bg:'var(--bg-surface-2)'")
    content = content.replace(
        "border:'rgba(255,255,255,0.1)'",
        "border:'var(--border)'")

    # Fix dark modal backgrounds in services
    content = content.replace(
        "background:linear-gradient(160deg,#1e1042 0%,#170d38 100%)",
        "background:var(--bg-surface)")
    content = content.replace(
        "background:'linear-gradient(160deg,#1e1042 0%,#170d38 100%)'",
        "background:'var(--bg-surface)'")

    # Fix sdrop (status dropdown) dark background - object style
    content = re.sub(
        r"(background:\s*')rgba\(14,7,34,0\.\d+\)(')",
        r"\1var(--bg-surface)\2", content)

    # Fix border rgba(255,255,255,X) in strings
    content = re.sub(r"'rgba\(255,255,255,0\.(?:04|05|06|065|07|075|08|09|1|13|14)\)'",
        "'var(--border)'", content)

    # Fix dark bg colors still in services modal
    content = content.replace("background:rgba(13,6,32,0.82)", "background:rgba(0,0,0,0.5)")

    # Fix analytics/performance spinner border
    content = content.replace(
        "border:`2px solid rgba(255,255,255,0.1)`",
        "border:`2px solid var(--border)`")

    # Fix services modal-card dark gradient
    content = re.sub(
        r"background:linear-gradient\(160deg,#[0-9a-f]+ 0%,#[0-9a-f]+ 100%\)",
        "background:var(--bg-surface)", content)

    return content

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

for rel_path in FILES:
    path = os.path.join(BASE, rel_path)
    if not os.path.exists(path):
        continue
    with open(path, 'r') as f:
        original = f.read()
    updated = fix_rgba_in_strings(original)
    if updated != original:
        with open(path, 'w') as f:
            f.write(updated)
        n = sum(1 for a, b in zip(original.splitlines(), updated.splitlines()) if a != b)
        print(f'FIXED ({n} lines): {rel_path}')
    else:
        print(f'no changes: {rel_path}')
print('Done.')
