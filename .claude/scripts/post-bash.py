#!/usr/bin/env python3
"""PostToolUse hook — auto-update Obsidian docs on git commit or Cloud Build deploy."""
import json, sys, subprocess, os
from datetime import datetime
from pathlib import Path

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

cmd = data.get('tool_input', {}).get('command', '')
docs = Path('docs')
if not docs.exists() or not cmd:
    sys.exit(0)

date = datetime.now().strftime('%Y-%m-%d')
log_file = docs / 'Decision-Log.md'

# ── Git commit ────────────────────────────────────────────────────────────────
if 'git commit' in cmd and 'git commit --' not in cmd:
    result = subprocess.run(['git', 'log', '--oneline', '-1'], capture_output=True, text=True)
    if result.returncode != 0 or not result.stdout.strip():
        sys.exit(0)
    entry = result.stdout.strip()
    commit_hash, *msg_parts = entry.split(' ', 1)
    commit_msg = msg_parts[0] if msg_parts else ''

    if log_file.exists():
        content = log_file.read_text()
        new_row = f'| {date} | `{commit_hash}` | {commit_msg} | commit |\n'
        # Insert after the table header if present, else append
        if '| Date |' in content:
            # Find end of table and insert
            lines = content.splitlines(keepends=True)
            insert_at = None
            in_table = False
            for i, line in enumerate(lines):
                if '| Date |' in line:
                    in_table = True
                if in_table and line.strip() and not line.strip().startswith('|'):
                    insert_at = i
                    break
            if insert_at:
                lines.insert(insert_at, new_row)
                log_file.write_text(''.join(lines))
            else:
                log_file.write_text(content.rstrip() + '\n' + new_row)
        else:
            table_header = (
                '\n\n## Recent Activity\n\n'
                '| Date | Commit | Message | Type |\n'
                '|---|---|---|---|\n'
            )
            log_file.write_text(content.rstrip() + table_header + new_row)

    # Also run graphify update to keep graph fresh
    subprocess.run(['graphify', 'update', '.'], capture_output=True)

# ── Cloud Build deploy ────────────────────────────────────────────────────────
elif 'gcloud builds submit' in cmd:
    tool_output = data.get('tool_response', {})
    output_str = str(tool_output)
    success = 'SUCCESS' in output_str

    infra_file = docs / 'Infrastructure.md'
    if infra_file.exists():
        content = infra_file.read_text()
        status = '✅ SUCCESS' if success else '❌ FAILED'
        deploy_note = f'\n- **{date}**: Cloud Build deploy — {status}\n'
        if '## Deployments' in content:
            content = content.replace('## Deployments', '## Deployments' + deploy_note, 1)
        else:
            content = content.rstrip() + '\n\n## Deployments\n' + deploy_note
        infra_file.write_text(content)

except Exception as e:
    # Never block the tool — silently exit
    pass

sys.exit(0)
