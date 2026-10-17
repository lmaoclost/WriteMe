import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { tidyOathsChart } from "../../domain/oaths";
import type { OathsChart, OathLink } from "../../domain/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";
import { useBoardNotesHotkey } from "../../ui/boardNotes";


export const OATH_LINK_STYLE: Record<OathLink["status"], { label: string; color: string; dash: string }> = {
  sworn: { label: "Sworn", color: "#7c5cbf", dash: "" },
  strained: { label: "Strained", color: "#d4a017", dash: "7 5" },
  broken: { label: "Broken", color: "#c0392b", dash: "10 6" },
};

export function OathsChartPage({ chartId }: { chartId: string }) {
  const chart = useScriptorium((s) => (s.oathsCharts ?? []).find((c) => c.id === chartId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`oc_${chartId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);

  useEffect(() => {
    if (!chart) pushToast("error", "Chain of command not found.");
  }, [chart, pushToast]);

  if (!chart) return null;

  const pos = tidyOathsChart(chart.members, chart.oathLinks, { rootX: 240, rootY: 120, levelH: 170 });

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="oaths-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label="Chart name"
          value={chart.name}
          onChange={(e) => useScriptorium.getState().renameOathsChart(chartId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label="Undo" className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoOC(chartId)}>↶</button>
          <button type="button" aria-label="Redo" className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoOC(chartId)}>↷</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => {
            const rect = document.querySelector('[data-testid="oaths-plane"]')?.getBoundingClientRect();
            useScriptorium.getState().pushOCHistory(chartId);
            const m = useScriptorium.getState().addOathMember(chartId, undefined, { name: "Fundador" });
            void m; void rect;
          }}>Fundador</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>Notes ✎</button>
        </div>
      </header>
      <div className="grid grid-cols-[1fr_300px] min-h-0 overflow-hidden">
        <div
          className="relative overflow-hidden bg-ink cursor-grab active:cursor-grabbing"
          data-testid="oaths-canvas"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,#17162a,var(--ink)_65%)] shadow-[inset_0_0_0_1px_var(--line)]" data-testid="oaths-plane">
            <svg data-testid="oaths-links" className="edges-layer absolute left-0 top-0 w-full h-full pointer-events-none" width="100%" height="100%">
              {chart.oathLinks.map((l: OathLink) => {
                const child = pos.get(l.subordinateId);
                const parent = pos.get(l.superiorId);
                if (!child || !parent) return null;
                const style = OATH_LINK_STYLE[l.status];
                const elbowY = parent.y + (child.y - parent.y) * 0.55;
                return (
                  <g key={l.id}>
                    <path
                      data-testid="oath-link"
                      className={"oath-link" + (l.kind === "joint" ? " oath-joint" : "")}
                      d={`M ${parent.x} ${parent.y + 24} L ${parent.x} ${elbowY} L ${child.x} ${elbowY} L ${child.x} ${child.y - 24}`}
                      stroke={style.color}
                      strokeWidth={l.kind === "joint" ? 2 : 2.6}
                      strokeDasharray={style.dash}
                      fill="none"
                    />
                    <text x={child.x} y={elbowY - 4} className="oath-link-status" fill={style.color} textAnchor="middle">
                      {style.label}
                      {l.kind === "joint" ? " (conjunta)" : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
            {chart.members.map((m) => {
              const p = pos.get(m.id);
              if (!p) return null;
              return (
                <div
                  key={m.id}
                  className={"oath-card absolute w-[180px] px-3 py-2.5 rounded-lg bg-night border border-slate grid gap-[3px] cursor-pointer" + (m.id === selectedId ? " outline outline-2 outline-gold" : "") + (m.seatStatus !== "held" ? " seat-" + m.seatStatus : "") + (m.seatStatus === "vacant" ? " border-dashed opacity-85" : "") + (m.seatStatus === "disputed" ? " border-[var(--ember)]" : "")}
                  data-testid="oath-member"
                  data-member-id={m.id}
                  style={{ left: p.x - 90, top: p.y }}
                  role="button"
                  aria-label={`Membro ${m.name}`}
                  tabIndex={0}
                  onClick={() => setSelectedId(m.id)}
                >
                  <span className="text-sm font-semibold text-parchment">{m.name}</span>
                  {m.title ? <span className="text-[11px] text-parchment-dim">{m.title}</span> : null}
                  {m.org ? <span className="text-[11px] text-slate">{m.org}</span> : null}
                  <span className={"oath-seat-badge w-max rounded-sm px-1 py-px text-[0.6875rem] bg-ink text-slate" + (m.seatStatus === "disputed" ? " text-[var(--ember)]" : "")}>
                    {m.seatStatus === "held" ? "Held" : m.seatStatus === "vacant" ? "Vacant seat" : "Contested seat"}
                  </span>
                </div>
              );
            })}
          </div>
          {chart.members.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[calc(1/var(--bl-scale,0.1))] text-slate whitespace-nowrap">Coloque o fundador — todos os oaths descem dele.</div>
          ) : null}
          {notesOpen ? <OathsNotepadBridge notes={chart.notes} onNotes={(v) => useScriptorium.getState().setOathsNotes(chartId, v)} onClose={() => setNotesOpen(false)} /> : null}
        </div>
        <OathsPanel chart={chart} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  );
}

function OathsPanel({ chart, selectedId, onSelect }: {
  chart: OathsChart;
  selectedId: string | null;
  onSelect(id: string | null): void;
}) {
  const member = chart.members.find((m) => m.id === selectedId);
  if (!member) {
    return (
      <aside className={BOARD_PANEL} data-testid="oaths-panel">
        <p className={BOARD_PANEL_HINT}>Pick a member on the chart.</p>
      </aside>
    );
  }
  return <MemberForm chart={chart} member={member} onSelect={onSelect} />;
}

function MemberForm({ chart, member, onSelect }: {
  chart: OathsChart;
  member: OathsChart["members"][number];
  onSelect(id: string | null): void;
}) {
  const store = useScriptorium.getState;
  const pushToast = useScriptorium((s) => s.pushToast);
  const [armDelete, setArmDelete] = useState(false);
  const update = (patch: Partial<OathsChart["members"][number]>) => store().updateOathMember(member.id, patch);

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deleteOathMember(member.id);
    pushToast("success", "Member removed.");
    onSelect(null);
  };

  const links = chart.oathLinks.filter((l) => l.subordinateId === member.id || l.superiorId === member.id);
  const superiors = links.filter((l) => l.subordinateId === member.id);
  const candidates = chart.members.filter((m) => m.id !== member.id);

  return (
    <aside className={BOARD_PANEL} data-testid="oaths-panel">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{member.name}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={remove}
          aria-label={armDelete ? "Confirm delete member" : "Delete member"}>
          {armDelete ? "Confirm?" : "Delete"}
        </Button>
      </header>
      <Field label="Name">
        <input aria-label="Member name" defaultValue={member.name} onBlur={(e) => update({ name: e.target.value.trim() || member.name })} />
      </Field>
      <Field label="Title / Office">
        <input aria-label="Title / Office" defaultValue={member.title ?? ""} onBlur={(e) => update({ title: e.target.value.trim() || undefined })} />
      </Field>
      <Field label="Order / Branch">
        <input aria-label="Order / Branch" defaultValue={member.org ?? ""} onBlur={(e) => update({ org: e.target.value.trim() || undefined })} />
      </Field>
      <Field label="Notes">
        <textarea aria-label="Member notes" rows={3} defaultValue={member.notes ?? ""} onBlur={(e) => update({ notes: e.target.value.trim() || undefined })} />
      </Field>
      <Field label="Assento">
        <Select value={member.seatStatus} onValueChange={(v) => update({ seatStatus: v as unknown as OathsChart["members"][number]["seatStatus"] })}>
          <SelectTrigger aria-label="Seat status" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            <SelectItem value="held" className="text-xs focus:bg-[#24233f] focus:text-parchment">Held</SelectItem>
            <SelectItem value="vacant" className="text-xs focus:bg-[#24233f] focus:text-parchment">Vacant seat</SelectItem>
            <SelectItem value="disputed" className="text-xs focus:bg-[#24233f] focus:text-parchment">Contested seat</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Color">
        <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Member color">
          {["#c0392b", "#e74c3c", "#e67e22", "#f1c40f", "#27ae60", "#2ecc71", "#2980b9", "#3498db", "#7c5cbf", "#8e44ad", "#2c3e50", "#34495e"].map((c) => (
            <button key={c} type="button" role="option" aria-selected={member.color === c}
              className={`color-swatch size-5 rounded-full border border-transparent cursor-pointer${member.color === c ? " outline outline-2 outline-parchment" : ""}`} style={{ background: c }}
              onClick={() => update({ color: c })} />
          ))}
        </div>
      </Field>
      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3 className="text-[13px] tracking-[0.08em] uppercase text-slate font-semibold">Direct reports</h3>
        <button
          type="button"
          aria-label="Add direct report"
          onClick={() => {
            store().addOathMember(chart.id, member.id, { name: "Novo vassalo" });
          }}
        >+ Swear an oath</button>
        <Field label="Subordinar a">
          <SubordinatePicker chart={chart} candidates={candidates} onPick={(id) => store().addOathLink(chart.id, member.id, id)} />
        </Field>
      </section>
      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3 className="text-[13px] tracking-[0.08em] uppercase text-slate font-semibold">Their oaths</h3>
        {links.length === 0 ? <p className="text-slate">No oaths.</p> : null}
        {superiors.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-1.5" data-testid="oath-edit-row">
            <span className="text-slate">Para {memberByIdName(chart, l.superiorId) ?? "?"}:</span>
            <Select value={l.status} onValueChange={(v) => store().setOathStatus(l.id, v as unknown as OathLink["status"])}>
              <SelectTrigger aria-label={`Status do oath com ${memberByIdName(chart, l.superiorId) ?? "?"}`} className="h-auto justify-between rounded-sm border-line bg-ink px-1 py-0.5 text-[11px] text-parchment-dim hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                <SelectItem value="sworn" className="text-[11px] focus:bg-[#24233f] focus:text-parchment">Sworn</SelectItem>
                <SelectItem value="strained" className="text-[11px] focus:bg-[#24233f] focus:text-parchment">Strained</SelectItem>
                <SelectItem value="broken" className="text-[11px] focus:bg-[#24233f] focus:text-parchment">Broken</SelectItem>
              </SelectContent>
            </Select>
            <Select value={l.kind} onValueChange={(v) => store().setOathLinkKind(l.id, v as unknown as OathLink["kind"])}>
              <SelectTrigger aria-label={`Tipo do oath com ${memberByIdName(chart, l.superiorId) ?? "?"}`} className="h-auto justify-between rounded-sm border-line bg-ink px-1 py-0.5 text-[11px] text-parchment-dim hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                <SelectItem value="primary" className="text-[11px] focus:bg-[#24233f] focus:text-parchment">Primary chain</SelectItem>
                <SelectItem value="joint" className="text-[11px] focus:bg-[#24233f] focus:text-parchment">Joint report</SelectItem>
              </SelectContent>
            </Select>
            <button type="button" aria-label="Remove oath link" onClick={() => store().removeOathLink(l.id)} className="bg-none border-0 text-slate text-xs">✕</button>
          </div>
        ))}
      </section>
    </aside>
  );
}

function SubordinatePicker({ chart, candidates, onPick }: {
  chart: OathsChart;
  candidates: OathsChart["members"];
  onPick(id: string): void;
}) {
  const [pick, setPick] = useState("");
  return (
    <Select value={pick} onValueChange={(v) => { if (v) { onPick(v); setPick(""); } }}>
      <SelectTrigger aria-label="Subordinar a" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment-dim hover:border-gold-dim data-[size=default]:h-auto">
        <SelectValue placeholder="— pick an existing member —" />
      </SelectTrigger>
      <SelectContent className="border-line bg-night text-parchment">
        {candidates.map((c) => (
          <SelectItem key={c.id} value={c.id} className="text-xs focus:bg-[#24233f] focus:text-parchment" data-testid="subordinate-option">{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  void chart;
}

function memberByIdName(chart: OathsChart, id: string): string {
  return chart.members.find((m) => m.id === id)?.name ?? "?";
}

function OathsNotepadBridge({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  return <OathsNotepad notes={notes} onNotes={onNotes} onClose={onClose} />;
}

import { OathsNotepad } from "./OathsNotepad";
