import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { tidyOathsChart } from "../../domain/oaths";
import type { OathsChart, OathLink } from "../../domain/types";
import "./oaths.css";

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

  useEffect(() => {
    if (!chart) pushToast("error", "Chain of command not found.");
  }, [chart, pushToast]);

  if (!chart) return null;

  const pos = tidyOathsChart(chart.members, chart.oathLinks, { rootX: 240, rootY: 120, levelH: 170 });

  return (
    <div className="oaths-page" data-testid="oaths-page">
      <header className="bl-header">
        <input
          className="bl-name"
          aria-label="Chart name"
          value={chart.name}
          onChange={(e) => useScriptorium.getState().renameOathsChart(chartId, e.target.value)}
        />
        <div className="bl-actions">
          <button type="button" aria-label="Undo" disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoOC(chartId)}>↶</button>
          <button type="button" aria-label="Redo" disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoOC(chartId)}>↷</button>
          <button type="button" onClick={() => {
            const rect = document.querySelector('[data-testid="oaths-plane"]')?.getBoundingClientRect();
            useScriptorium.getState().pushOCHistory(chartId);
            const m = useScriptorium.getState().addOathMember(chartId, undefined, { name: "Fundador" });
            void m; void rect;
          }}>Fundador</button>
          <button type="button" onClick={() => setNotesOpen((v) => !v)}>Notes</button>
        </div>
      </header>
      <div className="bl-body">
        <div
          className="bl-canvas"
          data-testid="oaths-canvas"
        >
          <div className="bl-plane" data-testid="oaths-plane">
            <svg data-testid="oaths-links" className="edges-layer" width="100%" height="100%">
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
                  className={"oath-card" + (m.id === selectedId ? " selected" : "") + (m.seatStatus !== "held" ? " seat-" + m.seatStatus : "")}
                  data-testid="oath-member"
                  data-member-id={m.id}
                  style={{ left: p.x - 90, top: p.y }}
                  role="button"
                  aria-label={`Membro ${m.name}`}
                  tabIndex={0}
                  onClick={() => setSelectedId(m.id)}
                >
                  <span className="oath-card-name">{m.name}</span>
                  {m.title ? <span className="oath-card-title">{m.title}</span> : null}
                  {m.org ? <span className="oath-card-org">{m.org}</span> : null}
                  <span className={"oath-seat-badge seat-" + m.seatStatus}>
                    {m.seatStatus === "held" ? "Held" : m.seatStatus === "vacant" ? "Vacant seat" : "Contested seat"}
                  </span>
                </div>
              );
            })}
          </div>
          {chart.members.length === 0 ? (
            <div className="bl-empty">Coloque o fundador — todos os oaths descem dele.</div>
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
      <aside className="bl-panel" data-testid="oaths-panel">
        <p className="bl-panel-hint">Pick a member on the chart.</p>
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
    <aside className="bl-panel" data-testid="oaths-panel">
      <header className="bl-panel-head">
        <h2>{member.name}</h2>
        <button type="button" className={armDelete ? "btn-danger" : ""} onClick={remove}
          aria-label={armDelete ? "Confirm delete member" : "Delete member"}>
          {armDelete ? "Confirm?" : "Delete"}
        </button>
      </header>
      <div className="field">
        <span className="field-label">Name</span>
        <input aria-label="Member name" defaultValue={member.name} onBlur={(e) => update({ name: e.target.value.trim() || member.name })} />
      </div>
      <div className="field">
        <span className="field-label">Title / Office</span>
        <input aria-label="Title / Office" defaultValue={member.title ?? ""} onBlur={(e) => update({ title: e.target.value.trim() || undefined })} />
      </div>
      <div className="field">
        <span className="field-label">Order / Branch</span>
        <input aria-label="Order / Branch" defaultValue={member.org ?? ""} onBlur={(e) => update({ org: e.target.value.trim() || undefined })} />
      </div>
      <label className="field">
        <span className="field-label">Notes</span>
        <textarea aria-label="Member notes" rows={3} defaultValue={member.notes ?? ""} onBlur={(e) => update({ notes: e.target.value.trim() || undefined })} />
      </label>
      <div className="field">
        <span className="field-label">Assento</span>
        <select aria-label="Seat status" value={member.seatStatus} onChange={(e) => update({ seatStatus: e.target.value as unknown as OathsChart["members"][number]["seatStatus"] })}>
          <option value="held">Held</option>
          <option value="vacant">Vacant seat</option>
          <option value="disputed">Contested seat</option>
        </select>
      </div>
      <div className="field">
        <span className="field-label">Color</span>
        <div className="color-row" role="listbox" aria-label="Member color">
          {["#c0392b", "#e74c3c", "#e67e22", "#f1c40f", "#27ae60", "#2ecc71", "#2980b9", "#3498db", "#7c5cbf", "#8e44ad", "#2c3e50", "#34495e"].map((c) => (
            <button key={c} type="button" role="option" aria-selected={member.color === c}
              className={`color-swatch${member.color === c ? " current" : ""}`} style={{ background: c }}
              onClick={() => update({ color: c })} />
          ))}
        </div>
      </div>
      <section className="bl-subsection">
        <h3>Direct reports</h3>
        <button
          type="button"
          aria-label="Add direct report"
          onClick={() => {
            store().addOathMember(chart.id, member.id, { name: "Novo vassalo" });
          }}
        >+ Swear an oath</button>
      </section>
      <section className="bl-subsection">
        <h3>Their oaths</h3>
        {links.length === 0 ? <p className="dim">No oaths.</p> : null}
        {superiors.map((l) => (
          <div key={l.id} className="oath-edit-row" data-testid="oath-edit-row">
            <span className="dim">Para {memberByIdName(chart, l.superiorId) ?? "?"}:</span>
            <select
              aria-label={`Status do oath com ${memberByIdName(chart, l.superiorId) ?? "?"}`}
              value={l.status}
              onChange={(e) => store().setOathStatus(l.id, e.target.value as unknown as OathLink["status"])}
            >
              <option value="sworn">Sworn</option>
              <option value="strained">Strained</option>
              <option value="broken">Broken</option>
            </select>
            <select
              aria-label={`Tipo do oath com ${memberByIdName(chart, l.superiorId) ?? "?"}`}
              value={l.kind}
              onChange={(e) => store().setOathLinkKind(l.id, e.target.value as unknown as OathLink["kind"])}
            >
              <option value="primary">Primary chain</option>
              <option value="joint">Joint report</option>
            </select>
          </div>
        ))}
        <details className="oath-new-details">
          <summary>Reconhecer superior</summary>
          <select
            aria-label="Pick a superior"
            defaultValue=""
            onChange={(e) => { if (e.target.value) store().addOathMember(chart.id, e.target.value, { name: "Sem nome" }); e.target.value = ""; }}
          >
            <option value="">—</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>Novo subordinado de {c.name}</option>
            ))}
          </select>
        </details>
      </section>
    </aside>
  );
}

function memberByIdName(chart: OathsChart, id: string): string {
  return chart.members.find((m) => m.id === id)?.name ?? "?";
}

function OathsNotepadBridge({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  return <OathsNotepad notes={notes} onNotes={onNotes} onClose={onClose} />;
}

import { OathsNotepad } from "./OathsNotepad";
