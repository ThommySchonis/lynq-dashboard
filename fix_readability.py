#!/usr/bin/env python3
"""
Fix all dark-mode hardcoded colors so pages are readable in light mode.
Replaces rgba translucent-white text/bg colors with CSS vars.
"""
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

def opacity_to_text_var(opacity_str):
    """Map opacity 0.0-1.0 to --text-1/2/3"""
    v = float(opacity_str)
    if v >= 0.75:
        return 'var(--text-1)'
    elif v >= 0.45:
        return 'var(--text-2)'
    else:
        return 'var(--text-3)'

def replace_rgba_text(m):
    return opacity_to_text_var(m.group(1))

def process(content):
    # ── 1. rgba(240,236,249, X) text colors → var(--text-X) ──────────────
    # In CSS strings: color:rgba(240,236,249,0.32)
    # In JSX strings: color:'rgba(240,236,249,0.32)'
    def repl_240(m):
        return m.group(1) + opacity_to_text_var(m.group(2))
    # CSS string context: color:rgba(...)
    content = re.sub(
        r'(color:)rgba\(240,236,249,(0\.\d+|1(?:\.0)?)\)',
        repl_240, content)
    # JSX string context: color:'rgba(...)'  or  color: 'rgba(...)'
    content = re.sub(
        r"(color:\s*')rgba\(240,236,249,(0\.\d+|1(?:\.0)?)\)(')",
        lambda m: m.group(1).replace("'","") + opacity_to_text_var(m.group(2)) + m.group(3),
        content)
    # Fix the above — keep quote context
    content = re.sub(
        r"((?:color|fill):\s*')rgba\(240,236,249,(0\.\d+|1(?:\.0)?)\)(')",
        lambda m: m.group(1) + opacity_to_text_var(m.group(2)) + m.group(3),
        content)

    # ── 2. rgba(248,250,252, X) text colors → var(--text-X) ──────────────
    def repl_248(m):
        return m.group(1) + opacity_to_text_var(m.group(2))
    content = re.sub(
        r'(color:)rgba\(248,250,252,(0\.\d+|1(?:\.0)?)\)',
        repl_248, content)
    content = re.sub(
        r"((?:color|fill):\s*')rgba\(248,250,252,(0\.\d+|1(?:\.0)?)\)(')",
        lambda m: m.group(1) + opacity_to_text_var(m.group(2)) + m.group(3),
        content)

    # ── 3. Hardcoded near-white text hex → var(--text-1) ──────────────────
    # In CSS strings
    for hex_val in ['#F0ECF9', '#F8FAFC', '#FFFFFF']:
        content = re.sub(r'((?:color|fill):)' + re.escape(hex_val) + r'\b', r'\1var(--text-1)', content)
    # In JSX strings
    for hex_val in ['#F0ECF9', '#F8FAFC']:
        content = re.sub(r"((?:color|fill):\s*')" + re.escape(hex_val) + r"(')", r'\1var(--text-1)\2', content)

    # ── 4. Placeholder colors (very low opacity white) → var(--text-3) ────
    content = re.sub(r'((?:color):)rgba\(240,236,249,0\.(?:1[0-9]?|2[0-4]?)\)',
        r'\1var(--text-3)', content)
    content = re.sub(r"((?:color):\s*')rgba\(240,236,249,0\.(?:1[0-9]?|2[0-4]?)\)(')",
        r'\1var(--text-3)\2', content)

    # ── 5. Dark modal/dropdown backgrounds → var(--bg-surface) ───────────
    # sdrop background
    content = re.sub(
        r'background:rgba\(14,7,34,0\.96\)',
        'background:var(--bg-surface)', content)
    content = re.sub(
        r"background:\s*'?rgba\(14,7,34,0\.96\)'?",
        "background:'var(--bg-surface)'", content)
    # modal-box dark gradients
    content = re.sub(
        r'background:linear-gradient\(145deg,rgba\(20,10,50,0\.98\)[^;]+\)',
        'background:var(--bg-surface)', content)
    content = re.sub(
        r'background:linear-gradient\(145deg,rgba\(14,6,38,0\.\d+\)[^;]+\)',
        'background:var(--bg-surface)', content)
    # Other dark backgrounds
    content = re.sub(r'background:#1a0e38\b', 'background:var(--bg-surface)', content)
    content = re.sub(r'background:#1a2744\b', 'background:var(--bg-surface)', content)
    content = re.sub(r"background:\s*'#1a0e38'\b", "background:'var(--bg-surface)'", content)
    # Overlay/modal backgrounds in JS
    content = re.sub(
        r"(background:\s*')rgba\(0,0,0,0\.7[0-9]\)(')",
        r'\1rgba(0,0,0,0.5)\2', content)

    # ── 6. Very-low-opacity white backgrounds → var(--bg-input) ──────────
    # CSS string: background:rgba(255,255,255,0.035) etc.
    for op in ['0.02', '0.025', '0.028', '0.03', '0.035', '0.038', '0.04', '0.042', '0.045', '0.048', '0.05', '0.052']:
        content = re.sub(
            r'background:rgba\(255,255,255,' + re.escape(op) + r'\)',
            'background:var(--bg-input)', content)
    # JSX: background: 'rgba(255,255,255,0.035)'
    content = re.sub(
        r"(background:\s*')rgba\(255,255,255,0\.0[1-9]\d?\)(')",
        r'\1var(--bg-input)\2', content)

    # ── 7. White-rgba borders → var(--border) ────────────────────────────
    for op in ['0.04', '0.05', '0.06', '0.065', '0.07', '0.075', '0.08', '0.085', '0.09', '0.1']:
        content = re.sub(
            r'border:1px solid rgba\(255,255,255,' + re.escape(op) + r'\)',
            'border:1px solid var(--border)', content)
    # border-bottom, border-top, border-right, border-left
    for side in ['bottom', 'top', 'right', 'left']:
        for op in ['0.04', '0.05', '0.05', '0.06', '0.065', '0.07', '0.075', '0.08', '0.1', '0.12', '0.13']:
            content = re.sub(
                r'border-' + side + r':1px solid rgba\(255,255,255,' + re.escape(op) + r'\)',
                'border-' + side + ':1px solid var(--border)', content)

    # ── 8. btn-ghost / input text colors ─────────────────────────────────
    # Already handled by rule 1/2 but let's catch JSX inline style map values
    # color: rgba(240,236,249,X) in object literals (no quotes around whole thing but inside object)
    content = re.sub(
        r"(color:\s*)rgba\(240,236,249,(0\.\d+|1(?:\.0)?)\)",
        lambda m: m.group(1) + opacity_to_text_var(m.group(2)),
        content)
    content = re.sub(
        r"(color:\s*)rgba\(248,250,252,(0\.\d+|1(?:\.0)?)\)",
        lambda m: m.group(1) + opacity_to_text_var(m.group(2)),
        content)

    # ── 9. Trow / list item hover backgrounds ────────────────────────────
    content = re.sub(
        r'background:rgba\(255,255,255,0\.(?:04[0-9]?|05[0-9]?|06[0-9]?|07[0-9]?)\)',
        'background:var(--bg-input)', content)

    # ── 10. search input border (isearch) ────────────────────────────────
    content = content.replace(
        'border:1px solid rgba(255,255,255,0.065)',
        'border:1px solid var(--border)')

    # ── 11. Modal label colors (ultra-low opacity) ────────────────────────
    content = re.sub(
        r'(color:)rgba\(240,236,249,0\.[012]\d*\)',
        r'\1var(--text-3)', content)

    return content


for rel_path in FILES:
    path = os.path.join(BASE, rel_path)
    if not os.path.exists(path):
        print(f'SKIP (not found): {rel_path}')
        continue
    with open(path, 'r') as f:
        original = f.read()
    updated = process(original)
    if updated != original:
        with open(path, 'w') as f:
            f.write(updated)
        # Count changes
        orig_lines = set(original.splitlines())
        upd_lines = set(updated.splitlines())
        changed = len([l for l in upd_lines if l not in orig_lines])
        print(f'FIXED ({changed} lines changed): {rel_path}')
    else:
        print(f'no changes: {rel_path}')

print('Done.')
