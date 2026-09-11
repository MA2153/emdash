---
"emdash": minor
---

Adds reference fields that store relationships between entries. Selections are written atomically with the entry and are hydrated on read alongside SEO and bylines. Each resolved reference includes a display title from the referenced entry's configured title field, `title`, or `name`, so pickers and backlinks show a readable label.

Reference fields enforce required and single-selection constraints for entry saves and direct reference requests. Reference selections are shared across translations, so creating a translation reuses the source entry's selection.

A reference field stores no column of its own once it is bound to a relation; its selection lives as edges in `_emdash_content_references`. A reference field created before relations existed is not bound to one, so it keeps the column it has and behaves as it always has: the entry id it holds saves, loads, validates against the collection schema, and appears in generated types as a `string`, and the field can still be indexed and used as a content-list filter. Seed files continue to use `$ref:` values, which resolve to an edge for a bound field and to a column value for an unbound one.

A bound reference field cannot be marked as indexed, because it has no column to index. Large reference replacements are split into D1-safe writes while preserving selection order.

#### Upgrading a site with existing reference fields

Migration 077 binds each reference field that named its target collection — in `options.collection`, as the `reference()` field helper and the documented seed shape do — to a new relation, and copies the entry ids in its column in as links. Those fields become working pickers on upgrade with their existing selections intact.

A reference field is left alone, and keeps behaving exactly as it did, when:

- it names no target collection, or names one that no longer exists. A reference field created in the admin before this release has no target, since the admin had nowhere to record one.
- it is marked searchable or indexed. Both mean the site queries that column through an index, and binding the field stops the column being written.
- the relation slug it would take, `{collection}_{field}`, is already in use.

To bind one of those fields yourself, open it under Content Types and choose a referenced collection. EmDash creates the relation, copies the column's ids in as links, and clears the field's searchable and indexed flags — after which `fields` filters and site search no longer cover it.

The column is left in place and stops being written. On a site that predates pickers it was a free-text box that could hold anything an editor typed, and only the ids that resolved to an entry became links, so nothing is deleted. Generated types no longer declare the key for a bound field, but a content read still reports the frozen column value in `data` beside the live `references`.

Relations are now first-class schema objects rather than a hidden detail of each reference field. A relation joins two collections under a slug that is unique across the site, and a reference field records which end of that relation it sits on — so the same relation can back a field on either side. A relation carries a label and an optional singular form for each role, plus an optional limit on how many entries each side may hold.

Migration 076 restructures `_emdash_relations` to match: the per-locale rows collapse into one row per relation, keyed by a new unique `slug`, and `_emdash_content_references.relation_group` becomes `relation_id`. Relation ids are preserved, so existing reference edges stay valid. Relations are no longer localized — like collections and fields, their labels are single-valued. Where per-locale rows existed, the lowest locale code's labels win.

Deleting a reference field no longer deletes its relation by default. The relation and its edges survive until they are deleted deliberately, either from the relations admin or by opting in on the field delete, which also removes the field bound to the relation's other side. Deleting a collection removes every relation it is an end of, along with the reference fields viewing them — including fields on the collection at the far end, which would otherwise address a collection that no longer exists.

Reading a relation now reports what deleting it would take: the reference fields bound to it and how many links it holds.

Seed files gain a top-level `relations` array, so a relation can be declared with its labels and limits instead of being created as a side effect of the first reference field that needs one:

```json
{
	"relations": [
		{
			"slug": "post_authors",
			"parentCollection": "posts",
			"childCollection": "authors",
			"parentLabel": "Posts",
			"childLabel": "Authors",
			"maxChildrenPerParent": 1
		}
	],
	"collections": [
		{
			"slug": "posts",
			"label": "Posts",
			"fields": [
				{
					"slug": "author",
					"label": "Author",
					"type": "reference",
					"validation": { "relation": "post_authors" }
				}
			]
		}
	]
}
```

A field that names a relation binds to it; the side it views follows from which end its collection sits on, and `relationSide` is needed only for a relation whose two ends are the same collection. A field that names only a `targetCollection` still gets a relation created for it. Re-applying a seed updates a relation's labels and limits under `onConflict: "update"`, but a seed naming different collections for an existing relation fails rather than leaving its links pointing into a collection that is no longer an end of it.

`emdash export-seed` emits those relations, and `--with-content` emits each entry's links as `$ref:` values on the parent side of the relation, so a site's reference selections survive an export and re-apply. Entry IDs in a reference field with no relation are emitted as `$ref:` too; previously they were emitted as a reference to the source database's row id, which resolved to nothing on apply.
