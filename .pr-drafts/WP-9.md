## What does this PR do?

Updates `CONTRIBUTING.md` for contributors working on machines with limited memory, and corrects the prerequisites.

- **Prerequisites:** Node.js 22.16+, to match `engines.node` (`>=22.16`), and pnpm 11, to match `packageManager` (`pnpm@11.9.0`). The page said Node.js 22+ and pnpm 10+.
- **New "Checks on a machine with limited memory" subsection** under Checks:
  - `pnpm lint` (type-aware) uses the most memory of the checks. Use `pnpm lint:quick` locally on a smaller machine; CI runs `pnpm lint` on every pull request.
  - Run `pnpm build`, `pnpm typecheck`, `pnpm lint` and the `emdash` test suite one at a time.
  - Run a scoped part of the `emdash` test suite with `pnpm --filter emdash exec vitest run <dir-or-file>`.

The memory figures were measured on a 4-core, 16 GB machine, one command at a time:

| Command | Time | Peak RSS |
| --- | --- | --- |
| `pnpm lint` | 46 s | 8.9 GB |
| `pnpm lint:quick` | 11 s | 3.0 GB |
| `pnpm typecheck` | 40 s | 2.0 GB |
| `pnpm build` | 82 s | 2.8 GB |

The page doesn't document a `NODE_OPTIONS=--max-old-space-size` workaround. On Node 26, `pnpm build` on `main` runs out of heap in `packages/core`. With the narrow admin entry change (`claude/perf-admin-app-entry`), the root build passed at the default heap: 82 s, 2.79 GB peak, no `NODE_OPTIONS`. If that change doesn't land first, this page needs that workaround.

Closes #

## Type of change

- [ ] Bug fix
- [ ] Feature (requires an [accepted feature plan or RFC](https://github.com/emdash-cms/emdash/tree/main/proposals))
- [ ] Refactor (no behavior change)
- [ ] Translation
- [x] Documentation
- [ ] Performance improvement
- [ ] Tests
- [ ] Chore (dependencies, CI, tooling)

## Your connection to this change

- [ ] I use EmDash and ran into the problem this PR addresses
- [ ] I maintain a tool, dependency, or service that EmDash uses, and this change concerns that integration
- [ ] A Maintainer approved this specific change before I opened the PR

## Checklist

- [x] I have read [CONTRIBUTING.md](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md)
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [ ] `pnpm test` passes (or targeted tests for my change) — not applicable, documentation only
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable) — not applicable, documentation only
- [ ] User-visible strings in the admin UI are [wrapped for translation](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md#internationalization-i18n) (if applicable) — not applicable
- [ ] I have added and reviewed the user-facing [changeset](https://github.com/emdash-cms/emdash/blob/main/.changeset/README.md) (if this PR changes a published package) — not applicable, no published package changes
- [ ] New features link to their merged design PR — not applicable
- [ ] I have included screenshots below if this PR changes the UI — not applicable

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (claude-opus-5-5)

## Screenshots / test output

Not applicable.
