/**
 * Relation editor — create a link definition, or rename the roles of one.
 *
 * The two collections and the slug are fixed once the relation exists: a
 * reference field stores the slug, and every link is keyed by the relation's
 * id, so changing either end would leave the stored links pointing at content
 * of the wrong type.
 *
 * Roles are single-valued, like a collection's label. A multi-locale admin
 * shows them untranslated.
 */

import { Input, Select } from "@cloudflare/kumo";
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
import { RouterLinkButton } from "./RouterLinkButton.js";
import { SaveButton } from "./SaveButton";

const SLUG_INVALID_CHARS_PATTERN = /[^a-z0-9]+/g;
const SLUG_LEADING_TRAILING_PATTERN = /^_|_$/g;

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

/** How a limit is expressed in the form. `limit` reveals a number input. */
type LimitMode = "one" | "many" | "limit";

function limitMode(value: number | null): LimitMode {
	if (value === null) return "many";
	return value === 1 ? "one" : "limit";
}

function limitValue(mode: LimitMode, custom: string): number | null {
	if (mode === "many") return null;
	if (mode === "one") return 1;
	const parsed = parseInt(custom, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(SLUG_INVALID_CHARS_PATTERN, "_")
		.replace(SLUG_LEADING_TRAILING_PATTERN, "");
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

	const [slug, setSlug] = React.useState(relation?.slug ?? "");
	const [slugEdited, setSlugEdited] = React.useState(false);
	const [parentCollection, setParentCollection] = React.useState(relation?.parentCollection ?? "");
	const [childCollection, setChildCollection] = React.useState(relation?.childCollection ?? "");
	const [parentLabel, setParentLabel] = React.useState(relation?.parentLabel ?? "");
	const [parentLabelSingular, setParentLabelSingular] = React.useState(
		relation?.parentLabelSingular ?? "",
	);
	const [childLabel, setChildLabel] = React.useState(relation?.childLabel ?? "");
	const [childLabelSingular, setChildLabelSingular] = React.useState(
		relation?.childLabelSingular ?? "",
	);
	const [childrenMode, setChildrenMode] = React.useState<LimitMode>(
		limitMode(relation?.maxChildrenPerParent ?? null),
	);
	const [childrenLimit, setChildrenLimit] = React.useState(
		relation?.maxChildrenPerParent && relation.maxChildrenPerParent !== 1
			? String(relation.maxChildrenPerParent)
			: "",
	);
	const [parentsMode, setParentsMode] = React.useState<LimitMode>(
		limitMode(relation?.maxParentsPerChild ?? null),
	);
	const [parentsLimit, setParentsLimit] = React.useState(
		relation?.maxParentsPerChild && relation.maxParentsPerChild !== 1
			? String(relation.maxParentsPerChild)
			: "",
	);

	const collectionItems = collections.map((c) => ({ label: c.label, value: c.slug }));
	const labelFor = (collectionSlug: string) =>
		collections.find((c) => c.slug === collectionSlug)?.label ?? collectionSlug;
	const singularFor = (collectionSlug: string) =>
		collections.find((c) => c.slug === collectionSlug)?.labelSingular ?? labelFor(collectionSlug);

	// A relation's slug defaults to the two collections it joins, which is what
	// the field-created relations are named after too.
	const handleEndChange = (end: "parent" | "child", value: string) => {
		const nextParent = end === "parent" ? value : parentCollection;
		const nextChild = end === "child" ? value : childCollection;
		if (end === "parent") setParentCollection(value);
		else setChildCollection(value);
		if (isNew && !slugEdited && nextParent && nextChild) {
			setSlug(slugify(`${nextParent}_${nextChild}`));
		}
	};

	const canSave = isNew
		? Boolean(slug && parentCollection && childCollection && parentLabel && childLabel)
		: Boolean(parentLabel && childLabel);

	const isDirty =
		isNew ||
		!relation ||
		parentLabel !== relation.parentLabel ||
		parentLabelSingular !== (relation.parentLabelSingular ?? "") ||
		childLabel !== relation.childLabel ||
		childLabelSingular !== (relation.childLabelSingular ?? "") ||
		limitValue(childrenMode, childrenLimit) !== relation.maxChildrenPerParent ||
		limitValue(parentsMode, parentsLimit) !== relation.maxParentsPerChild;

	// Named here rather than inside the label template: a `t` call nested in
	// another `t` template is not something the macro can extract.
	const linkingSideName = parentLabelSingular || t`entry on the linking side`;
	const linkedSideName = childLabelSingular || t`entry on the linked side`;

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!canSave) return;

		const roles = {
			parentLabel,
			parentLabelSingular: parentLabelSingular || null,
			childLabel,
			childLabelSingular: childLabelSingular || null,
			maxChildrenPerParent: limitValue(childrenMode, childrenLimit),
			maxParentsPerChild: limitValue(parentsMode, parentsLimit),
		};

		onSave(isNew ? { slug, parentCollection, childCollection, ...roles } : roles);
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
						isDirty={isDirty}
						isSaving={!!isSaving}
						disabled={!canSave || !isDirty}
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

			<form
				id="relation-editor-form"
				onSubmit={handleSubmit}
				className="grid grid-cols-1 lg:grid-cols-2 gap-6"
			>
				<div className="rounded-lg border bg-kumo-base p-4 space-y-4">
					<h2 className="font-semibold">{t`Content types`}</h2>

					<Select
						label={t`Links from`}
						value={parentCollection}
						onValueChange={(v) => handleEndChange("parent", v ?? "")}
						items={collectionItems}
						placeholder={t`Select a content type`}
						disabled={!isNew}
					/>
					<Select
						label={t`Links to`}
						value={childCollection}
						onValueChange={(v) => handleEndChange("child", v ?? "")}
						items={collectionItems}
						placeholder={t`Select a content type`}
						disabled={!isNew}
					/>
					<div>
						<Input
							label={t`Slug`}
							value={slug}
							onChange={(e) => {
								setSlugEdited(true);
								setSlug(e.target.value);
							}}
							placeholder="posts_authors"
							disabled={!isNew}
						/>
						<p className="text-xs text-kumo-subtle mt-2">
							{isNew
								? t`Lowercase letters, numbers and underscores. Reference fields store this.`
								: t`The content types and slug cannot be changed after a relation is created.`}
						</p>
					</div>
				</div>

				<div className="rounded-lg border bg-kumo-base p-4 space-y-4">
					<h2 className="font-semibold">{t`Roles`}</h2>
					<p className="text-sm text-kumo-subtle">
						{t`What each side is called. These name the picker and the "Referenced by" panel.`}
					</p>

					<Input
						label={t`Name for the linking side (plural)`}
						value={parentLabel}
						onChange={(e) => setParentLabel(e.target.value)}
						placeholder={parentCollection ? labelFor(parentCollection) : t`Posts`}
					/>
					<Input
						label={t`Name for the linking side (singular)`}
						value={parentLabelSingular}
						onChange={(e) => setParentLabelSingular(e.target.value)}
						placeholder={parentCollection ? singularFor(parentCollection) : t`Post`}
					/>
					<Input
						label={t`Name for the linked side (plural)`}
						value={childLabel}
						onChange={(e) => setChildLabel(e.target.value)}
						placeholder={childCollection ? labelFor(childCollection) : t`Authors`}
					/>
					<Input
						label={t`Name for the linked side (singular)`}
						value={childLabelSingular}
						onChange={(e) => setChildLabelSingular(e.target.value)}
						placeholder={childCollection ? singularFor(childCollection) : t`Author`}
					/>
				</div>

				<div className="rounded-lg border bg-kumo-base p-4 space-y-4 lg:col-span-2">
					<h2 className="font-semibold">{t`How many`}</h2>
					<p className="text-sm text-kumo-subtle">
						{t`Both reference fields bound to this relation share these limits, so the two sides cannot disagree about the same links.`}
					</p>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<LimitControl
							label={t`Each ${linkingSideName} links to`}
							oneLabel={t`One`}
							manyLabel={t`Any number`}
							mode={childrenMode}
							onModeChange={setChildrenMode}
							limit={childrenLimit}
							onLimitChange={setChildrenLimit}
						/>
						<LimitControl
							label={t`Each ${linkedSideName} is linked from`}
							oneLabel={t`One`}
							manyLabel={t`Any number`}
							mode={parentsMode}
							onModeChange={setParentsMode}
							limit={parentsLimit}
							onLimitChange={setParentsLimit}
						/>
					</div>
				</div>
			</form>

			{footer}
		</div>
	);
}

interface LimitControlProps {
	label: string;
	oneLabel: string;
	manyLabel: string;
	mode: LimitMode;
	onModeChange: (mode: LimitMode) => void;
	limit: string;
	onLimitChange: (limit: string) => void;
}

function LimitControl({
	label,
	oneLabel,
	manyLabel,
	mode,
	onModeChange,
	limit,
	onLimitChange,
}: LimitControlProps) {
	const { t } = useLingui();

	return (
		<div className="space-y-2">
			<Select
				label={label}
				value={mode}
				onValueChange={(v) => onModeChange(v ?? "many")}
				items={{ one: oneLabel, many: manyLabel, limit: t`At most…` }}
			/>
			{mode === "limit" && (
				<Input
					type="number"
					min={2}
					label={t`Maximum`}
					value={limit}
					onChange={(e) => onLimitChange(e.target.value)}
					placeholder="5"
				/>
			)}
		</div>
	);
}
