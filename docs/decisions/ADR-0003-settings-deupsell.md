# ADR-0003 — Settings: drop Support upsell and Change Email placeholder

## Context
Settings follows the account layout inherited from the initial build. Two sections don't fit a local-first app: the donation/subscription solicitation with a support email, and "Change Email" (a server-side unavailable notice with a mailto support link — meaningless locally, where email is inert data).

## Decision
1. Remove the "Support Scriptorium" section entirely (all plan states).
2. Remove the "Change Email" section entirely. "Account Information" keeps showing the stored email (inert).
3. "Your Plan" (toggle, upgrade, cancel flows), "Public Profile", "Community" and the new "Data & backup" (ADR-0002) stay — account content or local truth.
4. Section order after removal: Your Plan → Public Profile → Account Information → Change Username → Change Password → Data & backup → Community.

## Consequences
- SettingsPage tests lose two cases and shrink the section list.
- No other page links to `support@scriptorium.invalid` after this change.

## Parity exemption note
`account.css` still renders in the incumbent look (recorded metrics). The impeccable detector flags its sizes/colors/radii against the Archivist `DESIGN.md` — recorded as deliberate divergence until the Settings page migrates to the new identity (future surface brief). Not defects introduced by this ADR.

## Status
Accepted — 2026-10-16, grilling session with Renan.