---
"emdash": minor
---

Adds relations, and makes `reference` fields entry pickers that link through them.

A relation joins two collections under a site-unique slug, with a label for each side and an optional limit on how many entries each side may link. A reference field binds to a relation and views its links from one end, so one relation can back a field on either collection. Links live in `_emdash_content_references` rather than a column on the collection table, keyed by translation group, so a selection is shared across an entry's translations. The [Relations guide](https://docs.emdashcms.com/guides/relations/) covers the whole workflow, from defining a relation to reading its links in a template.

#### Read references from site code

`getEmDashEntry` takes a `references` option naming the fields a page renders, keyed by field slug, and returns a page of entries for each:

```ts
const { entry: post } = await getEmDashEntry("posts", slug, {
	references: { author: true, related_posts: { limit: 6 } },
});

const author = post?.references?.author.entries[0];
```

The option is opt-in in both directions: a call that passes no `references` runs no extra queries, and a field left out of the selection is not read. A call that selects fields costs one link query per field plus one entry query per distinct target collection, however many entries each field holds. Those reads go into the entry's cached snapshot, and the `cacheHint` the call returns names the referenced rows, so a route-cached page expires when a referenced entry changes and not only when the entry itself does.

A referenced entry is a `ContentEntry` like any other, with mapped `data` and a working `edit` proxy scoped to itself. Bylines and taxonomy terms are the exception: EmDash does not hydrate them onto referenced entries. `getEmDashReferences` fetches a later page of one field using the cursor the previous page returned. Both default to 50 entries per field and accept at most 100.

A collection with a bound reference field gets a `{Collection}References` interface in generated types, and `getEmDashEntry` narrows its result to the fields the call named. Re-run `emdash types` to pick them up.

#### Write a selection

Entry create and update bodies carry selections under `references`, keyed by field slug, written in the same transaction as the entry:

```jsonc
{ "data": { "title": "Hello" }, "references": { "author": ["01HXK5MZSN..."] } }
```

On a collection that keeps revisions, changing a selection on a published entry stages it in the draft alongside the entry's other pending edits; it goes live when the entry is published and is discarded with the draft. Publishing re-checks the whole selection against the relation's limits, so a draft cannot carry a selection past a schema change that would now reject it.

Seed files gain a top-level `relations` array, and a reference field names the relation it binds to in `validation.relation` instead of a `targetCollection`. `emdash export-seed` emits relations, and `--with-content` emits each entry's links as `$ref:` values, so a site's selections survive an export and re-apply.

Deleting a reference field no longer deletes the relation behind it. Pass `deleteRelation=true` to remove the relation, its links, and the field bound to its other side.

#### Upgrade a site with existing reference fields

Migration 084 binds each reference field that named a target collection in `options.collection` to a new relation and copies the entry IDs in its column in as links, so those fields become working pickers with their selections intact. It skips a field that names no target collection or one that no longer exists, a field marked searchable or indexed, and a field whose relation slug `{collection}_{field}` is taken. The column is left in place either way; nothing is deleted.

A skipped field keeps behaving exactly as it did: the entry ID it holds saves, loads, validates, and appears in generated types as a `string`, and the field can still be indexed and used as a content-list filter. To bind one, open it under Content Types and choose a referenced collection. EmDash creates the relation, copies the IDs in as links, and clears the field's searchable and indexed flags, after which `fields` filters and site search no longer cover it. A bound field cannot be marked as indexed, because it has no column to index. [Reference fields bind to relations](https://docs.emdashcms.com/deployment/updating/#changed-reference-fields-bind-to-relations) is the upgrade note for a deployed site.

Migration 083 collapses `_emdash_relations` from one row per locale to one row per relation, keyed by a new unique `slug`, and renames `_emdash_content_references.relation_group` to `relation_id`. Relation IDs are preserved, so existing links stay valid. Relations are no longer localized; where per-locale rows existed, the lowest locale code's labels win.

`relations` joins the reserved collection slugs, because the admin serves the relations screen at that path.
