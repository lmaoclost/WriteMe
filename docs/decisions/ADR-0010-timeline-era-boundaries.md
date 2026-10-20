# ADR-0010 — Timeline eras are boundaries, not intervals

## Context
The `/p/:id/linewheel` canvas stored eras as `TimelineSegment { fromX, toX }`: free-floating
intervals that could overlap, and `layoutSegments` stacked the overlaps into separate lanes above
the wire. Two eras could cover the same wire with no way to say where one ends and the next
begins, and an event (bead) could not mark the turn of an age. The demo world needed exactly that:
the war era has to *start at* the war event, not near it.

## Decision
1. **An era is a boundary, not an interval.** `TimelineEra { id, startX, label, lineColor, boundaryBeadId? }`
   holds only a start. A span's end is the next era's start, so eras tile the wire with no gaps and
   no lanes. The last era closes at `contentEnd = max(x) + 160` plane px, never at the 20000px plane
   edge. `src/domain/timeline.ts` owns the math: `eraSpans`, `eraAt`, `clampBoundary`, `clampBeadX`.
2. **A boundary can follow an event.** `boundaryBeadId` makes the era start at its bead's `x`, so a
   single bead is the seam between two eras. Deleting that bead keeps the seam: the era inherits
   `startX = bead.x` and clears the binding. Unbinding a boundary freezes the last bead position.
3. **Every timeline starts fixed.** `addTimeline` seeds an origin bead at `x=0` plus one era at the
   origin. The origin is a star labelled "Start": not draggable, not deletable, no era toggle, and
   excluded from the event count. Beads clamp to `x >= origin + 24`; eras and boundary beads cannot
   cross a neighbour (24px minimum gap), so a drag can never swap two eras.
4. **Eras are contiguous.** Splitting inserts a boundary under the view centre; deleting merges the
   span into the previous era (the first era gives its start to the next). One era always remains.
5. **A bead may link a calendar event.** `TimelineBead.calendarEvent { calendarId, dayKey, eventId }`
   in addition to the existing `entryId`. The bead panel lists events across the project's calendars
   and deep-links to `/p/:id/calendar/:calendarId?d=<dayKey>`; `CalendarPage` preselects that day.
6. **Export is v3, no migration.** `serialize` writes `version: 3`; `parseExport` accepts only 3 and
   rejects the older `segments` shape. There is no v2 acceptance and no migrate path — an old
   localStorage is treated as corrupt (backed up under `scriptorium.corrupt.*`) and the app starts
   clean.

## Consequences
- `segments` → `eras` across types, schema, store, seed, and the index count; `layoutSegments` and
  the lane stacking are gone, replaced by a single coloured band per era.
- The band is a 20px rect on the wire with a 2px border in the era colour; its label is dropped when
  `width × zoom < 60` but the colour stays, so a narrow era is still legible as a seam.
- Any writer holding a v2 export must re-import by hand; the tool refuses the old format rather than
  guessing at the interval→boundary conversion.
