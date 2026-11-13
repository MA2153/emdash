import { spawn } from "node:child_process";
import { resolve } from "node:path";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../../..");

/**
 * Builds the workspace packages matched by the given pnpm filters.
 *
 * Set `EMDASH_TEST_SKIP_BUILD=1` to test against the existing `dist/` output, for example after
 * running `pnpm build` yourself. Nothing checks that output is current.
 */
export async function buildWorkspace(label: string, filters: string[]): Promise<void> {
	if (process.env.EMDASH_TEST_SKIP_BUILD === "1") {
		console.log(`[${label}] EMDASH_TEST_SKIP_BUILD=1, using existing build output.`);
		return;
	}

	const args = ["run", ...filters.flatMap((filter) => ["--filter", filter]), "build"];
	console.log(`[${label}] Running pnpm ${args.join(" ")}...`);
	await new Promise<void>((resolvePromise, reject) => {
		const child = spawn("pnpm", args, { cwd: WORKSPACE_ROOT, stdio: "inherit" });
		child.on("error", reject);
		child.on("close", (code, signal) => {
			if (code === 0) resolvePromise();
			else reject(new Error(`pnpm ${args.join(" ")} failed (${signal ?? `exit code ${code}`})`));
		});
	});
	console.log(`[${label}] Build complete.`);
}
