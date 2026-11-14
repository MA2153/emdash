> **Depends on** the PR from `claude/types-handle-content-update-return`, which declares `EmDashRuntime.handleContentUpdate`'s return type. Merge that one first. This branch is not rebased onto it. Once both are on `main`, tsc and tsgo emit the same type for that method, and the only remaining declaration differences are printing-only ones (see "Declaration differences"). No changeset is needed.

## What does this PR do?

Generates the `.d.ts` files for `emdash` (core) and `@emdash-cms/admin` with tsgo instead of the TypeScript compiler. It uses rolldown-plugin-dts's experimental `dts.tsgo` option. This cuts core's build memory roughly in half, and `pnpm build` now passes at Node 26's default heap without `NODE_OPTIONS`.

- **Core:** `dts: { tsgo: true, tsconfig: "tsconfig.build.json", emitJs: false }`.
  - The new `packages/core/tsconfig.build.json` includes `src/astro/**`. The base `tsconfig.json` excludes it, and tsgo emits declarations only for files in its program. The `jsx` setting is unchanged.
  - `emitJs: false` stops the plugin from asking tsgo to emit declarations for the bundled `@emdash-cms/registry-verification` JavaScript (`noExternal`). Those imports resolve to the package's own `.d.ts` files instead. The published JavaScript bundle is unchanged.
- **Admin:** `dts: { tsgo: true }`.
- **Version pin:** `rolldown-plugin-dts` is pinned to `0.22.2` with a pnpm override, because the option is experimental. The tsgo binary is already pinned exactly through `@typescript/native-preview` in the root `package.json`.
- **`buildUiTypes` stays on tsc.** It takes about 1.5 s, and moving it would mean restructuring its temporary-directory `.astro` declaration step for little gain.

### Measurements

Measured on 4 vCPU and Node 26, peak RSS of the process tree:

| Build | Before (tsc) | After (tsgo) |
| --- | --- | --- |
| core tsdown, without `buildUiTypes` | 19.9–21.5 s, 2.53–2.56 GB (4 GB heap) | 7.0–7.7 s, 1.23–1.26 GB |
| core `pnpm build`, with `buildUiTypes` | ~23 s, 2.78 GB; OOM at the default heap | 10.9 s, 1.20 GB at the default heap |
| admin tsdown | 14.2–15.0 s, 1.60–1.81 GB | 10.5–11.7 s, 1.01 GB |
| root `pnpm build`, default heap | OOM in core | passes, 88.7 s, 2.43 GB |

### Equivalence

- **JavaScript:** byte-identical for both packages.
  - One tsgo build of core differed from `main` in 22 route files: a bare side-effect `import "./plan-*.mjs"` was missing. The reachable module set was identical; only evaluation order differed.
  - A second tsgo build matched `main` byte for byte. This is timing-dependent ordering in rolldown, not a change in output.
- **Admin declarations:** semantically equivalent; only union member order differs.
  - Two tsc builds of admin were identical, and two tsgo builds were identical.
- **Core declarations:** compared against two tsc baselines after normalizing chunk hashes.
  - The two tsc baselines also differ from each other in union order and chunk contents.
  - tsgo's output is deterministic across runs.

### Declaration differences in core

- Union member order changes. This is not a semantic change.
- `unknown | undefined` prints as `unknown`, and `30_000` prints as `30000`. Both are equivalent.
- JSDoc on `private` members and on non-exported helpers is dropped, for example `S3Storage.getObject`. Consumers can't see these members.
- One chunk keeps an unused `import { … } from "@emdash-cms/registry-lexicons"`. It is harmless because the package is a declared dependency.
- **The inferred return type of `EmDashRuntime.handleContentUpdate`.** On this branch alone, tsgo's subtype reduction folds its `SAVE_REJECTED` and `CONTENT_HOOK_ERROR` failure variants into `{ success: false; error: { code: string; message: string } }`. The prerequisite PR declares the return type explicitly. With it applied, tsc and tsgo emit identical types for every `EmDashRuntime` member, checked member by member under both compilers.

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
- [ ] `pnpm test` passes (or targeted tests for my change): build-tooling change; verified by declaration and JavaScript output comparison and a full `pnpm typecheck` against the new declarations
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable): not applicable
- [ ] User-visible strings in the admin UI are [wrapped for translation](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md#internationalization-i18n) (if applicable): not applicable
- [ ] I have added and reviewed the user-facing [changeset](https://github.com/emdash-cms/emdash/blob/main/.changeset/README.md) (if this PR changes a published package): not applicable once the prerequisite PR has merged; published types are then unchanged apart from printing
- [ ] New features link to their merged design PR: not applicable
- [ ] I have included screenshots below if this PR changes the UI: not applicable

`publint` passes for both packages. `attw` could not be run: it fails with `Cannot read properties of undefined (reading 'filename')` for every package in this environment, including untouched ones such as `@emdash-cms/auth`. It fails on a manually packed tarball too.

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

Not applicable.
