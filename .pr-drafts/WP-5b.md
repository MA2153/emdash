## What does this PR do?

Moves core's `vite` devDependency from `^6.0.0` to the workspace catalog (`^8.3.0`, resolving 8.3.1). Astro, the demos, and most of the workspace already run Vite 8.

Core uses `vite` only as a devDependency. The source imports `type { Plugin }` (the emitted declarations are unchanged), and tests call `build()`, `createServer()` and `isRunnableDevEnvironment()`. No code changes were needed. The change removes core's `vite@6.4.1` peer variants from the lockfile. `vite@6` itself stays, because the blocks playground and `infra/perf-monitor` still use it.

This branch is stacked on the lockfile dedupe PR (`claude/deps-dedupe-lockfile`).

## Type of change

- [ ] Bug fix
- [ ] Feature (requires an [accepted feature plan or RFC](https://github.com/emdash-cms/emdash/tree/main/proposals))
- [ ] Refactor (no behavior change)
- [ ] Translation
- [ ] Documentation
- [ ] Performance improvement
- [ ] Tests
- [x] Chore (dependencies, CI, tooling)

## Your connection to this change

- [ ] I use EmDash and ran into the problem this PR addresses
- [ ] I maintain a tool, dependency, or service that EmDash uses, and this change concerns that integration
- [ ] A Maintainer approved this specific change before I opened the PR

## Checklist

- [ ] I have read [CONTRIBUTING.md](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md)
- [x] `pnpm typecheck` passes (also `pnpm typecheck:demos`)
- [x] `pnpm lint` passes (`lint:quick` and `lint:json` report zero diagnostics)
- [x] `pnpm test` passes (or targeted tests for my change): core `tests/unit` (533 files, 7,208 tests) and `tests/integration/astro` (23 files, 203 tests)
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable) — not applicable, the existing Vite-driven tests cover it
- [ ] User-visible strings in the admin UI are wrapped for translation (if applicable) — not applicable
- [ ] I have added and reviewed the user-facing changeset (if this PR changes a published package) — not applicable: devDependency only, and the published output is unchanged
- [ ] New features link to their merged design PR — not applicable
- [ ] I have included screenshots below if this PR changes the UI — not applicable

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

Not applicable.
