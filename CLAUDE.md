# Project & Vault Rules — Instructions for Claude Code

## Context Navigation (Graphify)

### 3-Layer Query Rule
1. **First:** Query `graphify-out/graph.json` via `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"`. If `graphify-out/wiki/index.md` exists, use it for broad navigation.
2. **Second:** Query the Obsidian vault (`/docs` or `/notes`) for decisions, architecture notes, and project context.
3. **Third:** Only read raw code files when editing specific lines — never browse source files cold.

### Graphify Commands
- `graphify query "<question>"` — BFS traversal, broad context (use first)
- `graphify path "<A>" "<B>"` — shortest path between two concepts
- `graphify explain "<concept>"` — focused plain-language explanation
- `graphify update .` — incremental rebuild after modifying code (AST-only, no API cost)
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review when the above return insufficient context.

## Obsidian Note Rules
- When writing architecture notes or documentation, always save them in your documentation folder (e.g., `/docs` or `/notes`).
- Use internal Obsidian wikilinks: `[[Note Name]]` instead of standard markdown file links `[Note](file.md)`.
- Use a standard frontmatter block at the top of new documentation notes exactly like this:
  ```yaml
  ---
  tags: [dev-log, architecture]
  status: updated
  ---