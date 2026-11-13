---
"emdash": patch
"@emdash-cms/admin": patch
---

Fixes building EmDash from source failing with `Reached heap limit` on Node.js 26 at the default heap size. The admin route now imports the admin app through a narrower internal entry point, so type generation no longer loads the full admin component and icon type graph.
