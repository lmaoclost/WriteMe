import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function FactionWebServicePage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const webs = useScriptorium((s) => s.factionWebs ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = webs.filter((w) => w.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((w) => w.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>{t("factions.index.title")}</h1>
        <p className="text-slate text-sm">{t("factions.index.purpose")}</p>
        <Button onClick={() => setCreating(true)}>{t("factions.index.new")}</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>{t("factions.index.empty")}</p>
          <p className="text-slate text-sm">{t("factions.index.emptyDesc")}</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((w) => (
            <article key={w.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/factions/${w.id}`}>
                <h2 className={CARD_NAME}>{w.name}</h2>
                <p className={CARD_DESC}>
                  {t("factions.index.counts", {
                    factions: t("factions.index.factionCount", { count: w.factions.length }),
                    connections: t("factions.index.connectionCount", { count: w.connections.length }),
                  })}
                </p>
              </Link>
              <button title={t("factions.index.deleteChip")} className={DELETE_CHIP} onClick={() => setToDelete(w.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title={t("factions.index.new")} onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label={t("factions.index.name")}><input aria-label={t("factions.index.name")} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", t("factions.index.nameRequired")); return; }
                useScriptorium.getState().addFactionWeb(projectId, n);
                setCreating(false);
                setName("");
              }}>{t("factions.index.create")}</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={t("factions.index.deleteTitle", { name: target.name })} onClose={() => setToDelete(null)}>
          <p className="text-parchment-dim">{t("factions.index.deleteBody")}</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteFactionWeb(target.id);
              pushToast("success", t("factions.index.deleted"), undoToastAction());
              setToDelete(null);
            }}>{t("common.delete")}</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>{t("common.cancel")}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
