#!/usr/bin/env python3
"""PostToolUse hook — auto-update Obsidian docs on git commit or Cloud Build deploy."""
import json, sys, subprocess, re
from datetime import datetime
from pathlib import Path

# Resolve project root from script location (.claude/scripts/post-bash.py → project root)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DOCS = PROJECT_ROOT / 'docs'
LOG_FILE = DOCS / 'Decision-Log.md'
INFRA_FILE = DOCS / 'Infrastructure.md'

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_ROOT)

def append_to_log(date, commit_hash, commit_type, description):
    if not LOG_FILE.exists():
        return
    content = LOG_FILE.read_text()
    new_row = f'| {date} | `{commit_hash}` | {commit_type} | {description} |\n'

    if '| Date |' in content:
        lines = content.splitlines(keepends=True)
        # Find the last table row (last line starting with '|' after the header)
        last_table_line = None
        in_table = False
        for i, line in enumerate(lines):
            if '| Date |' in line:
                in_table = True
            if in_table and line.strip().startswith('|'):
                last_table_line = i
        if last_table_line is not None:
            lines.insert(last_table_line + 1, new_row)
            LOG_FILE.write_text(''.join(lines))
        else:
            LOG_FILE.write_text(content.rstrip() + '\n' + new_row + '\n')
    else:
        header = '\n\n## Recent Activity\n\n| Date | Commit | Type | Description |\n|---|---|---|---|\n'
        LOG_FILE.write_text(content.rstrip() + header + new_row)

try:
    data = json.load(sys.stdin)
    cmd = data.get('tool_input', {}).get('command', '')
    if not cmd or not DOCS.exists():
        sys.exit(0)

    date = datetime.now().strftime('%Y-%m-%d')

    # ── Git commit ────────────────────────────────────────────────────────────
    if 'git commit' in cmd and '--amend' not in cmd:
        result = run(['git', 'log', '--oneline', '-1'])
        if result.returncode == 0 and result.stdout.strip():
            parts = result.stdout.strip().split(' ', 1)
            commit_hash = parts[0]
            commit_msg = parts[1] if len(parts) > 1 else ''
            # Extract conventional commit type and description (e.g. "feat(scope): msg")
            m = re.match(r'^(\w+)(?:\([^)]*\))?!?:\s*(.*)', commit_msg, re.DOTALL)
            if m:
                commit_type = m.group(1)
                description = m.group(2).strip()
            else:
                commit_type = 'chore'
                description = commit_msg
            append_to_log(date, commit_hash, commit_type, description)
            # Keep graph fresh
            run(['graphify', 'update', '.'])

    # ── Cloud Build deploy ────────────────────────────────────────────────────
    elif 'gcloud builds submit' in cmd:
        output = str(data.get('tool_response', ''))
        status = '✅ SUCCESS' if 'SUCCESS' in output else '❌ FAILED'
        result = run(['git', 'log', '--oneline', '-1'])
        commit_ref = result.stdout.strip().split()[0] if result.returncode == 0 else 'unknown'
        if INFRA_FILE.exists():
            content = INFRA_FILE.read_text()
            note = f'\n- **{date}** `{commit_ref}`: Cloud Build → Cloud Run {status}'
            if '## Deployments' in content:
                content = content.replace('## Deployments', '## Deployments' + note, 1)
            else:
                content = content.rstrip() + '\n\n## Deployments' + note + '\n'
            INFRA_FILE.write_text(content)

    # ── PR merge ─────────────────────────────────────────────────────────────
    elif 'gh pr merge' in cmd:
        # Extract PR number from command
        m = re.search(r'gh pr merge\s+(\d+)', cmd)
        pr_num = m.group(1) if m else '?'
        result = run(['gh', 'pr', 'view', pr_num, '--json', 'title,headRefName'])
        pr_title, branch = '', ''
        if result.returncode == 0:
            try:
                info = json.loads(result.stdout)
                pr_title = info.get('title', '')
                branch = info.get('headRefName', '')
            except Exception:
                pass
        desc = pr_title or f'branch {branch}' or f'PR #{pr_num}'
        append_to_log(date, f'PR#{pr_num}', 'merge', desc)

    # ── Git push ──────────────────────────────────────────────────────────────
    elif re.search(r'\bgit push\b', cmd) and 'git push' in cmd:
        result = run(['git', 'log', '--oneline', '-1'])
        if result.returncode == 0 and result.stdout.strip():
            commit_hash = result.stdout.strip().split()[0]
            # Only note push in Infrastructure.md (not Decision-Log — commit already captured that)
            if INFRA_FILE.exists():
                content = INFRA_FILE.read_text()
                note = f'\n- **{date}** `{commit_hash}`: pushed to GitHub'
                if '## Deployments' in content:
                    content = content.replace('## Deployments', '## Deployments' + note, 1)
                else:
                    content = content.rstrip() + '\n\n## Deployments' + note + '\n'
                INFRA_FILE.write_text(content)

except Exception:
    pass  # Never block tool execution

sys.exit(0)
