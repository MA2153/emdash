## What does this PR do?

Makes `pnpm dev` (watch mode) in `packages/core` and `packages/admin` rebuild JavaScript only.

- Both `dev` scripts now run `tsdown --watch --no-dts --no-clean`.
- Core's `build:done` hook runs `buildUiTypes` only when declarations are enabled. Before this change, `--no-dts` alone still copied all of `src/` and ran a second declaration build on every rebuild.
- `--no-clean` keeps the declarations from the last `pnpm build` in `dist/`. Without it, starting watch mode would delete them, and dependent packages and demos would have no types at all instead of stale ones.
- CONTRIBUTING's watch-mode section now says that declarations don't update in watch mode, and that you need to rerun `pnpm build` after changing exported types.

Measured on a 4 vCPU machine with Node 26, rebuilding after a one-line edit (`src/utils/slugify.ts` in core, `src/slugify.ts` in admin):

| Package | Before | After |
| --- | --- | --- |
| core | ~19 s rebuild + ~1.5 s UI types, 3.4 GB resident | ~0.8 s, 0.7 GB |
| admin | ~12.7 s full build with `.d.ts` (separate measurement, not a watch rebuild) | ~5.5 s, 1.0 GB (most of this is the Lingui Babel transform) |

`pnpm build` is unaffected. Its JavaScript output is byte-identical. Its `.d.mts` output differs only in the same ways two consecutive builds of unmodified `main` already differ (union member order and type-chunk hashes).

Because `--no-clean` is set, watch mode leaves superseded hashed chunks in `dist/` until the next `pnpm build`.

Closes #

## Type of change

- [ ] Bug fix
- [ ] Feature (requires an [accepted feature plan or RFC](https://github.com/emdash-cms/emdash/tree/main/proposals))
- [ ] Refactor (no behavior change)
- [ ] Translation
- [ ] Documentation
- [x] Performance improvement
- [ ] Tests
- [x] Chore (dependencies, CI, tooling)

## Your connection to this change

- [ ] I use EmDash and ran into the problem this PR addresses
- [ ] I maintain a tool, dependency, or service that EmDash uses, and this change concerns that integration
- [ ] A Maintainer approved this specific change before I opened the PR

## Checklist

- [x] I have read [CONTRIBUTING.md](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md)
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes (`lint:quick` passes, and `lint:json` reports 0 diagnostics)
- [ ] `pnpm test` passes (or targeted tests for my change): no tests cover dev scripts; I verified watch mode by hand as described above
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable): not applicable, tooling only
- [ ] User-visible strings in the admin UI are [wrapped for translation](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md#internationalization-i18n) (if applicable): not applicable
- [ ] I have added and reviewed the user-facing [changeset](https://github.com/emdash-cms/emdash/blob/main/.changeset/README.md) (if this PR changes a published package): not applicable, published output is unchanged
- [ ] New features link to their merged design PR: not applicable
- [ ] I have included screenshots below if this PR changes the UI: not applicable

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

Not applicable.
