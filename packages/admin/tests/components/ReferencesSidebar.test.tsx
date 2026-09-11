import {
	Outlet,
	RouterProvider,
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReferencesSidebar } from "../../src/components/ReferencesSidebar";
import {
	fetchReferenceParents,
	fetchRelations,
	type EntryRef,
	type RelationWithUsage,
} from "../../src/lib/api/relations.js";
import { render } from "../utils/render.tsx";

vi.mock("../../src/lib/api", async () => {
	const actual = await vi.importActual("../../src/lib/api");
	return {
		...actual,
		fetchCollections: vi.fn(async () => [
			{ slug: "posts", label: "Posts" },
			{ slug: "pages", label: "Pages" },
		]),
	};
});

vi.mock("../../src/lib/api/relations.js", async () => {
	const actual = await vi.importActual("../../src/lib/api/relations.js");
	return {
		...actual,
		fetchRelations: vi.fn(),
		fetchReferenceParents: vi.fn(),
	};
});

function relation(overrides: Partial<RelationWithUsage>): RelationWithUsage {
	return {
		id: "rel-1",
		slug: "posts_author",
		parentCollection: "posts",
		childCollection: "authors",
		parentLabel: "Posts",
		parentLabelSingular: "Post",
		childLabel: "Authors",
		childLabelSingular: "Author",
		maxChildrenPerParent: null,
		maxParentsPerChild: null,
		boundFields: [],
		linkCount: 0,
		...overrides,
	};
}

function parentRef(overrides: Partial<EntryRef>): EntryRef {
	return {
		id: "post-1",
		slug: "launch-notes",
		collection: "posts",
		title: "Launch notes",
		locale: "en",
		translationGroup: "group-1",
		...overrides,
	};
}

async function renderSidebar() {
	const rootRoute = createRootRoute({ component: Outlet });
	const panelRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => <ReferencesSidebar collection="authors" entryId="author-1" />,
	});
	const contentRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/content/$collection/$id",
		validateSearch: (search: Record<string, unknown>) => ({
			locale: typeof search.locale === "string" ? search.locale : undefined,
		}),
		component: () => <div>Content destination</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([panelRoute, contentRoute]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	return render(<RouterProvider router={router} />);
}

describe("ReferencesSidebar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows an empty state when the entry has no backlinks", async () => {
		vi.mocked(fetchRelations).mockResolvedValue([]);
		vi.mocked(fetchReferenceParents).mockResolvedValue({ parents: [] });

		const screen = await renderSidebar();

		await expect
			.element(screen.getByRole("heading", { name: "Referenced by" }))
			.toBeInTheDocument();
		await expect.element(screen.getByText("No references yet.")).toBeInTheDocument();
	});

	it("lists the backlinks of every relation pointing at the collection", async () => {
		vi.mocked(fetchRelations).mockResolvedValue([
			relation({ id: "rel-authored", slug: "posts_author", parentCollection: "posts" }),
			relation({ id: "rel-reviewed", slug: "pages_reviewer", parentCollection: "pages" }),
			relation({
				id: "rel-elsewhere",
				slug: "posts_tags",
				parentCollection: "posts",
				childCollection: "tags",
			}),
		]);
		// Keyed by the identifier the panel sends: a relation resolves by id or
		// slug, and anything else 404s into an empty panel.
		const parentsByRelation: Record<string, EntryRef[]> = {
			"rel-authored": [parentRef({ id: "post-1", title: "Launch notes" })],
			"rel-reviewed": [
				parentRef({ id: "page-1", title: "About us", collection: "pages", slug: "about-us" }),
			],
		};
		vi.mocked(fetchReferenceParents).mockImplementation(async (_collection, _id, rel) => ({
			parents: parentsByRelation[rel] ?? [],
		}));

		const screen = await renderSidebar();

		await expect.element(screen.getByRole("heading", { name: "Posts" })).toBeInTheDocument();
		await expect.element(screen.getByRole("heading", { name: "Pages" })).toBeInTheDocument();
		await expect.element(screen.getByText("Launch notes")).toBeInTheDocument();
		await expect.element(screen.getByText("About us")).toBeInTheDocument();
	});

	it("ignores relations whose child side is another collection", async () => {
		vi.mocked(fetchRelations).mockResolvedValue([
			relation({ id: "rel-elsewhere", parentCollection: "posts", childCollection: "tags" }),
		]);
		vi.mocked(fetchReferenceParents).mockResolvedValue({
			parents: [parentRef({ title: "Should not appear" })],
		});

		const screen = await renderSidebar();

		await expect.element(screen.getByText("No references yet.")).toBeInTheDocument();
		expect(fetchReferenceParents).not.toHaveBeenCalled();
	});
});
