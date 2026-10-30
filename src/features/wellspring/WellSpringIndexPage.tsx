import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useWriteme } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function WellSpringIndexPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const wells = useWriteme((s) => s.wellsprings ?? []);
  const pushToast = useWriteme((s) => s.pushToast);
  const mine = wells.filter((w) => w.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((w) => w.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>{t("wellspring.index.title")}</h1>
        <p className="text-slate text-sm">{t("wellspring.index.purpose")}</p>
        <Button onClick={() => setCreating(true)}>{t("wellspring.index.new")}</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>{t("wellspring.index.empty")}</p>
          <p className="text-slate text-sm">{t("wellspring.index.emptyDesc")}</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((w) => (
            <article key={w.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/wellspring/${w.id}`}>
                <h2 className={CARD_NAME}>{w.name}</h2>
                <p className={CARD_DESC}>
                  {t("wellspring.index.counts", {
                    circles: t("wellspring.index.circleCount", { count: w.nodes.length }),
                    lines: t("wellspring.index.lineCount", { count: w.borders.length }),
                  })}
                </p>
              </Link>
              <button title={t("wellspring.index.deleteChip")} aria-label={t("wellspring.index.deleteChip")} className={DELETE_CHIP} onClick={() => setToDelete(w.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title={t("wellspring.index.new")} onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label={t("wellspring.index.name")}><input aria-label={t("wellspring.index.name")} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", t("wellspring.index.nameRequired")); return; }
                useWriteme.getState().addWellSpring(projectId, n);
                setCreating(false);
                setName("");
              }}>{t("wellspring.index.create")}</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={t("wellspring.index.deleteTitle", { name: target.name })} onClose={() => setToDelete(null)}>
          <p className="text-parchment-dim">{t("wellspring.index.deleteBody")}</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useWriteme.getState().deleteWellSpring(target.id);
              pushToast("success", t("wellspring.index.deleted"), undoToastAction());
              setToDelete(null);
            }}>{t("common.delete")}</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>{t("common.cancel")}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
