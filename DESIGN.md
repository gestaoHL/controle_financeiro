# Design system — Finanças HL

Light theme ported from the visual language of "Projeto Controle
Financeiro", with its black primary/sidebar swapped for a light-blue
family. Everything else (gold accent, success/danger/warning colors,
neutral background) is kept as in that reference.

## Tokens (`css/styles.css` `:root`)

| Token | Value | Use |
|---|---|---|
| `--color-primary` / `--color-primary-dark` | `#0ea5e9` / `#0284c7` | buttons, links, active states |
| `--color-sidebar` / `--color-sidebar-hover` | `#0ea5e9` / `#0284c7` | sidebar background |
| `--color-accent-gold` | `#f5b700` | sidebar logo, header underline |
| `--color-success` | `#10b981` | receitas, aprovado badges |
| `--color-danger` | `#ef4444` | despesas, exclusão |
| `--color-warning` | `#f59e0b` | pendente badges |
| `--color-bg` | `#e8eaed` | page background |
| `--color-border` | `#d9d9d9` | borders |
| `--radius` | `8px` | corners |

Screen code keeps using the older `--cor-*` aliases (`--cor-primaria`,
`--cor-receita`, `--cor-despesa`, `--cor-fundo`, `--cor-superficie`,
`--cor-borda`, `--cor-texto`, `--cor-texto-suave`, `--sombra`,
`--raio`) — they're defined in terms of the tokens above, so existing
`var(--cor-*)` references don't need to change.

## Components

- Buttons are solid fills: `.btn-primary` (blue/white), `.btn-secondary`
  (gray/white), `.btn-danger` (red/white).
- Badges are solid tinted pills with a 4px radius (`.badge-receita`,
  `.badge-despesa`, `.badge-pendente`, `.badge-aprovado`, and the
  ação-specific `.badge-acao-*` set used by Histórico).
- `.page-header` is the shared title + right-aligned actions row used
  at the top of most screens.
