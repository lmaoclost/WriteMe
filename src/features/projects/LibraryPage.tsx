import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useScriptorium } from "../../data/store";
import { storageHealth, APPROX_QUOTA_CHARS } from "../../data/storage";
import { downloadJson } from "../../data/backup";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import { Seal } from "../../ui/Seal";
import { LanguageToggle } from "../../ui/LanguageToggle";
import { CARD_GRID, WORLD_CARD, CARD_LINK, CARD_NAME, CARD_DESC, CARD_UPDATED, DELETE_CHIP, EMPTY_STATE } from "../../ui/pageBits";
import { localeFor } from "../../i18n";

const QUOTA_WARN_RATIO = 0.8;

function storageUsageMb(chars: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .format(chars / (1024 * 1024));
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function updatedStamp(ms: number, t: TFunction, locale: string): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 45) return t("library.updated", { when: t("library.justNow") });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (s < 3600) {
    return t("library.updated", { when: relative.format(-Math.max(1, Math.floor(s / 60)), "minute") });
  }
  if (s < 86400) {
    return t("library.updated", { when: relative.format(-Math.max(1, Math.floor(s / 3600)), "hour") });
  }
  if (s < 7 * 86400) {
    return t("library.updated", { when: relative.format(-Math.max(1, Math.floor(s / 86400)), "day") });
  }
  return t("library.updated", {
    when: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(ms),
  });
}

export function LibraryPage() {
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  const projects = useScriptorium((s) => s.projects);
  const addProject = useScriptorium((s) => s.addProject);
  const deleteProject = useScriptorium((s) => s.deleteProject);
  const pushToast = useScriptorium((s) => s.pushToast);
  const seedDemo = useScriptorium((s) => s.seedDemo);
  // only cover values for the listed projects — an unrelated image upload
  // no longer re-renders the whole library
  const covers = useScriptorium(useShallow((s) => {
    const out: Record<string, string> = {};
    for (const p of s.projects) {
      if (p.coverImageKey && s.images[p.coverImageKey]) out[p.coverImageKey] = s.images[p.coverImageKey];
    }
    return out;
  }));

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"recent" | "name">("recent");
  const [restoring, setRestoring] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);

  const downloadBackup = () => {
    downloadJson(useScriptorium.getState().exportData());
  };

  const readFileText = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

  const onRestoreFile = async (file: File) => {
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      pushToast("error", t("library.toasts.invalidFile"));
      setRestoring(false);
      setPendingRestore(null);
      return;
    }
    try {
      JSON.parse(text);
    } catch {
      pushToast("error", t("library.toasts.invalidJson"));
      setRestoring(false);
      setPendingRestore(null);
      return;
    }
    setPendingRestore(text);
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    const result = useScriptorium.getState().importData(pendingRestore);
    if (result.ok) {
      pushToast("success", t("library.toasts.restored"));
    } else {
      pushToast("error", result.error);
      return;
    }
    setRestoring(false);
    setPendingRestore(null);
  };

  const submitCreate = () => {
    const n = name.trim();
    if (!n) { pushToast("error", t("library.toasts.nameRequired")); return; }
    addProject(n, description.trim());
    setCreating(false);
    setName("");
    setDescription("");
    pushToast("success", t("library.toasts.worldCreated"));
  };

  const doSeed = () => {
    seedDemo();
    pushToast("success", t("library.toasts.sampleLoaded"));
  };

  const target = projects.find((p) => p.id === toDelete);

  const worldList = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    const list = projects.filter((p) =>
      !q || p.name.toLocaleLowerCase(locale).includes(q)
      || (p.description ?? "").toLocaleLowerCase(locale).includes(q));
    if (sortKey === "name") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, locale));
    }
    return list;
  }, [projects, query, sortKey, locale]);

  return (
    <div className="relative mx-auto max-w-[1080px] px-6 pt-9 pb-16">
      <div className="lamp-pool" aria-hidden="true" />
      <header className="grid gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Seal letter="S" className="size-7 text-sm" />
            <span className="font-display text-[15px] uppercase tracking-[0.14em] text-parchment">Scriptorium</span>
          </div>
          <LanguageToggle />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">{t("library.eyebrow")}</p>
        <h1 className="text-[clamp(2rem,4.5vw,2.75rem)] leading-[1.1] text-parchment-strong">{t("library.welcome")}</h1>
      </header>

      <div className="rule-hallmark my-9" aria-hidden="true"><span className="hallmark-gem" /></div>

      <section aria-label={t("library.myWorlds")}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-[1.375rem] text-parchment-strong">{t("library.myWorlds")}</h2>
          {projects.length >= 3 && (
            <div className="flex gap-2.5">
              <input
                type="search"
                className="w-[200px] rounded-sm border border-line bg-night px-2.5 py-[7px] text-sm text-parchment placeholder:text-slate outline-none focus-visible:border-gold-dim"
                placeholder={t("library.searchWorldsPlaceholder")}
                aria-label={t("library.searchWorlds")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as "recent" | "name")}>
                <SelectTrigger
                  aria-label={t("library.sortWorlds")}
                  className="justify-between rounded-sm border-line bg-night px-2.5 py-1.5 text-sm text-parchment hover:border-gold-dim data-[size=default]:h-auto"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-line bg-night text-parchment">
                  <SelectItem value="recent" className="text-sm focus:bg-accent focus:text-parchment">{t("library.recentlyUpdated")}</SelectItem>
                  <SelectItem value="name" className="text-sm focus:bg-accent focus:text-parchment">{t("library.nameAZ")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button className="flex-none" onClick={() => setCreating(true)}>{t("library.newWorld")}</Button>
        </div>

        {projects.length === 0 ? (
          <div className={EMPTY_STATE}>
            <p>{t("library.emptyInvite")}</p>
            <Button kind="ghost" onClick={doSeed}>{t("library.loadSample")}</Button>
          </div>
        ) : worldList.length === 0 ? (
          <p className="text-slate text-sm">{t("library.noMatch", { query: query.trim() })}</p>
        ) : (
          <div className={CARD_GRID}>
            {worldList.map((p) => (
              <article key={p.id} className={WORLD_CARD}>
                <Link to={`/p/${p.id}`} className={CARD_LINK}>
                  {p.coverImageKey && covers[p.coverImageKey] && (
                    <img className="h-[120px] w-full object-cover" src={covers[p.coverImageKey]} alt="" />
                  )}
                  <h3 className={CARD_NAME + " pr-12"}>{p.name}</h3>
                  {p.description && <p className={CARD_DESC + " pr-10"}>{p.description}</p>}
                  <p className={CARD_UPDATED}>{updatedStamp(p.updatedAt, t, locale)}</p>
                </Link>
                <button
                  aria-label={t("library.deleteWorld")}
                  className={DELETE_CHIP}
                  onClick={() => setToDelete(p.id)}
                >
                  ✕
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-label={t("library.backup")} className="mt-9">
        <h2 className="text-[1.375rem] text-parchment-strong">{t("library.backup")}</h2>
        <p className="text-slate text-sm mt-1 mb-3 max-w-[60ch]">{t("library.backupNote")}</p>
        <div className="flex gap-2.5">
          <Button onClick={downloadBackup}>{t("library.downloadBackup")}</Button>
          <Button kind="ghost" onClick={() => { setPendingRestore(null); setRestoring(true); }}>{t("library.restoreBackup")}</Button>
        </div>
        <p className="text-[var(--text-faint)] text-xs mt-2.5 [font-variant-numeric:tabular-nums]" data-testid="storage-usage">
          {t("library.storageUsage", { used: `${storageUsageMb(storageHealth().bytes, locale)} MB` })}
        </p>
        {storageHealth().bytes / APPROX_QUOTA_CHARS >= QUOTA_WARN_RATIO && (
          <p role="status" className="text-sm mt-1 text-danger">
            {t("library.storageWarning")}
          </p>
        )}
      </section>

      {creating && (
        <Modal title={t("library.newWorld")} onClose={() => setCreating(false)} closeLabel={t("common.close")}>
          <div className="grid gap-3">
            <Field label={t("library.name")}><input aria-label={t("library.name")} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={t("library.description")}><textarea aria-label={t("library.description")} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={submitCreate}>{t("common.create")}</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </Modal>
      )}

      {restoring && (
        <Modal title={t("library.restoreTitle")} onClose={() => { setRestoring(false); setPendingRestore(null); }}>
          <p className="text-parchment-dim">{t("library.restoreBody")}</p>
          <input
            type="file"
            accept="application/json"
            aria-label={t("library.restoreFromFile")}
            className="mt-3 text-sm text-slate file:mr-3 file:rounded-sm file:border file:border-line file:bg-night file:px-2.5 file:py-1.5 file:text-parchment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onRestoreFile(f);
              e.target.value = "";
            }}
          />
          <div className="mt-3 flex justify-end gap-2.5">
            <Button kind="danger" disabled={!pendingRestore} onClick={confirmRestore}>{t("common.restore")}</Button>
            <Button kind="ghost" onClick={() => { setRestoring(false); setPendingRestore(null); }}>{t("common.cancel")}</Button>
          </div>
        </Modal>
      )}

      {target && (
        <Modal title={t("library.deleteTitle", { name: target.name })} onClose={() => setToDelete(null)} closeLabel={t("common.close")}>
          <p className="text-parchment-dim">{t("library.deleteBody")}</p>
          <div className="mt-2 flex justify-end gap-2.5">
            <Button kind="danger" onClick={() => { deleteProject(target.id); setToDelete(null); pushToast("success", t("library.toasts.worldDeleted")); }}>
              {t("common.delete")}
            </Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>{t("common.cancel")}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
