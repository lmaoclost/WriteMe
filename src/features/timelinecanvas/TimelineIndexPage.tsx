import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";

export function TimelineIndexPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const lines = useScriptorium((s) => s.timelines ?? []);
  const pushToast = useScriptorium((s) => s.pushToast);
  const mine = lines.filter((t) => t.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((t) => t.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>{t("timeline.index.title")}</h1>
        <p className="text-slate text-sm">{t("timeline.index.purpose")}</p>
        <Button onClick={() => setCreating(true)}>{t("timeline.index.new")}</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>{t("timeline.index.empty")}</p>
          <p className="text-slate text-sm">{t("timeline.index.emptyDesc")}</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((line) => (
            <article key={line.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/linewheel/${line.id}`}>
                <h2 className={CARD_NAME}>{line.name}</h2>
                <p className={CARD_DESC}>
                  {t("timeline.index.counts", {
                    events: t("timeline.index.eventCount", { count: line.beads.filter((b) => !b.origin).length }),
                    eras: t("timeline.index.eraCount", { count: line.eras.length }),
                  })}
                </p>
              </Link>
              <button title={t("timeline.index.deleteChip")} className={DELETE_CHIP} onClick={() => setToDelete(line.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title={t("timeline.index.new")} onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label={t("timeline.index.name")}><input aria-label={t("timeline.index.name")} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", t("timeline.index.nameRequired")); return; }
                useScriptorium.getState().addTimeline(projectId, n);
                setCreating(false);
                setName("");
              }}>{t("timeline.index.create")}</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={t("timeline.index.deleteTitle", { name: target.name })} onClose={() => setToDelete(null)}>
          <p className="text-parchment-dim">{t("timeline.index.deleteBody")}</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useScriptorium.getState().deleteTimeline(target.id);
              pushToast("success", t("timeline.index.deleted"), undoToastAction());
              setToDelete(null);
            }}>{t("common.delete")}</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>{t("common.cancel")}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
