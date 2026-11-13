import { buildWorkspace } from "../build-workspace.js";

/** Smoke tests start and pack the demos and templates, so they need everything those depend on. */
export default async function setupSmokeBuild(): Promise<void> {
	await buildWorkspace("smoke", ["{./templates/*}^...", "{./demos/*}^..."]);
}
