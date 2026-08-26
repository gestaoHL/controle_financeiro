# Reskin + feature parity with Projeto Controle Financeiro

Date: 2026-08-26

## Context

Commit `cfa2b52` replaced Finanças HL's light teal theme with a dark
"Unicorn Studio" theme. That is being reverted. In its place, the app
adopts the visual language and several functional patterns of the
separate reference codebase `Projeto Controle Financeiro` (a
political-campaign finance app), with the reference's black color
family swapped for light blue. Two decisions were made explicitly by
the user during design: the blue tone is a vibrant sky blue
(`#0ea5e9` family, not pastel or navy), and the reference's "Limpar
Histórico" (wipe audit trail) feature is explicitly NOT ported, to
stay consistent with this project's hardened audit/RLS work.

No database schema or RLS changes are required anywhere in this
spec — `plano_contas` already supports multiple rows per `tipo` with
a `descricao` (used below as "grupo"), which is enough to build
everything described here from existing tables.

## 1. Design system (`css/styles.css`, `index.html`, `login.html`)

Replace the current dark-theme tokens with a token set ported from
the reference project, with black swapped for blue:

- `--color-primary: #0ea5e9`, `--color-primary-dark: #0284c7`
- `--color-sidebar: #0ea5e9`, `--color-sidebar-hover: #0284c7`
- Kept as in the reference: `--color-accent-gold: #f5b700`,
  `--color-success: #10b981`, `--color-danger: #ef4444`,
  `--color-warning: #f59e0b`, `--color-bg: #e8eaed`,
  `--color-white: #ffffff`, `--color-dark: #212121`,
  `--color-gray: #6b7280`, `--color-border: #d9d9d9`,
  `--radius: 8px`, `--shadow: 0 4px 6px -1px rgba(0,0,0,0.1)`.
- Existing app-level aliases (`--cor-primaria`, `--cor-receita`,
  `--cor-despesa`, `--cor-fundo`, `--cor-superficie`, `--cor-borda`,
  `--cor-texto`, `--cor-texto-suave`, `--sombra`, `--raio`) are
  redefined in terms of the tokens above so existing screen code
  (which references `var(--cor-*)`) keeps working unchanged.
- Components ported from the reference: solid-fill buttons (primary
  = blue/white text, secondary = solid gray/white text, danger =
  solid red/white text) replacing the current outline style; solid
  tinted-pill badges replacing the current outlined-dot badges; flat
  sidebar nav rows with a left-border highlight on hover/active;
  plain white top bar with a soft shadow; `.page-header` as a flex
  row (title + right-aligned action buttons) with a bottom border.
- Remove the Google Fonts (`Inter Tight`) `<link>` tags added by the
  dark theme from `index.html` and `login.html`; restore the
  original system font stack.
- `DESIGN.md` is rewritten to document this palette in place of the
  dark-theme description it currently holds.
- `js/dashboard.js`, `js/relatorios.js`, `js/shared/toast.js`,
  `js/conciliacao.js` lose their dark-theme-specific inline colors
  (chart series colors, toast colors, the conciliar-busca inline
  style) and pick up the new blue/gold/success/danger palette
  consistently with the rest of the app.

## 2. Plano de Contas (`js/planoContas.js`)

Restructure from a flat two-type table into grouped cards, matching
the reference's Plano de Contas screen:

- Load `plano_contas` rows (each is a "grupo": `{id, tipo, descricao}`)
  and their `contas` (`{id, plano_id, nome}`).
- Render one section per `tipo` (Receita / Despesa). Within each
  section, one card per grupo: header shows `descricao`, a conta-count
  badge, and edit/delete-grupo buttons; body lists its contas, each
  with edit/delete.
- "Novo Grupo" button opens a modal to create/edit a `plano_contas`
  row (tipo + descricao). Each grupo card has a "+ Conta" action to
  add a `contas` row scoped to that `plano_id`.
- Deleting a grupo cascades to its contas (already enforced by the
  existing `on delete cascade` FK) — keep the existing confirm-dialog
  pattern warning about lançamentos losing their reference.
- Audit log entries (`registrarHistorico`) are kept for every
  create/edit/delete of both grupos and contas.

## 3. Lançamentos (`js/lancamentos.js`)

No functional change. The conta `<select>` (both the list filter and
the modal's account picker) is rendered with `<optgroup>` elements
labeled by the conta's grupo `descricao`, instead of one flat
alphabetical list.

## 4. Orçamento (`js/orcamento.js`)

No functional change to how values are entered/saved. The table
groups rows by grupo: a header row per grupo (label + subtotal
column per month, summed from its contas) precedes that grupo's conta
rows. The reference's separate "exercícios/parâmetros" system is not
ported — out of scope, campaign-specific.

## 5. Conciliação (`js/conciliacao.js`)

Additive changes, existing OFX-import/manual-match/undo mechanics
unchanged:

- A filter bar above the table: a conta `<select>` and a status
  `<select>` (Pendentes / Conciliados / Todos) that filter the
  existing in-memory extrato list before rendering.
- A 4-card KPI summary above the table: Créditos no Extrato, Débitos
  no Extrato, Conciliados (count), Pendentes (count) — computed from
  the currently-loaded/filtered extrato items.
- An "Auto-conciliar" button that attempts to match extrato items to
  unconciliated lançamentos by exact value + date (±1 day tolerance),
  applying matches it's confident in and leaving the rest for manual
  review through the existing match modal. Each auto-match still goes
  through `registrarHistorico` like a manual one.

## 6. Membros (`js/membros.js`)

Visual restyle only (new buttons/badges/cards) — the reference project
has no equivalent multi-user approval/role screen, so no functional
port applies here. Existing approval and role-management logic is
untouched.

## 7. Histórico (`js/historico.js`)

- Add a second filter, ação-type (`Inserção` / `Edição` / `Exclusão` /
  `Importação` / ...), alongside the existing module filter, both
  filtering the same in-memory/query result set.
- Color the "Ação" column with per-type badges (insert/edit/delete/
  import get distinct badge colors) instead of plain text.
- The existing "Quem" column is kept (this app is multi-user, unlike
  the reference). No delete/clear-history action is added.

## 8. Dashboard (`js/dashboard.js`)

Additive to the existing orçado-vs-realizado summary and bar chart:

- Three new KPI cards: Maior Despesa (largest single lançamento of
  type DESPESA in the period), Média Diária (average daily spend),
  Qtd. Lançamentos (count in the period).
- A "Desvio por Grupo de Contas" table: for each grupo (from Plano de
  Contas), orçado vs. realizado totals and the % deviation, reusing
  the grupo model built in section 2.
- The reference's period-toggle/exercício system (Anual/Semestral/
  Trimestral/Mensal/Intervalo with a separate budget-year concept) is
  not ported — out of scope, and the current fixed-year view is kept.

## 9. Relatórios (`js/relatorios.js`)

Additive to the existing per-conta doughnut chart:

- A date-range picker (replacing the current fixed-to-current-year
  scope) plus a tipo filter (Receita/Despesa/Todos).
- A 3-card summary: Receitas, Despesas, Resultado, computed over the
  filtered range.
- An "Evolução Diária" line chart (daily net total across the range)
  next to the existing doughnut.
- A CSV export button for the filtered lançamentos. Print/PDF export
  is explicitly out of scope.

## Testing

No new automated tests are planned beyond what already exists
(`test/formato.test.js`, `test/ofxParser.test.js`) — this is UI/
presentation and read-aggregation work over existing tables with no
new business logic worth unit-testing in isolation. Verification is
manual: load each screen after the change and confirm existing
flows (create/edit/delete lançamento, conta, grupo; OFX import;
conciliação match/undo; membros approval) still work, and that new
elements (grupo cards, filters, KPI cards, charts, CSV export) render
and behave as described above.

## Out of scope

- Any reference-project feature tied to political-campaign compliance
  (parâmetros legais, teto de gastos, prestação de contas eleitoral,
  formulários públicos, veículos/combustível, vouchers, agenda de
  pagamento).
- The reference's multi-exercício/orçamento-parametrizado system.
- "Limpar Histórico" (explicitly declined).
- Any schema or RLS change.
