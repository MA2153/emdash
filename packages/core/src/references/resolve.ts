/**
 * Resolve an entry's reference selections to loadable entries, for the public
 * query path.
 *
 * The cost is bounded and predictable: one link read per selected field, then
 * one entry read per *distinct* target collection — never one per link. A
 * caller that selects no fields issues nothing at all, which is what keeps
 * references off the logged-out hot path of every render that does not ask for
 * them.
 */

import { readStagedReferences } from "../api/handlers/staged-references.js";
import { RelationRepository } from "../database/repositories/relation.js";
import { RevisionRepository } from "../database/repositories/revision.js";
import { decodeCursor, encodeCursor } from "../database/repositories/types.js";
import { getDb, loadEntriesByGroups, type LoadedEntry } from "../loader.js";
import { getReferenceFieldMap } from "./field-map.js";
import type { ReferenceQuery, ReferenceSelection } from "./types.js";

/** Default page size for one reference field, matching the list endpoints. */
const DEFAULT_LIMIT = 50;
/** Hard ceiling, matching the list endpoints. */
const MAX_LIMIT = 100;

/** Order value stamped into a staged selection's cursor; the anchor is its `id`. */
const STAGED_CURSOR_MARKER = "staged";

/** One reference field's resolved page, before the query layer wraps the entries. */
export interface ResolvedReferencePage {
	/** The collection the entries belong to — what the `edit` proxy is scoped to. */
	collection: string;
	entries: LoadedEntry[];
	nextCursor?: string;
}

export interface ResolveReferencesOptions {
	/** The collection the selecting entry belongs to. */
	collection: string;
	/** The selecting entry's own translation group. */
	entryGroup: string;
	/** The locale the parent resolved to, used to pick each target's variant. */
	locale: string | null;
	/** The selecting entry's draft revision, when it has one. */
	draftRevisionId?: string;
	/**
	 * Whether this render may see unpublished content. It decides both halves of
	 * draft visibility: whether a pending selection staged in the draft revision
	 * replaces the published one, and whether an unpublished target resolves at
	 * all.
	 */
	serveDrafts: boolean;
	/** The fields to resolve, by field slug. */
	selection: ReferenceSelection;
}

function pageOptions(query: ReferenceQuery): { limit: number; cursor?: string } {
	if (query === true) return { limit: DEFAULT_LIMIT };
	const requested = query.limit ?? DEFAULT_LIMIT;
	return {
		limit: Math.min(Math.max(requested, 1), MAX_LIMIT),
		cursor: query.cursor,
	};
}

/**
 * Page a staged selection, which is a list in memory rather than a table.
 *
 * The cursor anchors on the last group of the previous page rather than on its
 * index: the editor can reorder or drop entries between one page and the next,
 * and an index would then silently skip or repeat. An anchor that is no longer
 * in the selection means the entries it pointed past are gone, so the walk ends.
 */
function pageStagedGroups(
	groups: string[],
	options: { limit: number; cursor?: string },
): { groups: string[]; nextCursor?: string } {
	let start = 0;
	if (options.cursor) {
		const anchor = decodeCursor(options.cursor).id;
		const index = groups.indexOf(anchor);
		if (index === -1) return { groups: [] };
		start = index + 1;
	}
	const page = groups.slice(start, start + options.limit);
	const last = page.at(-1);
	const nextCursor =
		last && start + page.length < groups.length
			? encodeCursor(STAGED_CURSOR_MARKER, last)
			: undefined;
	return { groups: page, nextCursor };
}

/**
 * Pick the locale variant matching `locale`, falling back to the first (lowest
 * locale code). A link names a translation group, not one locale's row of it,
 * so a target that exists only in another locale is still a real reference.
 *
 * Mirrors `pickVariant` in `api/handlers/relations.ts`, which answers the same
 * question for the admin's resolved refs.
 */
function pickVariant(variants: LoadedEntry[], locale: string | null): LoadedEntry | undefined {
	if (locale === null) return variants[0];
	return variants.find((entry) => entry.data.locale === locale) ?? variants[0];
}

export async function resolveReferencePages(
	options: ResolveReferencesOptions,
): Promise<Record<string, ResolvedReferencePage>> {
	const fieldMap = await getReferenceFieldMap(options.collection);
	const requested = Object.entries(options.selection).filter(([slug]) => fieldMap.has(slug));
	if (requested.length === 0) return {};

	const db = await getDb();
	const relations = new RelationRepository(db);

	const staged =
		options.serveDrafts && options.draftRevisionId
			? readStagedReferences(
					(await new RevisionRepository(db).findById(options.draftRevisionId))?.data,
				)
			: undefined;

	// Phase one: each field's page of translation groups, in selection order.
	const pages = new Map<string, { groups: string[]; nextCursor?: string }>();
	for (const [slug, query] of requested) {
		const binding = fieldMap.get(slug)!;
		const page = pageOptions(query);

		const stagedGroups = staged?.[slug];
		if (stagedGroups) {
			pages.set(slug, pageStagedGroups(stagedGroups, page));
			continue;
		}

		const links =
			binding.side === "child"
				? await relations.getParentsPage(binding.relation, options.entryGroup, page)
				: await relations.getChildrenPage(binding.relation, options.entryGroup, page);
		pages.set(slug, {
			groups: links.items.map((link) =>
				binding.side === "child" ? link.parentGroup : link.childGroup,
			),
			nextCursor: links.nextCursor,
		});
	}

	// Phase two: one entry read per distinct target collection, however many
	// fields point at it.
	const groupsByCollection = new Map<string, Set<string>>();
	for (const [slug, page] of pages) {
		const target = fieldMap.get(slug)!.targetCollection;
		const groups = groupsByCollection.get(target) ?? new Set<string>();
		for (const group of page.groups) groups.add(group);
		groupsByCollection.set(target, groups);
	}

	const variantsByCollection = new Map<string, Map<string, LoadedEntry[]>>();
	await Promise.all(
		Array.from(groupsByCollection, async ([collection, groups]) => {
			const loaded = await loadEntriesByGroups(collection, [...groups], {
				publishedOnly: !options.serveDrafts,
			});
			const byGroup = new Map<string, LoadedEntry[]>();
			for (const entry of loaded) {
				const group = entry.data.translationGroup;
				if (typeof group !== "string") continue;
				const variants = byGroup.get(group);
				if (variants) variants.push(entry);
				else byGroup.set(group, [entry]);
			}
			variantsByCollection.set(collection, byGroup);
		}),
	);

	// Phase three: rebuild each field in link order. A group with no surviving
	// variant — deleted, or unpublished for a render that may not see drafts —
	// drops out, exactly as a dangling link does.
	const resolved: Record<string, ResolvedReferencePage> = {};
	for (const [slug, page] of pages) {
		const collection = fieldMap.get(slug)!.targetCollection;
		const byGroup = variantsByCollection.get(collection);
		const entries: LoadedEntry[] = [];
		for (const group of page.groups) {
			const variant = pickVariant(byGroup?.get(group) ?? [], options.locale);
			if (variant) entries.push(variant);
		}
		resolved[slug] = page.nextCursor
			? { collection, entries, nextCursor: page.nextCursor }
			: { collection, entries };
	}
	return resolved;
}
