/**
 * Relation editor page — create a link definition, or rename the roles of one.
 *
 * The form itself lives in `RelationForm`, which the create dialog on a
 * content type shares.
 */

import { useLingui } from "@lingui/react/macro";
import * as React from "react";

import type { SchemaCollection } from "../lib/api";
import type {
	CreateRelationInput,
	RelationWithUsage,
	UpdateRelationInput,
} from "../lib/api/relations.js";
import { ArrowPrev } from "./ArrowIcons.js";
import { EditorHeader } from "./EditorHeader";
import { RelationFormFields, useRelationForm } from "./RelationForm.js";
import { RouterLinkButton } from "./RouterLinkButton.js";
import { SaveButton } from "./SaveButton";

export interface RelationEditorProps {
	relation?: RelationWithUsage;
	collections: SchemaCollection[];
	isNew?: boolean;
	isSaving?: boolean;
	error?: string;
	onSave: (input: CreateRelationInput | UpdateRelationInput) => void;
	/** Rendered under the roles, for the delete action. */
	footer?: React.ReactNode;
}

export function RelationEditor({
	relation,
	collections,
	isNew,
	isSaving,
	error,
	onSave,
	footer,
}: RelationEditorProps) {
	const { t } = useLingui();
	const form = useRelationForm({ relation, isNew });

	const labelFor = (collectionSlug: string) =>
		collections.find((c) => c.slug === collectionSlug)?.label ?? collectionSlug;

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!form.canSave) return;
		onSave(form.toInput());
	};

	return (
		<div className="space-y-6">
			<EditorHeader
				leading={
					<RouterLinkButton
						to="/content-types/relations"
						aria-label={t`Back to Relations`}
						variant="ghost"
						shape="square"
						icon={<ArrowPrev />}
					/>
				}
				actions={
					<SaveButton
						type="submit"
						form="relation-editor-form"
						isDirty={form.isDirty}
						isSaving={!!isSaving}
						disabled={!form.canSave || !form.isDirty}
					/>
				}
			>
				<h1 className="truncate text-2xl font-semibold">
					{isNew ? t`New Relation` : relation?.slug}
				</h1>
				{!isNew && relation && (
					<p className="text-kumo-subtle text-sm">
						{t`${labelFor(relation.parentCollection)} link to ${labelFor(relation.childCollection)}`}
					</p>
				)}
			</EditorHeader>

			{error && (
				<div className="rounded-md border border-kumo-danger/50 bg-kumo-danger-tint p-4 text-sm">
					{error}
				</div>
			)}

			<form id="relation-editor-form" onSubmit={handleSubmit}>
				<RelationFormFields form={form} collections={collections} isNew={isNew} layout="grid" />
			</form>

			{footer}
		</div>
	);
}
