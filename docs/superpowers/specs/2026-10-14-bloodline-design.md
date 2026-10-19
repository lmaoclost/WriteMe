# Scriptorium — Bloodline Design (sub-projeto 5b)

Data: 2026-10-14
> Status 2026-10-14: Bloodline implementado (tasks 1–5). Notas: `familyColors` fica fora (cores por casa = 2 flags); notepad position ephemeral.
Escopo: canvas livre editável de genealogia com Casas, Persons, conexões parent/partner/sibling, notepad flutuante, find, undo, cores de família.

## 1. Modelo (schema v2)

```ts
type BloodlinePerson = {
  id; x: number; y: number;              // coords do canvas (px absolutos)
  name: string; suffix?: string;         // "of Vellmor"
  portraitUrl?: string;                  // dataUrl do store (img via key? RULING: portraitUrl DIRECT dataUrl no doc — imagens grandes: store images + key; person guarda portraitKey?: string)
  title?: string; relationship?: string;
  bio?: string;                          // editBackground
  birthDate?: string; deathDate?: string;
  additionalTitles: { title: string }[];  // editAdditionalTitles
  tenures: { label: string; from: string; to: string }[];  // editReigned + tenureLabels
  showBadge: boolean; badgeText: string;
  connectedTo?: Id;                      // parent (linha de sangue)
  siblingId?: Id;                        // sibling ordering group
  partnerId?: Id;                        // linha horizontal
  birthOrder?: number; isTwin: boolean;
}
type BloodlineHouse = { id; x; y; name; subtitle?; isMainBranch; isMonarch }
type Bloodline = { id; projectId; name: string; persons: BloodlinePerson[]; houses: BloodlineHouse[]; notes: string }
```

**Schema v2**: `bloodlines?: Bloodline[]` opcional em `ProjectData`; `validateProjectData` valida QUANDO presente (persons: id/x/y num/name/flags boolean; connectedTo/siblingId/partnerId = id strings; houses shape); `migrate` v1→v2: `bloodlines ?? []`; export/import version 1 ainda aceita (import v1 → migrate roda). STORAGE_KEY mantém `scriptorium.v1`? RULING: persist `version: 2` no `create` — migrate encadeia.

## 2. Rotas/UI

- `/p/:projectId/bloodline` → `BloodlineIndexPage` (lista de bloodlines + criar/excluir) e `/p/:projectId/bloodline/:id` → `BloodlineCanvas` (editor). Rail: item "Linhagem" (entre Cronologia e Livro).
- Canvas: div `.bl-canvas` (overflow hidden) → `.bl-plane` (largura/altura DINÂMICA: `dynamicCanvasSize` = max(person.x, house.x)+4000, arredondado a 1e4) com transform (pan/zoom — port do sistema do Stage SEM img: zoom wheel anchor cursor 0.1–8, pan drag, pinch).
- Persons: nós 64px (portrait round + nome + badge pill) em absolute; drag (limiar 5px; undo push no 1º move — padrão PinLayer); houses: pills maiores com glow quando `isMainBranch`/`isMonarch`.
- Edges: linhas de sangue: person → `connectedTo` (elbow: vertical do filho até o meio do parent — estilizado: linha gold-dim 1.5px); partners: linha dupla (2px) horizontal; sibling: mesma linha horizontal com birthOrder labels? RULING v1: linha reta child→parent + partner simples; birthOrder/twin como texto no card do person.
- Notepad: caixa flutuante (arrastável) com textarea = `notes` do bloodline.
- Find bar: ctrl+f → lista (name/suffix/title/badgeText/additionalTitles, cap 50) → click centra o canvas no person (`pan/zoom` foco).

## 3. Painel person (direita)

name, suffix, portrait (upload fileToDataUrl), title, relationship, bio, birth/death date, additionalTitles (add/remove), tenures (label dropdown 6 labels + from/to), badge (checkbox + text), conexões: parent picker (persons atuais), partner picker, sibling picker + birthOrder number + isTwin checkbox. Undo em cada commit — padrão pushHistory do atlas (história por bloodline: idem ephemeral).

## 4. Store

`addBloodline(projectId, name)`, `renameBloodline`, `deleteBloodline`; persons: `addPerson(bloodlineId, x?, y?)` (default "Sem nome", posição: centro do viewport), `updatePerson` (clone), `movePerson` (sem push; UI push no pointerdown — padrão), `deletePerson` (limpa connectedTo/siblingId/partnerId apontando pra ela); houses: `addHouse/updateHouse/moveHouse/deleteHouse`; `setNotes(id, notes)`; history: mesmo mecanismo (histories + snapshots de bloodlines).

## 5. Erros/edge

- Quota: portraits grandes → fileToDataUrl já cap 2048; putImage read-back.
- Delete com vínculos: linhas somem (ids pendentes ignorados na render).
- Canvas vazio: "Comece pelo fundador — adicione a primeira pessoa."

## 6. Testes (TDD)

- schema v2: validator + migrate 1→2 (fixture export v1 → bloodlines []; import mantém); person edges cleanup no delete (store).
- store: CRUD persons/houses + move + history undo/redo (padrão atlas).
- UI (RTL): canvas render + add person no centro do viewport; drag person (pointer events stub — padrão Stage tests); panel edits (name/badge/tenures add/remove); edges render (2 persons conectados → linha no DOM); find (ctrl+f busca + focus pan); notepad drag + notes persist; houses CRUD/glow.
- Sem e2e browser? Controller faz smoke (drag + edges + find) no preview.

## 7. Fora de escopo

Themes (white/dark), export imagem do canvas, guest mode, register dropdown, twin-dots na linha.