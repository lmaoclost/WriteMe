import { useState } from "react";
import { useScriptorium } from "../../data/store";
import type { PlotBoard, PlotCard } from "../../domain/types";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";
import { withCurrentColor } from "../../ui/colors";

export const BOARD_PRESET_COLORS = [
  "#7c5cbf", "#3498db", "#27ae60", "#e67e22", "#e74c3c", "#9b59b6",
  "#1abc9c", "#f39c12", "#2c3e50", "#8e44ad", "#2d6a8d", "#f1c40f",
  "#1a3a6b", "#2980b9",
];

export function PlotBoardPanel({ board, selectedId, onSelect }: {
  board: PlotBoard;
  selectedId: string | null;
  onSelect(id: string | null): void;
}) {
  const card = board.cards.find((c) => c.id === selectedId);
  if (!card) {
    return (
      <aside className={BOARD_PANEL} data-testid="pb-panel">
        <p className={BOARD_PANEL_HINT}>Select a card on the board.</p>
      </aside>
    );
  }
  return <CardForm board={board} card={card} onSelect={onSelect} />;
}

function CardForm({ board, card, onSelect }: {
  board: PlotBoard;
  card: PlotCard;
  onSelect(id: string | null): void;
}) {
  const store = useScriptorium.getState;
  const pushToast = useScriptorium((s) => s.pushToast);
  const [armDelete, setArmDelete] = useState(false);
  const update = (patch: Partial<PlotCard>) => store().updateCard(card.id, patch);
  const act = board.acts.find((a) => a.id === card.actId);

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deleteCard(card.id);
    pushToast("success", "Scene card deleted.");
    onSelect(null);
  };

  return (
    <aside className={BOARD_PANEL} data-testid="pb-panel">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{card.title || "Untitled Scene"}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={remove}
          aria-label={armDelete ? "Confirm delete card" : "Delete card"}>
          {armDelete ? "Confirm?" : "Delete"}
        </Button>
      </header>
      <Field label="Title">
        <input aria-label="Scene title" defaultValue={card.title} onBlur={(e) => update({ title: e.target.value })} />
      </Field>
      <Field label="Act">
        <Select value={card.actId} onValueChange={(v) => update({ actId: v })}>
          <SelectTrigger aria-label="Card act" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            {board.acts.map((a) => <SelectItem key={a.id} value={a.id} className="text-xs focus:bg-[#24233f] focus:text-parchment">{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="POV">
        <input aria-label="POV" defaultValue={card.pov} onBlur={(e) => update({ pov: e.target.value })} />
      </Field>
      <Field label="Location">
        <input aria-label="Local" defaultValue={card.location} onBlur={(e) => update({ location: e.target.value })} />
      </Field>
      <Field label="Color">
        <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Card color">
          {withCurrentColor(BOARD_PRESET_COLORS, card.color).map((c) => (
            <button key={c} type="button" role="option" aria-selected={card.color === c}
              className={`color-swatch${card.color === c ? " current" : ""}`} style={{ background: c }}
              data-color={c} onClick={() => update({ color: c })} />
          ))}
        </div>
      </Field>
      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3 className="text-[13px] tracking-[0.08em] uppercase text-slate font-semibold">Beats</h3>
        <ul className="titles-list list-none m-0 p-0 grid gap-1">
          {card.parts.map((p, i) => (
            <li key={p.id}>
              <input
                aria-label={`Beat ${i + 1}`}
                defaultValue={p.text}
                onBlur={(e) => update({ parts: card.parts.map((pp, j) => (j === i ? { ...pp, text: e.target.value } : pp)) })}
              />
              <button type="button" aria-label={`Remove beat ${i + 1}`}
                onClick={() => update({ parts: card.parts.filter((_, j) => j !== i) })} className="bg-none border-0 text-slate text-xs">✕</button>
            </li>
          ))}
        </ul>
        <Button kind="ghost" className="justify-self-start px-2 py-1 text-xs" aria-label="Add beat"
          onClick={() => update({ parts: [...card.parts, { id: `part_${Math.random().toString(36).slice(2, 8)}`, text: "" }] })}
        >+ Beat</Button>
      </section>
      <p className="text-slate text-xs">Act: {act?.name ?? "—"}</p>
    </aside>
  );
}
