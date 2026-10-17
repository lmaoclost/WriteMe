import { useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function OathsIndexPage({ projectId }: { projectId: string }) {
  const charts = useScriptorium((s) => s.oathsCharts ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = charts.filter((c) => c.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((c) => c.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>Oaths Hierarchy</h1>
        <p className="text-slate text-sm">Chart who answers to whom — courts, orders, armies and guilds.</p>
        <Button onClick={() => setCreating(true)}>Forge New Oaths Hierarchy</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>No saved chains of command found. Create a new one first!</p>
          <p className="text-slate text-sm">A primary chain sets the rank.</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((c) => (
            <article key={c.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/oaths/${c.id}`}>
                <h2 className={CARD_NAME}>{c.name}</h2>
                <p className={CARD_DESC}>{c.members.length} members · {c.oathLinks.length} oaths</p>
              </Link>
              <button title="Delete oaths hierarchy" className={DELETE_CHIP} onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title="Forge New Oaths Hierarchy" onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", "Please enter a chain name."); return; }
                useScriptorium.getState().addOathsChart(projectId, n);
                setCreating(false);
                setName("");
              }}>Forge</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={`Excluir "${target.name}"?`} onClose={() => setToDelete(null)}>
          <p className="text-parchment-dim">Removes members and oaths. No undo.</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteOathsChart(target.id);
              pushToast("success", "Hierarchy deleted.");
              setToDelete(null);
            }}>Delete</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
