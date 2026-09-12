/**
 * The relation form — the fields shared by the full-page relation editor and
 * the create dialog on a content type.
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

const SLUG_INVALID_CHARS_PATTERN = /[^a-z0-9]+/g;
const SLUG_LEADING_TRAILING_PATTERN = /^_|_$/g;

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

function customLimit(value: number | null | undefined): string {
	return value && value !== 1 ? String(value) : "";
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(SLUG_INVALID_CHARS_PATTERN, "_")
		.replace(SLUG_LEADING_TRAILING_PATTERN, "");
}

export interface RelationFormState {
	slug: string;
	slugEdited: boolean;
	parentCollection: string;
	childCollection: string;
	parentLabel: string;
	parentLabelSingular: string;
	childLabel: string;
	childLabelSingular: string;
	childrenMode: LimitMode;
	childrenLimit: string;
	parentsMode: LimitMode;
	parentsLimit: string;
}

export interface UseRelationFormOptions {
	relation?: RelationWithUsage;
	isNew?: boolean;
	/** Prefills the linking end when a relation is created from a content type. */
	defaultParentCollection?: string;
}

export interface RelationForm {
	state: RelationFormState;
	set: <K extends keyof RelationFormState>(key: K, value: RelationFormState[K]) => void;
	/** Sets one end, and renames an unedited new relation after both ends. */
	setEnd: (end: "parent" | "child", value: string) => void;
	/** Back to the values the form opened with. */
	reset: () => void;
	canSave: boolean;
	isDirty: boolean;
	toInput: () => CreateRelationInput | UpdateRelationInput;
}

function initialState({
	relation,
	defaultParentCollection,
}: UseRelationFormOptions): RelationFormState {
	return {
		slug: relation?.slug ?? "",
		slugEdited: false,
		parentCollection: relation?.parentCollection ?? defaultParentCollection ?? "",
		childCollection: relation?.childCollection ?? "",
		parentLabel: relation?.parentLabel ?? "",
		parentLabelSingular: relation?.parentLabelSingular ?? "",
		childLabel: relation?.childLabel ?? "",
		childLabelSingular: relation?.childLabelSingular ?? "",
		childrenMode: limitMode(relation?.maxChildrenPerParent ?? null),
		childrenLimit: customLimit(relation?.maxChildrenPerParent),
		parentsMode: limitMode(relation?.maxParentsPerChild ?? null),
		parentsLimit: customLimit(relation?.maxParentsPerChild),
	};
}

export function useRelationForm(options: UseRelationFormOptions): RelationForm {
	const { relation, isNew } = options;
	const [state, setState] = React.useState<RelationFormState>(() => initialState(options));

	const set = React.useCallback(
		<K extends keyof RelationFormState>(key: K, value: RelationFormState[K]) => {
			setState((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	// A relation's slug defaults to the two collections it joins, which is what
	// the field-created relations are named after too.
	const setEnd = React.useCallback(
		(end: "parent" | "child", value: string) => {
			setState((current) => {
				const next = {
					...current,
					...(end === "parent" ? { parentCollection: value } : { childCollection: value }),
				};
				if (isNew && !next.slugEdited && next.parentCollection && next.childCollection) {
					next.slug = slugify(`${next.parentCollection}_${next.childCollection}`);
				}
				return next;
			});
		},
		[isNew],
	);

	const optionsRef = React.useRef(options);
	optionsRef.current = options;
	const reset = React.useCallback(() => setState(initialState(optionsRef.current)), []);

	const canSave = isNew
		? Boolean(
				state.slug &&
				state.parentCollection &&
				state.childCollection &&
				state.parentLabel &&
				state.childLabel,
			)
		: Boolean(state.parentLabel && state.childLabel);

	const isDirty =
		isNew ||
		!relation ||
		state.parentLabel !== relation.parentLabel ||
		state.parentLabelSingular !== (relation.parentLabelSingular ?? "") ||
		state.childLabel !== relation.childLabel ||
		state.childLabelSingular !== (relation.childLabelSingular ?? "") ||
		limitValue(state.childrenMode, state.childrenLimit) !== relation.maxChildrenPerParent ||
		limitValue(state.parentsMode, state.parentsLimit) !== relation.maxParentsPerChild;

	const toInput = React.useCallback((): CreateRelationInput | UpdateRelationInput => {
		const roles = {
			parentLabel: state.parentLabel,
			parentLabelSingular: state.parentLabelSingular || null,
			childLabel: state.childLabel,
			childLabelSingular: state.childLabelSingular || null,
			maxChildrenPerParent: limitValue(state.childrenMode, state.childrenLimit),
			maxParentsPerChild: limitValue(state.parentsMode, state.parentsLimit),
		};
		return isNew
			? {
					slug: state.slug,
					parentCollection: state.parentCollection,
					childCollection: state.childCollection,
					...roles,
				}
			: roles;
	}, [state, isNew]);

	return { state, set, setEnd, reset, canSave, isDirty, toInput };
}

export interface RelationFormFieldsProps {
	form: RelationForm;
	collections: SchemaCollection[];
	isNew?: boolean;
	/** `grid` is the two-column page editor; `stack` fits inside a dialog. */
	layout?: "grid" | "stack";
}

export function RelationFormFields({
	form,
	collections,
	isNew,
	layout = "grid",
}: RelationFormFieldsProps) {
	const { t } = useLingui();
	const { state, set, setEnd } = form;

	const collectionItems = collections.map((c) => ({ label: c.label, value: c.slug }));
	const labelFor = (collectionSlug: string) =>
		collections.find((c) => c.slug === collectionSlug)?.label ?? collectionSlug;
	const singularFor = (collectionSlug: string) =>
		collections.find((c) => c.slug === collectionSlug)?.labelSingular ?? labelFor(collectionSlug);

	// Named here rather than inside the label template: a `t` call nested in
	// another `t` template is not something the macro can extract.
	const linkingSideName = state.parentLabelSingular || t`entry on the linking side`;
	const linkedSideName = state.childLabelSingular || t`entry on the linked side`;

	const isGrid = layout === "grid";
	const Heading = isGrid ? "h2" : "h3";
	const headingClass = isGrid
		? "font-semibold"
		: "text-xs font-medium uppercase tracking-wider text-kumo-subtle";
	const panelClass = isGrid ? "rounded-lg border bg-kumo-base p-4 space-y-4" : "space-y-4";

	return (
		<div className={isGrid ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "space-y-6"}>
			<div className={panelClass}>
				<Heading className={headingClass}>{t`Content types`}</Heading>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Select
						label={t`Links from`}
						className="w-full"
						value={state.parentCollection}
						onValueChange={(v) => setEnd("parent", v ?? "")}
						items={collectionItems}
						placeholder={t`Select a content type`}
						disabled={!isNew}
					/>
					<Select
						label={t`Links to`}
						className="w-full"
						value={state.childCollection}
						onValueChange={(v) => setEnd("child", v ?? "")}
						items={collectionItems}
						placeholder={t`Select a content type`}
						disabled={!isNew}
					/>
				</div>
				<div>
					<Input
						label={t`Slug`}
						value={state.slug}
						onChange={(e) => {
							set("slugEdited", true);
							set("slug", e.target.value);
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

			<div className={panelClass}>
				<Heading className={headingClass}>{t`Roles`}</Heading>
				<p className="text-sm text-kumo-subtle">
					{t`What each side is called. These name the picker and the "Referenced by" panel.`}
				</p>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Input
						label={t`Linking side (plural)`}
						value={state.parentLabel}
						onChange={(e) => set("parentLabel", e.target.value)}
						placeholder={state.parentCollection ? labelFor(state.parentCollection) : t`Posts`}
					/>
					<Input
						label={t`Linking side (singular)`}
						value={state.parentLabelSingular}
						onChange={(e) => set("parentLabelSingular", e.target.value)}
						placeholder={state.parentCollection ? singularFor(state.parentCollection) : t`Post`}
					/>
					<Input
						label={t`Linked side (plural)`}
						value={state.childLabel}
						onChange={(e) => set("childLabel", e.target.value)}
						placeholder={state.childCollection ? labelFor(state.childCollection) : t`Authors`}
					/>
					<Input
						label={t`Linked side (singular)`}
						value={state.childLabelSingular}
						onChange={(e) => set("childLabelSingular", e.target.value)}
						placeholder={state.childCollection ? singularFor(state.childCollection) : t`Author`}
					/>
				</div>
			</div>

			<div className={isGrid ? `${panelClass} lg:col-span-2` : panelClass}>
				<Heading className={headingClass}>{t`How many`}</Heading>
				<p className="text-sm text-kumo-subtle">
					{t`Both reference fields bound to this relation share these limits, so the two sides cannot disagree about the same links.`}
				</p>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-rows-[auto_auto] sm:gap-y-2">
					<LimitControl
						label={t`Each ${linkingSideName} links to`}
						oneLabel={t`One`}
						manyLabel={t`Any number`}
						mode={state.childrenMode}
						onModeChange={(mode) => set("childrenMode", mode)}
						limit={state.childrenLimit}
						onLimitChange={(value) => set("childrenLimit", value)}
					/>
					<LimitControl
						label={t`Each ${linkedSideName} is linked from`}
						oneLabel={t`One`}
						manyLabel={t`Any number`}
						mode={state.parentsMode}
						onModeChange={(mode) => set("parentsMode", mode)}
						limit={state.parentsLimit}
						onLimitChange={(value) => set("parentsLimit", value)}
					/>
				</div>
			</div>
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
	const labelId = React.useId();

	// The label sits in the parent grid's own row so that a label wrapping onto
	// a second line still leaves the two selects on one line.
	return (
		<div className="grid gap-2 sm:row-span-2 sm:grid-rows-subgrid">
			<span id={labelId} className="text-base font-medium text-kumo-default">
				{label}
			</span>
			<div className="space-y-2">
				<Select
					aria-labelledby={labelId}
					className="w-full"
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
		</div>
	);
}
