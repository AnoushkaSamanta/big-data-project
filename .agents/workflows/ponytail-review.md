---
description: Review code changes for over-engineering, what can be deleted
---

# Ponytail Review

Review the current code changes for over-engineering only, not correctness. One line per finding: `L<line>: <tag> <what to cut>. <replacement>.`

### Tags
- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

End with the net lines removable: `net: -<N> lines possible.`
If nothing to cut, say: `Lean already. Ship.`
