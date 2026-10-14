import { Link, useOutletContext } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { selectCounts, selectProject, useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";

export interface WorkspaceContext {
  projectId: string;
}

export function OverviewPage() {
  const { projectId } = useOutletContext<WorkspaceContext>();
  const project = useScriptorium(selectProject(projectId));
  const counts = useScriptorium(useShallow(selectCounts(projectId)));
  const exportData = useScriptorium((s) => s.exportData);
  const importData = useScriptorium((s) => s.importData);
  const pushToast = useScriptorium((s) => s.pushToast);
  const seedFlag = useScriptorium((s) => s.seedFlag);
  const seedDemo = useScriptorium((s) => s.seedDemo);

  const doExport = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "scriptorium"}.scriptorium.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const r = importData(text);
    if (r.ok) pushToast("success", "Projeto importado.");
    else pushToast("error", r.error);
  };

  return (
    <div className="overview">
      <header className="overview-head">
        <h1>{project?.name}</h1>
        {project?.description && <p className="overview-desc">{project.description}</p>}
      </header>
      <div className="overview-actions">
        <Button kind="ghost" onClick={doExport}>Exportar dados</Button>
        <label className="import-label">
          Importar dados
          <input
            type="file"
            accept="application/json,text/plain"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f).then(() => { e.target.value = ""; });
            }}
          />
        </label>
        {!seedFlag && <Button onClick={() => void seedDemo()}>Carregar projeto de exemplo</Button>}
      </div>
      <p className="overview-note">
        Seus dados vivem apenas neste navegador. Exporte de vez em quando.
      </p>
      <div className="stats">
        <Stat label="Entradas" value={counts.entries} />
        <Stat label="Atlas" value={counts.atlases} />
        <Stat label="Livros" value={counts.manuscripts} />
        <Stat label="Capítulos" value={counts.chapters} />
      </div>
      <div className="overview-links">
        <Link className="overview-link" to={`/p/${projectId}/atlas`}>Abrir Atlas</Link>
        <Link className="overview-link" to={`/p/${projectId}/entries`}>Abrir Códex</Link>
        <Link className="overview-link" to={`/p/${projectId}/manuscript`}>Abrir Livro</Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}