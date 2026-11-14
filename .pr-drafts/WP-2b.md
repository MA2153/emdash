## What does this PR do?

Sets `dts: { newContext: true }` in `packages/core/tsdown.config.ts`, which lowers the peak memory of core's build.

`rolldown-plugin-dts` keeps the TypeScript programs from a declaration build in a module-level context, which it reuses across builds in the same process. Core's `build:done` hook (`buildUiTypes`) runs a second declaration build in the same process, so it ran on top of the main build's retained heap. `newContext: true` releases that context at `buildEnd`.

This builds on `claude/perf-admin-internal-app-entry`, which gets core's build under the default Node.js 26 heap with little margin to spare. With both changes, the root `pnpm build` passes reliably at the default heap, and core's build passes at 1,800 MB. On its own, this change lowers the heap core needs from 4,096 MB to 2,600 MB, which isn't enough to fix the default-heap build.

The option only controls when `rolldown-plugin-dts` creates and releases its TypeScript context. It doesn't change compiler options or entry points.

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
- [ ] I have added and reviewed the user-facing [changeset](https://github.com/emdash-cms/emdash/blob/main/.changeset/README.md) (if this PR changes a published package)
- [ ] New features link to their merged design PR: https://github.com/emdash-cms/emdash/pull/...
- [ ] I have included screenshots below if this PR changes the UI

No changeset: this changes only build configuration, and the published packages are the same. No tests: the change affects build memory, not runtime behavior; the measurements below are the verification. No UI strings or UI change.

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

Not applicable (no UI change). Measured on 4 vCPU, 15.7 GiB RAM, Node 26.13.1. Peak = combined RSS of the process tree.

Core `pnpm build`:

| Variant | Default heap (2,144 MB) | Lowest heap tried that passes | Peak at 4,096 MB heap |
| --- | --- | --- | --- |
| `main` | out of memory | 4,096 MB | 3.30 GB |
| This PR alone | out of memory | 2,600 MB | 2.82 GB |
| Narrow admin entry alone | passes | 2,000 MB | 2.70 GB |
| Narrow admin entry + this PR | passes | 1,800 MB | 2.55 GB |

Root `pnpm build` at the default heap: the narrow admin entry alone passed 4 of 5 runs, and the one failure ran out of memory in `buildUiTypes`. With both changes it passed 3 of 3 runs, about 66 s, 2.64–2.77 GB peak.
