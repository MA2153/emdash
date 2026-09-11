/**
 * References Sidebar for Content Editor
 *
 * Read-only "Referenced by" panel shown in the content editor sidebar for
 * existing entries. For each relation whose child side is the entry's
 * collection, it lists the parent entries that reference the entry being
 * edited (the reverse direction of the parent-side reference field renderer).
 *
 * The panel always renders its heading so it remains a stable, sortable
 * content-settings section. Entries without backlinks show an empty state.
 */

import { Button, Loader, Text } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import * as React from "react";

import { fetchCollections } from "../lib/api";
import {
	type EntryRef,
	type RelationDef,
	fetchReferenceParents,
	fetchRelations,
} from "../lib/api/relations.js";
import { cn } from "../lib/utils.js";
import { RouterLinkButton } from "./RouterLinkButton.js";

interface ReferencesSidebarProps {
	collection: string;
	entryId: string;
	/** Applied to the root element. */
	className?: string;
}

interface ParentsState {
	items: EntryRef[];
	nextCursor?: string;
	loading: boolean;
}

const PAGE_SIZE = 50;

export function ReferencesSidebar({ collection, entryId, className }: ReferencesSidebarProps) {
	const { t } = useLingui();
	const relationsQuery = useQuery({
		queryKey: ["relations"],
		queryFn: () => fetchRelations(),
		// A 403 means the viewer genuinely lacks `schema:read`; retrying just adds
		// latency before we hide the panel, which is the desired outcome.
		retry: false,
	});

	// Group headings use the parent collection's plural label. The relation only
	// carries `parentLabel` (the singular field label), so map slugs to their
	// plural display name; the query is shared with the rest of the admin.
	const collectionsQuery = useQuery({
		queryKey: ["collections"],
		queryFn: fetchCollections,
	});
	const pluralLabelBySlug = React.useMemo(() => {
		const map = new Map<string, string>();
		for (const c of collectionsQuery.data ?? []) map.set(c.slug, c.label);
		return map;
	}, [collectionsQuery.data]);

	// Every relation whose child side is this collection: those are the ones
	// something can point at this entry through.
	const applicableRelations = React.useMemo(
		() => (relationsQuery.data ?? []).filter((r) => r.childCollection === collection),
		[relationsQuery.data, collection],
	);

	// Per-relation parents pagination, keyed by relation id. First pages are
	// loaded on demand (effect below) once the relations list resolves; manual
	// "Load more" advances the cursor for an individual relation.
	const [parentsByRel, setParentsByRel] = React.useState<Record<string, ParentsState>>({});

	// Dump stale state and load the first page for each applicable relation.
	// Re-runs when the entry, collection, or applicable relation set changes.
	React.useEffect(() => {
		let cancelled = false;
		// New entry/relation slice — start from a clean slate so cursor keys from
		// a previously displayed entry never bleed through.
		setParentsByRel({});
		void (async () => {
			for (const rel of applicableRelations) {
				try {
					const res = await fetchReferenceParents(collection, entryId, rel.id, {
						limit: PAGE_SIZE,
					});
					if (cancelled) return;
					setParentsByRel((prev) => ({
						...prev,
						[rel.id]: { items: res.parents, nextCursor: res.nextCursor, loading: false },
					}));
				} catch {
					if (cancelled) return;
					// A single relation failing (not found, draft-read denied, …)
					// shouldn't crash the panel — record it as empty so the heading
					// still hides once every relation has resolved.
					setParentsByRel((prev) => ({
						...prev,
						[rel.id]: { items: [], nextCursor: undefined, loading: false },
					}));
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [applicableRelations, collection, entryId]);

	const loadMore = React.useCallback(
		async (rel: RelationDef) => {
			// Read current cursor synchronously from state to avoid a stale closure
			// when multiple "Load more" clicks queue up.
			let cursor: string | undefined;
			setParentsByRel((prev) => {
				const cur = prev[rel.id];
				if (!cur || !cur.nextCursor || cur.loading) return prev;
				cursor = cur.nextCursor;
				return { ...prev, [rel.id]: { ...cur, loading: true } };
			});
			if (!cursor) return;
			try {
				const res = await fetchReferenceParents(collection, entryId, rel.id, {
					cursor,
					limit: PAGE_SIZE,
				});
				setParentsByRel((prev) => {
					const cur = prev[rel.id];
					if (!cur) return prev;
					const seen = new Set(cur.items.map((p) => p.id));
					const merged = [...cur.items, ...res.parents.filter((p) => !seen.has(p.id))];
					return {
						...prev,
						[rel.id]: { items: merged, nextCursor: res.nextCursor, loading: false },
					};
				});
			} catch {
				setParentsByRel((prev) => {
					const cur = prev[rel.id];
					return cur ? { ...prev, [rel.id]: { ...cur, loading: false } } : prev;
				});
			}
		},
		[collection, entryId],
	);

	const isPopulated = (rel: RelationDef): boolean => (parentsByRel[rel.id]?.items.length ?? 0) > 0;
	const populatedRels = applicableRelations.filter(isPopulated);
	const isLoadingParents = applicableRelations.some((rel) => !parentsByRel[rel.id]);

	return (
		<div className={cn("space-y-4", className)}>
			<Text bold as="h3">
				{t`Referenced by`}
			</Text>
			{relationsQuery.isLoading || isLoadingParents ? (
				<Loader size="sm" />
			) : relationsQuery.error ? (
				<p className="text-sm text-kumo-subtle">{t`References unavailable.`}</p>
			) : populatedRels.length === 0 ? (
				<p className="text-sm text-kumo-subtle">{t`No references yet.`}</p>
			) : (
				<div className="space-y-4">
					{populatedRels.map((rel) => {
						const state = parentsByRel[rel.id];
						// `state` is guarded by `isPopulated` above, but the TS narrowing
						// across the .filter callback doesn't carry through.
						if (!state) return null;
						const heading = pluralLabelBySlug.get(rel.parentCollection) ?? rel.parentLabel;
						return (
							<div key={rel.id} className="space-y-2">
								<h4 className="text-sm font-medium text-kumo-subtle">{heading}</h4>
								<ul className="space-y-2">
									{state.items.map((parent) => {
										const label = parent.title || parent.slug || parent.id;
										return (
											<li
												key={parent.id}
												className="flex items-center gap-2 rounded-md border bg-kumo-base px-3 py-2"
											>
												<Link
													to="/content/$collection/$id"
													params={{ collection: parent.collection, id: parent.id }}
													search={{ locale: parent.locale ?? undefined }}
													className="group min-w-0 flex-1"
												>
													<div className="truncate text-sm font-medium group-hover:underline">
														{label}
													</div>
													{parent.slug && (
														<div className="flex items-center gap-2 text-xs text-kumo-subtle">
															<span className="truncate">{parent.slug}</span>
														</div>
													)}
												</Link>
												<RouterLinkButton
													to="/content/$collection/$id"
													params={{ collection: parent.collection, id: parent.id }}
													search={{ locale: parent.locale ?? undefined }}
													target="_blank"
													variant="ghost"
													shape="square"
													size="sm"
													icon={<ArrowSquareOut className="h-4 w-4" />}
													aria-label={t`Open ${label} in a new tab`}
												/>
											</li>
										);
									})}
								</ul>
								{state.nextCursor && (
									<div className="pt-1">
										<Button
											variant="outline"
											size="sm"
											onClick={() => void loadMore(rel)}
											disabled={state.loading}
										>
											{state.loading ? (
												<>
													<Loader size="sm" /> {t`Loading...`}
												</>
											) : (
												t`Load more`
											)}
										</Button>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
