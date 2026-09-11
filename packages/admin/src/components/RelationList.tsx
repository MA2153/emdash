/**
 * Relation list view — every link definition on the site.
 *
 * A relation is schema, like a collection: it names two collections and the
 * roles each plays. Reference fields bind to one, from one end. A relation
 * with no bound field is still listed: unbinding the last field leaves one
 * behind, and this page is the only way to reach it again.
 */

import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ArrowRight, Pencil, Plus } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";

import type { RelationWithUsage } from "../lib/api/relations.js";
import { ArrowPrev } from "./ArrowIcons.js";
import { RouterLinkButton } from "./RouterLinkButton.js";

export interface RelationListProps {
	relations: RelationWithUsage[];
	isLoading?: boolean;
	error?: string;
}

export function RelationList({ relations, isLoading, error }: RelationListProps) {
	const { t } = useLingui();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-4 min-w-0">
					<RouterLinkButton
						to="/content-types"
						aria-label={t`Back to Content Types`}
						variant="ghost"
						shape="square"
						icon={<ArrowPrev />}
					/>
					<div className="min-w-0">
						<h1 className="text-2xl font-semibold leading-tight">{t`Relations`}</h1>
						<p className="mt-1 text-sm leading-5 text-pretty text-kumo-subtle">
							{t`Define how content types link to each other`}
						</p>
					</div>
				</div>
				<RouterLinkButton to="/content-types/relations/new" icon={<Plus />}>
					{t`New Relation`}
				</RouterLinkButton>
			</div>

			{error && (
				<div className="rounded-md border border-kumo-danger/50 bg-kumo-danger-tint p-4 text-sm">
					{error}
				</div>
			)}

			<div className="rounded-md border bg-kumo-base overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-b bg-kumo-tint/50">
							<th scope="col" className="px-4 py-3 text-start text-sm font-medium">
								{t`Slug`}
							</th>
							<th scope="col" className="px-4 py-3 text-start text-sm font-medium">
								{t`Connects`}
							</th>
							<th scope="col" className="px-4 py-3 text-start text-sm font-medium">
								{t`Fields`}
							</th>
							<th scope="col" className="px-4 py-3 text-start text-sm font-medium">
								{t`Links`}
							</th>
							<th scope="col" className="px-4 py-3 text-end text-sm font-medium">
								{t`Actions`}
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-kumo-line">
						{isLoading ? (
							<tr>
								<td colSpan={5} className="px-4 py-8 text-center text-kumo-subtle">
									{t`Loading relations...`}
								</td>
							</tr>
						) : relations.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-8 text-center text-kumo-subtle">
									{t`No relations yet.`}{" "}
									<Link to="/content-types/relations/new" className="text-kumo-link underline">
										{t`Create your first relation`}
									</Link>
								</td>
							</tr>
						) : (
							relations.map((relation) => <RelationRow key={relation.id} relation={relation} />)
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function RelationRow({ relation }: { relation: RelationWithUsage }) {
	const { t } = useLingui();

	return (
		<tr className="hover:bg-kumo-tint/25">
			<td className="px-4 py-3">
				<Link
					to="/content-types/relations/$slug"
					params={{ slug: relation.slug }}
					className="font-medium hover:text-kumo-link"
				>
					<code className="text-sm">{relation.slug}</code>
				</Link>
			</td>
			<td className="px-4 py-3">
				<div className="flex items-center gap-2 text-sm">
					<span>{relation.parentCollection}</span>
					<ArrowRight
						className="h-3.5 w-3.5 text-kumo-subtle rtl:-scale-x-100"
						aria-hidden="true"
					/>
					<span>{relation.childCollection}</span>
				</div>
			</td>
			<td className="px-4 py-3">
				{relation.boundFields.length === 0 ? (
					<span className="text-sm text-kumo-subtle">{t`No fields`}</span>
				) : (
					<ul className="space-y-1">
						{relation.boundFields.map((bound) => (
							<li key={`${bound.collectionSlug}.${bound.fieldSlug}`} className="text-sm">
								<code className="bg-kumo-tint px-1.5 py-0.5 rounded">
									{bound.collectionSlug}.{bound.fieldSlug}
								</code>
								<span className="ms-2 text-xs text-kumo-subtle">
									{bound.side === "parent"
										? t`picks ${relation.childLabel}`
										: t`picks ${relation.parentLabel}`}
								</span>
							</li>
						))}
					</ul>
				)}
			</td>
			<td className="px-4 py-3 text-sm text-kumo-subtle">
				{plural(relation.linkCount, { one: "# link", other: "# links" })}
			</td>
			<td className="px-4 py-3 text-end">
				<RouterLinkButton
					to="/content-types/relations/$slug"
					params={{ slug: relation.slug }}
					aria-label={t`Edit ${relation.slug}`}
					variant="ghost"
					shape="square"
					icon={<Pencil />}
				/>
			</td>
		</tr>
	);
}
