import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useWriteme } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Field } from "../../ui/Field";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";

export function ConlangIndexPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const conlangs = useWriteme((s) => s.conlangs ?? []);
  const pushToast = useWriteme((s) => s.pushToast);
  const mine = conlangs.filter((c) => c.projectId === projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = mine.find((c) => c.id === toDelete);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <header className="grid gap-1.5 justify-items-start mb-5">
        <h1>{t("conlang.index.title")}</h1>
        <p className="text-slate text-sm">{t("conlang.index.purpose")}</p>
        <Button onClick={() => setCreating(true)}>{t("conlang.index.new")}</Button>
      </header>

      {mine.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p>{t("conlang.index.empty")}</p>
          <p className="text-slate text-sm">{t("conlang.index.emptyDesc")}</p>
        </div>
      ) : (
        <div className={CARD_GRID}>
          {mine.map((c) => (
            <article key={c.id} className={WORLD_CARD}>
              <Link className={CARD_LINK} to={`/p/${projectId}/conlang/${c.id}`}>
                <h2 className={CARD_NAME}>{c.name}</h2>
                <p className={CARD_DESC}>
                  {t("conlang.index.counts", {
                    glyphs: t("conlang.index.glyphCount", { count: c.glyphs.length }),
                    words: t("conlang.index.wordCount", { count: c.words.length }),
                  })}
                </p>
              </Link>
              <button title={t("conlang.index.deleteChip")} className={DELETE_CHIP} onClick={() => setToDelete(c.id)}>✕</button>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <Modal title={t("conlang.index.new")} onClose={() => setCreating(false)}>
          <div className="grid gap-3">
            <Field label={t("conlang.index.name")}><input aria-label={t("conlang.index.name")} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={() => {
                const n = name.trim();
                if (!n) { pushToast("error", t("conlang.index.nameRequired")); return; }
                useWriteme.getState().addConlang(projectId, n);
                setCreating(false);
                setName("");
              }}>{t("conlang.index.create")}</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {target ? (
        <Modal title={t("conlang.index.deleteTitle", { name: target.name })} onClose={() => setToDelete(null)}>
          <p className="text-parchment-dim">{t("conlang.index.deleteBody")}</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => {
              useWriteme.getState().deleteConlang(target.id);
              pushToast("success", t("conlang.index.deleted"), undoToastAction());
              setToDelete(null);
            }}>{t("common.delete")}</Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>{t("common.cancel")}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
