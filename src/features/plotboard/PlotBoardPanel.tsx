import { useState } from "react";
import { useScriptorium } from "../../data/store";
import type { PlotBoard, PlotCard } from "../../domain/types";
import "./plotboard.css";

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
      <aside className="bl-panel" data-testid="pb-panel">
        <p className="bl-panel-hint">Selecione uma cena no quadro.</p>
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
    pushToast("success", "Cena removida.");
    onSelect(null);
  };

  return (
    <aside className="bl-panel" data-testid="pb-panel">
      <header className="bl-panel-head">
        <h2>{card.title || "Cena sem título"}</h2>
        <button type="button" className={armDelete ? "btn-danger" : ""} onClick={remove}
          aria-label={armDelete ? "Confirmar exclusão da cena" : "Excluir cena"}>
          {armDelete ? "Confirmar?" : "Excluir"}
        </button>
      </header>
      <div className="field">
        <span className="field-label">Título</span>
        <input aria-label="Título da cena" defaultValue={card.title} onBlur={(e) => update({ title: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Ato</span>
        <select aria-label="Ato da cena" value={card.actId} onChange={(e) => update({ actId: e.target.value })}>
          {board.acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="field">
        <span className="field-label">POV</span>
        <input aria-label="POV" defaultValue={card.pov} onBlur={(e) => update({ pov: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Local</span>
        <input aria-label="Local" defaultValue={card.location} onBlur={(e) => update({ location: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Cor</span>
        <div className="color-row" role="listbox" aria-label="Cor da cena">
          {BOARD_PRESET_COLORS.map((c) => (
            <button key={c} type="button" role="option" aria-selected={card.color === c}
              className={`color-swatch${card.color === c ? " current" : ""}`} style={{ background: c }}
              data-color={c} onClick={() => update({ color: c })} />
          ))}
        </div>
      </div>
      <section className="bl-subsection">
        <h3>Beats da cena</h3>
        <ul className="titles-list">
          {card.parts.map((p, i) => (
            <li key={p.id}>
              <input
                aria-label={`Beat ${i + 1}`}
                defaultValue={p.text}
                onBlur={(e) => update({ parts: card.parts.map((pp, j) => (j === i ? { ...pp, text: e.target.value } : pp)) })}
              />
              <button type="button" aria-label={`Remover beat ${i + 1}`}
                onClick={() => update({ parts: card.parts.filter((_, j) => j !== i) })}>✕</button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-label="Adicionar beat"
          onClick={() => update({ parts: [...card.parts, { id: `part_${Math.random().toString(36).slice(2, 8)}`, text: "" }] })}
        >+ Beat</button>
      </section>
      <p className="bl-panel-note">Ato: {act?.name ?? "—"}</p>
    </aside>
  );
}
