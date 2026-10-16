import type { Atlas, Chapter, Manuscript, Project, WorldEntry, Pin, Bloodline, FactionWeb, CustomCalendar, PlotBoard, TimelineWire, OathsChart, WellSpring, Conlang } from "../domain/types";
import { newId } from "../domain/id";
import { buildDemoMapSvg } from "./seedMap";

export function seedDemoProject() {
  const now = Date.now();
  const project: Project = {
    id: newId("prj"),
    name: "Reino de Vellmora (exemplo)",
    description: "Projeto de demonstração com códex, atlas e manuscrito populados. Exclua quando quiser.",
    createdAt: now,
    updatedAt: now,
  };

  const eCap = newId("ent"), eRiver = newId("ent"), eHouse = newId("ent"),
    eWar = newId("ent"), eRelic = newId("ent"), eLaw = newId("ent"),
    eFounder = newId("ent"),
    eNat = newId("ent"), eBeast = newId("ent"), eFlora = newId("ent"),
    eMat = newId("ent"), eTech = newId("ent"), eMagic = newId("ent"),
    eCult = newId("ent"), eLang = newId("ent"), eDeity = newId("ent");

  const entries: WorldEntry[] = [
    {
      id: eCap, projectId: project.id, title: "Cidade de Vellmora", category: "location",
      body: "Capital do reino, erguida onde o Rio Sarnen se abre em três braços. O portão sul — o Arco da Coroa — leva a marca do primeiro rei ainda legível.",
      links: [eRiver, eWar],
      sections: [{ name: "Quick Facts", fields: [{ label: "Climate", content: "Chuvoso no inverno" }] }],
    },
    {
      id: eRiver, projectId: project.id, title: "Rio Sarnen", category: "location",
      body: "Artéria do reino. As três pontes do Sarnen datam da fundação e nenhuma caiu em guerra — os capitães sempre pouparam o rio para o abastecimento.",
      links: [eCap],
      sections: [{ name: "Detail", fields: [{ label: "Points of Interest", content: "As três pontes; a boca da Fala" }] }],
    },
    {
      id: eHouse, projectId: project.id, title: "Casa Vellmor", category: "faction",
      body: "Dinastia fundada por Aldric Vellmor. Governam desde o Tratado das Três Pontes; a legitimidade vem de terem pagado o preço da Lei do Selo.",
      links: [eLaw, eFounder],
      sections: [{ name: "Detail", fields: [{ label: "Leadership", content: "Juíza do Selo em exercício" }] }],
    },
    {
      id: eWar, projectId: project.id, title: "Guerra dos Cinco Invernos", category: "event",
      date: "1200-05-10",
      body: "Conflito que definiu as fronteiras norte. O rio ficou vermelho por dias, contam os registros da Catedral — e a capital sobreviveu ao cerco por um inverno inteiro.",
      links: [eCap, eRelic],
      sections: [{ name: "Detail", fields: [{ label: "Key Figures", content: "Aldric Vellmor" }] }],
    },
    {
      id: eRelic, projectId: project.id, title: "Coroa de Sarnen", category: "artifact",
      body: "Coroa cerimonial perdida no último inverno da guerra. Dizem que carregar quem a carregar a fumaça dos anos difíceis. Nenhum rei a usou desde.",
      links: [eWar, eFounder],
      sections: [{ name: "Detail", fields: [{ label: "Current Location", content: "Fundo do Sarnen (?)" }] }],
    },
    {
      id: eLaw, projectId: project.id, title: "Lei do Selo", category: "lore",
      body: "Todo pacto no reino é feito em cera: o selo é a palavra. Romper um selo é romper o nome de casa — punição pior do que a morte nos tribunais antigos.",
      links: [eHouse],
    },
    {
      id: eFounder, projectId: project.id, title: "Aldric Vellmor", category: "character",
      body: "Fundador da Casa. Não morreu na guerra dos Cinco Invernos — entregou a Coroa ao rio e desapareceu. O que resta é o nome nos portões.",
      links: [eHouse, eRelic],
      sections: [{ name: "Quick Facts", fields: [{ label: "Identity", content: "Fundador, sumido no 9º mês" }] }],
    },
    {
      id: eNat, projectId: project.id, title: "Reino de Vellmora", category: "nation",
      body: "O reino inteiro, sob a Lei do Selo: do rio ao mar, três casas juram à coroa e uma espera.",
      links: [eCap, eHouse],
      summary: "O reino dos três braços do Sarnen.",
      sections: [{ name: "Detail", fields: [{ label: "Government", content: "Monarquia selada" }] }],
    },
    {
      id: eBeast, projectId: project.id, title: "Heron-da-Prata", category: "creature",
      body: "A ave do selo da Casa Vellmor. Dizem que os herons reais ouviram os juramentos e nunca mais pousaram em outro telhado.",
      links: [eHouse],
      summary: "A ave de três asas do selo.",
      sections: [{ name: "Detail", fields: [{ label: "Danger Level", content: "Nenhum — sagrada" }] }],
    },
    {
      id: eFlora, projectId: project.id, title: "Cera-Fria", category: "flora",
      body: "A cera que a Lei do Selo manda usar: derrete só no tribunal, à mão do juiz.",
      links: [eLaw],
      summary: "A cera sagrada dos selos.",
      sections: [{ name: "Detail", fields: [{ label: "Uses", content: "Selos da coroa" }] }],
    },
    {
      id: eMat, projectId: project.id, title: "Prata das Três Pontes", category: "material",
      body: "O metal das moedas do reino — e das três pontes. Não enferruja no Sarnen.",
      links: [eRiver],
      summary: "O metal das pontes.",
      sections: [{ name: "Detail", fields: [{ label: "Applications", content: "Moedas, pontes, sinos" }] }],
    },
    {
      id: eTech, projectId: project.id, title: "Prensa do Selo", category: "technology",
      body: "A prensa do tribunal: imprime selos idênticos. Inventada para a Lei — e odiada pelos artesãos.",
      links: [eLaw],
      summary: "A prensa dos selos.",
      sections: [{ name: "Detail", fields: [{ label: "Origin", content: "Tribunal do Selo" }] }],
    },
    {
      id: eMagic, projectId: project.id, title: "A Fala do Rio", category: "magic",
      body: "O Sarnen avisa. Quem ouve, salva a cidade — quem não ouve, lê a história depois.",
      links: [eRiver, eWar],
      summary: "O aviso do rio.",
      sections: [{ name: "Detail", fields: [{ label: "Rules", content: "Só quem nasceu na beira ouve" }] }],
    },
    {
      id: eCult, projectId: project.id, title: "Povo das Pontes", category: "culture",
      body: "Os ponteiros casam sobre a água e criam filhos com dois sobrenomes — um de cada margem.",
      links: [eRiver, eCap],
      summary: "O povo das três pontes.",
      sections: [{ name: "Detail", fields: [{ label: "Customs", content: "Casamentos sobre a água" }] }],
    },
    {
      id: eLang, projectId: project.id, title: "Fala do Selo", category: "language",
      body: "A língua dos tribunais: sem pronomes de segunda pessoa — ninguém acusa outra pessoa pelo nome.",
      links: [eLaw],
      summary: "A língua do tribunal.",
      sections: [{ name: "Detail", fields: [{ label: "Common Phrases", content: "“A cera esfriou.” = decisão final" }] }],
    },
    {
      id: eDeity, projectId: project.id, title: "A Mulher do Rio", category: "deity",
      body: "Divindade fluvial do Sarnen. Os capitães poupam o rio em guerra — e ela retribui com avisos.",
      links: [eRiver, eMagic],
      summary: "Divindade do Sarnen.",
      sections: [{ name: "Detail", fields: [{ label: "Domain", content: "O rio, os avisos, as pontes" }] }],
    },
  ];

  const pins: Pin[] = [
    { id: newId("pin"), x: 0.50, y: 0.55, type: "place", color: "#c9a227", label: "Vellmora", entryId: eCap },
    { id: newId("pin"), x: 0.30, y: 0.42, type: "event", color: "#a64b35", label: "Cerco de inverno", entryId: eWar },
    { id: newId("pin"), x: 0.75, y: 0.46, type: "item", color: "#8f7fd0", label: "Onde a Coroa afundou", entryId: eRelic },
    { id: newId("pin"), x: 0.58, y: 0.68, type: "person", color: "#5fa0b8", label: "Tribunal do Selo", entryId: eLaw },
  ];

  const atlases: Atlas[] = [{
    id: newId("atl"),
    projectId: project.id,
    name: "Atlas de Vellmora",
    regions: [
      {
        id: newId("reg"),
        label: "Terras Altas de Sarnen",
        color: "#4d8f5f",
        fillOpacity: 0.28,
        points: [
          { x: 0.16, y: 0.30 }, { x: 0.34, y: 0.22 }, { x: 0.52, y: 0.30 },
          { x: 0.58, y: 0.48 }, { x: 0.44, y: 0.60 }, { x: 0.24, y: 0.54 },
        ],
      },
      {
        id: newId("reg"),
        label: "Meados do Reino",
        color: "#c9a227",
        fillOpacity: 0.28,
        points: [
          { x: 0.42, y: 0.58 }, { x: 0.60, y: 0.52 }, { x: 0.72, y: 0.66 },
          { x: 0.64, y: 0.82 }, { x: 0.44, y: 0.80 }, { x: 0.36, y: 0.70 },
        ],
      },
      {
        id: newId("reg"),
        label: "Costa do Selo",
        color: "#4d6f8f",
        fillOpacity: 0.28,
        points: [
          { x: 0.66, y: 0.30 }, { x: 0.84, y: 0.34 }, { x: 0.86, y: 0.52 },
          { x: 0.74, y: 0.58 }, { x: 0.62, y: 0.50 },
        ],
      },
    ],
    pins,
  }];

  const ch = (heading: string, content: string, order: number): Chapter => ({
    id: newId("ch"), heading, content, order,
  });

  const manuscripts: Manuscript[] = [{
    id: newId("man"),
    projectId: project.id,
    title: "A Coroa e o Rio",
    author: "Renan",
    bindery: { font: "Georgia, serif", trim: "6x9", dropCaps: true, runningHead: true, titlePage: true, toc: true, glossary: false },
    chapters: [
      ch("Arco da Coroa", "Havia um ditado em Vellmora: a cidade se fecha quando o rio fala. Nessa manhã o rio falava baixo, e o vigia de turno esticou o pescoço para sobre as três pontes — nada vindo do sul, só a poeira comum do mercado...", 0),
      ch("O Tribunal do Selo", "A sala dos selos tinha cheiro de cera quente e papel velho. A juíza de cabelos brancos pôs o último documento sobre a mesa e disse: — Rompeu o selo, rompeu o nome. Ainda tem algo a dizer antes que a cera esfrie?...", 1),
      ch("Último Inverno", "No nono mês do cerco, quando os celeiros cantavam vazios, Aldric Vellmor subiu a torre do sino com a Coroa sob o braço. Ninguém combinou, mas a cidade inteira parou de olhar as muralhas e olhou para ele...", 2),
    ],
  }];

  const images: Record<string, string> = {};
  const mapKey = newId("img_map");
  images[mapKey] = buildDemoMapSvg();
  atlases[0].mapImageKey = mapKey;

  // Genealogia Casa Vellmor
  const pSarn = newId("blp"), pAldric = newId("blp"), pMirren = newId("blp"),
    pTalan = newId("blp"), pOra = newId("blp"), pVesper = newId("blp");
  const bloodline: Bloodline = {
    id: newId("bl"),
    projectId: project.id,
    name: "Genealogia Casa Vellmor",
    houses: [
      { id: newId("house"), x: 560, y: 80, name: "Casa Vellmor", subtitle: "Ramo real", isMainBranch: true, isMonarch: true },
      { id: newId("house"), x: 200, y: 80, name: "Ramo de Sarnen", subtitle: "Ramo cadete", isMainBranch: false, isMonarch: false },
    ],
    persons: [
      { id: pSarn, x: 240, y: 180, name: "Sarn Vellmor", title: "Capitão do Sarnen", relationship: "Raiz do ramo cadete", additionalTitles: [], tenures: [{ label: "Capitão da Costa do Selo", from: "1150", to: "1178" }], showBadge: true, badgeText: "†", isTwin: false },
      { id: pAldric, x: 620, y: 180, name: "Aldric Vellmor", title: "Rei Fundador", relationship: "Raiz do ramo real", bio: "Sumiu no nono mês do cerco com a Coroa sob o braço.", additionalTitles: [{ title: "Portador da Coroa" }], tenures: [{ label: "Coroação no Arco", from: "1160", to: "1200" }], showBadge: true, badgeText: "✦", isTwin: false },
      { id: pMirren, x: 430, y: 300, name: "Mirren Vellmor", title: "Juíza do Selo", relationship: "Filha de Aldric", additionalTitles: [], tenures: [{ label: "Tribunal do Selo", from: "1204", to: "" }], showBadge: false, badgeText: "", isTwin: false, connectedTo: pAldric },
      { id: pTalan, x: 430, y: 420, name: "Talan Vellmor", title: "Herdeiro", relationship: "Neto de Aldric", birthDate: "1210-03-12", additionalTitles: [], tenures: [], showBadge: false, badgeText: "", isTwin: false, connectedTo: pMirren, partnerId: pOra },
      { id: pOra, x: 640, y: 420, name: "Ora Sarnen", relationship: "Prima de Talan", title: "Lady da Costa", additionalTitles: [], tenures: [], showBadge: false, badgeText: "", isTwin: false, partnerId: pTalan },
      { id: pVesper, x: 430, y: 540, name: "Vesper Vellmor", title: "Recém-nascida", relationship: "Filha de Talan e Ora", additionalTitles: [], tenures: [], showBadge: true, badgeText: "✧", isTwin: false, connectedTo: pTalan },
    ],
    notes: "O ramo real seguiu por Talan; a linha do rio segue por Ora. O ramo cadete de Sarn guarda a costa.",
  };

  // Rede de facções
  const faVellmor = newId("fa"), faOrvean = newId("fa"), faGuilde = newId("fa"), faHeron = newId("fa");
  const factionWeb: FactionWeb = {
    id: newId("fw"),
    projectId: project.id,
    name: "Rede de Facções — Vellmora",
    notes: "O selo divide tudo: quem aperta a cera, quem derrete.",
    factions: [
      { id: faVellmor, x: 300, y: 200, name: "Casa Vellmor", leader: "Mirren Vellmor", territory: "Vellmora e o Sarnen", goals: "Sustentar a Lei do Selo", description: "A dinastia selada.", color: "#c9a227" },
      { id: faOrvean, x: 700, y: 260, name: "Casa Orvean", leader: "Duque Roval Orvean", territory: "Terras Altas de Sarnen", goals: "Sucessão sem a juíza", color: "#4d8f5f" },
      { id: faGuilde, x: 620, y: 640, name: "Guilde das Ceras", leader: "Colégio dos cinco Sela", territory: "Porto do Sebo", goals: "Monopólio da cera de selo", color: "#4d6f8f" },
      { id: faHeron, x: 240, y: 620, name: "Congregação do Heron", leader: "a Canta-Brân", territory: "Catedral do Heron", goals: "Intercessão pelo rio", color: "#8f4d6f" },
    ],
    connections: [
      { id: newId("co"), fromId: faOrvean, toId: faVellmor, type: "vassal" },
      { id: newId("co"), fromId: faOrvean, toId: faGuilde, type: "rival" },
      { id: newId("co"), fromId: faGuilde, toId: faHeron, type: "trade" },
      { id: newId("co"), fromId: faHeron, toId: faVellmor, type: "ally" },
    ],
  };

  // Calendário do Selo
  const calendars: CustomCalendar[] = [{
    id: newId("cal"),
    projectId: project.id,
    name: "Calendário do Selo",
    era: "Contagem do Arco",
    months: [
      { name: "Ceira", days: 30 }, { name: "Bruma", days: 30 }, { name: "Calor", days: 30 },
      { name: "Sela", days: 30 }, { name: "Ponte", days: 30 }, { name: "Fala", days: 30 },
      { name: "Vela", days: 30 }, { name: "Vau", days: 30 }, { name: "Heron", days: 30 },
      { name: "Ninar", days: 30 }, { name: "Inverno", days: 30 }, { name: "Arco", days: 31 },
    ],
    weekdays: ["Sela", "Ponte", "Cera", "Fala", "Vela", "Vau", "Arco"],
    weekendDays: [5, 6],
    startingWeekday: 1,
    events: {
      "1:0:1": [{ id: newId("ce"), text: "Abertura da Ceira", category: "Festivals", color: "#c9a227" }],
      "1:2:5": [{ id: newId("ce"), text: "Dia da Fundação", category: "Festivals", color: "#c9a227" }],
      "1:3:1": [{ id: newId("ce"), text: "Juramento das Três Pontes", category: "Events", color: "#4d6f8f" }],
      "1:3:22": [{ id: newId("ce"), text: "Feira das Ceras", category: "Events", color: "#4d6f8f" }],
      "1:5:9": [{ id: newId("ce"), text: "Noite da Fala (o rio murmura)", category: "Notes", color: "#8f4d6f" }],
      "1:8:3": [{ id: newId("ce"), text: "Rezeda do Heron-da-Prata", category: "Festivals", color: "#4d8f5f" }],
      "1:10:30": [{ id: newId("ce"), text: "Fecho dos celeiros", category: "Festivals", color: "#c9a227" }],
      "1:11:16": [{ id: newId("ce"), text: "Aniversário do cerco rompido", category: "Notes", color: "#4d8f5f" }],
      "1:11:31": [{ id: newId("ce"), text: "Véspera do Arco", category: "Festivals", color: "#c9a227" }],
    },
    notes: "Doze luas de 30 dias; Arco fecha o ano com 31. A Fala é o mês mais temido.",
  }];

  // Plot board
  const pbActs = [newId("act"), newId("act"), newId("act")];
  const pc: PlotBoard["cards"] = [];
  let wireRefs: { from: number; to: number }[] = [];
  const mkCard = (actIdx: number, x: number, y: number, title: string, pov: string, location: string, locationEntryId: string | undefined, parts: string[], color: string) => {
    const c: PlotBoard["cards"][number] = {
      id: newId("pc"), actId: pbActs[actIdx], x, y, title, pov, location,
      locationEntryId,
      parts: parts.map((text) => ({ id: newId("pp"), text })),
      color,
    };
    pc.push(c);
    return pc.length - 1;
  };
  const i1 = mkCard(0, 80, 120, "O rio fala", "Kellen", "Vellmora", eCap, ["Vigia vê poeira sem mercado", "Boato: a Coroa anda no rio", "Gota de cera no Arco"], "#4d6f8f");
  const i2 = mkCard(0, 380, 300, "Sindicância do selo", "Mirren Vellmor", "Tribunal do Selo", eLaw, ["Selo de Roval quebrado", "A Guilde pressiona por preços", "Pista: cera impura"], "#c9a227");
  const i3 = mkCard(0, 720, 180, "O convite de Orvean", "Ora Sarnen", "Terras Altas", eNat, ["Missiva real ao vale", "Proposta: casar o herdeiro", "Recusa educada"], "#4d8f5f");
  const i4 = mkCard(1, 80, 520, "A fumaça dos anos difíceis", "Kellen", "Fundo do Sarnen", eRelic, ["Mergulho no braço central", "A Coroa não está onde caiu", "Marcas de cordas novas"], "#8f4d6f");
  const i5 = mkCard(1, 380, 620, "O cerco de dentro", "Talan Vellmor", "Muralha sul", eWar, ["Celeiros cantando vazio", "Cera racionada", "Véspera na torre"], "#c9a227");
  const i6 = mkCard(2, 720, 520, "Rompimento de nome", "Roval Orvean", "Portão do Arco", eWar, ["Selo rasgado em público", "A cidade fecha", "Juíza responde com nome"], "#4d8f5f");
  const i7 = mkCard(2, 420, 720, "Coroa entregue", "Aldric (memória)", "Torre do sino", eFounder, ["Paralelo do nono inverno", "Escolha de Vesper", "Fecho no Arco"], "#c9a227");
  wireRefs = [{ from: i1, to: i4 }, { from: i2, to: i6 }, { from: i3, to: i6 }, { from: i4, to: i7 }, { from: i5, to: i7 }, { from: i6, to: i7 }];
  const plotBoards: PlotBoard[] = [{
    id: newId("pb"),
    projectId: project.id,
    name: "Plot Board — A Coroa e o Rio",
    acts: [{ id: pbActs[0], name: "Ato I — A Fala" }, { id: pbActs[1], name: "Ato II — A Cera" }, { id: pbActs[2], name: "Ato III — O Nome" }],
    hasPrologue: true,
    hasEpilogue: true,
    cards: pc,
    wires: wireRefs.map(({ from, to }) => ({ id: newId("pw"), fromCardId: pc[from].id, toCardId: pc[to].id })),
    notes: "Estrutura: o rio fala → a cera acusa → o nome decide. Cards em três atos com prólogo/epílogo aberto.",
  }];

  // Timeline
  const timelines: TimelineWire[] = [{
    id: newId("tw"),
    projectId: project.id,
    name: "Fio dos Selos",
    beads: [
      { id: newId("tb"), x: 700, y: -40, label: "Sarn nasce em Sarnen", dateText: "1148", summary: "Ramo cadete da costa.", color: "#4d6f8f" },
      { id: newId("tb"), x: 900, y: 40, label: "Coroação de Aldric no Arco", dateText: "1160", summary: "Fundação da Casa Vellmor.", color: "#c9a227" },
      { id: newId("tb"), x: 1120, y: -40, label: "Guerra dos Cinco Invernos", dateText: "1200-05-10", summary: "O rio ficou vermelho; a capital resistiu.", color: "#8f4d6f" },
      { id: newId("tb"), x: 1310, y: 40, label: "Aldric entrega a Coroa e some", dateText: "1200", summary: "Nono mês do cerco.", color: "#8f4d6f" },
      { id: newId("tb"), x: 1500, y: -40, label: "Mirren assume o Tribunal", dateText: "1204", summary: "Lei do Selo endurecida.", color: "#4d8f5f" },
      { id: newId("tb"), x: 1700, y: 40, label: "Nascimento de Talan", dateText: "1210-03-12", summary: "Herdeiro do ramo real.", color: "#c9a227" },
    ],
    segments: [
      { id: newId("ts"), fromX: 1080, toX: 1350, label: "Guerra (1200-1204)", lineColor: "#8f4d6f" },
      { id: newId("ts"), fromX: 1350, toX: 1760, label: "Paz do Selo", lineColor: "#4d8f5f" },
    ],
    notes: "Do nascimento de Sarn ao nascimento de Talan; segmentos marcam guerra e paz.",
  }];

  // Juramentos
  const oSela = newId("om"), oOrvean = newId("om"), oGuilde = newId("om"), oHeron = newId("om"),
    oHerdeiro = newId("om"), oVau = newId("om");
  const oathsCharts: OathsChart[] = [{
    id: newId("oc"),
    projectId: project.id,
    name: "Anel de Lealdade — Vellmora",
    members: [
      { id: oSela, name: "Mirren Vellmor", title: "Juíza do Selo", org: "Coroa", notes: "Titular do Anel.", seatStatus: "held", color: "#c9a227" },
      { id: oOrvean, name: "Roval Orvean", title: "Duque das Altas", org: "Casa Orvean", seatStatus: "disputed", color: "#4d8f5f" },
      { id: oGuilde, name: "Sela-Cinco", title: "Colégio da Guilde", org: "Guilde das Ceras", notes: "Uma cadeira por mestre, rotação anual.", seatStatus: "disputed", color: "#4d6f8f" },
      { id: oHeron, name: "a Canta-Brân", title: "Voz da Congregação", org: "Congregação do Heron", seatStatus: "held", color: "#8f4d6f" },
      { id: oHerdeiro, name: "Talan Vellmor", title: "Herdeiro", org: "Coroa", notes: "Assente até a maioridade.", seatStatus: "vacant", color: "#c9a227" },
      { id: oVau, name: "Vau de Baixo", title: "Custódia do Vau", org: "Ramo de Sarnen", notes: "Posto de fronteira do vau.", seatStatus: "vacant", color: "#4d6f8f" },
    ],
    oathLinks: [
      { id: newId("ol"), subordinateId: oOrvean, superiorId: oSela, kind: "primary", status: "strained" },
      { id: newId("ol"), subordinateId: oGuilde, superiorId: oSela, kind: "primary", status: "sworn" },
      { id: newId("ol"), subordinateId: oHeron, superiorId: oSela, kind: "primary", status: "sworn" },
      { id: newId("ol"), subordinateId: oHerdeiro, superiorId: oSela, kind: "joint", status: "broken" },
      { id: newId("ol"), subordinateId: oVau, superiorId: oOrvean, kind: "primary", status: "broken" },
    ],
    notes: "Dois juramentos rompidos desde a guerra; o Anel só fecha quando a Coroa recupera o vau.",
  }];

  // WellSpring
  const wq = newId("wn"), wTalan = newId("wn"), wOra = newId("wn"), wMirren = newId("wn"),
    wTribunal = newId("wn"), wTorre = newId("wn"), wC1 = newId("wn"), wC2 = newId("wn");
  const wellsprings: WellSpring[] = [{
    id: newId("ws"),
    projectId: project.id,
    name: "Poço do Cerco",
    nodes: [
      { id: wq, kind: "question", x: 360, y: 140, text: "Quem recebe a Coroa quando ela volta do rio?" },
      { id: wTalan, kind: "character", x: 200, y: 320, text: "Talan Vellmor — herdeiro que nunca jurou" },
      { id: wOra, kind: "character", x: 520, y: 320, text: "Ora Sarnen — lady da costa de outro nome" },
      { id: wMirren, kind: "character", x: 360, y: 500, text: "Mirren Vellmor — juíza do nome" },
      { id: wTribunal, kind: "setting", x: 140, y: 620, text: "Tribunal do Selo — cera quente e papel velho" },
      { id: wTorre, kind: "setting", x: 580, y: 620, text: "Torre do sino — onde se fecha um cerco" },
      { id: wC1, kind: "conflict", x: 140, y: 220, text: "A Guilde quer o vau; a Coroa não solta o nome" },
      { id: wC2, kind: "conflict", x: 580, y: 220, text: "O nome de casa ou o contrato de cera" },
    ],
    borders: [
      { id: newId("wb"), fromId: wq, toId: wTalan, label: "a Coroa decide" },
      { id: newId("wb"), fromId: wq, toId: wOra, label: "a Coroa decide" },
      { id: newId("wb"), fromId: wTalan, toId: wMirren, label: "sangue" },
      { id: newId("wb"), fromId: wOra, toId: wC2, label: "contrato" },
      { id: newId("wb"), fromId: wTribunal, toId: wMirren, label: "tribunal do nome" },
      { id: newId("wb"), fromId: wTorre, toId: wC1, label: "vigia" },
    ],
    notes: "Núcleo do Ato III: o poço do cerco gira em volta de quem carrega a Coroa com nome limpo.",
  }];

  // Conlang
  const glyph = (char: string, svgPath: string) => ({ id: newId("g"), char, svgPath });
  const glyphs = [
    glyph("s", "M 30 80 Q 50 20 70 80"),
    glyph("a", "M 20 80 L 50 20 L 80 80"),
    glyph("r", "M 50 20 Q 50 60 30 80"),
    glyph("n", "M 20 20 Q 50 80 80 20"),
    glyph("e", "M 25 25 Q 75 50 25 75"),
    glyph("v", "M 20 30 L 80 70"),
    glyph("l", "M 40 15 L 60 85"),
    glyph("o", "M 50 20 Q 90 50 50 80 Q 10 50 50 20"),
    glyph("k", "M 60 20 Q 30 50 70 75"),
  ];
  const word = (wOr: string, meaning: string, pos: string, theme: string) => ({ id: newId("cw"), word: wOr, meaning, pos, theme });
  const words = [
    word("sarnen", "o rio que fala", "noun", "geografia"),
    word("vell", "guardar; manter sob selo", "verb", "ritual"),
    word("oram", "ponte do fundo", "noun", "geografia"),
    word("keth", "cera de pacto", "noun", "ritual"),
    word("brân", "voz; quem canta pelo outro", "noun", "povo"),
    word("heron", "ave que ouve juramento", "noun", "povo"),
    word("selar", "romper o selo de casa", "verb", "ritual"),
    word("orma", "calmo antes de falar", "adjective", "clima"),
    word("vau", "passagem estreita de água", "noun", "geografia"),
    word("torun", "jurado sem cera (verbal)", "adjective", "ritual"),
    word("anvel", "sem guardião", "adjective", "clima"),
    word("kethram", "sindicância do selo", "noun", "tribunal"),
  ];
  const conlangs: Conlang[] = [{
    id: newId("cl"),
    projectId: project.id,
    name: "Fala do Sarnen",
    glyphs,
    words,
    notes: "Consoantes curtas, curvas de quem escreveu com cera morna; s é a mais antiga.",
  }];

  return { projects: [project], entries, atlases, manuscripts, images, bloodlines: [bloodline], factionWebs: [factionWeb], calendars, plotBoards, timelines, oathsCharts, wellsprings, conlangs };
}
