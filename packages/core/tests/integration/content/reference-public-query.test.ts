/**
 * Site code reads an entry's references.
 *
 * `getEmDashEntry(..., { references })` resolves each selected field to real
 * entries — the same shape a direct read of the target collection returns — and
 * `getEmDashReferences` walks past the first page. What these tests pin is the
 * behaviour a template depends on: link order, the locale variant chosen, what
 * an anonymous render is allowed to see, and that a caller who asks for nothing
 * pays for nothing.
 */

import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { handleContentCreate } from "../../../src/api/handlers/content.js";
import { ContentRepository } from "../../../src/database/repositories/content.js";
import { RelationRepository } from "../../../src/database/repositories/relation.js";
import type { Database } from "../../../src/database/types.js";
import type { EmDashRuntime } from "../../../src/emdash-runtime.js";
import { getEmDashEntry, getEmDashReferences } from "../../../src/query.js";
import { resolveReferencePages } from "../../../src/references/resolve.js";
import { runWithContext } from "../../../src/request-context.js";
import { SchemaRegistry } from "../../../src/schema/registry.js";
import { createTestRuntime } from "../../utils/mcp-runtime.js";
import {
	describeEachDialect,
	setupForDialect,
	teardownForDialect,
	type DialectTestContext,
} from "../../utils/test-db.js";

vi.mock("astro:content", () => ({
	getLiveCollection: vi.fn(),
	getLiveEntry: vi.fn(),
}));

import { getLiveEntry } from "astro:content";

describeEachDialect("public reference queries", (dialect) => {
	let ctx: DialectTestContext;
	let db: Kysely<Database>;
	let runtime: EmDashRuntime;

	beforeEach(async () => {
		ctx = await setupForDialect(dialect);
		db = ctx.db;

		const registry = new SchemaRegistry(db);
		await registry.createCollection({ slug: "pages", label: "Pages", labelSingular: "Page" });
		await registry.createField("pages", { slug: "title", label: "Title", type: "string" });
		await registry.createField("pages", { slug: "featured", label: "Featured", type: "boolean" });
		await registry.createCollection({ slug: "posts", label: "Posts", labelSingular: "Post" });
		await registry.createField("posts", { slug: "title", label: "Title", type: "string" });

		const relations = new RelationRepository(db);
		await relations.create({
			slug: "posts_related_pages",
			parentCollection: "posts",
			childCollection: "pages",
			parentLabel: "Posts",
			childLabel: "Related pages",
		});
		await registry.createField("posts", {
			slug: "related_pages",
			label: "Related pages",
			type: "reference",
			validation: {
				relation: "posts_related_pages",
				relationSide: "parent",
				targetCollection: "pages",
			},
		});
		// The inverse: a page lists the posts that point at it.
		await registry.createField("pages", {
			slug: "linking_posts",
			label: "Linking posts",
			type: "reference",
			validation: {
				relation: "posts_related_pages",
				relationSide: "child",
				targetCollection: "posts",
			},
		});

		runtime = createTestRuntime(db);
	});

	afterEach(async () => {
		await teardownForDialect(ctx);
		vi.mocked(getLiveEntry).mockReset();
	});

	async function createPage(
		title: string,
		options: { publish?: boolean; featured?: boolean } = {},
	) {
		const slug = title.toLowerCase().replaceAll(" ", "-");
		const result = await handleContentCreate(db, "pages", {
			data: { title, featured: options.featured ?? false },
			slug,
		});
		if (!result.success) throw new Error(`Page setup failed: ${result.error.message}`);
		if (options.publish !== false) {
			const published = await runtime.handleContentPublish("pages", result.data.item.id);
			if (!published.success) throw new Error("Page publish failed");
		}
		return result.data.item;
	}

	async function createPost(title: string, pageIds: string[]) {
		const created = await runtime.handleContentCreate("posts", {
			data: { title },
			slug: title.toLowerCase().replaceAll(" ", "-"),
			references: { related_pages: pageIds },
		});
		if (!created.success || !created.data) throw new Error("Post setup failed");
		const published = await runtime.handleContentPublish("posts", created.data.item.id);
		if (!published.success) throw new Error("Post publish failed");
		return created.data.item;
	}

	async function groupOf(collection: string, id: string): Promise<string> {
		const item = await new ContentRepository(db).findById(collection, id);
		if (!item?.translationGroup) throw new Error(`${collection}/${id} has no translation group`);
		return item.translationGroup;
	}

	/** Resolve as an anonymous render would, inside a request context bound to the test db. */
	function resolvePublic(
		collection: string,
		entryGroup: string,
		selection: Record<string, true | { limit?: number; cursor?: string }>,
		overrides: { serveDrafts?: boolean; draftRevisionId?: string; locale?: string | null } = {},
	) {
		return runWithContext({ editMode: false, db }, () =>
			resolveReferencePages({
				collection,
				entryGroup,
				locale: overrides.locale === undefined ? "en" : overrides.locale,
				draftRevisionId: overrides.draftRevisionId,
				serveDrafts: overrides.serveDrafts ?? false,
				selection,
			}),
		);
	}

	it("resolves a parent-side field in link order", async () => {
		const first = await createPage("Page One");
		const second = await createPage("Page Two");
		const post = await createPost("Hello", [second.id, first.id]);

		const pages = await resolvePublic("posts", await groupOf("posts", post.id), {
			related_pages: true,
		});

		expect(pages.related_pages?.collection).toBe("pages");
		expect(pages.related_pages?.entries.map((entry) => entry.slug)).toEqual([
			"page-two",
			"page-one",
		]);
	});

	it("gives a referenced entry the same data shape as a direct read", async () => {
		const page = await createPage("Page One", { featured: true });
		const post = await createPost("Hello", [page.id]);

		const pages = await resolvePublic("posts", await groupOf("posts", post.id), {
			related_pages: true,
		});

		const child = pages.related_pages?.entries[0];
		expect(child?.id).toBe("page-one");
		expect(child?.data.slug).toBe("page-one");
		expect(child?.data.title).toBe("Page One");
		// Booleans and dates are mapped, not handed back as raw column values —
		// a referenced entry renders through the same template as a direct one.
		expect(child?.data.featured).toBe(true);
		expect(child?.data.createdAt).toBeInstanceOf(Date);
	});

	it("hides an unpublished target from a public render and shows it to a draft render", async () => {
		const draftPage = await createPage("Page One", { publish: false });
		const post = await createPost("Hello", [draftPage.id]);
		const group = await groupOf("posts", post.id);

		const anonymous = await resolvePublic("posts", group, { related_pages: true });
		expect(anonymous.related_pages?.entries).toEqual([]);

		const preview = await resolvePublic(
			"posts",
			group,
			{ related_pages: true },
			{
				serveDrafts: true,
			},
		);
		expect(preview.related_pages?.entries.map((entry) => entry.slug)).toEqual(["page-one"]);
	});

	it("resolves a child-side field to the entries pointing at it", async () => {
		const page = await createPage("Page One");
		const post = await createPost("Hello", [page.id]);

		const pages = await resolvePublic("pages", await groupOf("pages", page.id), {
			linking_posts: true,
		});

		expect(pages.linking_posts?.collection).toBe("posts");
		expect(pages.linking_posts?.entries.map((entry) => entry.slug)).toEqual([post.slug]);
	});

	it("prefers a staged selection only when the render may see drafts", async () => {
		const published = await createPage("Page One");
		const staged = await createPage("Page Two");
		const post = await createPost("Hello", [published.id]);

		const updated = await runtime.handleContentUpdate("posts", post.id, {
			references: { related_pages: [staged.id] },
		});
		if (!updated.success) throw new Error("Post update failed");

		const row = await new ContentRepository(db).findById("posts", post.id);
		const draftRevisionId = row?.draftRevisionId ?? undefined;
		expect(draftRevisionId).toBeTruthy();
		const group = await groupOf("posts", post.id);

		const anonymous = await resolvePublic(
			"posts",
			group,
			{ related_pages: true },
			{
				draftRevisionId,
			},
		);
		expect(anonymous.related_pages?.entries.map((entry) => entry.slug)).toEqual(["page-one"]);

		const preview = await resolvePublic(
			"posts",
			group,
			{ related_pages: true },
			{
				draftRevisionId,
				serveDrafts: true,
			},
		);
		expect(preview.related_pages?.entries.map((entry) => entry.slug)).toEqual(["page-two"]);
	});

	it("pages a selection and walks it with the cursor it returns", async () => {
		const pageIds: string[] = [];
		for (const title of ["Page One", "Page Two", "Page Three"]) {
			pageIds.push((await createPage(title)).id);
		}
		const post = await createPost("Hello", pageIds);
		const group = await groupOf("posts", post.id);

		const first = await resolvePublic("posts", group, { related_pages: { limit: 2 } });
		expect(first.related_pages?.entries.map((entry) => entry.slug)).toEqual([
			"page-one",
			"page-two",
		]);
		expect(first.related_pages?.nextCursor).toBeTruthy();

		const second = await runWithContext({ editMode: false, db }, () =>
			getEmDashReferences("posts", post.id, "related_pages", {
				limit: 2,
				cursor: first.related_pages!.nextCursor,
			}),
		);
		expect(second.entries.map((entry) => entry.id)).toEqual(["page-three"]);
		expect(second.nextCursor).toBeUndefined();
	});

	it("returns an empty page for an unknown field", async () => {
		const post = await createPost("Hello", []);
		const result = await runWithContext({ editMode: false, db }, () =>
			getEmDashReferences("posts", post.id, "not_a_field"),
		);
		expect(result.entries).toEqual([]);
		expect(result.error).toBeUndefined();
	});

	it("attaches the selected fields to a loaded entry and nothing otherwise", async () => {
		const page = await createPage("Page One");
		const post = await createPost("Hello", [page.id]);
		const group = await groupOf("posts", post.id);

		vi.mocked(getLiveEntry).mockResolvedValue({
			entry: {
				id: post.slug,
				data: {
					id: post.id,
					slug: post.slug,
					title: "Hello",
					status: "published",
					locale: "en",
					translationGroup: group,
				},
			},
			cacheHint: {},
		});

		const withRefs = await runWithContext({ editMode: false, db }, () =>
			getEmDashEntry("posts", post.slug, { references: { related_pages: true } }),
		);
		expect(
			withRefs.entry?.references?.related_pages?.entries.map((entry) => entry.data.title),
		).toEqual(["Page One"]);

		const without = await runWithContext({ editMode: false, db }, () =>
			getEmDashEntry("posts", post.slug),
		);
		expect(without.entry?.references).toBeUndefined();
	});
});
