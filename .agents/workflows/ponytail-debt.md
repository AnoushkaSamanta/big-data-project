---
description: Harvest ponytail: comments into a tracked debt ledger
---

# Ponytail Debt

Harvest every `ponytail:` comment in this repository into a debt ledger so deferrals do not rot into 'later means never'. Grep the whole tree for comment markers (`grep -rnE '(#|//) ?ponytail:' .`, skipping node_modules, .git, and build output).
One row per marker, grouped by file: `<file>:<line> — <what was simplified>. ceiling: <limit>. upgrade: <trigger>`. Tag any marker lacking an upgrade path as `no-trigger`.
