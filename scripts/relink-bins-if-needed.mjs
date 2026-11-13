#!/usr/bin/env node
// pnpm links a package's bins only if the target exists at install time. The
// workspace CLIs (emdash, em, emdash-plugin) live in dist/, so after a fresh
// install every dependent's node_modules/.bin lacks them until relinked.
// `pnpm install` can't relink them: with an unchanged lockfile it reports
// "Already up to date" and skips linking. `pnpm rebuild` relinks bins for
// every project it visits, and --pending keeps it from rerunning build scripts.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.CI) process.exit(0);

if (!existsSync("packages/core/dist/cli/index.mjs")) process.exit(0);

if (!existsSync("node_modules/.bin/emdash")) {
	console.log("Workspace CLI bins missing — relinking...");
	execSync("pnpm --recursive rebuild --pending", { stdio: "inherit" });
}
