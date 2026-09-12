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
			<Dialog
				size="lg"
				className="flex max-h-[min(88dvh,46rem)] flex-col overflow-hidden p-0"
				style={{ width: "min(94vw, 40rem)" }}
			>
				<div className="flex shrink-0 items-start justify-between gap-4 border-b border-kumo-line px-6 py-5">
					<div className="min-w-0">
						<Dialog.Title className="text-lg font-semibold leading-tight tracking-tight">
							{t`New Relation`}
						</Dialog.Title>
						<Dialog.Description className="mt-1 text-sm leading-5 text-kumo-subtle">
							{t`A relation defines how two content types link. Reference fields on either side then pick entries through it.`}
						</Dialog.Description>
					</div>
					<Dialog.Close
						render={(props) => (
							<Button {...props} variant="ghost" shape="square" aria-label={t`Close`}>
								<X className="h-4 w-4" />
							</Button>
						)}
					/>
				</div>

				<form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
						<RelationFormFields form={form} collections={collections} isNew layout="stack" />
					</div>

					<div className="shrink-0 border-t border-kumo-line px-6 py-4">
						<DialogError message={error} className="mb-3" />

						<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
					</div>
				</form>
			</Dialog>
		</Dialog.Root>
	);
}
