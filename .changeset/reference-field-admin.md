---
"@emdash-cms/admin": minor
---

Reference fields are now a real, working field type. Previously "reference" was just a plain text box with nowhere to point; now you get a proper relationship picker. Configure it in the schema editor (choose the target collection and single vs. multiple), then search for, pick, and reorder linked entries right in the entry editor — all saved together with the entry in one request. Referenced entries show a read-only "Referenced by" panel so you can see what points at them, and you can jump straight to any linked entry from the picker or the backlinks.

A reference field created before this release has no target collection, so the entry editor keeps showing it as the text box it has always been, alongside a note about setting a target collection under Content Types to get the picker.
