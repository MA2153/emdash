## What does this PR do?

Moves admin's `vite` devDependency from `^7.0.0` to the workspace catalog (`^8.3.0`, resolving 8.3.1), and removes `vite@7.3.1` from the lockfile.

In admin, `vite` only runs the Vitest browser suite; the package build uses tsdown. `@vitejs/plugin-react` stays at 4.7.0. Its declared peer range ends at Vite 7, but `apps/labeler` already runs 4.7.0 on Vite 8 with the same `babel` option for the Lingui macro. The first version that declares Vite 8 support is 5.2.0, which would add a third `@vitejs/plugin-react` version to the lockfile. 6.x drops the `babel` option, so the Lingui macro setup would have to move to `@rolldown/plugin-babel`. Either upgrade can be a follow-up.

This branch is stacked on the lockfile dedupe PR (`claude/deps-dedupe-lockfile`) and is independent of the core Vite 8 PR.

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
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes (`lint:quick` and `lint:json` report zero diagnostics)
- [x] `pnpm test` passes (or targeted tests for my change): admin browser suite. See the test output below.
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable) — not applicable, the change only affects the test toolchain
- [ ] User-visible strings in the admin UI are wrapped for translation (if applicable) — not applicable
- [ ] I have added and reviewed the user-facing changeset (if this PR changes a published package) — not applicable: devDependency only, and the published build doesn't use Vite
- [ ] New features link to their merged design PR — not applicable
- [ ] I have included screenshots below if this PR changes the UI — not applicable

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

The first full admin run on Vite 8 failed two timing-dependent tests in `tests/editor/video-block-editor.test.tsx`: video `readyState` and Tab order. The file passed on its own afterwards. A `tests/editor` run then failed one other timing-dependent test, the toolbar fade in `PortableTextEditor.test.tsx`. Two more `tests/editor` runs passed in full (64 files, 1,147 tests). The Vite 7 baseline passed one `tests/editor` run. Because each failure was a different test and passed on rerun, these look like timing flakes on a busy shared machine, not a Vite 8 regression. CI should confirm.
