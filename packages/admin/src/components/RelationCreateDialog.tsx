/**
 * Create a relation without leaving the content type you are editing.
 *
 * The full-page editor at `/content-types/relations/new` remains the way in
 * from the relations list; this is the same form in a dialog, with the content
 * type you came from prefilled as the linking end.
 */

import { Button, Dialog } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { X } from "@phosphor-icons/react";
import * as React from "react";

import type { SchemaCollection } from "../lib/api";
import type { CreateRelationInput } from "../lib/api/relations.js";
import { DialogError, getMutationError } from "./DialogError";
import { RelationFormFields, useRelationForm } from "./RelationForm.js";

export interface RelationCreateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	collections: SchemaCollection[];
	/** Prefills the linking end. */
	defaultParentCollection?: string;
	/** Resolves once the relation exists; rejects with the server's message. */
	onCreate: (input: CreateRelationInput) => Promise<unknown>;
}

export function RelationCreateDialog({
	open,
	onOpenChange,
	collections,
	defaultParentCollection,
	onCreate,
}: RelationCreateDialogProps) {
	const { t } = useLingui();
	const form = useRelationForm({ isNew: true, defaultParentCollection });
	const [isSaving, setIsSaving] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const { reset } = form;

	React.useEffect(() => {
		if (open) {
			reset();
			setError(null);
		}
	}, [open, reset]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!form.canSave || isSaving) return;
		setIsSaving(true);
		setError(null);
		try {
			await onCreate(form.toInput() as CreateRelationInput);
			onOpenChange(false);
		} catch (err) {
			setError(getMutationError(err));
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog className="p-6 max-w-2xl" size="lg">
				<div className="flex items-start justify-between gap-4 mb-4">
					<div>
						<Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
							{t`New Relation`}
						</Dialog.Title>
						<p className="mt-2 text-sm text-kumo-subtle">
							{t`A relation defines how two content types link. Reference fields on either side then pick entries through it.`}
						</p>
					</div>
					<Dialog.Close
						aria-label={t`Close`}
						render={(props) => (
							<Button {...props} variant="ghost" shape="square" aria-label={t`Close`}>
								<X className="h-4 w-4" />
							</Button>
						)}
					/>
				</div>

				<form onSubmit={handleSubmit}>
					<div className="max-h-[60vh] overflow-y-auto pe-1">
						<RelationFormFields form={form} collections={collections} isNew layout="stack" />
					</div>

					<DialogError message={error} className="mt-4" />

					<div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end sm:space-x-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSaving}
						>
							{t`Cancel`}
						</Button>
						<Button type="submit" disabled={!form.canSave || isSaving}>
							{isSaving ? t`Creating...` : t`Create Relation`}
						</Button>
					</div>
				</form>
			</Dialog>
		</Dialog.Root>
	);
}
