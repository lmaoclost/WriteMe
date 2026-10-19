import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function OathsIndexPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
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
        <h1>{t("oaths.index.title")}</h1>
        <p className="text-slate text-sm">{t("oaths.index.purpose")}</p>
        <Button onClick={() => setCreating(true)}>{t("oaths.index.new")}</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>{t("oaths.index.empty")}</p>
          <p className="text-slate text-sm">{t("oaths.index.emptyDesc")}</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((c) => (
            <article key={c.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/oaths/${c.id}`}>
                <h2 className={CARD_NAME}>{c.name}</h2>
                <p className={CARD_DESC}>
                  {t("oaths.index.counts", {
                    members: t("oaths.index.memberCount", { count: c.members.length }),
                    oaths: t("oaths.index.oathCount", { count: c.oathLinks.length }),
                  })}
                </p>
              </Link>
              <button title={t("oaths.index.deleteChip")} className={DELETE_CHIP} onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title={t("oaths.index.new")} onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label={t("oaths.index.name")}><input aria-label={t("oaths.index.name")} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", t("oaths.index.nameRequired")); return; }
                useScriptorium.getState().addOathsChart(projectId, n);
                setCreating(false);
                setName("");
              }}>{t("oaths.index.create")}</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={t("oaths.index.deleteTitle", { name: target.name })} onClose={() => setToDelete(null)}>
          <p className="text-parchment-dim">{t("oaths.index.deleteBody")}</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteOathsChart(target.id);
              pushToast("success", t("oaths.index.deleted"), undoToastAction());
              setToDelete(null);
            }}>{t("common.delete")}</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>{t("common.cancel")}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
