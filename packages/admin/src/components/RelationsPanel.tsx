/**
 * Relations a content type takes part in, listed under its fields.
 *
 * A relation is schema that lives outside the collection — the relations list
 * owns the full view — but the collection editor is where someone asks "what
 * does this link to?", so the ones it is an end of are answered here.
 */

import { Button } from "@cloudflare/kumo";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ArrowRight, LinkSimple, Pencil, Plus } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import * as React from "react";

import type { SchemaCollection } from "../lib/api";
import type { CreateRelationInput, RelationWithUsage } from "../lib/api/relations.js";
import { RelationCreateDialog } from "./RelationCreateDialog";
import { RouterLinkButton } from "./RouterLinkButton.js";

export interface RelationsPanelProps {
	/** The content type being edited — the end these relations are read from. */
	collectionSlug: string;
	/** Every relation on the site; the panel keeps the ones this end is in. */
	relations: RelationWithUsage[];
	collections: SchemaCollection[];
	isLoading?: boolean;
	onCreateRelation?: (input: CreateRelationInput) => Promise<unknown>;
}

export function RelationsPanel({
	collectionSlug,
	relations,
	collections,
	isLoading,
	onCreateRelation,
}: RelationsPanelProps) {
	const { t } = useLingui();
	const [createOpen, setCreateOpen] = React.useState(false);

	const participating = relations.filter(
		(relation) =>
			relation.parentCollection === collectionSlug || relation.childCollection === collectionSlug,
	);

	return (
		<div className="rounded-lg border bg-kumo-base">
			<div className="flex items-center justify-between gap-4 p-4 border-b">
				<div>
					<h2 className="font-semibold">{t`Relations`}</h2>
					<p className="text-sm text-kumo-subtle">
						{isLoading
							? t`Loading relations...`
							: plural(participating.length, {
									one: "# relation this content type takes part in",
									other: "# relations this content type takes part in",
								})}
					</p>
				</div>
				{onCreateRelation && (
					<Button icon={<Plus />} onClick={() => setCreateOpen(true)}>
						{t`New Relation`}
					</Button>
				)}
			</div>

			{participating.length === 0 ? (
				<div className="p-8 text-center text-kumo-subtle">
					<LinkSimple className="mx-auto h-12 w-12 mb-4 opacity-50" />
					<p className="font-medium">{t`No relations yet`}</p>
					<p className="text-sm">
						{t`Create one to let entries here link to entries in another content type.`}
					</p>
					{onCreateRelation && (
						<Button className="mt-4" icon={<Plus />} onClick={() => setCreateOpen(true)}>
							{t`Create First Relation`}
						</Button>
					)}
				</div>
			) : (
				<div className="divide-y divide-kumo-line">
					{participating.map((relation) => (
						<RelationRow key={relation.id} relation={relation} collectionSlug={collectionSlug} />
					))}
				</div>
			)}

			{onCreateRelation && (
				<RelationCreateDialog
					open={createOpen}
					onOpenChange={setCreateOpen}
					collections={collections}
					defaultParentCollection={collectionSlug}
					onCreate={onCreateRelation}
				/>
			)}
		</div>
	);
}

function RelationRow({
	relation,
	collectionSlug,
}: {
	relation: RelationWithUsage;
	collectionSlug: string;
}) {
	const { t } = useLingui();

	const isParent = relation.parentCollection === collectionSlug;
	const isChild = relation.childCollection === collectionSlug;
	const ownFields = relation.boundFields.filter((bound) => bound.collectionSlug === collectionSlug);

	return (
		<div className="flex items-center gap-4 px-4 py-3 hover:bg-kumo-tint/25">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<Link
						to="/content-types/relations/$slug"
						params={{ slug: relation.slug }}
						className="font-medium hover:text-kumo-link"
					>
						<code className="text-sm">{relation.slug}</code>
					</Link>
					<span className="flex items-center gap-1.5 text-sm text-kumo-subtle">
						{relation.parentCollection}
						<ArrowRight className="h-3 w-3 rtl:-scale-x-100" aria-hidden="true" />
						{relation.childCollection}
					</span>
				</div>

				<p className="mt-1 text-sm text-kumo-subtle">
					{isParent && <span>{t`Links to ${relation.childLabel}`}</span>}
					{isParent && isChild && <span aria-hidden="true"> · </span>}
					{isChild && <span>{t`Linked from ${relation.parentLabel}`}</span>}
				</p>

				{ownFields.length === 0 ? (
					<p className="mt-1 text-xs text-kumo-subtle">{t`No field on this content type uses it yet`}</p>
				) : (
					<ul className="mt-1 flex flex-wrap gap-1.5">
						{ownFields.map((bound) => (
							<li key={bound.fieldSlug}>
								<code className="rounded bg-kumo-tint px-1.5 py-0.5 text-xs">
									{bound.fieldSlug}
								</code>
							</li>
						))}
					</ul>
				)}
			</div>

			<span className="whitespace-nowrap text-sm text-kumo-subtle">
				{plural(relation.linkCount, { one: "# link", other: "# links" })}
			</span>

			<RouterLinkButton
				to="/content-types/relations/$slug"
				params={{ slug: relation.slug }}
				aria-label={t`Edit ${relation.slug}`}
				variant="ghost"
				shape="square"
				icon={<Pencil />}
			/>
		</div>
	);
}
