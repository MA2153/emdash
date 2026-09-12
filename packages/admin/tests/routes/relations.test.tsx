/**
 * The relations admin surface: the list, the editor, and the routing that
 * reaches them.
 *
 * `/content-types/relations` sits under the collection editor's own
 * `/content-types/$slug`, so the routing assertions here are the ones that
 * catch a relation page being served as a collection called "relations".
 */

import {
	Outlet,
	RouterProvider,
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RelationDangerZone } from "../../src/components/RelationDangerZone";
import { RelationEditor } from "../../src/components/RelationEditor";
import { RelationList } from "../../src/components/RelationList";
import type { SchemaCollection } from "../../src/lib/api";
import type { RelationWithUsage } from "../../src/lib/api/relations.js";
import { createAdminRouter } from "../../src/router";
import { render } from "../utils/render.tsx";
import { createTestQueryClient } from "../utils/test-helpers";

function relation(overrides: Partial<RelationWithUsage> = {}): RelationWithUsage {
	return {
		id: "rel-1",
		slug: "posts_authors",
		parentCollection: "posts",
		childCollection: "authors",
		parentLabel: "Posts",
		parentLabelSingular: "Post",
		childLabel: "Authors",
		childLabelSingular: "Author",
		maxChildrenPerParent: 1,
		maxParentsPerChild: null,
		boundFields: [{ collectionSlug: "posts", fieldSlug: "author", side: "parent" }],
		linkCount: 12,
		...overrides,
	};
}

const collections = [
	{ slug: "posts", label: "Posts", labelSingular: "Post" },
	{ slug: "authors", label: "Authors", labelSingular: "Author" },
] as SchemaCollection[];

/** Render `element` inside a router that owns the relation route shapes, so
 * `<Link>` targets resolve the way they do in the admin. */
async function renderWithRoutes(element: React.ReactNode) {
	const rootRoute = createRootRoute({ component: Outlet });
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => element,
	});
	const listRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/content-types/relations",
		component: () => <div>Relations list</div>,
	});
	const newRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/content-types/relations/new",
		component: () => <div>New relation</div>,
	});
	const editRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/content-types/relations/$slug",
		component: () => <div>Edit relation</div>,
	});
	const contentTypesRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/content-types",
		component: () => <div>Content types</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			indexRoute,
			contentTypesRoute,
			listRoute,
			newRoute,
			editRoute,
		]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	const screen = await render(<RouterProvider router={router} />);
	return { router, screen };
}

/** Kumo's Select is a combobox button over a listbox, not a native select. */
async function selectOption(
	screen: Awaited<ReturnType<typeof renderWithRoutes>>["screen"],
	label: string,
	option: string,
) {
	await screen.getByLabelText(label, { exact: true }).click();
	await screen.getByRole("option", { name: option, exact: true }).click();
}

describe("RelationList", () => {
	it("shows each relation's ends, bound fields and link count", async () => {
		const { screen } = await renderWithRoutes(<RelationList relations={[relation()]} />);

		await expect.element(screen.getByText("posts_authors")).toBeInTheDocument();
		await expect.element(screen.getByText("posts.author")).toBeInTheDocument();
		await expect.element(screen.getByText("picks Authors")).toBeInTheDocument();
		await expect.element(screen.getByText("12 links")).toBeInTheDocument();
	});

	it("says which end a child-side field picks from", async () => {
		const { screen } = await renderWithRoutes(
			<RelationList
				relations={[
					relation({
						boundFields: [{ collectionSlug: "authors", fieldSlug: "posts", side: "child" }],
					}),
				]}
			/>,
		);

		await expect.element(screen.getByText("picks Posts")).toBeInTheDocument();
	});

	// Unbinding the last field leaves a relation behind; without a row here it
	// is unreachable and undeletable.
	it("lists a relation with no bound fields", async () => {
		const { screen } = await renderWithRoutes(
			<RelationList relations={[relation({ boundFields: [], linkCount: 0 })]} />,
		);

		await expect.element(screen.getByText("posts_authors")).toBeInTheDocument();
		await expect.element(screen.getByText("No fields")).toBeInTheDocument();
	});

	it("navigates to a relation from its slug", async () => {
		const { router, screen } = await renderWithRoutes(<RelationList relations={[relation()]} />);

		screen.getByRole("link", { name: "posts_authors", exact: true }).element().click();

		await vi.waitFor(() => {
			expect(router.state.location.pathname).toBe("/content-types/relations/posts_authors");
		});
	});
});

describe("RelationEditor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("saves the roles and limits of an existing relation", async () => {
		const onSave = vi.fn();
		const { screen } = await renderWithRoutes(
			<RelationEditor relation={relation()} collections={collections} onSave={onSave} />,
		);

		const childLabel = screen.getByLabelText("Linked side (plural)");
		await childLabel.fill("Writers");
		await screen.getByRole("button", { name: /Save/ }).click();

		await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
		expect(onSave.mock.calls[0]?.[0]).toEqual({
			parentLabel: "Posts",
			parentLabelSingular: "Post",
			childLabel: "Writers",
			childLabelSingular: "Author",
			maxChildrenPerParent: 1,
			maxParentsPerChild: null,
		});
	});

	// The two ends key every stored link; changing one would repoint them at
	// content of the wrong type.
	it("locks the ends and the slug of an existing relation", async () => {
		const { screen } = await renderWithRoutes(
			<RelationEditor relation={relation()} collections={collections} onSave={vi.fn()} />,
		);

		await expect.element(screen.getByLabelText("Slug")).toBeDisabled();
		await expect.element(screen.getByLabelText("Links from", { exact: true })).toBeDisabled();
		await expect.element(screen.getByLabelText("Links to", { exact: true })).toBeDisabled();
	});

	it("sends the two ends and a slug when creating", async () => {
		const onSave = vi.fn();
		const { screen } = await renderWithRoutes(
			<RelationEditor isNew collections={collections} onSave={onSave} />,
		);

		await selectOption(screen, "Links from", "Posts");
		await selectOption(screen, "Links to", "Authors");
		await screen.getByLabelText("Linking side (plural)").fill("Posts");
		await screen.getByLabelText("Linked side (plural)").fill("Authors");
		await screen.getByRole("button", { name: /Save/ }).click();

		await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
		expect(onSave.mock.calls[0]?.[0]).toMatchObject({
			slug: "posts_authors",
			parentCollection: "posts",
			childCollection: "authors",
			parentLabel: "Posts",
			childLabel: "Authors",
		});
	});
});

describe("relation routes", () => {
	// `/content-types/relations` sits inside `/content-types/$slug`'s space. If
	// the dynamic route ever wins, the page becomes a collection editor for a
	// collection named "relations" — a 404 the user cannot act on.
	it("prefers the relations routes over the collection editor", () => {
		const router = createAdminRouter(createTestQueryClient());

		const matchIds = (pathname: string) =>
			router.matchRoutes({ pathname, search: {}, hash: "", href: pathname, state: {} }).at(-1)
				?.routeId;

		expect(matchIds("/content-types/relations")).toBe("/_admin/content-types/relations");
		expect(matchIds("/content-types/relations/new")).toBe("/_admin/content-types/relations/new");
		expect(matchIds("/content-types/relations/posts_authors")).toBe(
			"/_admin/content-types/relations/$slug",
		);
		expect(matchIds("/content-types/posts")).toBe("/_admin/content-types/$slug");
	});
});

describe("RelationDangerZone", () => {
	// The relation delete cascades to the fields on both ends, so the dialog
	// says so before it runs rather than reporting it afterwards.
	it("names what the delete takes before it runs", async () => {
		const { screen } = await renderWithRoutes(
			<RelationDangerZone relation={relation()} onDelete={vi.fn()} />,
		);

		await screen.getByRole("button", { name: "Delete relationship", exact: true }).click();

		await expect.element(screen.getByText("This removes:")).toBeInTheDocument();
		await expect
			.element(screen.getByText(/the author field on posts, which picks entries it links to/))
			.toBeInTheDocument();
		await expect.element(screen.getByText("12 links")).toBeInTheDocument();
	});

	// Bound fields are not a refusal: the dialog names them and the delete
	// removes them.
	it("deletes a relationship that fields are still bound to", async () => {
		const onDelete = vi.fn();
		const { screen } = await renderWithRoutes(
			<RelationDangerZone relation={relation()} onDelete={onDelete} />,
		);

		await screen.getByRole("button", { name: "Delete relationship", exact: true }).click();
		screen.getByRole("button", { name: "Delete", exact: true }).element().click();

		expect(onDelete).toHaveBeenCalledTimes(1);
	});
});
