import { sql } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";

import { columnExists } from "../../../src/database/dialect-helpers.js";
import * as migration077 from "../../../src/database/migrations/077_reference_field_relations.js";
import { ContentRepository } from "../../../src/database/repositories/content.js";
import { SchemaRegistry } from "../../../src/schema/registry.js";
import { createLegacyReferenceField } from "../../utils/legacy-reference-field.js";
import {
	describeEachDialect,
	setupForDialect,
	teardownForDialect,
	type DialectTestContext,
} from "../../utils/test-db.js";

interface FieldValidation {
	relation?: string;
	relationSide?: string;
	targetCollection?: string;
	multiple?: boolean;
}

describeEachDialect("reference field relations migration (077)", (dialect) => {
	let ctx: DialectTestContext;

	beforeEach(async () => {
		ctx = await setupForDialect(dialect);
		const registry = new SchemaRegistry(ctx.db);
		await registry.createCollection({ slug: "posts", label: "Posts", labelSingular: "Post" });
		await registry.createField("posts", { slug: "title", label: "Title", type: "string" });
		await registry.createCollection({ slug: "authors", label: "Authors", labelSingular: "Author" });
		await registry.createField("authors", { slug: "name", label: "Name", type: "string" });
	});

	afterEach(async () => {
		await teardownForDialect(ctx);
	});

	/** Write a value straight to the legacy column, as the pre-relations writer did. */
	async function writeColumn(
		collection: string,
		entryId: string,
		column: string,
		value: string,
	): Promise<void> {
		await sql`
			UPDATE ${sql.ref(`ec_${collection}`)}
			SET ${sql.ref(column)} = ${value}
			WHERE id = ${entryId}
		`.execute(ctx.db);
	}

	async function readValidation(collection: string, field: string): Promise<FieldValidation> {
		const row = await sql<{ validation: string | null }>`
			SELECT f.validation
			FROM ${sql.ref("_emdash_fields")} AS f
			INNER JOIN ${sql.ref("_emdash_collections")} AS c ON c.id = f.collection_id
			WHERE c.slug = ${collection} AND f.slug = ${field}
		`.execute(ctx.db);
		const validation = row.rows[0]?.validation;
		return validation ? (JSON.parse(validation) as FieldValidation) : {};
	}

	function readRelations() {
		return sql<{
			id: string;
			slug: string;
			parent_collection: string;
			child_collection: string;
			parent_label: string;
			parent_label_singular: string | null;
			child_label: string;
			max_children_per_parent: number | null;
		}>`SELECT * FROM ${sql.ref("_emdash_relations")} ORDER BY slug ASC`.execute(ctx.db);
	}

	function readEdges() {
		return sql<{
			relation_id: string;
			parent_group: string;
			child_group: string;
			sort_order: number;
		}>`
			SELECT relation_id, parent_group, child_group, sort_order
			FROM ${sql.ref("_emdash_content_references")}
			ORDER BY parent_group ASC, sort_order ASC
		`.execute(ctx.db);
	}

	it("binds a field whose target is named in options.collection and copies its id in", async () => {
		await createLegacyReferenceField(ctx.db, "posts", "author", { targetCollection: "authors" });

		const content = new ContentRepository(ctx.db);
		const author = await content.create({ type: "authors", slug: "jane", data: { name: "Jane" } });
		const post = await content.create({ type: "posts", slug: "hello", data: { title: "Hello" } });
		await writeColumn("posts", post.id, "author", author.id);

		await migration077.up(ctx.db);

		const relations = await readRelations();
		expect(relations.rows).toHaveLength(1);
		expect(relations.rows[0]).toMatchObject({
			slug: "posts_author",
			parent_collection: "posts",
			child_collection: "authors",
			parent_label: "Posts",
			parent_label_singular: "Post",
			child_label: "Author",
			// No `options.allowMultiple` means one reference, as the field helper documented.
			max_children_per_parent: 1,
		});

		expect(await readValidation("posts", "author")).toEqual({
			relation: "posts_author",
			relationSide: "parent",
			targetCollection: "authors",
			multiple: false,
		});

		const edges = await readEdges();
		expect(edges.rows).toEqual([
			{
				relation_id: relations.rows[0]!.id,
				parent_group: post.translationGroup,
				child_group: author.translationGroup,
				sort_order: 0,
			},
		]);

		// The column is the only copy of anything that did not resolve, so it stays.
		expect(await columnExists(ctx.db, "ec_posts", "author")).toBe(true);
	});

	it("copies a multiple-reference array in selection order and drops ids that no longer resolve", async () => {
		await createLegacyReferenceField(ctx.db, "posts", "related", {
			targetCollection: "authors",
			allowMultiple: true,
		});

		const content = new ContentRepository(ctx.db);
		const first = await content.create({ type: "authors", slug: "first", data: { name: "First" } });
		const second = await content.create({
			type: "authors",
			slug: "second",
			data: { name: "Second" },
		});
		const post = await content.create({ type: "posts", slug: "hello", data: { title: "Hello" } });
		await writeColumn(
			"posts",
			post.id,
			"related",
			JSON.stringify([second.id, "gone-entry-id", first.id]),
		);

		await migration077.up(ctx.db);

		const relations = await readRelations();
		expect(relations.rows[0]?.max_children_per_parent).toBeNull();

		const edges = await readEdges();
		expect(edges.rows.map((edge) => edge.child_group)).toEqual([
			second.translationGroup,
			first.translationGroup,
		]);
		expect(edges.rows.map((edge) => edge.sort_order)).toEqual([0, 1]);
	});

	it("changes nothing on a rerun", async () => {
		await createLegacyReferenceField(ctx.db, "posts", "author", { targetCollection: "authors" });
		const content = new ContentRepository(ctx.db);
		const author = await content.create({ type: "authors", slug: "jane", data: { name: "Jane" } });
		const post = await content.create({ type: "posts", slug: "hello", data: { title: "Hello" } });
		await writeColumn("posts", post.id, "author", author.id);

		await migration077.up(ctx.db);
		const relationsAfterFirst = (await readRelations()).rows;
		const edgesAfterFirst = (await readEdges()).rows;

		await migration077.up(ctx.db);

		expect((await readRelations()).rows).toEqual(relationsAfterFirst);
		expect((await readEdges()).rows).toEqual(edgesAfterFirst);
	});

	it("finishes a run that was interrupted before the field row was written", async () => {
		await createLegacyReferenceField(ctx.db, "posts", "author", { targetCollection: "authors" });
		const content = new ContentRepository(ctx.db);
		const author = await content.create({ type: "authors", slug: "jane", data: { name: "Jane" } });
		const post = await content.create({ type: "posts", slug: "hello", data: { title: "Hello" } });
		await writeColumn("posts", post.id, "author", author.id);

		await migration077.up(ctx.db);
		const relationId = (await readRelations()).rows[0]!.id;

		// Roll the completion fence back: the relation and its edges landed, the
		// field row update did not.
		await sql`
			UPDATE ${sql.ref("_emdash_fields")} SET validation = NULL WHERE slug = 'author'
		`.execute(ctx.db);

		await migration077.up(ctx.db);

		const relations = await readRelations();
		expect(relations.rows).toHaveLength(1);
		expect(relations.rows[0]?.id).toBe(relationId);
		expect((await readEdges()).rows).toHaveLength(1);
		expect(await readValidation("posts", "author")).toMatchObject({ relation: "posts_author" });
	});

	it("leaves a field alone when its slug is held by a relation of another shape", async () => {
		// The slug has no collision suffix, so that a rerun can find the relation it
		// would have created by name. A slug already in use is left alone.
		await sql`
			INSERT INTO ${sql.ref("_emdash_relations")}
				(id, slug, parent_collection, child_collection, parent_label, child_label)
			VALUES ('rel-existing', 'posts_author', 'posts', 'posts', 'Posts', 'Related')
		`.execute(ctx.db);
		await createLegacyReferenceField(ctx.db, "posts", "author", { targetCollection: "authors" });

		await migration077.up(ctx.db);

		expect(await readValidation("posts", "author")).toEqual({});
		expect((await readRelations()).rows).toHaveLength(1);
		expect((await readRelations()).rows[0]?.id).toBe("rel-existing");
	});

	it("leaves a field alone when its slug names a relation another field already binds", async () => {
		const registry = new SchemaRegistry(ctx.db);
		await registry.createField("posts", {
			slug: "writer",
			label: "Writer",
			type: "reference",
			validation: { relation: "posts_author", relationSide: "parent", targetCollection: "authors" },
		});
		await sql`
			INSERT INTO ${sql.ref("_emdash_relations")}
				(id, slug, parent_collection, child_collection, parent_label, child_label,
				 max_children_per_parent)
			VALUES ('rel-writer', 'posts_author', 'posts', 'authors', 'Posts', 'Writer', 1)
		`.execute(ctx.db);
		await createLegacyReferenceField(ctx.db, "posts", "author", { targetCollection: "authors" });

		await migration077.up(ctx.db);

		// Two fields over one relation and side have no defined merge, so the
		// unbound field stays unbound even though the relation's shape matches.
		expect(await readValidation("posts", "author")).toEqual({});
	});

	it("accepts a target named in validation.targetCollection", async () => {
		await createLegacyReferenceField(ctx.db, "posts", "author", {
			validationTargetCollection: "authors",
		});

		await migration077.up(ctx.db);

		expect(await readValidation("posts", "author")).toMatchObject({
			relation: "posts_author",
			targetCollection: "authors",
		});
	});

	it("leaves a field alone when no target collection can be resolved", async () => {
		await createLegacyReferenceField(ctx.db, "posts", "author", {});
		await createLegacyReferenceField(ctx.db, "posts", "editor", { targetCollection: "gone" });

		await migration077.up(ctx.db);

		expect((await readRelations()).rows).toEqual([]);
		expect(await readValidation("posts", "author")).toEqual({});
		expect(await readValidation("posts", "editor")).toEqual({});
	});

	it("leaves an indexed or searchable field alone, so its column keeps serving queries", async () => {
		await createLegacyReferenceField(ctx.db, "posts", "author", {
			targetCollection: "authors",
			indexed: true,
		});
		await createLegacyReferenceField(ctx.db, "posts", "editor", {
			targetCollection: "authors",
			searchable: true,
		});

		await migration077.up(ctx.db);

		expect((await readRelations()).rows).toEqual([]);
		expect(await readValidation("posts", "author")).toEqual({});
		expect(await readValidation("posts", "editor")).toEqual({});
	});

	it("keeps one child for a single-reference field whose locale rows disagree", async () => {
		await createLegacyReferenceField(ctx.db, "posts", "author", { targetCollection: "authors" });

		const content = new ContentRepository(ctx.db);
		const jane = await content.create({ type: "authors", slug: "jane", data: { name: "Jane" } });
		const rosa = await content.create({ type: "authors", slug: "rosa", data: { name: "Rosa" } });
		const english = await content.create({
			type: "posts",
			slug: "hello",
			data: { title: "Hello" },
		});
		const french = await content.create({
			type: "posts",
			slug: "bonjour",
			data: { title: "Bonjour" },
			locale: "fr",
			translationOf: english.id,
		});
		await writeColumn("posts", english.id, "author", jane.id);
		await writeColumn("posts", french.id, "author", rosa.id);

		await migration077.up(ctx.db);

		const edges = await readEdges();
		expect(edges.rows).toHaveLength(1);
		expect(edges.rows[0]?.child_group).toBe(jane.translationGroup);
	});
});
