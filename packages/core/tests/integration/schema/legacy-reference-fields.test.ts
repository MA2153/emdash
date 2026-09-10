import { sql } from "kysely";
import type { Kysely } from "kysely";
import { ulid } from "ulidx";
import { expect, it } from "vitest";

import {
	handleContentCreate,
	handleContentGet,
	handleContentUpdate,
} from "../../../src/api/handlers/content.js";
import { handleSchemaFieldUpdate } from "../../../src/api/handlers/schema.js";
import { ContentRepository } from "../../../src/database/repositories/content.js";
import type { Database } from "../../../src/database/types.js";
import { SchemaRegistry } from "../../../src/schema/registry.js";
import { describeEachDialect, setupForDialect, teardownForDialect } from "../../utils/test-db.js";
import type { DialectTestContext } from "../../utils/test-db.js";

/**
 * Build the exact shape a reference field had before relations existed: a
 * `_emdash_fields` row with its target in `options.collection`, no
 * `validation.relation`, and a real TEXT column on the content table.
 *
 * Written with raw statements rather than the registry so the fixture does not
 * depend on the behaviour under test.
 */
async function createLegacyReferenceField(
	db: Kysely<Database>,
	collectionSlug: string,
	fieldSlug: string,
	options: { targetCollection: string; indexed?: boolean; required?: boolean } = {
		targetCollection: "posts",
	},
): Promise<void> {
	const collection = await db
		.selectFrom("_emdash_collections")
		.select("id")
		.where("slug", "=", collectionSlug)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("_emdash_fields")
		.values({
			id: ulid(),
			collection_id: collection.id,
			slug: fieldSlug,
			label: "Author",
			type: "reference",
			column_type: "TEXT",
			required: options.required ? 1 : 0,
			unique: 0,
			default_value: null,
			validation: null,
			widget: null,
			options: JSON.stringify({ collection: options.targetCollection }),
			sort_order: 10,
			indexed: options.indexed ? 1 : 0,
		})
		.execute();

	await sql`ALTER TABLE ${sql.ref(`ec_${collectionSlug}`)} ADD COLUMN ${sql.ref(fieldSlug)} text`.execute(
		db,
	);
}

describeEachDialect("reference fields that predate relations", (dialect) => {
	let ctx: DialectTestContext;

	async function setup() {
		ctx = await setupForDialect(dialect);
		const registry = new SchemaRegistry(ctx.db);
		await registry.createCollection({ slug: "posts", label: "Posts", labelSingular: "Post" });
		await registry.createField("posts", { slug: "title", label: "Title", type: "string" });
		return registry;
	}

	it("round-trips its value through create and get", async () => {
		await setup();
		try {
			await createLegacyReferenceField(ctx.db, "posts", "author", { targetCollection: "posts" });

			const created = await handleContentCreate(ctx.db, "posts", {
				data: { title: "A", author: "author-entry-id" },
			});
			expect(created.success).toBe(true);
			if (!created.success) return;
			expect(created.data.item.data).toMatchObject({ author: "author-entry-id" });

			const fetched = await handleContentGet(ctx.db, "posts", created.data.item.id);
			expect(fetched.success).toBe(true);
			if (!fetched.success) return;
			expect(fetched.data.item.data).toMatchObject({ author: "author-entry-id" });
		} finally {
			await teardownForDialect(ctx);
		}
	});

	it("keeps its value when the entry is updated", async () => {
		await setup();
		try {
			await createLegacyReferenceField(ctx.db, "posts", "author", { targetCollection: "posts" });

			const created = await handleContentCreate(ctx.db, "posts", {
				data: { title: "A", author: "first" },
			});
			if (!created.success) throw new Error("create failed");

			const updated = await handleContentUpdate(ctx.db, "posts", created.data.item.id, {
				data: { author: "second" },
			});
			expect(updated).toMatchObject({ success: true });

			const fetched = await handleContentGet(ctx.db, "posts", created.data.item.id);
			if (!fetched.success) throw new Error("get failed");
			expect(fetched.data.item.data).toMatchObject({ author: "second" });
		} finally {
			await teardownForDialect(ctx);
		}
	});

	it("stays editable and filterable when it was indexed before the upgrade", async () => {
		await setup();
		try {
			await createLegacyReferenceField(ctx.db, "posts", "author", {
				targetCollection: "posts",
				indexed: true,
			});

			// An unrelated edit must not be refused because the type left the
			// indexable set.
			const renamed = await handleSchemaFieldUpdate(ctx.db, "posts", "author", {
				label: "Written by",
			});
			expect(renamed).toMatchObject({ success: true });

			const created = await handleContentCreate(ctx.db, "posts", {
				data: { title: "A", author: "author-entry-id" },
			});
			if (!created.success) throw new Error("create failed");

			const content = new ContentRepository(ctx.db);
			const matches = await content.findMany("posts", {
				where: { fieldFilters: { author: "author-entry-id" } },
			});
			expect(matches.items.map((item) => item.id)).toEqual([created.data.item.id]);
		} finally {
			await teardownForDialect(ctx);
		}
	});
});
