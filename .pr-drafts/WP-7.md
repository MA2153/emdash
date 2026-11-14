## What does this PR do?

The `emdash` integration, smoke, and host suites ran a full `pnpm build` in their Vitest global setup with a 120-second timeout. On a 4-vCPU machine the full build takes about 83 s with a raised heap, so a slower machine hits the limit and the suite fails before any test runs. The e2e setup had the same full-build fallback when the CLI binary was missing.

This PR:

- Builds only the dependency closure of the sites each suite starts, with no timeout and with build output streamed to the terminal:
  - integration and host suites: `emdash-demo^...`, because their test servers resolve dependencies through `demos/simple/node_modules` (13 packages with a build script, against 25 for the root build)
  - smoke suite: `{./templates/*}^...` and `{./demos/*}^...`, because it starts and packs the demos and templates (15 packages). It gets its own global setup file.
- Adds `EMDASH_TEST_SKIP_BUILD=1` to reuse existing `dist/` output, documented in CONTRIBUTING.md.
- In `e2e/global-setup.ts`, folds the full-build fallback into the existing scoped `emdash-e2e-fixture...` build, which already includes `emdash`, and removes its 180 s timeout.
- Updates the CI comment on the host test job.

A "skip when `dist/` is newer than the sources" check was not added. `dist/` spans many workspace packages, and an mtime heuristic can silently run tests against stale code. CI is unaffected: its integration, smoke, and host jobs check out fresh and rely on the global setup to build, which still happens.

Closes #

## Type of change

- [ ] Bug fix
- [ ] Feature (requires an [accepted feature plan or RFC](https://github.com/emdash-cms/emdash/tree/main/proposals))
- [ ] Refactor (no behavior change)
- [ ] Translation
- [ ] Documentation
- [ ] Performance improvement
- [x] Tests
- [ ] Chore (dependencies, CI, tooling)

## Your connection to this change

- [ ] I use EmDash and ran into the problem this PR addresses
- [ ] I maintain a tool, dependency, or service that EmDash uses, and this change concerns that integration
- [ ] A Maintainer approved this specific change before I opened the PR

## Checklist

- [x] I have read [CONTRIBUTING.md](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md)
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm test` passes (or targeted tests for my change)
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable) — not applicable; this changes test setup only
- [ ] User-visible strings in the admin UI are [wrapped for translation](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md#internationalization-i18n) (if applicable) — not applicable, no admin UI change
- [ ] I have added and reviewed the user-facing [changeset](https://github.com/emdash-cms/emdash/blob/main/.changeset/README.md) (if this PR changes a published package) — not applicable, no published package changes
- [ ] New features link to their merged design PR — not applicable
- [ ] I have included screenshots below if this PR changes the UI — not applicable

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

Not applicable for screenshots. Test output, on a 4-vCPU machine with `NODE_OPTIONS=--max-old-space-size=4096`:

- `vitest run --config vitest.integration.config.ts tests/integration/cli/help.test.ts`: scoped build plus tests in 64 s; 4 tests passed.
- `EMDASH_TEST_SKIP_BUILD=1 vitest run --config vitest.integration.config.ts tests/integration/cli`: no build; 16 files and 138 tests passed.
- `vitest run --config vitest.smoke.config.ts tests/integration/smoke/sqlite-prerender.test.ts`: smoke-scoped build plus tests in 86 s; 2 tests passed.
- The e2e suite was not run. `pnpm -r --filter "emdash-e2e-fixture..."` and `"emdash-e2e-fixture-cloudflare..."` both include `emdash`, so the merged build still produces the CLI binary.
