---
description: Audit the whole repo for over-engineering, what can be deleted
---

# Ponytail Audit

Audit the entire repository for over-engineering only, not correctness. Scan the whole tree, not a diff. One line per finding, ranked biggest cut first: `<tag> <what to cut>. <replacement>. [path]`.
Tags: delete, stdlib, native, yagni, shrink. End with the net lines and dependencies removable. If nothing to cut: 'Lean already. Ship.'
