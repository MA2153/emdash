## What does this PR do?

`pnpm build` fails on Node.js 26 at the default V8 heap (about 2.1 GB on a 16 GB machine) with `Reached heap limit` in core's tsdown step. Contributors currently need `NODE_OPTIONS=--max-old-space-size=4096` to build the repository.

Two things push core's declaration build over the limit:

1. `packages/core/src/astro/routes/PluginRegistry.tsx` imports `AdminApp` from the `@emdash-cms/admin` barrel. That makes the declaration program load the barrel's whole type graph, including `@cloudflare/kumo` and 3,092 `@phosphor-icons/react` declaration files. This PR adds an `@emdash-cms/admin/internal/app` entry that exports only `AdminApp`, `AdminAppProps` and `AdminBranding`, and switches `PluginRegistry.tsx` to it. The new entry's declaration chunk references Lingui, TanStack Query, React and `@emdash-cms/blocks`, but not Kumo or Phosphor. The entry sits under `internal/` alongside the other core-only subpaths, so it doesn't add public API.
2. Even with (1), the `build:done` hook (`buildUiTypes`) then ran out of memory. `rolldown-plugin-dts` keeps the TypeScript programs from the main build in a module-level context that it reuses across builds in the same process, so the hook's second declaration build ran on top of the first one's retained heap. Setting `dts: { newContext: true }` in core's tsdown config releases that context at `buildEnd`.

Neither change is enough on its own. Both counterfactuals were measured and both run out of memory (see below).

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

| Run | Before | After |
| --- | --- | --- |
| Root `pnpm build`, default heap (no `NODE_OPTIONS`) | OOM in core | pass, 92–95 s, 2.64 GB peak |
| core `pnpm build`, default heap (~2,144 MB) | OOM (28 s, 2.62 GB) | pass (22.7 s, 2.49 GB) |
| core `pnpm build`, 1,800 MB heap | not run (OOMs at the default heap) | pass (26.2 s, 2.20 GB) |
| core `pnpm build`, 1,500 MB heap | | OOM |
| Only the narrow entry, default heap | | OOM in `buildUiTypes` |
| Only `newContext: true`, default heap | | OOM in the main build |
| Files in a program rooted at `PluginRegistry.tsx` (`tsgo --listFilesOnly`) | 5,119 (3,092 Phosphor, 61 Kumo) | 634 (0 Phosphor, 0 Kumo) |

The admin still works:

- `demos/simple` with `astro dev` (admin aliased to source): the admin dashboard loads through `/_emdash/api/setup/dev-bypass` with no page or console errors.
- `demos/simple` with `astro build` and `node dist/server/entry.mjs` (admin resolved from `dist`): `/_emdash/admin` renders the sign-in screen with no page or console errors.

`publint` passes for `@emdash-cms/admin`. `attw` (in the package `check` script) crashes with `Cannot read properties of undefined (reading 'filename')` both with and without the new export, so the crash predates this change.
