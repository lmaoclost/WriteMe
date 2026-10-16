# Projeto Exemplo Completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `seedDemoProject()` passa a retornar TODOS os subsystems preenchidos (sangue: bloodline; facções; calendário; plot board; timeline; juramentos; wellspring; conlang), e `seedDemo()` no store os persiste.

**Architecture:** Estender `src/data/seed.ts` com builders dos novos subsystems usando o mesmo universo "Reino de Vellmora", retornar arrays completos em `ProjectData`; atualizar ação `seedDemo()` em `src/data/store.ts` para espalhar todos os arrays; estender `seed.test.ts` para validar cada subsystem via `validateProjectData` + invariantes de contagem/cruzamento de ids.

**Tech Stack:** TypeScript + zustand + vitest (padrão do repo).

## Global Constraints

- Sem deps novas; `newId("prj")` e helpers já usados em seed.ts.
- Todo referenciamento cruzado de ids deve apontar para ids do mesmo seed.
- Calendário: chave de evento `"ano:mês:d"` (testes usam `"0:2:5"`, `"1:3:9"`).
- Copy do seed em PT (padrão do seed atual).
- `validateProjectData(seed)` deve continuar `true` (schema valida cada subsystem novo).
- Coordenadas dentro do canvas padrão: persons/factions/cards x≤1600, y≤900; timeline beads x 600–1600; conlang svgPath em viewBox 0 0 100 100.
- Lint: `npm run lint` (0 warnings) + `npm test` + `npm run typecheck`.

---

### Task 1: Bloodline + FactionWeb no seed

**Files:**
- Modify: `src/data/seed.ts`
- Test: `src/data/seed.test.ts`

**Interfaces:**
- Consumes: tipos `Bloodline`, `FactionWeb` de `src/domain/types.ts`; ids de entries já criados (eHouse etc.).
- Produces: `seedDemoProject()` retorna `bloodlines: Bloodline[]` (1, ≥6 persons ligadas por connectedTo/partnerId/siblingId, houses ≥2) e `factionWebs: FactionWeb[]` (1, ≥4 factions, ≥4 connections com type válido).

- [ ] **Step 1: Failing tests em seed.test.ts**

```ts
it("one bloodline with linked persons and houses", () => {
  expect(data.bloodlines).toHaveLength(1);
  const bl = data.bloodlines[0];
  expect(bl.persons.length).toBeGreaterThanOrEqual(6);
  expect(bl.houses.length).toBeGreaterThanOrEqual(2);
  const ids = new Set(bl.persons.map((p) => p.id));
  bl.persons.forEach((p) => {
    for (const l of [p.connectedTo, p.siblingId, p.partnerId]) {
      if (l) expect(ids.has(l)).toBe(true);
    }
  });
  expect(bl.persons.some((p) => p.tenures.length > 0)).toBe(true);
});

it("one faction web with 4 factions and typed connections", () => {
  expect(data.factionWebs).toHaveLength(1);
  const fw = data.factionWebs[0];
  expect(fw.factions.length).toBeGreaterThanOrEqual(4);
  const fids = new Set(fw.factions.map((f) => f.id));
  fw.connections.forEach((c) => {
    expect(fids.has(c.fromId)).toBe(true);
    expect(fids.has(c.toId)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/data/seed.test.ts` → FAIL (undefined).
- [ ] **Step 3: Implementar em seed.ts** — adicionar ao fim `seedDemoProject()`:

```ts
const bloodline: Bloodline = {
  id: newId("bl"), projectId: project.id, name: "Genealogia Casa Vellmor",
  houses: [
    { id: newId("house"), x: 560, y: 80, name: "Casa Vellmor", subtitle: "Ramo real", isMainBranch: true, isMonarch: true },
    { id: newId("house"), x: 200, y: 80, name: "Ramo de Sarnen", subtitle: "Ramo cadete", isMainBranch: false, isMonarch: false },
  ],
  persons: [
    { id: newId("p"), x: 240, y: 180, name: "Sarn Vellmor", title: "Capitão do Sarnen", relationship: "Raiz ramo cadete", additionalTitles: [], tenures: [{ label: "Capitão da costa", from: "1150", to: "1178" }], showBadge: true, badgeText: "†", isTwin: false },
    { id: newId("p"), x: 620, y: 180, name: "Aldric Vellmor", title: "Rei Fundador", relationship: "Raiz ramo real", bio: "Sumiu no nono mês do cerco.", additionalTitles: [{ title: "Portador da Coroa" }], tenures: [{ label: "Coroação do Arco", from: "1160", to: "1200" }], showBadge: true, badgeText: "✦", isTwin: false },
    { id: newId("p"), x: 430, y: 300, name: "Mirren Vellmor", title: "Juíza do Selo", relationship: "Filha de Aldric", additionalTitles: [], tenures: [{ label: "Tribunal do Selo", from: "1204", to: "1221" }], showBadge: false, badgeText: "", isTwin: false },
    { id: newId("p"), x: 430, y: 420, name: "Talan Vellmor", title: "Herdeiro", relationship: "Neto de Aldric", birthDate: "1210-03-12", additionalTitles: [], tenures: [], showBadge: false, badgeText: "", isTwin: false },
    { id: newId("p"), x: 640, y: 420, name: "Ora Sarnen", suffix: "de Sarnen", title: "Lady da Costa", relationship: "Prima de Talan", additionalTitles: [], tenures: [], showBadge: false, badgeText: "", isTwin: false },
    { id: newId("p"), x: 430, y: 540, name: "Vesper Vellmor", title: "Recém-nascida", relationship: "Filha de Talan e Ora", additionalTitles: [], tenures: [], showBadge: true, badgeText: "✧", isTwin: false },
  ],
  notes: "O ramo real aparentemente terminou em Talan; a linha do rio segue por Ora.",
};
// ligações: Talan↔Ora partnerId; Vesper connectedTo Talan; Talan sibling de si? não — Talan sibling nulo; Mirren parent of Talan via connectedTo (canvas usa connectedTo p/ pai)
bloodline.persons[2].connectedTo = bloodline.persons[1].id; // Mirren filha de Aldric
bloodline.persons[3].connectedTo = bloodline.persons[2].id; // Talan filho de Mirren
bloodline.persons[3].partnerId = bloodline.persons[4].id;   // Talan–Ora
bloodline.persons[4].partnerId = bloodline.persons[3].id;
bloodline.persons[5].connectedTo = bloodline.persons[3].id; // Vesper filha de Talan

const factionWeb: FactionWeb = {
  id: newId("fw"), projectId: project.id, name: "Rede de Facções — Vellmora",
  notes: "O selo divide tudo: quem aperta a cera, quem derrete.",
  factions: [
    { id: newId("fa"), x: 300, y: 200, name: "Casa Vellmor", leader: "Mirren Vellmor", territory: "Vellmora e o Sarnen", goals: "Manter a Lei do Selo", description: "A dinastia selada.", color: "#c9a227" },
    { id: newId("fa"), x: 700, y: 260, name: "Casa Orvean", leader: "Duque Roval Orvean", territory: "Terras Altas", goals: "Sucessão sem a juíza", color: "#4d8f5f" },
    { id: newId("fa"), x: 620, y: 640, name: "Guilde das Ceras", leader: "Mestres Sela — colégio de cinco", territory: "Porto do Sebo", goals: "Monopólio do selo", color: "#4d6f8f" },
    { id: newId("fa"), x: 240, y: 620, name: "Congregação do Heron", leader: "Canta-Brân (anon.)", territory: "Catedral", goals: "Intercessão pelo rio", color: "#8f4d6f" },
  ],
  connections: [
    { id: newId("co"), fromId: "", toId: "", type: "vassal" },
    { id: newId("co"), fromId: "", toId: "", type: "rival" },
    { id: newId("co"), fromId: "", toId: "", type: "trade" },
    { id: newId("co"), fromId: "", toId: "", type: "ally" },
  ],
};
// preencher connections com os fids reais (Orvean vassal de Vellmor; Orvean rival Guilde; Guilde trade Congregação; Congregação ally Vellmor)
```

(No código real: guardar refs das ids em consts e usar nos connections.)

- [ ] **Step 4: rodar testes → PASS**
- [ ] **Step 5: commit** — `git commit -m "feat(seed): bloodline + faction web em projeto de exemplo"`

### Task 2: Calendar + PlotBoard + Timeline no seed

**Files:**
- Modify: `src/data/seed.ts`
- Test: `src/data/seed.test.ts`

**Interfaces:**
- Consumes: tipos `CustomCalendar`, `PlotBoard`, `TimelineWire`.
- Produces: `calendars` (1: 12 meses temáticos 30/31d, 7 weekdays, ≥8 eventos), `plotBoards` (1: 3 acts + pró-logo/epílogo, ≥6 cards com pov/parts, ≥3 wires), `timelines` (1: ≥5 beads, ≥1 segment, y offsets alternados).

- [ ] **Step 1: Failing tests**

```ts
it("one calendar with themed months and events", () => {
  expect(data.calendars).toHaveLength(1);
  const cal = data.calendars[0];
  expect(cal.months).toHaveLength(12);
  expect(cal.weekdays).toHaveLength(7);
  const nEvents = Object.values(cal.events).reduce((n, l) => n + l.length, 0);
  expect(nEvents).toBeGreaterThanOrEqual(8);
  Object.keys(cal.events).forEach((k) => {
    const [y, m, d] = k.split(":").map(Number);
    expect(m).toBeLessThan(cal.months.length);
    expect(d).toBeLessThanOrEqual(cal.months[m].days);
  });
});

it("one plot board with acts, cards and wires", () => {
  expect(data.plotBoards).toHaveLength(1);
  const pb = data.plotBoards[0];
  expect(pb.acts.length).toBeGreaterThanOrEqual(3);
  expect(pb.hasPrologue && pb.hasEpilogue).toBe(true);
  expect(pb.cards.length).toBeGreaterThanOrEqual(6);
  const cids = new Set(pb.cards.map((c) => c.id));
  pb.wires.forEach((w) => { expect(cids.has(w.fromCardId)).toBe(true); expect(cids.has(w.toCardId)).toBe(true); });
  pb.cards.forEach((c) => expect(c.parts.length).toBeGreaterThan(0));
});

it("one timeline with beads and segment", () => {
  expect(data.timelines).toHaveLength(1);
  const t = data.timelines[0];
  expect(t.beads.length).toBeGreaterThanOrEqual(5);
  expect(t.segments.length).toBeGreaterThanOrEqual(1);
  t.segments.forEach((s) => expect(s.toX).toBeGreaterThan(s.fromX));
});
```

- [ ] **Step 2: ver falhar**
- [ ] **Step 3: implementar** — calendário "Calendário do Selo" (era "Contagem do Arco", meses: Ceira, Bruma, Calor, Sela, Ponte, Fala, Vela, Vau, Heron, Ninar, Inverno, Arco; 12º mês 31d, resto 30), weekdays PT, weekendDays [5,6], startingWeekday 1, eventos em chaves ex. `"1:2:5"` (dia da Fundação), `"1:4:1"` (Juramento das Pontes), `"1:9:3"` (Noite da Fala), etc. Plotboard "Plot Board — A Coroa e o Rio": acts Ato I/II/III, cards com pov (Kellen/Ora/Roval), location vinculado a entryId (eCap etc.), parts (beats curtos), 3 wires progressão. Timeline "Fio dos Selos": beads com datas 1160→1287 alternando y ±60, segment cobrindo guerra.
- [ ] **Step 4: PASS**
- [ ] **Step 5: commit** — `feat(seed): calendário, plot board e timeline no exemplo`

### Task 3: Oaths + WellSpring + Conlang + store + fechamento

**Files:**
- Modify: `src/data/seed.ts`
- Modify: `src/data/store.ts` (ação `seedDemo`)
- Test: `src/data/seed.test.ts`

**Interfaces:**
- Consumes: tipos `OathsChart`, `WellSpring`, `Conlang`.
- Produces: `oathsCharts` (1: ≥6 members, seats variados held/vacant/disputed, links com status sworn/strained/broken), `wellsprings` (1: ≥8 nodes dos 4 kinds, ≥5 borders com label), `conlangs` (1: ≥8 glyphs svgPath "M.. Q..", ≥10 words com pos/theme). `seedDemo()` espalha TODOS os arrays e valida; retorno de id de projeto inalterado.

- [ ] **Step 1: Failing tests**

```ts
it("one oaths chart with mixed seats and statuses", () => {
  expect(data.oathsCharts).toHaveLength(1);
  const oc = data.oathsCharts[0];
  expect(oc.members.length).toBeGreaterThanOrEqual(6);
  expect(new Set(oc.members.map((m) => m.seatStatus)).size).toBe(3);
  expect(new Set(oc.oathLinks.map((l) => l.status)).size).toBe(3);
  const mids = new Set(oc.members.map((m) => m.id));
  oc.oathLinks.forEach((l) => { expect(mids.has(l.subordinateId)).toBe(true); expect(mids.has(l.superiorId)).toBe(true); });
});

it("one wellspring with all four kinds and borders", () => {
  expect(data.wellsprings).toHaveLength(1);
  const w = data.wellsprings[0];
  expect(w.nodes.length).toBeGreaterThanOrEqual(8);
  expect(new Set(w.nodes.map((n) => n.kind)).size).toBe(4);
  const nids = new Set(w.nodes.map((n) => n.id));
  w.borders.forEach((b) => { expect(nids.has(b.fromId)).toBe(true); expect(nids.has(b.toId)).toBe(true); expect(b.label.length).toBeGreaterThan(0); });
});

it("one conlang with glyphs and vocabulary", () => {
  expect(data.conlangs).toHaveLength(1);
  const cl = data.conlangs[0];
  expect(cl.glyphs.length).toBeGreaterThanOrEqual(8);
  cl.glyphs.forEach((g) => { expect(g.svgPath).toContain("M "); expect(g.svgPath.length).toBeGreaterThan(10); });
  expect(cl.words.length).toBeGreaterThanOrEqual(10);
  cl.words.forEach((w) => { expect(w.meaning.length).toBeGreaterThan(2); expect(["n","v","adj","prep"]).toContain(w.pos); });
});
```

- [ ] **Step 2: ver falhar**
- [ ] **Step 3: implementar seed.ts** — Juramentos "Anel de Lealdade": membros (Mirren titular coroa held; Orvean strained; Guilde trade disputed; Canta-Brân held; herdeiro vacant; vau-velha broken) + 5 links. WellSpring "Poço do Cerco": 8 nós (question "Quem recebe a Coroa?", characters Talan/Ora/Mirren, settings Tribunal/Torre, conflicts 2). Conlang "Fala do Sarnen": 8 glyphs paths curvos (ex.: `"M 20 80 Q 50 10 80 80"`, variantes) + 10 palavras (sarnen=rio; vell=guardar; oram=ponte; etc.).
- [ ] **Step 4: atualizar store.ts `seedDemo()`**

```ts
seedDemo() {
  const demo = seedDemoProject();
  set((s) => ({
    ...s,
    projects: [...s.projects, ...demo.projects],
    entries: [...s.entries, ...demo.entries],
    atlases: [...s.atlases, ...demo.atlases],
    manuscripts: [...s.manuscripts, ...demo.manuscripts],
    bloodlines: [...(s.bloodlines ?? []), ...(demo.bloodlines ?? [])],
    factionWebs: [...(s.factionWebs ?? []), ...(demo.factionWebs ?? [])],
    calendars: [...(s.calendars ?? []), ...(demo.calendars ?? [])],
    plotBoards: [...(s.plotBoards ?? []), ...(demo.plotBoards ?? [])],
    timelines: [...(s.timelines ?? []), ...(demo.timelines ?? [])],
    oathsCharts: [...(s.oathsCharts ?? []), ...(demo.oathsCharts ?? [])],
    wellsprings: [...(s.wellsprings ?? []), ...(demo.wellsprings ?? [])],
    conlangs: [...(s.conlangs ?? []), ...(demo.conlangs ?? [])],
    images: { ...s.images, ...demo.images },
    seedFlag: true,
  }));
  return demo.projects[0].id;
},
```

- [ ] **Step 5: teste de integração no store.test.ts** — `seedDemo()` persiste 1 bloodline/calendars etc. (asertar `store().bloodlines).toHaveLength(1)` após seedDemo em store limpo).
- [ ] **Step 6: PASS + `npm run lint` + `npm run typecheck` + suite inteira**
- [ ] **Step 7: commit** — `feat(seed): juramentos, wellspring e conlang; seedDemo persiste todos os subsystems`

### Verificação manual E2E

- [ ] Dev server + Playwright: clicar "Carregar projeto de exemplo" na Library, abrir workspace, checar Bloodline/Factions/Calendar/Plot/Timeline/Oaths/WellSpring/Conlang com conteúdo.
- [ ] Print do overview para o relatório final.