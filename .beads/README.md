# Beads - AI-Native Issue Tracking

Welcome to Beads! This repository uses **Beads** for issue tracking - a modern, AI-native tool designed to live directly in your codebase alongside your code.

## How HabitCraft stores its issues

> This section is HabitCraft-specific and overrides the generic guidance below.

This repo runs bd on the **embedded Dolt backend** (`.beads/metadata.json` →
`"dolt_mode": "embedded"`). That means:

- **The Dolt remote is the single source of truth.** Issue data lives in
  `.beads/embeddeddolt/`, which is gitignored, and is shared by pushing to the
  remote configured as `sync.remote` in `config.yaml`.
- **Git does not carry a copy of the issues.** `issues.jsonl` and
  `sync_base.jsonl` were tracked until 2026-07-28 but nothing refreshed them
  under the embedded backend, so they drifted 4 months and ~79 issues out of
  date while still looking authoritative. They are now gitignored
  (habitcraft-fa3). A stale snapshot is worse than no snapshot.
- **`bd dolt push` is what preserves your work**, not `git push`. Running only
  `git push` leaves new issues on this machine alone. See the session
  completion checklist in [AGENTS.md](../AGENTS.md).

Need a human-readable dump for grepping or archaeology? Generate one on demand
and leave it untracked:

```bash
bd export -o /tmp/issues.jsonl        # regular issues
bd export --all -o /tmp/full.jsonl    # plus infra, templates, gates, memories
```

## What is Beads?

Beads is issue tracking that lives in your repo, making it perfect for AI coding agents and developers who want their issues close to their code. No web UI required - everything works through the CLI and integrates seamlessly with git.

**Learn more:** [github.com/steveyegge/beads](https://github.com/steveyegge/beads)

## Quick Start

### Essential Commands

```bash
# Create new issues
bd create "Add user authentication"

# View all issues
bd list

# View issue details
bd show <issue-id>

# Update issue status
bd update <issue-id> --status in_progress
bd update <issue-id> --status done

# Sync with git remote
bd sync
```

### Working with Issues

Issues in Beads are:
- **Git-native**: Stored in the repo and synced like code (in HabitCraft, via
  the embedded Dolt database and `bd dolt push` — see above, not `issues.jsonl`)
- **AI-friendly**: CLI-first design works perfectly with AI coding agents
- **Branch-aware**: Issues can follow your branch workflow
- **Always in sync**: Auto-syncs with your commits

## Why Beads?

✨ **AI-Native Design**
- Built specifically for AI-assisted development workflows
- CLI-first interface works seamlessly with AI coding agents
- No context switching to web UIs

🚀 **Developer Focused**
- Issues live in your repo, right next to your code
- Works offline, syncs when you push
- Fast, lightweight, and stays out of your way

🔧 **Git Integration**
- Automatic sync with git commits
- Branch-aware issue tracking
- Intelligent JSONL merge resolution

## Get Started with Beads

Try Beads in your own projects:

```bash
# Install Beads
curl -sSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# Initialize in your repo
bd init

# Create your first issue
bd create "Try out Beads"
```

## Learn More

- **Documentation**: [github.com/steveyegge/beads/docs](https://github.com/steveyegge/beads/tree/main/docs)
- **Quick Start Guide**: Run `bd quickstart`
- **Examples**: [github.com/steveyegge/beads/examples](https://github.com/steveyegge/beads/tree/main/examples)

---

*Beads: Issue tracking that moves at the speed of thought* ⚡
