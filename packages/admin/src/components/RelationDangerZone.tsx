/**
 * Deleting a relationship, from the relationship's own page.
 *
 * It does not refuse when fields are bound to it: it names them and removes
 * them, the same cascade the field-delete checkbox and a content-type delete
 * run. A relationship a field still points at is not a state anything else in
 * the admin knows how to show.
 */

import { Button } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import * as React from "react";

import type { RelationWithUsage } from "../lib/api/relations.js";
import { ConfirmDialog } from "./ConfirmDialog";
import { RelationImpact } from "./RelationImpact.js";

export interface RelationDangerZoneProps {
	relation: RelationWithUsage;
	onDelete: () => void;
	isDeleting?: boolean;
	error?: unknown;
}

export function RelationDangerZone({
	relation,
	onDelete,
	isDeleting,
	error,
}: RelationDangerZoneProps) {
	const { t } = useLingui();
	const [confirming, setConfirming] = React.useState(false);

	return (
		<div className="rounded-lg border border-kumo-danger/50 bg-kumo-base p-4">
			<h2 className="font-semibold">{t`Delete relationship`}</h2>
			<p className="mt-1 text-sm text-kumo-subtle">
				{t`Removes this relationship, every link stored under it, and the reference fields that use it.`}
			</p>
			<Button variant="destructive" className="mt-3" onClick={() => setConfirming(true)}>
				{t`Delete relationship`}
			</Button>

			<ConfirmDialog
				open={confirming}
				onClose={() => setConfirming(false)}
				title={t`Delete "${relation.slug}"?`}
				description={t`This removes:`}
				confirmLabel={t`Delete`}
				pendingLabel={t`Deleting...`}
				isPending={!!isDeleting}
				error={error}
				onConfirm={onDelete}
			>
				<RelationImpact relations={[relation]} nameRelations={false} />
			</ConfirmDialog>
		</div>
	);
}
