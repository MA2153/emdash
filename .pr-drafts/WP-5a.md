## What does this PR do?

Dedupes `pnpm-lock.yaml` and points three stale dev-dependency ranges at the workspace catalog, so fresh installs fetch fewer duplicate toolchains.

- `pnpm dedupe` removes 113 lockfile packages and adds none (1,981 → 1,868). Among them: `workerd@1.20260301.1` (about 114 MB on disk), `wrangler@4.71.0`, `miniflare@4.20260301.1`, `esbuild@0.27.3`, `@cloudflare/vite-plugin` 1.26.1 and 1.36.3. Every consumer now resolves `@cloudflare/vite-plugin@1.53.0`.
- The dedupe moved `@atcute/jetstream` and `@atcute/firehose` from the patched `partysocket@1.1.18` to the unpatched 1.1.19 that `agents` pins. That broke the labeler's jetstream adapter test (`MessageEvent constructor: Expected eventInitDict.source … to be an instance of MessagePort`). Two scoped overrides in `pnpm-workspace.yaml` keep both packages on the patched version. The number of patched resolutions in the lockfile is unchanged (11).
- The root `typescript` pin (`6.0.0-beta`), the blocks playground's `wrangler` range (`^4.63.0`) and perf-monitor's `@cloudflare/vite-plugin` range (`^1.0.0`) now use `catalog:`. This drops `typescript@6.0.0-beta`; `@astrojs/check` in the demos and templates now resolves TypeScript 6.0.3.
- `pnpm dedupe --check` now exits 0 (about 23 s).

`workerd` still has four versions: 1.20260507.1 comes from `miniflare@4` (`@emdash-cms/sandbox-workerd`'s optional dependency), and the others are peer-selected by `@cloudflare/unenv-preset`. `vite@6`/`vite@7` and the rolldown release candidates remain; the Vite major upgrades are separate PRs.

I did not add `pnpm dedupe --check` to CI: Dependabot's npm updates don't dedupe, so a blocking check would fail most Dependabot lockfile PRs. That needs a maintainer decision (blocking check with a manual dedupe, an auto-apply workflow like the formatting one, or no check).

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
- [x] `pnpm test` passes (or targeted tests for my change): core unit tests, admin browser tests, and the `test:unit` packages
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable) — not applicable, lockfile and dev ranges only; the existing labeler test caught the partysocket regression
- [ ] User-visible strings in the admin UI are wrapped for translation (if applicable) — not applicable
- [ ] I have added and reviewed the user-facing changeset (if this PR changes a published package) — not applicable: no published package's dependency ranges or output change
- [ ] New features link to their merged design PR — not applicable
- [ ] I have included screenshots below if this PR changes the UI — not applicable

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

Not applicable.
