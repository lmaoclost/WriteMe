import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function PlotBoardIndexPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const boards = useScriptorium((s) => s.plotBoards ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = boards.filter((b) => b.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((b) => b.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>{t("plotboard.index.title")}</h1>
        <p className="text-slate text-sm">{t("plotboard.index.purpose")}</p>
        <Button onClick={() => setCreating(true)}>{t("plotboard.index.new")}</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>{t("plotboard.index.empty")}</p>
          <p className="text-slate text-sm">{t("plotboard.index.emptyDesc")}</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((b) => (
            <article key={b.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/plotboard/${b.id}`}>
                <h2 className={CARD_NAME}>{b.name}</h2>
                <p className={CARD_DESC}>
                  {t("plotboard.index.counts", {
                    acts: t("plotboard.index.actCount", { count: b.acts.length }),
                    scenes: t("plotboard.index.sceneCount", { count: b.cards.length }),
                    wires: t("plotboard.index.wireCount", { count: b.wires.length }),
                  })}
                </p>
              </Link>
              <button title={t("plotboard.index.deleteChip")} className={DELETE_CHIP} onClick={() => setToDelete(b.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title={t("plotboard.index.new")} onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label={t("plotboard.index.name")}><input aria-label={t("plotboard.index.name")} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", t("plotboard.index.nameRequired")); return; }
                useScriptorium.getState().addPlotBoard(projectId, n);
                setCreating(false);
                setName("");
              }}>{t("plotboard.index.create")}</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={t("plotboard.index.deleteTitle", { name: target.name })} onClose={() => setToDelete(null)}>
          <p className="text-parchment-dim">{t("plotboard.index.deleteBody")}</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deletePlotBoard(target.id);
              pushToast("success", t("plotboard.index.deleted"), undoToastAction());
              setToDelete(null);
            }}>{t("common.delete")}</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>{t("common.cancel")}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
