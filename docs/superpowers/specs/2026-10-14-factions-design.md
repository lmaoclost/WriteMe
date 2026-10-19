# Scriptorium — Frações Design (sub-projeto 5c)

Data: 2026-10-14
> Status: em implementação (plan `2026-10-14-factions.md`). Paridade do Bloodline em mecânica; modelo `FactionWeb`.

## 1. Modelo (schema v2, campo opcional)

```ts
type Faction = { id; x; y; name; leader?; territory?; goals?; description?; color }
type FactionConnection = { id; fromId; toId; type: "ally" | "rival" | "vassal" | "trade" | "neutral" }
type FactionWeb = { id; projectId; name; factions: Faction[]; connections: FactionConnection[]; notes: string }
```
`ProjectData.factionWebs?: FactionWeb[]` — validator valida quando presente; parseExport normaliza `?? []`; serialize v2. CONNECTION_STYLES: ally #27ae60 sólida · rival #e74c3c dash "8 4" · vassal #7c5cbf sólida · trade #d4a017 dash "8 4" · neutral #888 dash "4 4" (12 preset colors p/ faction).

## 2. Store (paridade Bloodline)

`addFactionWeb/renameFactionWeb/deleteFactionWeb` + `addFaction(webId, init?)` (name "Fração sem nome", color slate default, x/y 4000) + `updateFaction/moveFaction/deleteFaction` (limpa CONNECTIONS incidentes) + `addConnection(webId, fromId, toId)` (type "neutral", evita self/dupe) + `setConnectionType(id, type)` + `removeConnection(id)` + `setNotes` + history `pushFWHistory/undoFW/redoFW/selectFWHistoryFlags` (snapshot `{ factions, connections }`).

## 3. UI

- `/p/:projectId/factions` (index: lista + criar/excluir) e `/p/:projectId/factions/:id` (canvas). Rail: "Frações" (entre Linhagem e Livro).
- Canvas: **mesmo `usePlane` do bloodline** (movido para `src/ui/usePlane.ts` — refactor compartilhado, imports trocados).
- Nodes: pill 120px com name + leader + cor (dot/borda). Edges: linhas com o estilo por tipo + rótulo do tipo no midpoint (texto pequeno).
- **Connection flow**: pointerdown no HANDLE da borda do node (não no centro) → `pendingConnection` (linha fantasma segue o cursor) → click em outro node → `addConnection` neutral + popover de TIPO no midpoint (5 opções coloridas; click fora cancela? fica até escolher) → `setConnectionType`.
- Panel: name/leader/territory/goals/description (debounced) + color (12 presets) + delete two-step; connection selecionada: painel de TIPO + remover.
- Notepad + undo/redo + find skip (YAGNI — o find do bloodline não tem equivalente necessário aqui).

## 4. Testes

- Schema v2 (factionWebs) + store: paridade BL (CRUD, connections dupe/self guard, set type, undo/redo, cleanup no delete).
- UI: canvas render + connection flow (pointer no handle → click destino → picker aparece → escolhe → edge com dash class) + panel fields + notepad.
- Gate + browser smoke (flow completo) + merge.