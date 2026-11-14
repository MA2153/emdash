## What does this PR do?

Declares the return type of `EmDashRuntime.handleContentUpdate` explicitly. The published declaration is then the same no matter which compiler emits it.

The return type used to be inferred. The current `tsc`-based declaration build keeps the specific failure variants:
- `SAVE_REJECTED` with `details: SandboxSaveRejectionDetails`
- `SAVE_REJECTED` without details
- `CONTENT_HOOK_ERROR`
- the generic `{ code: string; details?: Record<string, unknown> }` failure with `status?`

tsgo infers the same function differently. Its subtype reduction folds all of these into `{ success: false; error: { code: string; message: string } }`. Code that narrows on `error.code === "SAVE_REJECTED"` to read `error.details` then stops type-checking. This blocks generating declarations with tsgo (`claude/perf-dts-tsgo`).

### Changes

- `handleContentUpdate` returns `Promise<ContentUpdateResult>`. `ContentUpdateResult` is a module-private alias built from existing types: `Extract<ApiResult<never>, { success: false }>` (the same pattern `api/handlers/transfer.ts` uses), `ContentResponse` and `ContentWrite`, plus the two success shapes the function returns.
- `beforeSaveFailure()` returns a new module-private `BeforeSaveFailure` alias holding its three variants. No new types are exported.
- `SandboxSaveRejectionDetails` changes from an interface to a type alias.
  - As an interface it isn't assignable to `HandlerResponse`'s `details?: Record<string, unknown>`. Interfaces don't get implicit index signatures.
  - So `EmDashRuntime` didn't satisfy `ContentSaveSite` once the `SAVE_REJECTED` variant was kept. It only type-checked before because tsgo's reduction dropped that variant.
  - The type isn't exported from any public entry point, so the change isn't observable by consumers.

### Verification

I compared the declarations with type-level identity and assignability checks. The compared outputs were `main`'s tsc output, this branch's tsc output, and this branch built with the tsgo declaration config from `claude/perf-dts-tsgo` (applied locally only). Each check ran under both tsc and tsgo.

- `main` (tsc) and this branch (tsc): mutually assignable. Narrowing a failure on `code === "SAVE_REJECTED"` gives `details` as `{ pluginId: string; reason: string } | undefined` in both.
- This branch, tsc and tsgo: the return types are identical under the strict identity check.
- Negative control: the same checks against a tsgo build of unmodified `main` fail the identity and narrowing checks. Plain assignability still passes, so the difference is only visible when narrowing.

To check for other members with the same problem, I compared the type of every `EmDashRuntime` member between tsc and tsgo output.
- Before this change, `handleContentUpdate` was the only member that differed. After it, none do.
- The other four flagged members (`cronExecutor`, `email`, `hooks`, `schemaRegistry`) are classes with private members. Those flag even between two tsc builds.
- A whole-tree line comparison of core's declarations, ignoring union member order, shows no other differences beyond printing.

The tsc declaration text changes for this method: it now references the `ContentUpdateResult` and `BeforeSaveFailure` aliases instead of inlining the union. The bundler also attaches an existing JSDoc comment, from an unexported constant, next to the new aliases. Neither changes the type, so there is no changeset.

Closes #

## Type of change

- [ ] Bug fix
- [ ] Feature (requires an [accepted feature plan or RFC](https://github.com/emdash-cms/emdash/tree/main/proposals))
- [x] Refactor (no behavior change)
- [ ] Translation
- [ ] Documentation
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
- [x] `pnpm lint` passes (`lint:quick` passes, and `lint:json` reports 0 diagnostics)
- [x] `pnpm test` passes (or targeted tests for my change): the before-save rejection integration tests (sandboxed and in-process) and the sandbox hook-result unit tests, 22 tests
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable): not added. A type test would restate the annotation; the cross-compiler checks above were run once as verification.
- [ ] User-visible strings in the admin UI are [wrapped for translation](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md#internationalization-i18n) (if applicable): not applicable
- [ ] I have added and reviewed the user-facing [changeset](https://github.com/emdash-cms/emdash/blob/main/.changeset/README.md) (if this PR changes a published package): not applicable, the published type is semantically unchanged
- [ ] New features link to their merged design PR: not applicable
- [ ] I have included screenshots below if this PR changes the UI: not applicable

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

Not applicable.
