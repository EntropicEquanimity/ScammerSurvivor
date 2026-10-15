@AGENTS.md

## Claude Code notes

- Stage gate: slice 1 (the walking skeleton: no model calls, no scam content) may be built locally. Slice 2 onward waits until the builder has read `docs/prd.md` and `docs/build-plan.md` and the results of kill tests A, A2, A3 and B are written into `docs/kill-test.md`.
- Never without the builder saying go: deploying to Cloud Run, creating or pushing to the public GitHub repo, committing, spending credits.
- Build one slice at a time from `docs/build-plan.md`. Run that slice's check before starting the next.
- After any change under `content/`, `server/agents/`, `server/guard/` or `web/`, run the `policy-reviewer` agent on the diff.
- Before every commit, push, deploy and the submission, run the `cup-reviewer` agent on the tree. It checks the Cup gates (Google stack only, fresh code, Cloud Run, English only, deliverables) and lists the people-gates it cannot see.
- Use the `scenario-author` agent to draft pattern notes; the content lead approves each one and the playtest lead takes a second look.
- One builder writes the repo. Teammates send pattern notes and playtest notes; they do not edit code. Tracked files name people by role; names live in `CLAUDE.local.md`.
- Public repo: never write a machine path, key or teammate's personal detail into a tracked file. Machine-specific pointers go in `CLAUDE.local.md`.
