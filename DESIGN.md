# Design system — Finanças HL

Palette and typography sourced from the official MDB (Movimento
Democrático Brasileiro) website, https://www.mdb.org.br/ — colors
extracted from that site's published Elementor color kit
(`--e-global-color-*`), fonts from its Google Fonts includes
(Montserrat + Roboto).

## Tokens (`css/styles.css` `:root`)

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#0A9246` | MDB green — buttons, links, active states |
| `--color-primary-dark` | `#12793F` | MDB dark green — hover states, gradients |
| `--color-sidebar` / `--color-sidebar-hover` | `#141414` / `#12793F` | sidebar background |
| `--color-accent` | `#FFBC7D` | sidebar logo underline, active nav indicator |
| `--color-success` | `#10b981` | receitas, aprovado badges |
| `--color-danger` | `#ef4444` | despesas, exclusão |
| `--color-warning` | `#f59e0b` | pendente badges |
| `--color-bg` | `#e8eaed` | page background |
| `--color-border` | `#d9d9d9` | borders |
| `--radius` | `8px` | corners |
| `--font-display` | `'Montserrat', system-ui, sans-serif` | headings, sidebar title, page titles |
| `--font-body` | `'Roboto', system-ui, sans-serif` | body text |

Screen code keeps using the older `--cor-*` aliases (`--cor-primaria`,
`--cor-receita`, `--cor-despesa`, `--cor-fundo`, `--cor-superficie`,
`--cor-borda`, `--cor-texto`, `--cor-texto-suave`, `--sombra`,
`--raio`) — they're defined in terms of the tokens above, so existing
`var(--cor-*)` references don't need to change.

## Components

- Buttons are solid fills: `.btn-primary` (green/white), `.btn-secondary`
  (gray/white), `.btn-danger` (red/white).
- Badges are solid tinted pills with a 4px radius (`.badge-receita`,
  `.badge-despesa`, `.badge-pendente`, `.badge-aprovado`, and the
  ação-specific `.badge-acao-*` set used by Histórico).
- `.page-header` is the shared title + right-aligned actions row used
  at the top of most screens.
- `.card-premium` / `.premium-grid` are the gradient/icon stat cards
  used on Dashboard and Conciliação (see `.bg-gradient-primary`,
  `.border-success|danger|warning|info|purple`).
- `.list-card` / `.btn-icon` are the card-list rows (Lançamentos,
  Contas Bancárias) with icon-only edit/delete actions.
