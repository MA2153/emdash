import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { exportSeed } from "../../../src/cli/commands/export-seed.js";
import { ContentRepository } from "../../../src/database/repositories/content.js";
import { RelationRepository } from "../../../src/database/repositories/relation.js";
import type { Database } from "../../../src/database/types.js";
import { setI18nConfig } from "../../../src/i18n/config.js";
import { SchemaRegistry } from "../../../src/schema/registry.js";
import { applySeed } from "../../../src/seed/apply.js";
import type { SeedFile } from "../../../src/seed/types.js";
import { setupTestDatabase, teardownTestDatabase } from "../../utils/test-db.js";

describe("exportSeed: relations", () => {
	let db: Kysely<Database>;

	beforeEach(async () => {
		setI18nConfig(null);
		db = await setupTestDatabase();
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
		setI18nConfig(null);
	});

	/** A site whose `posts.author` field binds to a declared relation. */
	const seed: SeedFile = {
		version: "1",
		collections: [
			{
				slug: "posts",
				label: "Posts",
				fields: [
					{ slug: "title", label: "Title", type: "string" },
					{
						slug: "author",
						label: "Author",
						type: "reference",
						validation: { relation: "post_authors" },
					},
				],
			},
			{
				slug: "authors",
				label: "Authors",
				fields: [{ slug: "name", label: "Name", type: "string" }],
			},
		],
		relations: [
			{
				slug: "post_authors",
				parentCollection: "posts",
				childCollection: "authors",
				parentLabel: "Posts",
				parentLabelSingular: "Post",
				childLabel: "Authors",
				childLabelSingular: "Author",
				maxChildrenPerParent: 1,
			},
		],
	};

	it("exports a relation with everything needed to recreate it", async () => {
		await applySeed(db, seed);

		const exported = await exportSeed(db);

		expect(exported.relations).toEqual([
			{
				slug: "post_authors",
				parentCollection: "posts",
				childCollection: "authors",
				parentLabel: "Posts",
				parentLabelSingular: "Post",
				childLabel: "Authors",
				childLabelSingular: "Author",
				maxChildrenPerParent: 1,
				maxParentsPerChild: null,
			},
		]);
	});

	it("applies its own export into a fresh database unchanged", async () => {
		await applySeed(db, seed);
		const exported = await exportSeed(db);

		const fresh = await setupTestDatabase();
		try {
			const result = await applySeed(fresh, exported);

			expect(result.relations.created).toBe(1);
			expect(await new RelationRepository(fresh).list()).toHaveLength(1);

			// The field binds to the exported relation rather than getting a second
			// one created for it.
			const field = await new SchemaRegistry(fresh).getField("posts", "author");
			expect(field?.validation).toMatchObject({
				relation: "post_authors",
				relationSide: "parent",
				targetCollection: "authors",
			});
		} finally {
			await teardownTestDatabase(fresh);
		}
	});

	it("exports a relation no field binds", async () => {
		await new RelationRepository(db).create({
			slug: "orphan",
			parentCollection: "posts",
			childCollection: "posts",
			parentLabel: "Parents",
			childLabel: "Children",
		});

		const exported = await exportSeed(db);

		expect(exported.relations?.map((relation) => relation.slug)).toEqual(["orphan"]);
	});

	it("exports an entry's links as $ref: values and restores them on apply", async () => {
		await applySeed(
			db,
			{
				...seed,
				content: {
					authors: [{ id: "author-jane", slug: "jane", data: { name: "Jane" } }],
					posts: [
						{
							id: "post-hello",
							slug: "hello",
							data: { title: "Hello", author: "$ref:author-jane" },
						},
					],
				},
			},
			{ includeContent: true },
		);

		const exported = await exportSeed(db, "all");

		expect(exported.content?.posts?.[0]?.data).toMatchObject({
			title: "Hello",
			author: "$ref:authors:jane",
		});

		const fresh = await setupTestDatabase();
		try {
			await applySeed(fresh, exported, { includeContent: true });

			const relation = await new RelationRepository(fresh).findBySlug("post_authors");
			const content = new ContentRepository(fresh);
			const post = await content.findBySlug("posts", "hello");
			const author = await content.findBySlug("authors", "jane");
			const links = await new RelationRepository(fresh).getChildrenPage(
				relation!.id,
				post!.translationGroup!,
			);

			expect(links.items.map((link) => link.childGroup)).toEqual([author!.translationGroup]);
		} finally {
			await teardownTestDatabase(fresh);
		}
	});

	it("drops a link whose child collection was not exported", async () => {
		await applySeed(
			db,
			{
				...seed,
				content: {
					authors: [{ id: "author-jane", slug: "jane", data: { name: "Jane" } }],
					posts: [
						{
							id: "post-hello",
							slug: "hello",
							data: { title: "Hello", author: "$ref:author-jane" },
						},
					],
				},
			},
			{ includeContent: true },
		);

		const exported = await exportSeed(db, "posts");

		// Nothing in the seed would resolve a reference to an entry it does not carry.
		expect(exported.content?.posts?.[0]?.data).not.toHaveProperty("author");
	});
});
