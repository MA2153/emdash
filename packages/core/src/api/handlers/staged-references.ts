import type { Kysely } from "kysely";

import { RelationRepository } from "../../database/repositories/relation.js";
import type { Database } from "../../database/types.js";
import type { ApiResult } from "../types.js";
import { writeReferenceSelection } from "./relations.js";
import {
	referenceFieldConstraints,
	validateReferenceSelection,
	type ReferenceFieldConstraints,
} from "./validate-references.js";

/**
 * Where a collection that keeps drafts stages a pending reference selection: in
 * the draft revision's data, beside `_slug`. The leading underscore is what
 * keeps it out of the column writer, the loaded entry's `data`, and the publish
 * promotion loop, all of which already skip `_`-prefixed keys.
 *
 * The link table holds the live selection only.
 */
export const STAGED_REFERENCES_KEY = "_references";

/**
 * A staged selection, by field slug, holding `translation_group` values rather
 * than entry ids: an edge names a thing, not one locale's row of it, so the
 * group is what the link table stores and what survives an entry being
 * translated or re-slugged between saving and publishing. The save resolves ids
 * to groups so publication has nothing left that can fail to resolve.
 *
 * Order is significant on the parent side, where it becomes `sort_order`.
 */
export type StagedReferences = Record<string, string[]>;

function isGroupList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** The staged selection inside a revision's data, if it carries one. */
export function readStagedReferences(
	data: Record<string, unknown> | undefined,
): StagedReferences | undefined {
	const staged = data?.[STAGED_REFERENCES_KEY];
	if (typeof staged !== "object" || staged === null || Array.isArray(staged)) return undefined;

	const result: StagedReferences = {};
	for (const [fieldSlug, groups] of Object.entries(staged)) {
		if (isGroupList(groups)) result[fieldSlug] = groups;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Fold a save's selections into whatever the previous draft staged. A save that
 * names one reference field must not drop another field's pending selection, so
 * fields absent from `incoming` keep their staged value.
 */
export function mergeStagedReferences(
	base: Record<string, unknown> | undefined,
	incoming: StagedReferences,
): StagedReferences {
	return { ...readStagedReferences(base), ...incoming };
}

/** One bound field's live selection as translation groups. */
async function liveFieldSelection(
	repo: RelationRepository,
	field: ReferenceFieldConstraints,
	entryGroup: string,
): Promise<string[]> {
	const links =
		field.relationSide === "child"
			? await repo.getParents(field.relation, entryGroup)
			: await repo.getChildren(field.relation, entryGroup);
	return links.map((link) => (field.relationSide === "child" ? link.parentGroup : link.childGroup));
}

/**
 * Re-check what publication is about to make live against the relation's current
 * cardinality.
 *
 * A draft can sit unpublished across a schema edit that makes its field required
 * or narrows the relation's limits, and it is publication — not the save that
 * staged it — that has to hold the line. So this walks the collection's bound
 * fields rather than the staged keys: a field added as required after the entry
 * was written appears in no existing draft, and iterating `staged` would never
 * reach it. A field the draft does stage needs no link read.
 */
export async function validateStagedReferences(
	db: Kysely<Database>,
	collection: string,
	staged: StagedReferences,
	entryGroup: string,
): Promise<ApiResult<true>> {
	const repo = new RelationRepository(db);
	for (const field of (await referenceFieldConstraints(db, collection)).values()) {
		const groups = Object.hasOwn(staged, field.slug)
			? (staged[field.slug] ?? [])
			: await liveFieldSelection(repo, field, entryGroup);
		const valid = validateReferenceSelection(field, groups);
		if (!valid.success) return valid;
	}
	return { success: true, data: true };
}

/**
 * The live selection, in the same shape a draft stages: every bound reference
 * field on the collection, by field slug, as translation groups.
 *
 * One link read per bound field. Used where both selections have to be
 * comparable — the live and draft sides of a compare — never on a render path.
 */
export async function liveReferenceSelection(
	db: Kysely<Database>,
	collection: string,
	entryGroup: string,
): Promise<StagedReferences> {
	const repo = new RelationRepository(db);
	const selection: StagedReferences = {};
	for (const field of (await referenceFieldConstraints(db, collection)).values()) {
		selection[field.slug] = await liveFieldSelection(repo, field, entryGroup);
	}
	return selection;
}

/**
 * Promote a staged selection to live links.
 *
 * A field slug the collection no longer carries as a bound reference field is
 * skipped: the revision outlived the field, and there is no relation left to
 * write into.
 */
export async function applyStagedReferences(
	db: Kysely<Database>,
	collection: string,
	entryGroup: string,
	staged: StagedReferences,
): Promise<void> {
	const constraints = await referenceFieldConstraints(db, collection);
	for (const [fieldSlug, groups] of Object.entries(staged)) {
		const field = constraints.get(fieldSlug);
		if (!field) continue;
		await writeReferenceSelection(db, {
			relation: field.relation,
			side: field.relationSide,
			entryGroup,
			groups,
		});
	}
}
