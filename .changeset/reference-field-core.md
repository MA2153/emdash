---
"emdash": minor
---

Adds relations, and makes `reference` fields entry pickers that link through them. A relation joins two collections under a site-unique slug, with a label and an optional link limit for each side, and a reference field binds to a relation and views its links from one end. A selection is shared across an entry's translations, and on a collection that keeps revisions it stages in the draft and goes live when the entry is published. Entry create and update bodies carry selections under `references`, keyed by field slug; `getEmDashEntry` takes a matching `references` option naming the fields a page renders, `getEmDashReferences` pages past the first 50 entries of a field, and `emdash types` generates a `{Collection}References` interface per collection. Seeds gain a top-level `relations` array, and `emdash export-seed --with-content` emits each entry's links. The [Relations guide](https://docs.emdashcms.com/guides/relations/) covers the workflow end to end.

Selections are written through the content routes only; there is no relation-scoped endpoint for writing links.

Upgrading turns each existing reference field that names a target collection into a picker, keeping the entries it already held. A field that names no target, or one marked searchable or indexed, keeps working exactly as it does today and can be converted by hand under Content Types; nothing is deleted either way. Relations are no longer translated, so a site that gave one different labels per locale keeps a single set. See [Reference fields bind to relations](https://docs.emdashcms.com/deployment/updating/#changed-reference-fields-bind-to-relations).
