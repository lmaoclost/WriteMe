// All sections wired; kept for future route stubs only.
const COPY: Record<string, { title: string; next: string; project: string }> = {};

export function PlaceholderPage({ section }: { section: string }) {
  const copy = COPY[section];
  if (!copy) return null;
  return (
    <div className="placeholder">
      <h1>{copy.title}</h1>
      <p>{copy.next}</p>
      <p className="placeholder-note">Esta seção chega no {copy.project}.</p>
    </div>
  );
}
