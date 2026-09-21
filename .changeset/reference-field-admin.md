---
"@emdash-cms/admin": minor
---

Adds a working reference field, and a screen for the relationships behind it.

A reference field is an entry picker: search for, pick, and reorder linked entries in the entry editor, saved with the entry in one request. A referenced entry gets a read-only "Referenced by" panel listing what points at it, and any linked entry can be opened from either side. The [Relations guide](https://docs.emdashcms.com/guides/relations/) walks through the screens below.

#### Relationships have their own page

Content Types links to a Relations page listing every relationship on the site: the two content types it joins, the reference fields bound to each end and which end they pick from, and how many links it holds. A content type's own page repeats the ones it is an end of, in a Relations panel under its fields. New, edit and delete all happen in a dialog over the list, so the page you found the relationship on is the page you stay on.

Picking the two content types names both sides after them, in the plural and the singular, and the slug follows the names. The two content types and the slug are fixed once the relationship exists: every link is keyed by the relationship, so moving an end would repoint stored links at content of the wrong type. Limits read as One, Any number, or an explicit maximum, per side, and live on the relationship rather than on each field, so two fields bound to it cannot disagree about the same links.

A new reference field starts from its relationship: the field dialog asks which one to bind to, and the label, slug and the rest of the field appear once you have picked. The field is named after the side it picks — a field over the linked end of Chapters → Lessons is called Lessons — and the dialog says what it will hold in those same names. The direction is a choice only for a relationship whose two ends are the same content type. Create relation is the last choice in that picker, and all a site with no relationships yet gets: picking it turns Add field into Next and the dialog into the relationship form, then comes back to the field with the new relationship selected.

#### Deleting says what goes with it

Deleting a reference field offers to delete the relationship it uses, checked by default, and names what that takes: the relationship, how many links it holds, and the field on the other content type with the direction it picks from. That matters most when the field being deleted is the inverse one, since deleting a field on Authors would otherwise silently remove the primary field on Posts. Clearing the checkbox keeps the relationship and its links. Deleting a relationship names the fields bound to it and removes them with it, and deleting a content type lists every relationship it is an end of next to the existing content warning.

#### Reference fields created before this release

A field with no target collection keeps rendering as the text box it has always been, with a note about setting a target collection under Content Types. Its field dialog offers the collection picker, pre-filled with whatever target the field already named, and says what saving one does: the field becomes an entry picker, its stored entry IDs move to the relationship, and it stops being searchable and filterable. A field that never recorded whether it allowed more than one entry shows as single, which is what the API and the upgrade migration both assume. New reference fields default to single for the same reason.
