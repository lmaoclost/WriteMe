# Scriptorium — Cronologia Design (sub-projeto 5a)

Data: 2026-10-14
Escopo: timeline REAL de eventos — o `GregorianTimeline` é um form sem persistência (stub); o nosso tem valor funcional: eventos do códex, datas opcionais, ordenação, navegação. Compatível com os outros extras do roadmap (Bloodline, Factions, Calendar custom).

## 1. Modelo (schema v1 + campo opcional)

- `WorldEntry` ganha `date?: string` — formato livre validado: `"YYYY" | "YYYY-MM" | "YYYY-MM-DD"` (regex `^\d{1,4}(-\d{1,2}){0,2}$`; anos negativos com sinal? RULING: prefixo "-" permitido para eras BC: `^-?\d{1,4}(-\d{1,2}){0,2}$`). Campo EXTRA no shape v1: o `validateProjectData` atual não itera unknown keys — NÃO REJEITA o campo; para o export/import, a re-validação também passa. Zero migration.
- Sort key: `dateKey(date) = ano*10000 + mês*100 + dia` com fill de 1 (ano ausente → -inf para "sem data"); negativos ok por aritmética.

## 2. Store

- `updateEntry` já aceita patch qualquer (clona) — `date` entra pelo patch (nada novo).
- Novo: `sanitizeDate(input: string): string | null` (`src/domain/dates.ts`) — valida regex + ranges (mês 1–12, dia 1–31 se presentes); null = inválido.

## 3. Rotas/UI

- `/p/:projectId/timeline` → `TimelinePage` (rail ganha item "Cronologia" entre Códex e Livro).
- Layout: coluna vertical única com linha ao centro; cards ordenados por `dateKey` asc: data display formatada ("1200", "1200 · Maio", "1200 · 5 de Maio") à esquerda da linha, card com título + snippet body (primeira linha) + dot da categoria (event color).
- Eventos SEM data: seção final "Sem data" (lista compacta, dot cinza).
- Click no card → navega ao Códex com a entry selecionada (state select — pattern CX2/LinkPicker).
- Filtro: chip "Só eventos" default; chip "Tudo" (inclui entries de outras categorias COM date).
- Empty: "Nenhum evento com data — edite uma entrada de evento e defina a data."

## 4. Integração códex

- `EntryView`: campo "Data" (input, placeholder "1200 · 1200-05 · 1200-05-10", debounce 300ms): inválido → hint inline vermelho (não bloqueia commit — commit vazio = limpa; inválido NÃO persiste).
- Eyebrow do painel mostra a data quando presente.

## 5. Erros/edge

- Date inválida salva antes do fix → timeline manda para "Sem data"? RULING: o sanitize na render: datas que não batem regex vão pra "Sem data" (com dot de aviso).
- Anos com >4 dígitos: clamp display (mostra como está).
- Mês/dia >12/31: "Sem data".

## 6. Testes (TDD)

- dates: dateKey (positivos/negativos/fills), sanitize (válido/inválido/ranges).
- store: updateEntry date patch persiste (nada novo — smoke).
- UI: render ordenado asc com eventos do seed (seed tem "Guerra..." SEM data — criar 2 events com datas no teste), "Sem data" section, navegação ao códex, filtro chip, empty state.
- rails: link cronologia ativo; placeholder? (novos: timeline não é placeholder).

## 7. Fora de escopo (roadmap extras)

Bloodline (5b), Factions (5c), Calendar custom (5d) — specs próprios; drag-and-drop de cards; eras/navegação por décadas.