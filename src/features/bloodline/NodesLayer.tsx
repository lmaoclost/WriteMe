import type { BloodlineHouse, BloodlinePerson } from "../../domain/types";

export function PersonNode({
  person, images, selected, houseName, onSelect, onDelete, onDragStart, onDragMove, onDragEnd,
}: {
  person: BloodlinePerson;
  images: Record<string, string>;
  selected: boolean;
  houseName?: string;
  onSelect(): void;
  onDelete(): void;
  onDragStart?(): void;
  onDragMove?(dx: number, dy: number): void;
  onDragEnd?(): void;
}) {
  const portrait = person.portraitKey ? images[person.portraitKey] : undefined;
  const drag = { start: { x: 0, y: 0 }, moved: false };
  return (
    <div
      data-testid="person-node"
      className={`bl-node person-node absolute size-16 rounded-full bg-night-2 border-2 border-line grid place-items-center cursor-pointer [grid-template-rows:1fr]${selected ? " selected border-gold shadow-[0_0_0_2px_color-mix(in_srgb,var(--gold)_40%,transparent)]" : " border-line"}`}
      style={{ left: person.x - 32, top: person.y - 32 }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onSelect();
        drag.start = { x: e.clientX, y: e.clientY };
        drag.moved = false;
        const move = (ev: PointerEvent) => {
          const dx = ev.clientX - drag.start.x;
          const dy = ev.clientY - drag.start.y;
          if (!drag.moved && Math.hypot(dx, dy) <= 5) return;
          if (!drag.moved) { drag.moved = true; onDragStart?.(); }
          onDragMove?.(dx, dy);
        };
        const up = () => {
          if (drag.moved) onDragEnd?.();
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      role="button"
      aria-label={`Pessoa ${person.name}`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Delete") onDelete(); }}
    >
      {portrait ? (
        <img className="person-portrait size-[60px] rounded-full object-cover" src={portrait} alt="" draggable={false} />
      ) : (
        <span className="person-initial font-display text-[1.375rem] text-parchment">{(person.name || "?").charAt(0).toUpperCase()}</span>
      )}
      {person.showBadge && person.badgeText ? (
        <span className="person-badge absolute -top-2 left-1/2 -translate-x-1/2 text-[0.6875rem] bg-gold text-wax py-px px-1.5 rounded-lg whitespace-nowrap">{person.badgeText}</span>
      ) : null}
      {person.isTwin ? <span className="person-twin absolute -right-2.5 top-0 text-slate text-xs" aria-hidden="true">⇉</span> : null}
      <span className="person-name absolute top-[66px] left-1/2 -translate-x-1/2 text-xs text-parchment bg-[rgb(18_18_30/0.9)] px-1.5 py-0.5 rounded-sm whitespace-nowrap">{person.name}</span>
      {houseName ? <span className="person-house absolute top-[84px] left-1/2 -translate-x-1/2 text-[10px] tracking-[0.04em] text-slate whitespace-nowrap uppercase">{houseName}</span> : null}
      {person.birthOrder != null ? (
        <span className="person-order absolute -bottom-[18px] left-1/2 -translate-x-1/2 font-mono text-[0.6875rem] text-slate">{person.birthOrder}</span>
      ) : null}
    </div>
  );
}

export function HouseNode({ house, selected, memberCount, onSelect }: {
  house: BloodlineHouse;
  selected: boolean;
  memberCount: number;
  onSelect(): void;
}) {
  return (
    <div
      data-testid="house-node"
      className={`bl-node house-node absolute w-32 px-2.5 py-2 rounded-lg bg-night border border-slate grid gap-0.5 cursor-pointer${house.isMainBranch ? " house-main border-gold-dim shadow-[0_0_12px_color-mix(in_srgb,var(--gold)_25%,transparent)]" : ""}${house.isMonarch ? " house-monarch border-gold border-2" : ""}${selected ? " selected border-gold shadow-[0_0_0_2px_color-mix(in_srgb,var(--gold)_40%,transparent)]" : ""}`}
      style={{ left: house.x - 64, top: house.y - 24 }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
      role="button"
      aria-label={`Casa ${house.name}`}
      tabIndex={0}
    >
      <span className="house-name text-sm font-semibold text-parchment">{house.name}</span>
      {house.subtitle ? <span className="house-subtitle text-[11px] text-slate">{house.subtitle}</span> : null}
      <span className="house-count text-[10px] text-slate" data-testid="house-member-count">{memberCount} {memberCount === 1 ? "membro" : "membros"}</span>
      {house.isMonarch ? <span className="house-crown absolute -top-4 right-1.5 text-gold" aria-hidden="true">♛</span> : null}
    </div>
  );
}

interface EdgePts { fromId: string; toId: string; x1: number; y1: number; x2: number; y2: number }

export function EdgesLayer({ persons, selected }: { persons: BloodlinePerson[]; selected?: string | null }) {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const blood: EdgePts[] = [];
  const partners: EdgePts[] = [];
  for (const p of persons) {
    const parent = p.connectedTo ? byId.get(p.connectedTo) : undefined;
    if (parent) blood.push({ fromId: p.id, toId: parent.id, x1: p.x, y1: p.y, x2: parent.x, y2: parent.y });
    const partner = p.partnerId ? byId.get(p.partnerId) : undefined;
    if (partner && partner.partnerId === p.id && p.x <= partner.x) partners.push({ fromId: p.id, toId: partner.id, x1: p.x, y1: p.y, x2: partner.x, y2: partner.y });
  }
  return (
    <svg data-testid="edges-layer" className="edges-layer absolute left-0 top-0 w-full h-full pointer-events-none" width="100%" height="100%">
      {blood.map((e, i) => (
        <g key={`b${i}`}>
          <path
            data-testid="edge-blood"
            className={`edge-blood [stroke:var(--gold-dim)] [stroke-width:1.5] [fill:none]${selected && (e.fromId === selected || e.toId === selected) ? " highlighted [stroke:var(--gold)] [stroke-width:2]" : ""}`}
            d={`M ${e.x1} ${e.y1} L ${e.x2} ${(e.y1 + e.y2) / 2} L ${e.x2} ${e.y2}`}
          />
        </g>
      ))}
      {partners.map((e, i) => (
        <g key={`p${i}`}>
          <path data-testid="edge-partner" className={`edge-partner [stroke:var(--slate)] [stroke-width:1.5] [fill:none]${selected && (e.fromId === selected || e.toId === selected) ? " highlighted [stroke:var(--gold)] [stroke-width:2]" : ""}`} d={`M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`} />
          <path data-testid="edge-partner" className="edge-partner edge-partner-2 opacity-60 [stroke:var(--slate)] [stroke-width:1.5] [fill:none]" d={`M ${e.x1} ${e.y1 + 3} L ${e.x2} ${e.y2 + 3}`} />
        </g>
      ))}
    </svg>
  );
}
