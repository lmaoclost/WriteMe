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
      className={`bl-node person-node${selected ? " selected" : ""}`}
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
        <img className="person-portrait" src={portrait} alt="" draggable={false} />
      ) : (
        <span className="person-initial">{(person.name || "?").charAt(0).toUpperCase()}</span>
      )}
      {person.showBadge && person.badgeText ? (
        <span className="person-badge">{person.badgeText}</span>
      ) : null}
      {person.isTwin ? <span className="person-twin" aria-hidden="true">⇉</span> : null}
      <span className="person-name">{person.name}</span>
      {houseName ? <span className="person-house">{houseName}</span> : null}
      {person.birthOrder != null ? (
        <span className="person-order">{person.birthOrder}</span>
      ) : null}
    </div>
  );
}

export function HouseNode({ house, selected, onSelect }: {
  house: BloodlineHouse;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <div
      data-testid="house-node"
      className={`bl-node house-node${house.isMainBranch ? " house-main" : ""}${house.isMonarch ? " house-monarch" : ""}${selected ? " selected" : ""}`}
      style={{ left: house.x - 64, top: house.y - 24 }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
      role="button"
      aria-label={`Casa ${house.name}`}
      tabIndex={0}
    >
      <span className="house-name">{house.name}</span>
      {house.subtitle ? <span className="house-subtitle">{house.subtitle}</span> : null}
      {house.isMonarch ? <span className="house-crown" aria-hidden="true">♛</span> : null}
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
    <svg data-testid="edges-layer" className="edges-layer" width="100%" height="100%">
      {blood.map((e, i) => (
        <g key={`b${i}`}>
          <path
            data-testid="edge-blood"
            className={`edge-blood${selected && (e.fromId === selected || e.toId === selected) ? " highlighted" : ""}`}
            d={`M ${e.x1} ${e.y1} L ${e.x2} ${(e.y1 + e.y2) / 2} L ${e.x2} ${e.y2}`}
          />
        </g>
      ))}
      {partners.map((e, i) => (
        <g key={`p${i}`}>
          <path data-testid="edge-partner" className={`edge-partner${selected && (e.fromId === selected || e.toId === selected) ? " highlighted" : ""}`} d={`M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`} />
          <path data-testid="edge-partner" className="edge-partner edge-partner-2" d={`M ${e.x1} ${e.y1 + 3} L ${e.x2} ${e.y2 + 3}`} />
        </g>
      ))}
    </svg>
  );
}
