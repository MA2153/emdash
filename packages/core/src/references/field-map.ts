/**
 * The reference fields a collection carries, for the public query path.
 *
 * `referenceFieldConstraints` (api/handlers) answers the write question — how
 * many entries may a field select, and is it required. Rendering asks a
 * different one: which collection do I load, and which end of the relation am I
 * standing on. Both read the same rows; keeping them apart keeps the render
 * path off the relation table, which the constraints map has to read for its
 * limits.
 */

import type { Kysely } from "kysely";

import type { Database } from "../database/types.js";
import { getDb } from "../loader.js";
import { cachedQuery, CacheNamespace } from "../object-cache/index.js";
import { requestCached } from "../request-cache.js";
import { isMissingTableError } from "../utils/db-errors.js";

/** One reference field, as a render needs it. */
export interface ReferenceFieldBinding {
	/** Field slug — the key a caller names a selection under. */
	slug: string;
	/** Relation slug the field binds to. */
	relation: string;
	/** Which end of the relation this field's own collection sits on. */
	side: "parent" | "child";
	/** The collection at the other end. */
	targetCollection: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadBindings(
	db: Kysely<Database>,
	collection: string,
): Promise<ReferenceFieldBinding[]> {
	let rows: { slug: string; validation: string | null }[];
	try {
		rows = await db
			.selectFrom("_emdash_fields")
			.innerJoin("_emdash_collections", "_emdash_collections.id", "_emdash_fields.collection_id")
			.select(["_emdash_fields.slug", "_emdash_fields.validation"])
			.where("_emdash_collections.slug", "=", collection)
			.where("_emdash_fields.type", "=", "reference")
			.execute();
	} catch (error) {
		if (isMissingTableError(error)) return [];
		throw error;
	}

	const bindings: ReferenceFieldBinding[] = [];
	for (const row of rows) {
		if (!row.validation) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(row.validation);
		} catch {
			continue;
		}
		if (!isRecord(parsed)) continue;
		const { relation, targetCollection } = parsed;
		// A field with neither is unbound: it keeps its own column, and its value
		// is already in `data`. There is nothing to resolve.
		if (typeof relation !== "string" || typeof targetCollection !== "string") continue;
		bindings.push({
			slug: row.slug,
			relation,
			targetCollection,
			side: parsed.relationSide === "child" ? "child" : "parent",
		});
	}
	return bindings;
}

/**
 * Every bound reference field on `collection`, by field slug.
 *
 * Cached twice over: once per request, and once in the schema object-cache
 * namespace, which a schema edit already bumps. A render that asks for
 * references therefore pays for this lookup at most once per isolate between
 * schema changes, and a render that asks for none never issues it.
 */
export function getReferenceFieldMap(
	collection: string,
): Promise<Map<string, ReferenceFieldBinding>> {
	return requestCached(`reference-field-map:${collection}`, async () => {
		const bindings = await cachedQuery({
			namespace: CacheNamespace.SCHEMA,
			key: `reference-field-map:${collection}`,
			load: async () => loadBindings(await getDb(), collection),
		});
		return new Map(bindings.map((binding) => [binding.slug, binding]));
	});
}
