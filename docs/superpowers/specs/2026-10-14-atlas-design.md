# Scriptorium — Atlas Design (sub-projeto 2)

> Status 2026-10-14: Atlas implementado (tasks 1–9).

Data: 2026-10-14
Escopo: editor de mapa estilo Scriptorium sobre a Foundation — upload de mapa, pintura de regiões poligonais, pins, carve/vizinho/fit por compartilhamento de borda, undo/redo, multi-atlas por projeto. A mecânica é implementada algoritmicamente.

## 1. Rotas e estrutura

| Rota | Conteúdo |
|---|---|
| `/p/:projectId/atlas` | Biblioteca de atlas do projeto (cards: nome, contagens, mini-mapa se `mapImageKey`); criar/excluir |
| `/p/:projectId/atlas/:atlasId` | Editor completo |

`src/features/atlas/`: `AtlasIndexPage.tsx`, `AtlasEditor.tsx`, `stage/` (`Stage.tsx`, `RegionLayer.tsx`, `PinLayer.tsx`, `DrawLayer.tsx`), `panels/` (`RegionPanel.tsx`, `PinPanel.tsx`, `LinkPicker.tsx`), `atlas.css`. Geometria pura em `src/domain/geometry.ts` (testável sem DOM).

## 2. Store (extensão do schema Foundation)

Actions novas (todas com `pushHistory` no atlas afetado):

- `addAtlas(projectId, name): Atlas` · `renameAtlas(id, name)` · `deleteAtlas(id)` (`mapImageKey` liberado)
- `putMapImage(atlasId, dataUrl)` (key `img_map_*`, antiga liberada) · `setAtlasMapFromEntry(atlasId, entryId)` (referencia `images[entry.imageKey]` copiando blob novo — atlas desacopla da entry)
- Regiões: `addRegion(atlasId, inputs)` → `{ id, points[], color: lastColor|"#3498db", fillOpacity: .28, label:"", }`; `updateRegion(regionId, patch)` (points/color/fillOpacity/label/entryId); `deleteRegion(regionId)` (pinta histórico)
- Pins: `addPin(atlasId, x, y)` (type default "place", color default) · `updatePin` · `movePin(pinId, x, y)` (drag; history só no pointerdown) · `deletePin`
- Claim: `claimRemainingArea(atlasId, regionId)` (poly-clipping)

História por atlas: `undoStack/redoStack` (cap 50) com snapshot `{regions, pins}` clonado; `undo/redo` aplicam e re-selecionam se ids vivos; validação `validateProjectData` continua passando (história fica FORA do persist — efêmera).

## 3. Geometria (src/domain/geometry.ts) — algoritmos

- `polygonArea(pts)`: shoelace |½Σ|
- `pointInPolygon(pt, pts)`: ray-casting half-plane
- `regionCentroid(pts)`: centroide real (fórmula signed area; com fallback à média)
- `projectToBoundary(pt, pts): {dist, point, edgeIndex, t}` — projeção ortogonal em cada aresta mínima
- `snapToCarveBorder(pt, regions, scalePx)` → primeiro de: vértice a ≤14px*scale, projeção a ≤8px*scale (constantes de referência)
- `buildCarveChild(parentPts, entry, exit, forward)` — caminhada da borda entre os índices `edgeIndex+t` de entrada e saída com o desenho no meio
- `unionBorderRing(allRegions)` — mapa de arestas por chave arredondada (1e-6); arestas únicas formam o anel externo (p/ fit e vizinho)
- **polygon-clipping** (npm, dep permitida — usa `polygon-clipping`) para `fitRegion` (difference do desenho por todas as regiões) e `claimRemainingArea` (difference da região selecionada pelo union das outras, uma região por polígono resultante)

## 4. Editor

**Stage** (`Stage.tsx`): `div.stage` com `img.stage-map` + `<svg viewBox="0 0 imgW imgH" preserveAspectRatio="none">`; wrapper de transform único (`translate(panX,panY) scale(scale)`). `imgW/imgH` do `naturalWidth/Height` no load. Zoom: wheel com anchor no cursor (`zoomAtPoint`), botões +/−/100%/fit (`fitToContainer`: scale = min(w/imgW, h/imgH), centrado; cap 8x, floor 0.1x). Pan: drag (pointer) com threshold de 5px p/ distinguir clique; touch 1 dedo pan, 2 dedos pinch (`touchDist`).

**Tools**: `select | pin | region` (toolbar vertical). Select: pick região (stacked: `regionsContaining` menor área primeiro; dblclick abre `regionChooser` popover com todas as opções + nenhuma) e pino. Pin: clique cria (sem limite local). Region: desenha.

**Draw (region)**: cliques adicionam vértices (`drawVertices`); preview: polígono atual + linha do cursor; close: clique ≤14px do primeiro vértice (screen px), **Enter**, ou dblclick → `finishRegion` (region tool) / `attemptFinishRegion` com carve path. Escape → `cancelDraw`. Cursor exibido com o último ponto carregado. `drawCursor`/`carveSnapPoint` atualizam em mousemove quando borderShare.

**Carve/vizinho/fit** (toggle trio mutuamente exclusivo, conforme especificado):
- **carve**: desenha sobre uma região maior detectada (`detectCarveParent`: região contendo primeiro vértice, menor área ganha). Extremos snapam; `carvePreview` mostra `carvePreviewPoints` (useForward/backward); botões "usar outro lado"/"descartar"; confirm: child criado com `buildCarveChild(..., forward|backward)`; quando `inside` o **pai é trimado** com o caminho oposto (`parent.points = backward`) — igual `confirmCarve` . O caminho `unionMode`  (união de shapes via borda) NÃO entra nesta fase — carve trima pai, neighbor não; simplificação registrada.
- **neighbor**: borderShare com a região mais próxima (`regionNearestToPoint`), sem trim; child pode sair do lado de fora.
- **fit**: desenho livre; confirm → `difference(desenho, todasAsRegiões)` via polygon-clipping; maior área resultante vira a região ("region fitted to its neighbors — name it" toast).

**Region layer**: `<polygon>` com fill `color`,`fill-opacity regionFillOpacity` (.28 base; .selected +.15 máx .6; hover +.02 máx .62), stroke 2px (3px selected/hover), `vector-effect: non-scaling-stroke`, `pointer-events` por regionShown. Sort: área desc (children por cima). Label por região: `<text>` no `regionCentroid`, fill parchment-dim, `pointer-events: none`, 12px mono. `renderedRegions` exclui as ocultas (`regionShown` = sempre true local).

**Carve parent highlight**: `.carve-parent` (stroke gold dashed?) — simples: stroke-opacity maior + classe.

**Pin layer**: divs absolutos por `pinStyle` (`left = panX + x*imgW*scale`), 18px círculo com anel da cor do pin + ícone por tipo (place=⚑, person=○, event=✦, item=◆, via `<svg>` inline). Hover: tooltip (`hoverCard` popover posicionado) mostrando `label` + título do entry linkado. Selected: anel duplo. Drag: pointerdown não inicia pan quando tool select e pin ativo; `movePin` no move com `pushHistory` só no pointerdown; touch idem. Delete: botão no panel + Delete key em selected.

**Panels** (direita, 280px): mostra `RegionPanel` (nome, cor: picker + `recentColors` (efêmero — módulo singleton), fillOpacity slider 0–1, link picker) ou `PinPanel` (label, tipo 4 escolhas, cor, link picker, deletar). LinkPicker: busca entries do projeto (title case-insensitive substring), lista clicável, cria `entryId`+toast; mostra título atual com X para remover.

**Undo/redo**: botões (disabled por stack) + ctrl+z / ctrl+shift+z|ctrl+y; cap 50. Sem ctrl+s (persist é automática).

**Header**: nome do atlas editável inline (blur/Enter commit), zoom %, botões undo/redo/fit/tools, toggles carve/vizinho/fit, reader? (skip — sem público externo local).

**Empty mapa**: dropzone no editor — arquivo (drag ou picker) → `fileToDataUrl` → `putMapImage`. Também "pegar imagem do códex": popover listando entries com `imageKey` + preview, aplica cópia.

**A11y/floor de qualidade**: foco visível herdado; teclas: Escape cancela, Enter fecha, Delete remove selected; `aria-label` em ícones; reduced-motion respeitado (transições curtas via media query).

## 5. Persistência

Tudo via store Foundation (persist `scriptorium.v1` v1 — arrays regiões/pins crescem dentro do doc Atlas). Sem migration (v1 intocado — novos campos são opcionais no shape). validateProjectData já cobre os shapes de Region/Pin; se novos campos adicionais forem necessários (ex.: `labelPinSize`), eles não entram nesta fase.

## 6. Seed

Seed de Foundation ganha +2 regiões esculpidas por carve? Não — o seed já tem atlas com 3 regiões e 4 pins. Compatibilidade confirmada por testes existentes. Nada a fazer.

## 7. Erro/edge

- Imagem grande demais/quota: try/catch putImage → toast "Não coube no armazenamento local." (storage adapter já ignora setItem falho — o putMap confere `storageHealth().bytes` delta? Simples: re-ler images[key] após put; undefined → rollback + toast).
- Região desenhada área <1e-5 → descartada com toast.
- polygon-clipping failure → toast "Não consegui calcular os encaixes." — estado intacto.
- Carve sem extremos na borda → toast  ("extremidades na borda do Estado").

## 8. Testes (TDD)

- `geometry.test.ts`: shoelace/raycast/centroid/projection/snap/carve-child/union-ring (fixtures numéricas exatas)
- `claiming.test.ts`: fit + claim com polygon-clipping (pontos [x,y] tupla, fechado) — região encaixa gap, claim pega resto
- store: addRegion/update/delete + history (undo/redo, cap 50, seleção inválida clear), movePin no drag, claimRemainingArea
- UI smoke RTL: stage render + fit; draw 3 cliques + Enter → região criada; pin clique + drag; carve snap preview aparece (fixtures com coords); link picker busca
- **Sem** playwright e2e nesta fase (stage visual conferido manualmente no preview + screenshot, como fiz na Foundation)

## 9. Fora de escopo

Temas de atlas (white/dark ), publicação/slugs/público (sem server), claim "No un-regioned area" por estado (claim entra mas o copy exato pode variar), export do atlas como PNG (posso pôr em extras 5), version history UI .