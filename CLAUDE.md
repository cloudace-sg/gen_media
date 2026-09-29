# Project & Vault Rules — Instructions for Claude Code

## Context Navigation (Graphify)

### 3-Layer Query Rule
1. **First:** Query `graphify-out/graph.json` via `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"`. If `graphify-out/wiki/index.md` exists, use it for broad navigation.
2. **Second:** Query the Obsidian vault (`/docs` or `/notes`) for decisions, architecture notes, and project context.
3. **Third:** Only read raw code files when editing specific lines — never browse source files cold. `graphify explain "<ComponentName>"` gives callers/callees/location in ~15 lines; reading the whole file first (even a 1000+ line one) to "get oriented" skips a step that already exists — don't do it.

### Graphify Commands
- `graphify query "<question>"` — BFS traversal, broad context (use first)
- `graphify path "<A>" "<B>"` — shortest path between two concepts
- `graphify explain "<concept>"` — focused plain-language explanation
- `graphify update .` — incremental rebuild after modifying code (AST-only, no API cost)
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review when the above return insufficient context.

## Efficient Tool Usage (token discipline)
- **Filter before it lands in context.** `npm install`/`npm run build`/`gcloud builds submit` output is full of deprecation spam. Redirect to a file and `grep` for `STATUS|ERROR|SUCCESS|Failed to compile` first; only widen to a full tail if the grep comes up empty.
- **Read with `offset`/`limit`** when only one function or section is needed — don't read a whole file to check one thing, especially after `graphify explain` has already pointed at the line number.
- **`ToolSearch` queries should be narrow.** Use `select:<exact-tool-name>` when the tool name is already known. A vague keyword query (e.g. "context usage") can pull in several large, unrelated tool schemas that then sit in context for the rest of the session for no benefit.
- **Fork for log-heavy or open-ended investigation** (build debugging, multi-file audits) so raw output stays out of the main thread and only the summary comes back.

## Obsidian Note Rules
- When writing architecture notes or documentation, always save them in your documentation folder (e.g., `/docs` or `/notes`).
- Use internal Obsidian wikilinks: `[[Note Name]]` instead of standard markdown file links `[Note](file.md)`.
- Use a standard frontmatter block at the top of new documentation notes exactly like this:
  ```yaml
  ---
  tags: [dev-log, architecture]
  status: updated
  ---