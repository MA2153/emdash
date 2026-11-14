## What does this PR do?

After a fresh `pnpm install`, none of the workspace CLI bins (`emdash`, `em`, `emdash-plugin`) are linked, because their targets live in `dist/` and pnpm only links a bin whose target exists at install time. On `main`, install warns `Failed to create bin` for 93 shims across 39 workspace projects, including the root, every demo, `templates/*`, `e2e/fixture*`, `fixtures/perf-site` and `infra/*`. The `infra/*` and `fixtures/perf-site` `bootstrap`/`seed` scripts run `emdash init && emdash seed`, so they fail until the bins exist.

The root `postbuild` hook (`scripts/relink-bins-if-needed.mjs`) was meant to fix this by running `pnpm install --frozen-lockfile` after a build. With an unchanged lockfile, pnpm 11 prints "Already up to date" and skips linking, so the hook never created any bin.

This PR replaces that call with `pnpm --recursive rebuild --pending`, which relinks bins for every workspace project. `--pending` keeps it from rerunning dependency build scripts. The hook still does nothing when the bin already exists or under `CI`. I also removed the comment claiming a CI setup step handles bins, because no workflow does.

Closes #

## Type of change

- [x] Bug fix
- [ ] Feature (requires an [accepted feature plan or RFC](https://github.com/emdash-cms/emdash/tree/main/proposals))
- [ ] Refactor (no behavior change)
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
- [ ] `pnpm typecheck` passes (not run: the change is one untyped `.mjs` script)
- [ ] `pnpm lint` passes (`lint:quick` and the `lint:json` zero-diagnostic check: see below)
- [x] `pnpm test` passes (or targeted tests for my change): reproduced by hand; see test output
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable): not applicable, a build hook that depends on pnpm's link state
- [ ] User-visible strings in the admin UI are [wrapped for translation](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md#internationalization-i18n) (if applicable): not applicable
- [ ] I have added and reviewed the user-facing [changeset](https://github.com/emdash-cms/emdash/blob/main/.changeset/README.md) (if this PR changes a published package): not applicable, no published package changes
- [ ] New features link to their merged design PR: not applicable
- [ ] I have included screenshots below if this PR changes the UI: not applicable

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Opus 5.5 (Claude Code)

## Screenshots / test output

Not applicable for screenshots. Reproduction on pnpm 11.9.0:

- **Before:** fresh install, then `pnpm build`. The hook prints `CLI bin missing — relinking...` and then `Already up to date`. Afterwards `node_modules/.bin/emdash` and `demos/simple/node_modules/.bin/emdash` are still missing.
- **After:** the hook runs `pnpm --recursive rebuild --pending` in about 1.8 s. All 93 shims that install warned about now exist, and `demos/simple/node_modules/.bin/emdash --help` runs. A second build skips the hook's work in 0.04 s.
