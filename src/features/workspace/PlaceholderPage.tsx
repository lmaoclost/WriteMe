const COPY: Record<string, { title: string; next: string; project: string }> = {
  atlas: { title: "Atlas", next: "Pintar regiões e cravar pinos sobre o mapa do mundo.", project: "sub-projeto 2" },
  entries: { title: "Códex", next: "Registrar pessoas, lugares e eventos com links entre eles.", project: "sub-projeto 3" },
  manuscript: { title: "Livro", next: "Escrever capítulos e exportar o manuscrito.", project: "sub-projeto 4" },
};

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