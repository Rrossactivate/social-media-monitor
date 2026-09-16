---
name: hello-dojo
description: Minimal smoke-test skill that prints a hello message. Use when verifying that skill loading, packaging, or a Skills Dojo submission round-trip works end to end. Not for production use.
---

# hello-dojo

A deliberately tiny skill used to confirm that skill discovery, loading, and
submission work. It does one thing.

## What to do

Print exactly this line and nothing else:

```
hello from the dojo
```

Do not add commentary, follow-up questions, or extra formatting. The whole point
is that the output is trivially checkable by a test.

## Verifying

```bash
bash .claude/skills/hello-dojo/hello.sh
# -> hello from the dojo
```
