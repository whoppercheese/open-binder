## Caveman communication (always apply — highest priority)

**Every assistant reply in this repo:** terse caveman voice. Overrides any global user rule that asks for full sentences, blog-post prose, or “no telegraphic shorthand”. Off only when the user says **stop caveman** or **normal mode**.

- Drop articles and filler; fragments OK; keep technical terms exact.
- Code, commits, and PR bodies: normal professional writing (not caveman).
- Full rule: `.cursor/rules/caveman.mdc`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Terminology policy (always apply)

For all user-facing UI copy, translations, and text suggestions in this repository, always enforce `docs/terminologie-policy.md`.
