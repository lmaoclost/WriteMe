# Surface brief — Library hub (`/`)

**Status:** approved by Renan, 2026-10-16 (shape; code deferred to an execution session).

- **Job/audience:** solo writer returning to the app. Success = right forge in ≤1 click. Mode: Operate with archivist personality.
- **Outcome/proof:** welcome + 7 forge panels + "My worlds" section; selector puts a world's forges 1 click away.
- **Direction:** "Archivist" vocabulary on the incumbent palette. Fraunces serif display headline; Welcome demoted to eyebrow; forge panels = deeper navy card with hairline border, small gold seal icon + EN name + one-line description, 900px column; horizontal hairline rules between Welcome → Forges → My worlds; My worlds = smaller cards (cover thumb, name, "Updated …"), discrete search/sort at section title (≥3 worlds). World selector: ghost dropdown at the right of the welcome line, truncates long names.
- **States:** zero worlds → ghost forge panels + create/import CTA; one world → auto-selected (selector hidden); ≥3 worlds → sort; delete confirm modal unchanged in behavior.
- **Boundaries:** no Unlock badge, no survey, no purple glow, no gradient text. Forge copy EN per glossary. ADR-0001 governs function.
- **Implementation consequence:** tokens go to `DESIGN.md`; identity + EN migration then rolls app-wide starting at this hub.

**Update 2026-10-18:** forge panels and the world selector were removed by user
decision — `/` is welcome + "My worlds" cards only; re-entry from a workspace
happens through the "← My worlds" rail item. See the supersede note in ADR-0001.