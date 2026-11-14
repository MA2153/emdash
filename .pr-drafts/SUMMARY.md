# EmDash tooling efficiency: branch and PR summary

The branches below came out of a tooling-efficiency audit of `MA2153/emdash`. Each branch is meant to land as its own PR. All of them are pushed to `origin`, and no PRs are open yet. Every branch is cut from `origin/main` at `bd5286c`, except where the table says otherwise.

The PR body drafts are in this directory (`.pr-drafts/<WP>.md`), filled in from `.github/PULL_REQUEST_TEMPLATE.md`. In each one, the "Your connection to this change" boxes are left unticked for a human to fill in. The repo's AI policy requires a human to authorize every PR separately.

All measurements come from one 4 vCPU, 15 GB RAM machine on Node 26.13.1 and pnpm 11.9.0. "Peak" is the peak resident memory of the whole process tree. Timings vary by about ±15% between runs.

## At a glance

| # | Branch | Commit | Changeset | Draft | One-line purpose |
| - | ------ | ------ | --------- | ----- | ---------------- |
| WP-2a | `claude/perf-admin-internal-app-entry` | `52bdca0` | patch: `emdash`, `@emdash-cms/admin` | `WP-2a.md` | Narrow admin entry; the default-heap build passes, with little margin |
| WP-2b | `claude/perf-dts-new-context` | `b84b705` | none | `WP-2b.md` | `dts.newContext`; with WP-2a, the default-heap build passes reliably |
| WP-6-pre | `claude/types-handle-content-update-return` | `0b853fb` | none | `WP-6-pre.md` | Explicit return type, so tsc and tsgo publish the same type |
| WP-6 | `claude/perf-dts-tsgo` | `6c0cfb6` | none (needs WP-6-pre first) | `WP-6.md` | Generate core and admin `.d.ts` with tsgo, about 2.5× faster at half the memory |
| WP-1 | `claude/perf-dev-watch-no-dts` | `7869234` | none | `WP-1.md` | `dev` watch mode skips declarations; a rebuild drops from 19 s to 0.8 s |
| WP-4 | `claude/perf-build-skip-playground` | `6009d77` | none | `WP-4.md` | Root build skips the private blocks playground |
| WP-8 | `claude/fix-postbuild-relink` | `d68ca9d` | none | `WP-8.md` | Make the `postbuild` bin relink actually work |
| WP-7 | `claude/perf-test-setup-build` | `5bc5cfa` | none | `WP-7.md` | Test global setups build only what they need, with no 120 s timeout |
| WP-12 | `claude/perf-test-db-template` | `050c7ed` | none | `WP-12.md` | Tests copy a migrated template database; core suite drops from 867 s to 603 s |
| WP-5a | `claude/deps-dedupe-lockfile` | `fce8315` | none | `WP-5a.md` | `pnpm dedupe` plus aligning stale version ranges; 113 fewer packages |
| WP-5b | `claude/deps-core-vite-8` | `31c2175` | none | `WP-5b.md` | core devDependency: Vite 6 to 8 (**stacked on WP-5a**) |
| WP-5c | `claude/deps-admin-vite-8` | `747243c` | none | `WP-5c.md` | admin devDependency: Vite 7 to 8 (**stacked on WP-5a**) |
| WP-9 | `claude/docs-contributing-low-memory` | `9b84d6b` | none | `WP-9.md` | CONTRIBUTING: correct the prerequisites, add advice for low-memory machines |

Each branch ran the repo's pre-commit checks: `pnpm format`, root `pnpm build`, `pnpm lint:quick`, `lint:json` returning 0 diagnostics, `pnpm typecheck`, and the relevant tests. The exceptions are in the per-branch notes.

## How they fit together

There are three themes.

1. **Build memory and speed of the published packages:** WP-2a, WP-2b, WP-6-pre, WP-6 and WP-1.
   - WP-2a and WP-2b fix the hard failure: on `main`, `pnpm build` aborts with `Reached heap limit` on Node 26 unless `NODE_OPTIONS=--max-old-space-size=4096` is set. They are independent changes and were split from one branch (`claude/perf-admin-app-entry`, `bcb8a42`, superseded). WP-2a does most of the work; WP-2b adds the margin.
   - WP-6 fixes the same failure in a different way, and also makes declaration builds much faster. It is independent of WP-2a and WP-2b, and all three are worth landing.
   - WP-6 depends on WP-6-pre. Without it, tsgo publishes a weaker type for `EmDashRuntime.handleContentUpdate`.
   - WP-1 only affects the `dev` watch loop.
   - All four edit the `dts:` and `hooks:` lines in `packages/core/tsdown.config.ts` (see [Conflicts](#conflicts)).
2. **Root build and test workflow:** WP-4, WP-8, WP-7 and WP-12. These are independent of each other and of theme 1.
3. **Dependencies:** WP-5a, WP-5b and WP-5c.
   - WP-5b and WP-5c each stack on WP-5a, and are independent of each other.
   - WP-6 also touches the lockfile and `pnpm-workspace.yaml` overrides.

WP-9 documents the state after everything else lands. In particular, it assumes WP-2a and WP-2b have landed, so it has no `NODE_OPTIONS` workaround.

### Suggested merge order

1. WP-2a, then WP-2b, so the default-heap build works for everyone.
2. WP-6-pre.
3. WP-4, WP-8, WP-7 and WP-12, in any order.
4. WP-5a, then WP-5b and WP-5c. Regenerate the lockfile for whichever of the two lands second.
5. WP-1. Resolve its `tsdown.config.ts` conflict with WP-2b.
6. WP-6, rebased onto everything above. Resolve conflicts with WP-2b, WP-1 and WP-5a.
7. WP-9, last. If WP-2a and WP-2b haven't landed by then, WP-9 needs the `NODE_OPTIONS` workaround added back.

### Conflicts

I merged every branch into `origin/main`, one after another, in the order above. Only these conflicted:

| Branch merged | Conflicts with | Files | Resolution |
| ------------- | -------------- | ----- | ---------- |
| WP-5c | WP-5b, since both are stacked on WP-5a | `pnpm-lock.yaml` | Rebase onto the merged WP-5b and run `pnpm install` to regenerate the lockfile. |
| WP-1 | WP-2b | `packages/core/tsdown.config.ts` | Keep both: `dts: { newContext: true }` from WP-2b, and WP-1's `hooks: { "build:done": ({ options }) => (options.dts ? buildUiTypes() : undefined) }`. Check that `tsdown --watch --no-dts` still switches declarations off when `dts` is an object. |
| WP-6 | WP-2b, WP-1, WP-5a | `packages/core/tsdown.config.ts`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | **Config:** use `dts: { tsgo: true, tsconfig: "tsconfig.build.json", emitJs: false }`, keep WP-1's gated hook, and test again whether WP-2b's `newContext: true` is still needed. With tsgo, the main build no longer holds TypeScript programs in memory, so it might not be. **Overrides:** keep WP-5a's two `partysocket` lines and WP-6's `rolldown-plugin-dts: 0.22.2` pin, then regenerate the lockfile with `pnpm install`. |

WP-1 and WP-7 add separate paragraphs to `CONTRIBUTING.md`, and WP-9 edits other sections, so all three merge without textual conflicts. Each touches different parts of `.github/workflows/ci.yml` (WP-4 and WP-7) and `package.json`, and those merged cleanly too.

## Per-branch notes

### WP-2a: narrow admin entry (`claude/perf-admin-internal-app-entry`)

- **Problem:** core's `PluginRegistry.tsx` imported `AdminApp` from the `@emdash-cms/admin` barrel. That pulled the whole admin type graph, including 3,092 Phosphor icon declarations, into core's declaration build.
- **Change:**
  - New entry `packages/admin/src/internal/app.ts`, published as `@emdash-cms/admin/internal/app`. It sits under `internal/` so it doesn't add public API, and exports only `AdminApp`, `AdminAppProps` and `AdminBranding`.
  - `PluginRegistry.tsx` imports from the new entry.
- **Effect:**
  - Files loaded from `PluginRegistry.tsx` drop from 5,119 to 634, with no Phosphor or Kumo.
  - Core's build at the default heap: out of memory before, passes after (3 of 3). Lowest heap tried that passes: 4,096 MB before, 2,000 MB after (1,800 MB fails in `buildUiTypes`). Peak at a 4 GB heap: 3.30 GB before, 2.70 GB after.
  - Root build at the default heap: passed 4 of 5 runs, about 65 s, 2.8 GB. The one failure was in `buildUiTypes`.
- **Verified:** the admin loads in `demos/simple` in both the dev server and a production build, with no console errors and a single copy of the admin app in the client bundle. This was checked on the superseded WP-2 branch, and the code in this branch is identical to that part of it.
- **Versioning:** core depends on admin as `workspace:*`, and both are in the same changesets `fixed` group, so the versions can't drift apart.
- **Note:** `attw` in admin's `check` script crashes on `main` too, with `Cannot read properties of undefined (reading 'filename')`. This branch didn't cause it.

### WP-2b: release the dts context (`claude/perf-dts-new-context`)

- **Problem:** `rolldown-plugin-dts` keeps the main build's TypeScript programs in a module-level context, so core's `buildUiTypes` hook ran its declaration build on top of that retained heap.
- **Change:** `dts: { newContext: true }` in core's tsdown config, a one-line change with no changeset.
- **Effect:**
  - Alone: core's build still runs out of memory at the default heap. Lowest heap tried that passes drops from 4,096 MB to 2,600 MB, and the peak at a 4 GB heap from 3.30 GB to 2.82 GB.
  - With WP-2a: core's build passes at 1,800 MB, peaking at 2.55 GB at a 4 GB heap. The root build at the default heap passed 3 of 3 runs, about 66 s, 2.64–2.77 GB.
- **Checks:** the root build ran at a 4 GB heap, because this change alone can't pass at the default heap (neither can `main`).
- **May become unnecessary after WP-6:** with tsgo, the main build might no longer keep TypeScript programs in memory. Splitting it out makes it easy to drop.

### WP-6-pre: explicit `handleContentUpdate` return type (`claude/types-handle-content-update-return`)

- **Problem:** `handleContentUpdate` had no explicit return type, so its published type depended on how the compiler inferred it. tsgo merged the `SAVE_REJECTED` and `CONTENT_HOOK_ERROR` variants, and their typed `details`, into a generic `{ code: string; message: string }`.
- **Change:**
  - Two module-private type aliases, `BeforeSaveFailure` and `ContentUpdateResult`, built from existing types, and the explicit return type `Promise<ContentUpdateResult>`.
  - `SandboxSaveRejectionDetails` becomes a type alias instead of an interface, because an interface isn't assignable to `Record<string, unknown>`. The type isn't exported from any public entry point.
- **Verified:** tsc output before and after is equivalent, and narrowing on `SAVE_REJECTED` still gives a typed `details`. tsc and tsgo now emit identical types for this member. A scan of every other `EmDashRuntime` member found no other real difference between the two compilers.

### WP-6: tsgo declarations (`claude/perf-dts-tsgo`)

- **Change:**
  - **core:** `dts: { tsgo: true, tsconfig: "tsconfig.build.json", emitJs: false }`.
    - The new `tsconfig.build.json` includes `src/astro/**` and keeps the base `jsx` setting. That fixes the 249 errors the audit found.
    - `emitJs: false` keeps the bundled `registry-verification` JavaScript out of tsgo, so its own `.d.ts` files are used.
  - **admin:** `dts: { tsgo: true }`.
  - **Pin:** `rolldown-plugin-dts` is pinned to 0.22.2 through a pnpm override, because the tsgo option is experimental.
  - **Unchanged:** `buildUiTypes` stays on tsc. It takes about 1.5 s.
- **Effect:**

  | Build | Before | After |
  | ----- | ------ | ----- |
  | core declarations | about 20 s, 2.5 GB | about 7.5 s, 1.25 GB |
  | core full build | out of memory at the default heap | 10.9 s, 1.2 GB |
  | admin | about 14.5 s, 1.7 GB | about 11 s, 1.0 GB |
  | root build, default heap | out of memory | passes, 88.7 s, 2.43 GB |

  The published JavaScript doesn't change.
- **Equivalence:** apart from the `handleContentUpdate` type that WP-6-pre fixes, the declaration differences are cosmetic:
  - union member order;
  - `30_000` printed as `30000`, and `unknown | undefined` printed as `unknown`;
  - JSDoc dropped on private members.
- **Note:** declaration output on `main` already differs between two identical builds, in union order and in which chunk a type lands. Rolldown's JavaScript chunking can also vary with timing. Compare builds with that in mind.

### WP-1: no declarations in `dev` watch mode (`claude/perf-dev-watch-no-dts`)

- **Change:**
  - `dev` becomes `tsdown --watch --no-dts --no-clean` in both core and admin.
  - Core's `build:done` hook only runs `buildUiTypes` when declarations are on.
  - One paragraph in CONTRIBUTING: watch mode doesn't update types, so run `pnpm build` after changing exported types.
- **Why `--no-clean`:** without it, starting watch mode deletes the last build's declarations, so dependents lose their types entirely instead of seeing stale ones.
- **Effect:**
  - Core rebuild after a one-line edit: about 19 s at 3.4 GB before, 0.7–0.85 s at 0.69 GB after.
  - Admin rebuild: about 5 s. That remaining time is the Lingui Babel transform; see WP-10 under [Closed without a branch](#closed-without-a-branch).
- **Verified:** the JavaScript from `pnpm build` is byte-identical to before.
- **Not covered by tests:** no tests cover the `dev` scripts; watch mode was checked by hand.

### WP-4: skip the blocks playground in the root build (`claude/perf-build-skip-playground`)

- **Change:**
  - The root `build` script adds `--filter !@emdash-cms/blocks-playground`.
  - CI's typecheck job builds the playground in its own step. The root build was the only thing compiling it, and it has no typecheck script.
- **Effect:** root build goes from 89.5 s at 3.48 GB to 75.9 s at 2.77 GB.
- **Deployment:** the playground deploys to blocks.emdashcms.com by hand. Whoever deploys must first run `pnpm run --filter @emdash-cms/blocks-playground build`. The PR draft says this. We considered adding a wrangler `build.command` and decided against it.

### WP-8: fix the postbuild relink (`claude/fix-postbuild-relink`)

- **Problem:** `scripts/relink-bins-if-needed.mjs` ran `pnpm install`, which reports "Already up to date" and links nothing.
  - The bins that matter aren't just the root one. There are 93 `emdash`, `em` and `emdash-plugin` shims across 39 workspace projects, and they're missing after a fresh install because `dist/` doesn't exist yet.
  - The `bootstrap` and `seed` scripts in `infra/*` and `fixtures/perf-site` need them.
- **Change:** the script runs `pnpm --recursive rebuild --pending` instead. It still skips under `CI` and still only acts when the root bin is missing.
- **Effect:** restores all 93 shims in 1.8 s, and takes 0.04 s when they already exist.

### WP-7: scoped builds in test global setup (`claude/perf-test-setup-build`)

- **Change:**
  - New helper `packages/core/tests/integration/build-workspace.ts`. It builds the given pnpm filters with no timeout and streams the output.
  - The integration and host suites build `emdash-demo^...`, 13 packages.
  - The smoke suite gets its own global setup, which builds the dependencies of all templates and demos.
  - `EMDASH_TEST_SKIP_BUILD=1` skips the build. This is documented in CONTRIBUTING.
  - The e2e setup drops its separate full `pnpm build` fallback; its fixture build already covers the CLI. Its 180 s timeout is also removed.
- **Deliberately not done:** a "skip if `dist/` is newer than the sources" check. It could quietly run tests against stale code from other packages.
- **Effect:** the scoped build takes about 62 s, against about 83 s for a full build. The bigger gains are no timeout and the option to skip the build.
- **CI:** CI doesn't build before these suites, so the setup still builds by default and CI behaves the same.
- **Not run:** the host and e2e suites.

### WP-12: template test database (`claude/perf-test-db-template`)

- **Change:**
  - The first `setupTestDatabase()` call in each test file migrates normally, then dumps the database into a SQL script: DDL, rows written with `quote()` so value types survive, then indexes, triggers and views.
  - Later calls load that script into a fresh `:memory:` database. That takes about 9 ms, against about 110 ms for running the migrations.
  - Unchanged: the PostgreSQL paths, `setupTestDatabaseWithCompoundSelectLimit()`, and tests that run migrations directly.
- **Drift guard:** `tests/unit/database/test-db-template.test.ts` compares a restored database with a freshly migrated one: schema objects, rows, value types and pragmas. It fails when indexes or triggers are left out of the dump.
- **Effect:** the full core suite goes from 866.8 s (926 files, 11,510 tests) to 603.0 s (927 files, 11,512 tests).
- **Departures from the audit:**
  - The template is built once per test file instead of shared through Vitest's global setup. Sharing it was no faster: 131 s against 121 s on a 178-file subset.
  - It uses a plain SQL script instead of SQLite's serialize/deserialize, which CI's Node 22 doesn't support.
- **For review:**
  - Rows the migrations write, such as `_emdash_migrations` timestamps, now carry the time the template was built.
  - The dump skips `sqlite_*` tables, including `sqlite_sequence`. That only matters if a migration seeds rows into an `AUTOINCREMENT` table; no tests failed.

### WP-5a: dedupe and stale ranges (`claude/deps-dedupe-lockfile`)

- **Commits:**
  - `90366c7`: `pnpm dedupe`.
  - `e388d8a`: the root `typescript`, the playground's `wrangler` and perf-monitor's `@cloudflare/vite-plugin` move to `catalog:`.
  - `fce8315`: two scoped overrides that keep `@atcute/jetstream` and `@atcute/firehose` on the patched `partysocket@1.1.18`. The dedupe alone breaks a labeler test, so **keep this commit with the dedupe**.
- **Effect:**
  - Lockfile goes from 1,981 to 1,868 packages.
  - Removed: `workerd@1.20260301.1` (114 MB), `wrangler@4.71.0`, a `miniflare`, `esbuild@0.27.3`, `typescript@6.0.0-beta`, and `@cloudflare/vite-plugin` 1.26.1 and 1.36.3.
  - `pnpm dedupe --check` exits 0.
- **Couldn't go further:**
  - `workerd` stays at 4 versions; the others come from `miniflare` and `@cloudflare/unenv-preset`.
  - The two rolldown release candidates stay.
- **Not done:** `pnpm dedupe --check` in CI. Dependabot doesn't dedupe, so the check would fail most of its lockfile PRs. That's for a maintainer to decide.

### WP-5b: core Vite 6 to 8 (`claude/deps-core-vite-8`, stacked on WP-5a)

- **Change:** devDependency only, no code changes. Core uses Vite only for the `Plugin` type and in tests.
- **Checks:** unit tests (7,208) and `tests/integration/astro` (203) pass.

### WP-5c: admin Vite 7 to 8 (`claude/deps-admin-vite-8`, stacked on WP-5a)

- **Change:** removes `vite@7` from the lockfile. `@vitejs/plugin-react` stays at 4.7.0: the labeler already runs that version on Vite 8, and 6.x drops the `babel` option the Lingui macro needs.
- **Needs CI to confirm:** on the shared machine, a different timing-sensitive editor test failed on each run and passed when rerun. The last two full editor runs passed. It looks like flakiness, not a Vite 8 break.

### WP-9: CONTRIBUTING (`claude/docs-contributing-low-memory`)

- **Prerequisites:** Node 22.16+, matching `engines`, and pnpm 11, matching the `packageManager` pin. The page said pnpm 10+.
- **New subsection "Checks on a machine with limited memory":**
  - `pnpm lint` peaks at about 9 GB and `lint:quick` at about 3 GB, measured again on this branch; the audit's 11.2 GB didn't reproduce.
  - Run the heavy checks one at a time.
  - Run scoped Vitest commands while working.
- **Verified:** the default-heap build passes on the superseded WP-2 branch, which had both WP-2a and WP-2b.
- **Left out:** `tsgo --checkers 1`, because typecheck only peaks at about 2 GB.

## Closed without a branch

| Item | Outcome |
| ---- | ------- |
| WP-3: drop core's first `tsgo --noEmit` | **Rejected, by decision.** The typecheck program includes test-only files: a `*.astro` module shim and a collection-type augmentation. Only the first run catches a bad `.astro` import or an unknown collection in `src`. The gain would be about 9 s. A possible later fix is to point the type tests at the published entry points. |
| WP-10: cheaper Lingui macro transform | **Rejected on evidence.** The cost is Babel's own traversal, not its config lookup, which saved only 3% (noise). Babel on worker threads saves about 2 s but adds 0.4 GB. `@lingui/swc-plugin` is 5× faster but leaves nested macros untransformed, which would break at runtime. Lingui 6 might be revisited later. |
| WP-11, WP-14, WP-15 | Not attempted, by decision: route `.d.ts`, lint-program type errors, `isolatedDeclarations`. |
| WP-13: e18e lint rules | Postponed while the user investigates. |

## Corrections to the original audit found during implementation

- **WP-2:** the narrow entry alone is enough for core's build at the default heap, but only just: core's build passes at 2,000 MB and fails at 1,800 MB, and the root build passed 4 of 5 runs. `newContext: true` closes the gap. The first implementation recorded the narrow entry alone as out of memory.
- **WP-3:** the `rootDir` caveat is wrong; tsgo with `noEmit` reports `rootDir` violations in neither run.
- **WP-8:** the target is 93 bins in 39 workspace projects, not just the root bin.
- **WP-9:** type-aware lint peaks at about 9 GB, not 11.2 GB.
- **Declaration output:** it isn't deterministic on `main`; union order and chunk placement vary between identical builds.
- **attw:** it crashes in this environment for every package. Use `pnpm exec attw`, never `npx attw`, which downloads a placeholder package.

## Tips for an agent picking this up

- **Memory:** on a 16 GB machine, don't run two type-aware lints, or a lint and a build, at once.
- **Heap:** until WP-2a and WP-2b, or WP-6, are on the branch you're testing, build with `NODE_OPTIONS=--max-old-space-size=4096`.
- **Lockfile conflicts:** regenerate with `pnpm install` rather than resolving by hand.
- **Labeler:** the `test` script leaves untracked files under `apps/labeler/src/admin/locales/`; don't commit them.
- **`CI=true`:** setting it locally makes pnpm 11 fail with `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN`.
- **Repo rules:** follow `.claude/CLAUDE.md` and `AI_POLICY.md`. Don't open PRs or post comments without explicit human authorization for that specific item.
