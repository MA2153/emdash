---
"@emdash-cms/admin": minor
---

Reference fields are now a real, working field type. Previously "reference" was just a plain text box with nowhere to point; now you get a proper relationship picker. Configure it in the schema editor (choose the target collection and single vs. multiple), then search for, pick, and reorder linked entries right in the entry editor — all saved together with the entry in one request. Referenced entries show a read-only "Referenced by" panel so you can see what points at them, and you can jump straight to any linked entry from the picker or the backlinks.

A reference field created before this release has no target collection, so the entry editor keeps showing it as the text box it has always been, alongside a note about setting a target collection under Content Types to get the picker. Its field dialog offers the collection picker rather than disabling it, pre-filled with whatever target the field already named, and says what saving one does: the field becomes an entry picker, its stored entry IDs move to the relationship, and it stops being searchable and filterable. A field that never recorded whether it allowed more than one entry now shows as single rather than multiple, which is what the API and the upgrade migration both assume — binding one by hand and letting it upgrade on its own now give the same limit. New reference fields default to single for the same reason.

#### Relationships have their own page

Content Types links to a Relations page listing every relationship on the site: the two content types it joins, the reference fields bound to each end and which end they pick from, and how many links it holds. Relationships with no field bound to them are listed too — clearing the checkbox on a field delete leaves one behind, and this is the only way back to it.

A relationship can be created there, ahead of any field that uses it, and its role names and limits edited afterwards. The two content types and the slug are fixed once it exists: a reference field stores the slug and every link is keyed by the relationship, so moving an end would repoint stored links at content of the wrong type. Limits read as One, Any number, or an explicit maximum, per side, and live on the relationship rather than on each field so two fields bound to it cannot disagree about the same links.

The field dialog offers the relationships this content type can still bind to, ahead of the referenced-collection picker; choosing one takes the referenced collection and the limits from it. The direction is a choice only for a relationship whose two ends are the same content type, and stated read-only everywhere else, with a note on why the linked end offers no reordering: a link's position is scoped to the entry that made it, so only the linking end can order its selection.

The first choice in that picker is Quick create a relationship, which is also what a site with no relationships yet gets. Picking it still makes a relationship, named after the field and its content type, taking its linking-side limit from the Allow multiple references switch and leaving the other side unlimited, and the dialog now says so — and links to the Relations page, in a new tab so the half-filled field survives, for anyone who would rather set the slug, the role names, and the limits themselves and then come back and pick it.

#### Deleting says what goes with it

Deleting a reference field offers to delete the relationship it uses, checked by default, and the dialog names what that takes: the relationship, how many links it holds, and the field on the other content type with the direction it picks from. That last part matters most when the field being deleted is the inverse one — deleting a field on Authors would otherwise silently remove the primary field on Posts. Clearing the checkbox keeps the relationship and its links.

A relationship can be deleted from its own page. It does not refuse when fields are bound to it: it names them and removes them. Deleting a content type lists every relationship it is an end of, and the fields on other content types that go with them, next to the existing content warning.
