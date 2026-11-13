import { buildWorkspace } from "./build-workspace.js";

/** Test servers resolve their dependencies through `demos/simple/node_modules`. */
export default async function setupIntegrationBuild(): Promise<void> {
	await buildWorkspace("integration", ["emdash-demo^..."]);
}
