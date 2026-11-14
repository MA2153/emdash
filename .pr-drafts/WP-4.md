## What does this PR do?

The root `pnpm build` filter (`{./packages/**}`) also matches `@emdash-cms/blocks-playground`, a private Vite app that no workspace package consumes. Building it adds time and memory to every local `pnpm build`. This PR excludes it from the root build.

The playground still builds on its own with `pnpm run --filter @emdash-cms/blocks-playground build`. It resolves `@emdash-cms/blocks` from source through a Vite alias, so the rest of the workspace doesn't have to be built first.

CI's typecheck job was the only place that compiled the playground, through `pnpm build`. That job now builds it in a separate step, so CI coverage is unchanged.

**Deployment:** `packages/blocks/playground/wrangler.jsonc` deploys to `blocks.emdashcms.com` by hand. The root `pnpm build` no longer builds the playground, so before running `wrangler deploy`, build it with `pnpm run --filter @emdash-cms/blocks-playground build`. Otherwise the deploy ships a stale or missing `dist`.

Closes #

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

- [x] I have read [CONTRIBUTING.md](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md)
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [ ] `pnpm test` passes (or targeted tests for my change). Not applicable: this changes only a build script and CI.
- [x] `pnpm format` has been run
- [ ] I have added/updated tests for my changes (if applicable). Not applicable.
- [ ] User-visible strings in the admin UI are [wrapped for translation](https://github.com/emdash-cms/emdash/blob/main/CONTRIBUTING.md#internationalization-i18n) (if applicable). Not applicable.
- [ ] I have added and reviewed the user-facing [changeset](https://github.com/emdash-cms/emdash/blob/main/.changeset/README.md) (if this PR changes a published package). Not applicable: no published package changes.
- [ ] New features link to their merged design PR. Not applicable.
- [ ] I have included screenshots below if this PR changes the UI. Not applicable.

## AI assistance disclosure

- [x] This PR includes AI-generated code or text — model/tool: Claude Code (Claude Opus 5.5)

## Screenshots / test output

Not applicable for screenshots.

These are measurements of the root `pnpm build` on a machine with 4 vCPUs and 16 GB of RAM, using Node 26 and `NODE_OPTIONS=--max-old-space-size=4096`. Peak RSS is for the whole process tree. Each figure is a single run, so expect about ±15% variation.

| | Time | Peak RSS |
| --- | --- | --- |
| Before | 89.5 s | 3.48 GB |
| After | 75.9 s | 2.77 GB |
| Playground alone (`pnpm run --filter @emdash-cms/blocks-playground build`) | 11.0 s | 1.42 GB |
