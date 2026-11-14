## What does this PR do?

`pnpm build` fails on Node.js 26 at the default V8 heap (about 2.1 GB on a 16 GB machine) with `Reached heap limit` in core's tsdown step. Contributors currently need `NODE_OPTIONS=--max-old-space-size=4096` to build the repository.

The main cause is that `packages/core/src/astro/routes/PluginRegistry.tsx` imports `AdminApp` from the `@emdash-cms/admin` barrel. Core's declaration program then loads the barrel's whole type graph, including `@cloudflare/kumo` and 3,092 `@phosphor-icons/react` declaration files.

This PR adds an `@emdash-cms/admin/internal/app` entry that exports only `AdminApp`, `AdminAppProps` and `AdminBranding`, and switches `PluginRegistry.tsx` to it. The new entry's declaration chunk references Lingui, TanStack Query, React and `@emdash-cms/blocks`, but not Kumo or Phosphor. The entry sits under `internal/` alongside the other core-only subpaths, so it doesn't add public API.

With this change, core's build passes at the default heap, but with little margin. In the root build, where other packages compile in parallel, it passed 4 of 5 runs, and the failure was in core's `buildUiTypes` hook. A follow-up PR (`claude/perf-dts-new-context`) releases the main declaration build's TypeScript context before that hook runs, and closes the remaining gap.

At runtime, the Vite alias for `@emdash-cms/admin` uses prefix matching, so the new subpath resolves to `src/internal/app.ts` in in-repo dev and to `dist/internal/app.js` everywhere else. The production client bundle of `demos/simple` still contains a single copy of the admin app module.

Closes #

## Type of change

- [ ] Bug fix
- [ ] Feature (requires an [accepted feature plan or RFC](https://github.com/emdash-cms/emdash/tree/main/proposals))
- [ ] Refactor (no behavior change)
- [ ] Translation
- [ ] Documentation
- [x] Performance improvement
- [ ] Tests
- [ ] Chore (dependencies, CI, tooling)

## Your connection to this change

- [ ] I use EmDash and ran into the problem this PR addresses
- [ ] I maintain a tool, dependency, or service that EmDash uses, and this change concerns that integration
- [ ] A Maintainer approved this specific change before I opened the PR

## Checklist

- [x] I have read [CONTRIBUTING.md](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md)
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes (`lint:quick`, and `lint:json` reports 0 diagnostics)
- [ ] `pnpm test` passes (or targeted tests for my change)
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable)
- [ ] User-visible strings in the admin UI are [wrapped for translation](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md#internationalization-i18n) (if applicable). Do not include `messages.po` changes except in translation PRs — a workflow extracts catalogs on merge to `main`.
- [x] I have added and reviewed the user-facing [changeset](https://github.com/emdash-cms/emdash/blob/main/.changeset/README.md) (if this PR changes a published package)
- [ ] New features link to their merged design PR: https://github.com/emdash-cms/emdash/pull/...
- [ ] I have included screenshots below if this PR changes the UI

There are no unit tests for this change: it changes build memory and an import path, not runtime behavior. The checks below (build at fixed heap limits, the admin loading in dev and production) are the verification. There are no UI strings, and the admin UI does not change.

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

Not applicable (no UI change). Measured on 4 vCPU, 15.7 GiB RAM, Node 26.13.1. Peak = combined RSS of the process tree.

| Run | `main` | This PR |
| --- | --- | --- |
| core `pnpm build`, default heap (2,144 MB) | out of memory | passes (3 of 3), about 21 s, 2.65 GB peak |
| core `pnpm build`, 4,096 MB heap | passes, 3.30 GB peak | passes, 2.70 GB peak |
| Lowest heap tried at which core's build passes | 4,096 MB | 2,000 MB (1,800 MB fails in `buildUiTypes`) |
| Root `pnpm build`, default heap | out of memory in core | passes 4 of 5 runs, about 65 s, 2.8 GB peak |
| Files in a program rooted at `PluginRegistry.tsx` (`tsgo --listFilesOnly`) | 5,119 (3,092 Phosphor, 61 Kumo) | 634 (0 Phosphor, 0 Kumo) |

The admin still works:

- `demos/simple` with `astro dev` (admin aliased to source): the admin dashboard loads through `/_emdash/api/setup/dev-bypass` with no page or console errors.
- `demos/simple` with `astro build` and `node dist/server/entry.mjs` (admin resolved from `dist`): `/_emdash/admin` renders the sign-in screen with no page or console errors.

`publint` passes for `@emdash-cms/admin`. `attw` (in the package `check` script) crashes with `Cannot read properties of undefined (reading 'filename')` both with and without the new export, so the crash predates this change.
