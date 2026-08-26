# Reskin + Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert the dark "Unicorn Studio" theme to a light theme with a blue/gold palette ported from Projeto Controle Financeiro, and add grouped-account organization plus functional parity (Conciliação, Histórico, Dashboard, Relatórios) to Finanças HL, without any schema/RLS change.

**Architecture:** A CSS token/component rewrite (`css/styles.css`) undoes the dark theme and ports the reference's visual language with black swapped for light blue. A new `js/shared/grupos.js` module centralizes "group contas by plano_contas row" logic, reused by Plano de Contas, Lançamentos, Orçamento, and Dashboard. Each screen gets additive, self-contained changes; new pure computational logic (grouping, auto-match, CSV, dashboard/report calculations) lands in small `js/shared/*.js` modules with `node:test` unit tests, following the existing `formato.js`/`ofxParser.js` pattern. DOM-rendering code has no test harness in this repo, so those tasks are verified by running the existing suite (no regressions) plus a manual check, per the spec's Testing section.

**Tech Stack:** Vanilla ES modules, Supabase JS client, Chart.js (CDN), `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-08-26-reskin-and-feature-parity-design.md`

## Global Constraints

- No database schema or RLS changes anywhere in this plan.
- Blue tone: `#0ea5e9` (primary) / `#0284c7` (primary-dark/hover) — vibrant sky blue, user-approved.
- Kept from the reference project as-is: `--color-accent-gold:#f5b700`, `--color-success:#10b981`, `--color-danger:#ef4444`, `--color-warning:#f59e0b`, `--color-bg:#e8eaed`, `--color-border:#d9d9d9`, `--radius:8px`.
- Do NOT port the reference's "Limpar Histórico" (clear audit trail) feature — explicitly declined by the user.
- Do NOT port the reference's campaign-specific systems (parâmetros legais, exercícios/orçamento-parametrizado, prestação de contas eleitoral, veículos, vouchers, etc.).
- Every existing `var(--cor-*)` reference in screen code must keep working — new tokens are aliased, not renamed at call sites.
- Every create/edit/delete action must keep calling `registrarHistorico(...)` exactly as it does today (audit trail is untouched).

## File Structure

- `css/styles.css` — full rewrite: tokens + components (Task 1).
- `index.html`, `login.html` — remove dark-theme Google Fonts links (Task 1).
- `DESIGN.md` — rewritten to document the new palette (Task 1).
- `js/shared/toast.js` — revert toast colors/icons to the light palette (Task 1).
- `js/shared/grupos.js` (new) — `agruparPorTipoEGrupo(planos, contas)` (Task 2).
- `test/grupos.test.js` (new) (Task 2).
- `js/planoContas.js` — rewritten: grouped cards + grupo CRUD (Task 3).
- `js/lancamentos.js` — modified: `<optgroup>` account pickers (Task 4).
- `js/orcamento.js` — modified: grouped table with subtotal rows (Task 5).
- `js/shared/conciliacaoAuto.js` (new) — `encontrarCorrespondenciasAutomaticas(...)` (Task 6).
- `test/conciliacaoAuto.test.js` (new) (Task 6).
- `js/conciliacao.js` — modified: filter bar, KPI summary, auto-conciliar (Task 7).
- `js/shared/formato.js` — add `classeParaAcao(acao)` (Task 8).
- `js/historico.js` — modified: ação filter + badges (Task 9).
- `js/shared/dashboardCalculos.js` (new) (Task 10).
- `test/dashboardCalculos.test.js` (new) (Task 10).
- `js/dashboard.js` — modified: new KPI cards + desvio-por-grupo table (Task 11).
- `js/shared/relatoriosCalculos.js` (new), `js/shared/csv.js` (new) (Task 12).
- `test/relatoriosCalculos.test.js` (new), `test/csv.test.js` (new) (Task 12).
- `js/relatorios.js` — modified: summary cards, evolução diária chart, CSV export (Task 13).
- Task 14: full-suite run + manual verification pass (all screens, including Membros which needs no code change) + final push.

---

### Task 1: Design system revert (blue/gold palette)

**Files:**
- Modify: `css/styles.css` (full rewrite)
- Modify: `index.html:7-9`
- Modify: `login.html:7-9`
- Modify: `DESIGN.md` (full rewrite)
- Modify: `js/shared/toast.js:12-30`

**Interfaces:**
- Produces: CSS custom properties `--color-primary`, `--color-primary-dark`, `--color-sidebar`, `--color-sidebar-hover`, `--color-accent-gold`, `--color-success`, `--color-danger`, `--color-warning`, `--color-bg`, `--color-white`, `--color-dark`, `--color-gray`, `--color-border`, `--shadow`, `--radius`, plus the existing `--cor-*` aliases (unchanged names, new values) that every screen file already consumes. Produces a new `.page-header` class used by later tasks.

- [ ] **Step 1: Rewrite `css/styles.css`**

```css
:root {
    --color-primary: #0ea5e9;
    --color-primary-dark: #0284c7;
    --color-sidebar: #0ea5e9;
    --color-sidebar-hover: #0284c7;
    --color-accent-gold: #f5b700;
    --color-success: #10b981;
    --color-danger: #ef4444;
    --color-warning: #f59e0b;
    --color-bg: #e8eaed;
    --color-white: #ffffff;
    --color-dark: #212121;
    --color-gray: #6b7280;
    --color-border: #d9d9d9;
    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --radius: 8px;

    --cor-primaria: var(--color-primary);
    --cor-primaria-escura: var(--color-primary-dark);
    --cor-primaria-clara: #e0f2fe;
    --cor-receita: var(--color-success);
    --cor-despesa: var(--color-danger);
    --cor-fundo: var(--color-bg);
    --cor-superficie: var(--color-white);
    --cor-borda: var(--color-border);
    --cor-texto: var(--color-dark);
    --cor-texto-suave: var(--color-gray);
    --sombra: var(--shadow);
    --raio: var(--radius);
}

* { box-sizing: border-box; }

body {
    margin: 0;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--cor-fundo);
    color: var(--cor-texto);
}

.app-container { display: flex; min-height: 100vh; }

.sidebar {
    width: 250px;
    flex-shrink: 0;
    background: var(--color-sidebar);
    color: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    padding: 1.5rem 1.25rem;
    border-bottom: 3px solid;
    border-image: linear-gradient(90deg, var(--color-accent-gold), var(--color-sidebar-hover)) 1;
}
.sidebar-header h2 { margin: 0; font-size: 1.15rem; color: var(--color-accent-gold); }

.sidebar-nav { display: flex; flex-direction: column; padding: 0.75rem 0; flex: 1; overflow-y: auto; }

.nav-link {
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
    padding: 0.65rem 1.25rem;
    font-size: 0.9rem;
    border-left: 4px solid transparent;
    transition: background 0.15s, border-color 0.15s;
}

.nav-link:hover { background: var(--color-sidebar-hover); }
.nav-link.active { background: var(--color-sidebar-hover); border-left-color: var(--color-success); color: #fff; font-weight: 600; }

.sidebar-footer { padding: 1rem 1.25rem; border-top: 1px solid rgba(255,255,255,0.15); }
.user-name { display: block; font-size: 0.85rem; margin-bottom: 0.5rem; }
.btn-logout { width: 100%; padding: 0.5rem; border: none; border-radius: var(--radius); background: rgba(0,0,0,0.2); color: #fff; cursor: pointer; font-family: inherit; }
.btn-logout:hover { background: rgba(0,0,0,0.32); }

.main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.top-header { padding: 1.25rem 2rem; background: var(--cor-superficie); box-shadow: var(--sombra); }
.top-header h2 { margin: 0; }
.page-content { padding: 1.5rem 2rem; flex: 1; }

.page { display: none; }
.page.active { display: block; }

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--cor-borda);
}
.page-header h2, .page-header h3 { margin: 0; }

.card, .summary-card {
    background: var(--cor-superficie);
    border-radius: var(--raio);
    box-shadow: var(--sombra);
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.5rem;
}

.btn-primary, .btn-secondary, .btn-danger {
    padding: 0.55rem 1.1rem;
    border-radius: var(--raio);
    border: none;
    font-size: 0.88rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
}

.btn-primary { background: var(--cor-primaria); color: #fff; }
.btn-primary:hover { background: var(--cor-primaria-escura); }
.btn-secondary { background: var(--color-gray); color: #fff; }
.btn-secondary:hover { background: #54606f; }
.btn-danger { background: var(--cor-despesa); color: #fff; }
.btn-danger:hover { background: #dc2626; }
button:disabled { opacity: 0.6; cursor: not-allowed; }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem; }
.form-group input, .form-group select, .form-group textarea,
input[type="text"], input[type="date"], input[type="number"], select, textarea {
    width: 100%;
    padding: 0.55rem 0.7rem;
    background: var(--cor-superficie);
    color: var(--cor-texto);
    border: 1px solid var(--cor-borda);
    border-radius: var(--raio);
    font-size: 0.9rem;
    font-family: inherit;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus,
input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--cor-primaria);
}

.data-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.data-table th, .data-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--cor-borda); text-align: left; }
.data-table th { color: var(--cor-texto-suave); font-weight: 600; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.04em; }
.data-table tbody tr:hover { background: rgba(14, 165, 233, 0.05); }

.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
.badge-receita { background: #d1fae5; color: #065f46; }
.badge-despesa { background: #fee2e2; color: #991b1b; }
.badge-pendente { background: #fef3c7; color: #92400e; }
.badge-aprovado { background: #d1fae5; color: #065f46; }

.modal { display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.45); align-items: center; justify-content: center; z-index: 1000; }
.modal.show { display: flex; }
.modal-content { background: var(--cor-superficie); border-radius: var(--raio); padding: 1.5rem; max-width: 520px; width: 92%; max-height: 88vh; overflow-y: auto; }

.text-center { text-align: center; }
.text-muted { color: var(--cor-texto-suave); }

.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, var(--cor-primaria-escura), var(--cor-primaria)); }
.login-card { background: var(--cor-superficie); border-radius: var(--raio); padding: 2.5rem; width: 100%; max-width: 380px; box-shadow: var(--sombra); }
.login-card h1 { margin-top: 0; font-size: 1.4rem; color: var(--cor-primaria-escura); }
.alert { display: none; align-items: center; gap: 0.5rem; background: #fee2e2; color: #991b1b; padding: 0.7rem 0.9rem; border-radius: var(--raio); font-size: 0.85rem; margin-bottom: 1rem; }
.btn-loader { display: none; }

@media print {
    .sidebar, .top-header, .btn-primary, .btn-secondary, .btn-danger { display: none !important; }
    .main-content { width: 100%; }
}
```

- [ ] **Step 2: Remove the dark-theme Google Fonts links from `index.html`**

Delete these 3 lines (currently `index.html:7-9`, right after the viewport meta tag and before `<link rel="stylesheet" href="css/styles.css">`):

```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 3: Remove the same 3 lines from `login.html:7-9`**

Same lines, same removal, in `login.html` right before `<link rel="stylesheet" href="css/styles.css">`.

- [ ] **Step 4: Rewrite `DESIGN.md`**

```markdown
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
```

- [ ] **Step 5: Revert toast colors/icons in `js/shared/toast.js`**

Replace the `mostrarToast` function body (lines 12-46) with:

```javascript
export function mostrarToast(mensagem, tipo) {
    const cores = {
        sucesso: { bg: '#ecfdf5', border: '#10b981', texto: '#065f46', icone: '✅' },
        erro:    { bg: '#fef2f2', border: '#ef4444', texto: '#991b1b', icone: '⚠️' }
    };
    const cor = cores[tipo] || cores.sucesso;

    const container = obterContainerToast();
    const toast = document.createElement('div');
    toast.style.cssText = `
        background:${cor.bg}; color:${cor.texto}; border-left:4px solid ${cor.border};
        border-radius:8px; padding:0.85rem 1.1rem; box-shadow:0 4px 16px rgba(0,0,0,0.15);
        font-size:0.88rem; line-height:1.4; max-width:360px; display:flex; align-items:flex-start;
        gap:0.6rem; opacity:0; transform:translateX(20px); transition:opacity 0.25s ease, transform 0.25s ease;
    `;
    const icone = document.createElement('span');
    icone.style.flexShrink = '0';
    icone.textContent = cor.icone;
    const texto = document.createElement('span');
    texto.textContent = mensagem;
    toast.append(icone, texto);
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
```

`obterContainerToast()` and `executarComBloqueio(...)` are unchanged — leave them exactly as they are.

- [ ] **Step 6: Verify nothing broke**

Run: `npm test`
Expected: all existing tests still PASS (this task touches no logic, only styling/markup).

- [ ] **Step 7: Manual check**

Open `login.html` and `index.html` in a browser: confirm the sidebar/buttons are blue (not black or purple/dark), the login card has a blue gradient background, badges are chip-shaped, and no Google Font request appears in the network tab.

- [ ] **Step 8: Commit**

```bash
git add css/styles.css index.html login.html DESIGN.md js/shared/toast.js
git commit -m "feat: revert dark theme to light blue/gold palette"
```

---

### Task 2: `js/shared/grupos.js` — shared grouping utility

**Files:**
- Create: `js/shared/grupos.js`
- Test: `test/grupos.test.js`

**Interfaces:**
- Produces: `agruparPorTipoEGrupo(planos, contas)` → `[{ tipo: 'RECEITA'|'DESPESA', grupos: [{ id, nome, contas: [...] }] }]`, only including tipos that have at least one grupo. `planos` rows: `{ id, tipo, descricao }`. `contas` rows: `{ id, plano_id, nome, ... }`. Used by Tasks 3, 4, 5, 11.

- [ ] **Step 1: Write the failing test**

Create `test/grupos.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorTipoEGrupo } from '../js/shared/grupos.js';

test('agrupa contas por tipo e depois por grupo (plano_contas)', () => {
    const planos = [
        { id: 1, tipo: 'RECEITA', descricao: 'Salários' },
        { id: 2, tipo: 'DESPESA', descricao: 'Casa' }
    ];
    const contas = [
        { id: 10, plano_id: 1, nome: 'Salário' },
        { id: 11, plano_id: 2, nome: 'Aluguel' },
        { id: 12, plano_id: 2, nome: 'Condomínio' }
    ];

    const resultado = agruparPorTipoEGrupo(planos, contas);

    assert.equal(resultado.length, 2);
    assert.equal(resultado[0].tipo, 'RECEITA');
    assert.equal(resultado[0].grupos.length, 1);
    assert.equal(resultado[0].grupos[0].nome, 'Salários');
    assert.equal(resultado[0].grupos[0].contas.length, 1);
    assert.equal(resultado[1].grupos[0].contas.length, 2);
});

test('usa um nome padrão quando o grupo não tem descrição', () => {
    const planos = [{ id: 1, tipo: 'RECEITA', descricao: null }];
    const resultado = agruparPorTipoEGrupo(planos, []);
    assert.equal(resultado[0].grupos[0].nome, 'Receitas');
});

test('omite tipos sem nenhum grupo cadastrado', () => {
    const planos = [{ id: 1, tipo: 'RECEITA', descricao: 'Salários' }];
    const resultado = agruparPorTipoEGrupo(planos, []);
    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].tipo, 'RECEITA');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/grupos.test.js`
Expected: FAIL — `Cannot find module '../js/shared/grupos.js'`

- [ ] **Step 3: Write the implementation**

Create `js/shared/grupos.js`:

```javascript
const TIPOS = ['RECEITA', 'DESPESA'];

export function agruparPorTipoEGrupo(planos, contas) {
    return TIPOS
        .map(tipo => ({
            tipo,
            grupos: planos
                .filter(p => p.tipo === tipo)
                .map(p => ({
                    id: p.id,
                    nome: p.descricao || (tipo === 'RECEITA' ? 'Receitas' : 'Despesas'),
                    contas: contas.filter(c => c.plano_id === p.id)
                }))
        }))
        .filter(secao => secao.grupos.length > 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/grupos.test.js`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add js/shared/grupos.js test/grupos.test.js
git commit -m "feat: add shared grupos.js for grouping contas by plano_contas"
```

### Task 3: Plano de Contas — grouped cards + grupo CRUD

**Files:**
- Modify: `js/planoContas.js` (full rewrite)

**Interfaces:**
- Consumes: `agruparPorTipoEGrupo(planos, contas)` from `js/shared/grupos.js` (Task 2).
- Produces: no exports beyond the existing `montarTela(container)`.

- [ ] **Step 1: Rewrite `js/planoContas.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { escapeHtml } from './shared/formato.js';
import { agruparPorTipoEGrupo } from './shared/grupos.js';

const ROTULO_TIPO = { RECEITA: 'Receita', DESPESA: 'Despesa' };

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <div class="page-header">
                <h3>Plano de Contas</h3>
                <button class="btn-primary" id="btn-novo-grupo">+ Novo Grupo</button>
            </div>
            <div id="plano-contas-secoes"><p class="text-center text-muted">Carregando...</p></div>
        </div>

        <div class="modal" id="modal-grupo">
            <div class="modal-content">
                <h3 id="modal-grupo-titulo">Novo Grupo</h3>
                <form id="form-grupo">
                    <input type="hidden" id="grupo-id">
                    <div class="form-group">
                        <label for="grupo-tipo">Tipo</label>
                        <select id="grupo-tipo" required>
                            <option value="RECEITA">Receita</option>
                            <option value="DESPESA">Despesa</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="grupo-descricao">Nome do grupo</label>
                        <input type="text" id="grupo-descricao" required placeholder="Ex: Salários, Casa, Lazer...">
                    </div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-grupo">Cancelar</button>
                        <button type="submit" class="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="modal" id="modal-conta">
            <div class="modal-content">
                <h3 id="modal-conta-titulo">Nova Conta</h3>
                <form id="form-conta">
                    <input type="hidden" id="conta-id">
                    <input type="hidden" id="conta-grupo-id">
                    <div class="form-group">
                        <label for="conta-nome">Nome da conta</label>
                        <input type="text" id="conta-nome" required>
                    </div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-conta">Cancelar</button>
                        <button type="submit" class="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    let planos = [];
    let contas = [];

    async function carregar() {
        const [{ data: planosData, error: erroPlanos }, { data: contasData, error: erroContas }] = await Promise.all([
            supabase.from('plano_contas').select('*').order('tipo').order('id'),
            supabase.from('contas').select('*').order('nome')
        ]);
        if (erroPlanos || erroContas) {
            mostrarToast('Erro ao carregar plano de contas: ' + (erroPlanos || erroContas).message, 'erro');
            return;
        }
        planos = planosData;
        contas = contasData;
        renderizar();
    }

    function renderizar() {
        const alvo = container.querySelector('#plano-contas-secoes');
        const secoes = agruparPorTipoEGrupo(planos, contas);
        if (!secoes.length) {
            alvo.innerHTML = '<p class="text-center text-muted">Nenhum grupo configurado.</p>';
            return;
        }

        alvo.innerHTML = secoes.map(secao => {
            const cor = secao.tipo === 'RECEITA' ? 'var(--cor-receita)' : 'var(--cor-despesa)';
            const totalContas = secao.grupos.reduce((s, g) => s + g.contas.length, 0);

            const gruposHtml = secao.grupos.map(grupo => `
                <div style="border:1px solid var(--cor-borda); border-radius:var(--raio); overflow:hidden; margin-bottom:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.75rem; padding:0.65rem 1rem; background:var(--cor-fundo); border-bottom:1px solid var(--cor-borda);">
                        <strong>${escapeHtml(grupo.nome)}</strong>
                        <span class="badge" style="background:transparent; border:1px solid ${cor}; color:${cor};">
                            ${grupo.contas.length} ${grupo.contas.length === 1 ? 'conta' : 'contas'}
                        </span>
                        <div style="margin-left:auto; display:flex; gap:0.4rem;">
                            <button class="btn-secondary" data-nova-conta="${grupo.id}">+ Conta</button>
                            <button class="btn-secondary" data-editar-grupo="${grupo.id}">Editar</button>
                            <button class="btn-danger" data-excluir-grupo="${grupo.id}">Excluir</button>
                        </div>
                    </div>
                    ${grupo.contas.length === 0
                        ? '<p class="text-muted" style="padding:0.6rem 1rem; margin:0;">Nenhuma conta cadastrada neste grupo.</p>'
                        : grupo.contas.map(conta => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 1rem; border-top:1px solid var(--cor-borda);">
                                <span>${escapeHtml(conta.nome)}</span>
                                <span style="display:flex; gap:0.4rem;">
                                    <button class="btn-secondary" data-editar-conta="${conta.id}">Editar</button>
                                    <button class="btn-danger" data-excluir-conta="${conta.id}">Excluir</button>
                                </span>
                            </div>
                        `).join('')}
                </div>
            `).join('');

            return `
                <div style="margin-bottom:1.5rem;">
                    <h4 style="margin:0 0 0.5rem; color:${cor};">
                        ${ROTULO_TIPO[secao.tipo]}
                        <span class="text-muted" style="font-weight:400; font-size:0.8rem;">
                            — ${secao.grupos.length} grupo${secao.grupos.length === 1 ? '' : 's'} · ${totalContas} conta${totalContas === 1 ? '' : 's'}
                        </span>
                    </h4>
                    ${gruposHtml}
                </div>
            `;
        }).join('');

        alvo.querySelectorAll('[data-nova-conta]').forEach(btn =>
            btn.addEventListener('click', () => abrirModalConta(null, Number(btn.dataset.novaConta))));
        alvo.querySelectorAll('[data-editar-conta]').forEach(btn =>
            btn.addEventListener('click', () => {
                const conta = contas.find(c => c.id === Number(btn.dataset.editarConta));
                abrirModalConta(conta, conta.plano_id);
            }));
        alvo.querySelectorAll('[data-excluir-conta]').forEach(btn =>
            btn.addEventListener('click', () => excluirConta(Number(btn.dataset.excluirConta))));
        alvo.querySelectorAll('[data-editar-grupo]').forEach(btn =>
            btn.addEventListener('click', () => abrirModalGrupo(planos.find(p => p.id === Number(btn.dataset.editarGrupo)))));
        alvo.querySelectorAll('[data-excluir-grupo]').forEach(btn =>
            btn.addEventListener('click', () => excluirGrupo(Number(btn.dataset.excluirGrupo))));
    }

    function abrirModalGrupo(grupo) {
        container.querySelector('#modal-grupo-titulo').textContent = grupo ? 'Editar Grupo' : 'Novo Grupo';
        container.querySelector('#grupo-id').value = grupo?.id ?? '';
        container.querySelector('#grupo-tipo').value = grupo?.tipo ?? 'RECEITA';
        container.querySelector('#grupo-descricao').value = grupo?.descricao ?? '';
        container.querySelector('#modal-grupo').classList.add('show');
    }

    async function excluirGrupo(id) {
        const grupo = planos.find(p => p.id === id);
        if (!confirm(`Excluir o grupo "${grupo?.descricao ?? grupo?.tipo}"? Todas as contas dele (e a referência delas em lançamentos) serão excluídas.`)) return;
        const { error } = await supabase.from('plano_contas').delete().eq('id', id);
        if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }
        await registrarHistorico('Plano de Contas', 'EXCLUSÃO', `Grupo "${grupo?.descricao ?? grupo?.tipo}" excluído`);
        mostrarToast('Grupo excluído.', 'sucesso');
        carregar();
    }

    function abrirModalConta(conta, grupoId) {
        container.querySelector('#modal-conta-titulo').textContent = conta ? 'Editar Conta' : 'Nova Conta';
        container.querySelector('#conta-id').value = conta?.id ?? '';
        container.querySelector('#conta-grupo-id').value = grupoId;
        container.querySelector('#conta-nome').value = conta?.nome ?? '';
        container.querySelector('#modal-conta').classList.add('show');
    }

    async function excluirConta(id) {
        if (!confirm('Excluir esta conta? Lançamentos ligados a ela perdem a referência.')) return;
        const conta = contas.find(c => c.id === id);
        const { error } = await supabase.from('contas').delete().eq('id', id);
        if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }
        await registrarHistorico('Plano de Contas', 'EXCLUSÃO', `Conta "${conta?.nome}" excluída`);
        mostrarToast('Conta excluída.', 'sucesso');
        carregar();
    }

    container.querySelector('#btn-novo-grupo').addEventListener('click', () => abrirModalGrupo(null));
    container.querySelector('#btn-cancelar-grupo').addEventListener('click', () =>
        container.querySelector('#modal-grupo').classList.remove('show'));
    container.querySelector('#btn-cancelar-conta').addEventListener('click', () =>
        container.querySelector('#modal-conta').classList.remove('show'));

    container.querySelector('#form-grupo').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const id = container.querySelector('#grupo-id').value;
            const tipo = container.querySelector('#grupo-tipo').value;
            const descricao = container.querySelector('#grupo-descricao').value.trim();

            const payload = { tipo, descricao };
            const { error } = id
                ? await supabase.from('plano_contas').update(payload).eq('id', id)
                : await supabase.from('plano_contas').insert(payload);

            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Plano de Contas', id ? 'EDIÇÃO' : 'INSERÇÃO', `Grupo "${descricao}" (${tipo})`);
            mostrarToast('Grupo salvo.', 'sucesso');
            container.querySelector('#modal-grupo').classList.remove('show');
            carregar();
        });
    });

    container.querySelector('#form-conta').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const id = container.querySelector('#conta-id').value;
            const planoId = Number(container.querySelector('#conta-grupo-id').value);
            const nome = container.querySelector('#conta-nome').value.trim();

            const payload = { plano_id: planoId, nome };
            const { error } = id
                ? await supabase.from('contas').update(payload).eq('id', id)
                : await supabase.from('contas').insert(payload);

            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Plano de Contas', id ? 'EDIÇÃO' : 'INSERÇÃO', `Conta "${nome}"`);
            mostrarToast('Conta salva.', 'sucesso');
            container.querySelector('#modal-conta').classList.remove('show');
            carregar();
        });
    });

    await carregar();
}
```

- [ ] **Step 2: Sanity-check the suite**

Run: `npm test`
Expected: PASS (no test covers this file; confirms nothing else broke).

- [ ] **Step 3: Manual verification**

Open the app, log in, go to Plano de Contas:
1. Click "+ Novo Grupo", create a RECEITA grupo named "Teste" → it appears as a new card under "Receita".
2. Click "+ Conta" on that card, add "Conta Teste" → it appears inside the card.
3. Click "Editar" on the grupo, rename it → card title updates.
4. Click "Editar" on the conta, rename it → row updates.
5. Click "Excluir" on the conta, confirm → row disappears.
6. Click "Excluir" on the grupo, confirm → card disappears.
7. Check Histórico afterward: all 6 actions above appear as "Plano de Contas" entries.

- [ ] **Step 4: Commit**

```bash
git add js/planoContas.js
git commit -m "feat: group Plano de Contas into cards with grupo CRUD"
```

---

### Task 4: Lançamentos — grouped account pickers

**Files:**
- Modify: `js/lancamentos.js`

**Interfaces:**
- Consumes: `agruparPorTipoEGrupo(planos, contas)` from `js/shared/grupos.js` (Task 2).
- Produces: no change to `montarTela(container, contexto)` signature or to any `lancamentos` table behavior.

- [ ] **Step 1: Add the import and replace the account-loading logic**

In `js/lancamentos.js`, add to the top imports:

```javascript
import { agruparPorTipoEGrupo } from './shared/grupos.js';
```

Add this constant near `FORMAS_PAGAMENTO`:

```javascript
const ROTULO_TIPO = { RECEITA: 'Receita', DESPESA: 'Despesa' };
```

Replace the `let contas = [];` declaration and the `carregarContas`/`popularSelectContaModal` functions (current lines 76, 79-93) with:

```javascript
    let secoes = [];
    let lancamentos = [];

    async function carregarContas() {
        const [{ data: planosData, error: erroPlanos }, { data: contasData, error: erroContas }] = await Promise.all([
            supabase.from('plano_contas').select('*'),
            supabase.from('contas').select('*').order('nome')
        ]);
        if (erroPlanos || erroContas) {
            mostrarToast('Erro ao carregar contas: ' + (erroPlanos || erroContas).message, 'erro');
            return;
        }
        secoes = agruparPorTipoEGrupo(planosData, contasData);
        popularFiltroConta();
    }

    function popularFiltroConta() {
        const selectFiltro = container.querySelector('#filtro-conta');
        const opcoes = secoes.flatMap(secao => secao.grupos.map(grupo => `
            <optgroup label="${escapeHtml(ROTULO_TIPO[secao.tipo] + ' · ' + grupo.nome)}">
                ${grupo.contas.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')}
            </optgroup>
        `)).join('');
        selectFiltro.innerHTML = '<option value="">Todas as contas</option>' + opcoes;
    }

    function popularSelectContaModal(tipo) {
        const select = container.querySelector('#lancamento-conta');
        const secao = secoes.find(s => s.tipo === tipo);
        select.innerHTML = !secao || !secao.grupos.length
            ? '<option value="" disabled>Nenhuma conta cadastrada para este tipo.</option>'
            : secao.grupos.map(grupo => `
                <optgroup label="${escapeHtml(grupo.nome)}">
                    ${grupo.contas.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')}
                </optgroup>
            `).join('');
    }
```

This removes the old `let contas = [];` declaration entirely — nothing else in the file reads a bare `contas` variable (only `carregarContas`/`popularSelectContaModal` did, and both are replaced above); the modal's account list and the filter dropdown are now driven by `secoes`.

- [ ] **Step 2: Wrap the page header in `.page-header`**

Replace:
```html
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Lançamentos</h3>
                <button class="btn-primary" id="btn-novo-lancamento">+ Novo Lançamento</button>
            </div>
```
with:
```html
            <div class="page-header">
                <h3>Lançamentos</h3>
                <button class="btn-primary" id="btn-novo-lancamento">+ Novo Lançamento</button>
            </div>
```

- [ ] **Step 3: Sanity-check the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Open Lançamentos:
1. The "Todas as contas" filter dropdown shows accounts grouped under headings like "Receita · Salários".
2. Click "+ Novo Lançamento", switch Tipo between Receita/Despesa → the Conta dropdown repopulates, grouped by grupo name, and still lets you pick and save a lançamento normally.
3. Create, edit, and delete a lançamento as before — confirm all three still work and still show up in Histórico.

- [ ] **Step 5: Commit**

```bash
git add js/lancamentos.js
git commit -m "feat: group Lançamentos account pickers by grupo"
```

### Task 5: Orçamento — grouped table with subtotal rows

**Files:**
- Modify: `js/orcamento.js` (full rewrite)

**Interfaces:**
- Consumes: `agruparPorTipoEGrupo(planos, contas)` from `js/shared/grupos.js` (Task 2).
- Produces: no exports beyond the existing `montarTela(container)`.

- [ ] **Step 1: Rewrite `js/orcamento.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarMoeda, escapeHtml } from './shared/formato.js';
import { agruparPorTipoEGrupo } from './shared/grupos.js';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ROTULO_TIPO = { RECEITA: 'Receita', DESPESA: 'Despesa' };

export async function montarTela(container) {
    const anoAtual = new Date().getFullYear();

    container.innerHTML = `
        <div class="card">
            <div class="page-header">
                <h3>Orçamento por conta</h3>
                <div class="form-group" style="margin:0; width:120px;">
                    <select id="orcamento-ano"></select>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table class="data-table" id="orcamento-tabela">
                    <thead><tr><th>Conta</th>${MESES.map(m => `<th>${m}</th>`).join('')}<th>Total</th></tr></thead>
                    <tbody id="orcamento-body"><tr><td colspan="14" class="text-center">Carregando...</td></tr></tbody>
                </table>
            </div>
        </div>
    `;

    const selectAno = container.querySelector('#orcamento-ano');
    for (let ano = anoAtual - 2; ano <= anoAtual + 1; ano++) {
        const opt = document.createElement('option');
        opt.value = ano;
        opt.textContent = ano;
        if (ano === anoAtual) opt.selected = true;
        selectAno.appendChild(opt);
    }
    selectAno.addEventListener('change', carregar);

    let secoes = [];
    let valores = [];

    async function carregar() {
        const ano = Number(selectAno.value);
        const [{ data: planosData, error: erroPlanos }, { data: contasData, error: erroContas }, { data: valoresData, error: erroValores }] = await Promise.all([
            supabase.from('plano_contas').select('*'),
            supabase.from('contas').select('*').order('nome'),
            supabase.from('orcamento_valores').select('*').eq('ano', ano)
        ]);
        if (erroPlanos || erroContas || erroValores) {
            mostrarToast('Erro ao carregar orçamento: ' + (erroPlanos || erroContas || erroValores).message, 'erro');
            return;
        }
        secoes = agruparPorTipoEGrupo(planosData, contasData);
        valores = valoresData;
        renderizar(ano);
    }

    function valorDe(contaId, mes) {
        return valores.find(v => v.conta_id === contaId && v.mes === mes)?.valor ?? 0;
    }

    function totalContaAno(contaId) {
        return MESES.reduce((soma, _, i) => soma + valorDe(contaId, i + 1), 0);
    }

    function linhaConta(conta) {
        const celulas = MESES.map((_, i) => {
            const mes = i + 1;
            return `<td><input type="number" step="0.01" min="0" style="width:80px;"
                data-conta="${conta.id}" data-mes="${mes}" value="${valorDe(conta.id, mes)}"></td>`;
        }).join('');
        return `<tr><td style="padding-left:1.5rem;">${escapeHtml(conta.nome)}</td>${celulas}<td><strong>${formatarMoeda(totalContaAno(conta.id))}</strong></td></tr>`;
    }

    function linhaSubtotalGrupo(grupo) {
        const celulas = MESES.map((_, i) => {
            const mes = i + 1;
            const subtotal = grupo.contas.reduce((s, c) => s + valorDe(c.id, mes), 0);
            return `<td><strong>${formatarMoeda(subtotal)}</strong></td>`;
        }).join('');
        const totalGrupo = grupo.contas.reduce((s, c) => s + totalContaAno(c.id), 0);
        return `<tr style="background:var(--cor-fundo);"><td><strong>${escapeHtml(grupo.nome)}</strong></td>${celulas}<td><strong>${formatarMoeda(totalGrupo)}</strong></td></tr>`;
    }

    function renderizar(ano) {
        const tbody = container.querySelector('#orcamento-body');
        if (!secoes.length) {
            tbody.innerHTML = '<tr><td colspan="14" class="text-center">Nenhuma conta cadastrada.</td></tr>';
            return;
        }
        tbody.innerHTML = secoes.map(secao => `
            <tr><td colspan="14" style="padding-top:1rem; border-bottom:none;"><strong style="color:${secao.tipo === 'RECEITA' ? 'var(--cor-receita)' : 'var(--cor-despesa)'};">${ROTULO_TIPO[secao.tipo]}</strong></td></tr>
            ${secao.grupos.map(grupo => `
                ${linhaSubtotalGrupo(grupo)}
                ${grupo.contas.map(linhaConta).join('')}
            `).join('')}
        `).join('');

        tbody.querySelectorAll('input[data-conta]').forEach(input => {
            input.addEventListener('change', () => salvarValor(ano, input));
        });
    }

    async function salvarValor(ano, input) {
        const contaId = Number(input.dataset.conta);
        const mes = Number(input.dataset.mes);
        const valor = Number(input.value) || 0;

        const { error } = await supabase.from('orcamento_valores')
            .upsert({ ano, mes, conta_id: contaId, valor }, { onConflict: 'ano,mes,conta_id' });

        if (error) { mostrarToast('Erro ao salvar valor: ' + error.message, 'erro'); return; }

        const existente = valores.find(v => v.conta_id === contaId && v.mes === mes);
        if (existente) existente.valor = valor;
        else valores.push({ ano, mes, conta_id: contaId, valor });

        let nomeConta = '';
        secoes.forEach(s => s.grupos.forEach(g => {
            const encontrada = g.contas.find(c => c.id === contaId);
            if (encontrada) nomeConta = encontrada.nome;
        }));
        await registrarHistorico('Orçamento', 'EDIÇÃO', `${nomeConta} — ${MESES[mes - 1]}/${ano}: ${formatarMoeda(valor)}`);
        renderizar(ano);
    }

    await carregar();
}
```

Note: `salvarValor` now re-renders the whole table (via `renderizar(ano)`) instead of patching a single total cell, because subtotal rows also need to update — acceptable given the table's size in a personal-finance app.

- [ ] **Step 2: Sanity-check the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Open Orçamento:
1. Confirm rows are grouped: a bold "Receita"/"Despesa" divider, then a shaded subtotal row per grupo, then its contas indented underneath.
2. Type a value into a month cell for some conta → on blur/change, the conta's Total column, its grupo's subtotal row for that month, and the grupo's Total column all update correctly.
3. Change the year selector → table reloads with that year's values.
4. Check Histórico: the edit appears as an "Orçamento" entry with the correct conta name.

- [ ] **Step 4: Commit**

```bash
git add js/orcamento.js
git commit -m "feat: group Orçamento table by grupo with subtotal rows"
```

---

### Task 6: `js/shared/conciliacaoAuto.js` — auto-match logic

**Files:**
- Create: `js/shared/conciliacaoAuto.js`
- Test: `test/conciliacaoAuto.test.js`

**Interfaces:**
- Produces: `encontrarCorrespondenciasAutomaticas(itensExtrato, lancamentosDisponiveis)` → `[{ itemId, lancamentoId }]`. `itensExtrato` rows: `{ id, tipo: 'CREDITO'|'DEBITO', valor, data, status }`. `lancamentosDisponiveis` rows: `{ id, tipo: 'RECEITA'|'DESPESA', valor, data }`. Only produces unambiguous 1:1 matches (exact value, ±1 day date tolerance); ties are skipped. Used by Task 7.

- [ ] **Step 1: Write the failing test**

Create `test/conciliacaoAuto.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encontrarCorrespondenciasAutomaticas } from '../js/shared/conciliacaoAuto.js';

test('casa um item de crédito com um lançamento de receita de mesmo valor e data', () => {
    const itens = [{ id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [{ id: 100, tipo: 'RECEITA', valor: 150, data: '2026-08-10' }];
    const resultado = encontrarCorrespondenciasAutomaticas(itens, lancamentos);
    assert.deepEqual(resultado, [{ itemId: 1, lancamentoId: 100 }]);
});

test('aceita diferença de até 1 dia na data', () => {
    const itens = [{ id: 1, tipo: 'DEBITO', valor: 80, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [{ id: 100, tipo: 'DESPESA', valor: 80, data: '2026-08-11' }];
    const resultado = encontrarCorrespondenciasAutomaticas(itens, lancamentos);
    assert.deepEqual(resultado, [{ itemId: 1, lancamentoId: 100 }]);
});

test('não casa quando a diferença de data é maior que 1 dia', () => {
    const itens = [{ id: 1, tipo: 'DEBITO', valor: 80, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [{ id: 100, tipo: 'DESPESA', valor: 80, data: '2026-08-13' }];
    assert.deepEqual(encontrarCorrespondenciasAutomaticas(itens, lancamentos), []);
});

test('não casa quando o valor é diferente', () => {
    const itens = [{ id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [{ id: 100, tipo: 'RECEITA', valor: 151, data: '2026-08-10' }];
    assert.deepEqual(encontrarCorrespondenciasAutomaticas(itens, lancamentos), []);
});

test('ignora itens já conciliados', () => {
    const itens = [{ id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'conciliado' }];
    const lancamentos = [{ id: 100, tipo: 'RECEITA', valor: 150, data: '2026-08-10' }];
    assert.deepEqual(encontrarCorrespondenciasAutomaticas(itens, lancamentos), []);
});

test('não casa quando há mais de um candidato ambíguo', () => {
    const itens = [{ id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [
        { id: 100, tipo: 'RECEITA', valor: 150, data: '2026-08-10' },
        { id: 101, tipo: 'RECEITA', valor: 150, data: '2026-08-10' }
    ];
    assert.deepEqual(encontrarCorrespondenciasAutomaticas(itens, lancamentos), []);
});

test('não reutiliza um lançamento já usado em outra correspondência', () => {
    const itens = [
        { id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' },
        { id: 2, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' }
    ];
    const lancamentos = [{ id: 100, tipo: 'RECEITA', valor: 150, data: '2026-08-10' }];
    const resultado = encontrarCorrespondenciasAutomaticas(itens, lancamentos);
    assert.equal(resultado.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/conciliacaoAuto.test.js`
Expected: FAIL — `Cannot find module '../js/shared/conciliacaoAuto.js'`

- [ ] **Step 3: Write the implementation**

Create `js/shared/conciliacaoAuto.js`:

```javascript
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const TOLERANCIA_VALOR = 0.005;

export function encontrarCorrespondenciasAutomaticas(itensExtrato, lancamentosDisponiveis) {
    const usados = new Set();
    const correspondencias = [];

    itensExtrato
        .filter(item => item.status !== 'conciliado')
        .forEach(item => {
            const tipoEsperado = item.tipo === 'CREDITO' ? 'RECEITA' : 'DESPESA';
            const dataItem = new Date(item.data + 'T00:00:00').getTime();

            const candidatos = lancamentosDisponiveis.filter(l =>
                !usados.has(l.id) &&
                l.tipo === tipoEsperado &&
                Math.abs(l.valor - item.valor) < TOLERANCIA_VALOR &&
                Math.abs(new Date(l.data + 'T00:00:00').getTime() - dataItem) <= UM_DIA_MS
            );

            if (candidatos.length === 1) {
                usados.add(candidatos[0].id);
                correspondencias.push({ itemId: item.id, lancamentoId: candidatos[0].id });
            }
        });

    return correspondencias;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/conciliacaoAuto.test.js`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add js/shared/conciliacaoAuto.js test/conciliacaoAuto.test.js
git commit -m "feat: add conciliacaoAuto.js for automatic bank-statement matching"
```

---

### Task 7: Conciliação — filter bar, KPI summary, auto-conciliar

**Files:**
- Modify: `js/conciliacao.js`

**Interfaces:**
- Consumes: `encontrarCorrespondenciasAutomaticas(itensExtrato, lancamentosDisponiveis)` from `js/shared/conciliacaoAuto.js` (Task 6).
- Produces: no change to `montarTela(container)` signature. Reuses the existing `conciliar_extrato` / `desfazer_conciliacao` RPCs — no schema change.

- [ ] **Step 1: Add the import**

At the top of `js/conciliacao.js`, add:

```javascript
import { encontrarCorrespondenciasAutomaticas } from './shared/conciliacaoAuto.js';
```

- [ ] **Step 2: Replace the "Extrato importado" card markup**

Replace this block (current lines 20-30):

```html
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Extrato importado</h3>
                <button class="btn-primary" id="btn-importar-ofx">Importar extrato (.OFX)</button>
            </div>
            <select id="filtro-conta-bancaria" style="margin-bottom:1rem;"><option value="">Todas as contas</option></select>
            <table class="data-table">
                <thead><tr><th>Conta</th><th>Data</th><th>Histórico</th><th>Tipo</th><th>Valor</th><th>Status</th><th></th></tr></thead>
                <tbody id="extrato-body"><tr><td colspan="7" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>
```

with:

```html
        <div class="card">
            <div class="page-header">
                <h3>Extrato importado</h3>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-secondary" id="btn-auto-conciliar">Auto-conciliar</button>
                    <button class="btn-primary" id="btn-importar-ofx">Importar extrato (.OFX)</button>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:1rem; margin-bottom:1rem;">
                <div class="summary-card" style="border-top:4px solid var(--cor-receita); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Créditos no extrato</div>
                    <div id="resumo-creditos" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--cor-despesa); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Débitos no extrato</div>
                    <div id="resumo-debitos" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--cor-primaria); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Conciliados</div>
                    <div id="resumo-conciliados" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--color-warning); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Pendentes</div>
                    <div id="resumo-pendentes" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
            </div>

            <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
                <select id="filtro-conta-bancaria"><option value="">Todas as contas</option></select>
                <select id="filtro-status-extrato">
                    <option value="pendente">Pendentes</option>
                    <option value="conciliado">Conciliados</option>
                    <option value="">Todos</option>
                </select>
            </div>

            <table class="data-table">
                <thead><tr><th>Conta</th><th>Data</th><th>Histórico</th><th>Tipo</th><th>Valor</th><th>Status</th><th></th></tr></thead>
                <tbody id="extrato-body"><tr><td colspan="7" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>
```

Also wrap the "Contas bancárias" card header (current lines 9-13) the same way — replace:
```html
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Contas bancárias</h3>
                <button class="btn-primary" id="btn-nova-conta-bancaria">+ Nova Conta Bancária</button>
            </div>
```
with:
```html
            <div class="page-header">
                <h3>Contas bancárias</h3>
                <button class="btn-primary" id="btn-nova-conta-bancaria">+ Nova Conta Bancária</button>
            </div>
```

- [ ] **Step 3: Replace `renderizarExtrato` and add the summary/filter/auto-match functions**

Replace the existing `renderizarExtrato` function (current lines 135-163) with:

```javascript
    function itensFiltrados() {
        const status = container.querySelector('#filtro-status-extrato').value;
        return status ? extratoItens.filter(it => it.status === status) : extratoItens;
    }

    function atualizarResumo() {
        const creditos = extratoItens.filter(it => it.tipo === 'CREDITO').reduce((s, it) => s + it.valor, 0);
        const debitos = extratoItens.filter(it => it.tipo === 'DEBITO').reduce((s, it) => s + it.valor, 0);
        const conciliados = extratoItens.filter(it => it.status === 'conciliado').length;
        const pendentes = extratoItens.filter(it => it.status === 'pendente').length;

        container.querySelector('#resumo-creditos').textContent = formatarMoeda(creditos);
        container.querySelector('#resumo-debitos').textContent = formatarMoeda(debitos);
        container.querySelector('#resumo-conciliados').textContent = String(conciliados);
        container.querySelector('#resumo-pendentes').textContent = String(pendentes);
    }

    function renderizarExtrato() {
        atualizarResumo();
        const lista = itensFiltrados();

        const tbody = container.querySelector('#extrato-body');
        if (!lista.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum item de extrato para este filtro.</td></tr>';
            return;
        }
        tbody.innerHTML = lista.map(it => {
            const badgeStatus = it.status === 'conciliado'
                ? '<span class="badge badge-aprovado">Conciliado</span>'
                : '<span class="badge badge-pendente">Pendente</span>';
            const acao = it.status === 'conciliado'
                ? `<button class="btn-secondary" data-desfazer="${it.id}">Desfazer</button>`
                : `<button class="btn-primary" data-conciliar="${it.id}">Conciliar</button>`;
            return `<tr>
                <td>${escapeHtml(it.contas_bancarias?.nome ?? '—')}</td>
                <td>${formatarData(it.data)}</td>
                <td>${escapeHtml(it.historico)}</td>
                <td><span class="badge ${it.tipo === 'CREDITO' ? 'badge-receita' : 'badge-despesa'}">${it.tipo === 'CREDITO' ? 'Crédito' : 'Débito'}</span></td>
                <td>${formatarMoeda(it.valor)}</td>
                <td>${badgeStatus}</td>
                <td>${acao}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-conciliar]').forEach(btn =>
            btn.addEventListener('click', () => abrirModalConciliar(Number(btn.dataset.conciliar))));
        tbody.querySelectorAll('[data-desfazer]').forEach(btn =>
            btn.addEventListener('click', () => desfazerConciliacao(Number(btn.dataset.desfazer))));
    }

    async function executarAutoConciliar() {
        const { data: lancamentosDisponiveis, error: erroLanc } = await supabase
            .from('lancamentos').select('id, tipo, valor, data').is('conta_bancaria_id', null);
        if (erroLanc) { mostrarToast('Erro ao buscar lançamentos: ' + erroLanc.message, 'erro'); return; }

        const pendentes = extratoItens.filter(it => it.status === 'pendente');
        const correspondencias = encontrarCorrespondenciasAutomaticas(pendentes, lancamentosDisponiveis);

        if (!correspondencias.length) { mostrarToast('Nenhuma correspondência automática encontrada.', 'sucesso'); return; }

        let sucesso = 0;
        for (const { itemId, lancamentoId } of correspondencias) {
            const { error } = await supabase.rpc('conciliar_extrato', { p_item_id: itemId, p_lancamento_id: lancamentoId });
            if (!error) {
                sucesso++;
                await registrarHistorico('Conciliação Bancária', 'CONCILIAÇÃO', `Item de extrato #${itemId} conciliado automaticamente com lançamento #${lancamentoId}`);
            }
        }

        mostrarToast(`${sucesso} de ${correspondencias.length} transação(ões) conciliada(s) automaticamente.`, 'sucesso');
        await carregarExtrato();
    }
```

- [ ] **Step 4: Wire the new elements**

Near the other event listeners at the bottom of the file (right after `container.querySelector('#filtro-conta-bancaria').addEventListener('change', carregarExtrato);`), add:

```javascript
    container.querySelector('#filtro-status-extrato').addEventListener('change', renderizarExtrato);
    container.querySelector('#btn-auto-conciliar').addEventListener('click', executarAutoConciliar);
```

- [ ] **Step 5: Sanity-check the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Open Conciliação Bancária:
1. The 4 KPI cards show correct créditos/débitos totals and conciliados/pendentes counts for the selected conta filter.
2. Switching the new status filter between Pendentes/Conciliados/Todos changes which rows show, without an extra network fetch (instant).
3. Import an OFX file whose transactions have exact matches (in value, ±1 day) among existing unlinked lançamentos, then click "Auto-conciliar" → matched rows flip to "Conciliado" and a toast reports how many were matched; check Histórico for the "conciliado automaticamente" entries.
4. Manual "Conciliar" flow (search, select, confirm) and "Desfazer" still work exactly as before.

- [ ] **Step 7: Commit**

```bash
git add js/conciliacao.js
git commit -m "feat: add filters, KPI summary, and auto-conciliar to Conciliação"
```

### Task 8: `classeParaAcao` + ação badge CSS

**Files:**
- Modify: `js/shared/formato.js`
- Modify: `test/formato.test.js`
- Modify: `css/styles.css`

**Interfaces:**
- Produces: `classeParaAcao(acao)` → one of `'badge-acao-inserir' | 'badge-acao-editar' | 'badge-acao-excluir' | 'badge-acao-importacao' | 'badge-acao-conciliacao' | 'badge-acao-outro'`. Used by Task 9.

- [ ] **Step 1: Write the failing tests**

Append to `test/formato.test.js` (add to the existing `import` line and add these `test(...)` blocks at the end of the file):

Change the import line from:
```javascript
import { formatarMoeda, formatarData, formatarDataHora, escapeHtml } from '../js/shared/formato.js';
```
to:
```javascript
import { formatarMoeda, formatarData, formatarDataHora, escapeHtml, classeParaAcao } from '../js/shared/formato.js';
```

Append at the end of the file:
```javascript
test('classeParaAcao mapeia cada tipo de ação conhecido para sua classe de badge', () => {
    assert.equal(classeParaAcao('INSERÇÃO'), 'badge-acao-inserir');
    assert.equal(classeParaAcao('EDIÇÃO'), 'badge-acao-editar');
    assert.equal(classeParaAcao('EXCLUSÃO'), 'badge-acao-excluir');
    assert.equal(classeParaAcao('IMPORTAÇÃO'), 'badge-acao-importacao');
    assert.equal(classeParaAcao('CONCILIAÇÃO'), 'badge-acao-conciliacao');
    assert.equal(classeParaAcao('DESCONCILIAÇÃO'), 'badge-acao-conciliacao');
    assert.equal(classeParaAcao('APROVAÇÃO'), 'badge-acao-conciliacao');
});

test('classeParaAcao retorna uma classe neutra para ações desconhecidas', () => {
    assert.equal(classeParaAcao('ALGO_NOVO'), 'badge-acao-outro');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/formato.test.js`
Expected: FAIL — `classeParaAcao is not a function` (or not exported)

- [ ] **Step 3: Implement `classeParaAcao` in `js/shared/formato.js`**

Append to the end of `js/shared/formato.js`:

```javascript
const CLASSES_ACAO = {
    'INSERÇÃO': 'badge-acao-inserir',
    'EDIÇÃO': 'badge-acao-editar',
    'EXCLUSÃO': 'badge-acao-excluir',
    'IMPORTAÇÃO': 'badge-acao-importacao',
    'CONCILIAÇÃO': 'badge-acao-conciliacao',
    'DESCONCILIAÇÃO': 'badge-acao-conciliacao',
    'APROVAÇÃO': 'badge-acao-conciliacao'
};

export function classeParaAcao(acao) {
    return CLASSES_ACAO[acao] ?? 'badge-acao-outro';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/formato.test.js`
Expected: PASS (all tests in the file, old and new)

- [ ] **Step 5: Add the badge CSS classes**

Append to `css/styles.css`, right after the existing `.badge-aprovado { ... }` rule:

```css
.badge-acao-inserir { background: #dbeafe; color: #1e40af; }
.badge-acao-editar { background: #fef3c7; color: #92400e; }
.badge-acao-excluir { background: #fee2e2; color: #991b1b; }
.badge-acao-importacao { background: #e0f2fe; color: #075985; }
.badge-acao-conciliacao { background: #d1fae5; color: #065f46; }
.badge-acao-outro { background: #f3f4f6; color: #374151; }
```

- [ ] **Step 6: Commit**

```bash
git add js/shared/formato.js test/formato.test.js css/styles.css
git commit -m "feat: add classeParaAcao and ação badge colors for Histórico"
```

---

### Task 9: Histórico — ação filter + badges

**Files:**
- Modify: `js/historico.js` (full rewrite)

**Interfaces:**
- Consumes: `classeParaAcao(acao)` from `js/shared/formato.js` (Task 8).
- Produces: no exports beyond the existing `montarTela(container)`. Does NOT add any clear/delete-history action (explicitly declined).

- [ ] **Step 1: Rewrite `js/historico.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarDataHora, escapeHtml, classeParaAcao } from './shared/formato.js';

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <h3 style="margin-top:0;">Histórico de ações</h3>
            <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
                <select id="hist-filtro-modulo"><option value="">Todos os módulos</option></select>
                <select id="hist-filtro-acao"><option value="">Todas as ações</option></select>
            </div>
            <table class="data-table">
                <thead><tr><th>Data/Hora</th><th>Quem</th><th>Módulo</th><th>Ação</th><th>Detalhes</th></tr></thead>
                <tbody id="hist-body"><tr><td colspan="5" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>
    `;

    const MODULOS = ['Plano de Contas', 'Orçamento', 'Lançamentos', 'Conciliação Bancária', 'Membros'];
    const ACOES = ['INSERÇÃO', 'EDIÇÃO', 'EXCLUSÃO', 'IMPORTAÇÃO', 'CONCILIAÇÃO', 'DESCONCILIAÇÃO', 'APROVAÇÃO'];

    const selectModulo = container.querySelector('#hist-filtro-modulo');
    selectModulo.innerHTML += MODULOS.map(m => `<option value="${m}">${m}</option>`).join('');

    const selectAcao = container.querySelector('#hist-filtro-acao');
    selectAcao.innerHTML += ACOES.map(a => `<option value="${a}">${a}</option>`).join('');

    async function carregar() {
        const modulo = selectModulo.value;
        const acao = selectAcao.value;
        let query = supabase.from('historico_auditoria').select('*, perfis(nome)').order('created_at', { ascending: false }).limit(200);
        if (modulo) query = query.eq('modulo', modulo);
        if (acao) query = query.eq('acao', acao);

        const { data, error } = await query;
        if (error) { mostrarToast('Erro ao carregar histórico: ' + error.message, 'erro'); return; }
        renderizar(data);
    }

    function renderizar(itens) {
        const tbody = container.querySelector('#hist-body');
        if (!itens.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum registro encontrado.</td></tr>';
            return;
        }
        tbody.innerHTML = itens.map(it => `<tr>
            <td>${formatarDataHora(it.created_at)}</td>
            <td>${escapeHtml(it.perfis?.nome ?? '—')}</td>
            <td>${escapeHtml(it.modulo ?? '—')}</td>
            <td><span class="badge ${classeParaAcao(it.acao)}">${escapeHtml(it.acao)}</span></td>
            <td>${escapeHtml(it.detalhes ?? '—')}</td>
        </tr>`).join('');
    }

    selectModulo.addEventListener('change', carregar);
    selectAcao.addEventListener('change', carregar);
    await carregar();
}
```

- [ ] **Step 2: Sanity-check the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Open Histórico:
1. The "Ação" column now shows colored chips (e.g. blue for INSERÇÃO, amber for EDIÇÃO, red for EXCLUSÃO) instead of plain text.
2. The new ação filter, used alone or combined with the module filter, narrows the table correctly.
3. The "Quem" column is still present and populated (this app is multi-user, unlike the reference project).
4. No delete/clear-history control exists anywhere on this screen.

- [ ] **Step 4: Commit**

```bash
git add js/historico.js
git commit -m "feat: add ação filter and colored badges to Histórico"
```

---

### Task 10: `js/shared/dashboardCalculos.js`

**Files:**
- Create: `js/shared/dashboardCalculos.js`
- Test: `test/dashboardCalculos.test.js`

**Interfaces:**
- Produces: `calcularMaiorDespesa(lancamentos)` → number; `calcularMediaDiaria(lancamentos, dias)` → number; `diasNoAno(ano)` → 365 or 366; `calcularDesvioPorGrupo(secoes, orcamentoPorConta, realizadoPorConta)` → `[{ tipo, nome, orcado, realizado, desvioPct }]`, where `secoes` is the output shape of `agruparPorTipoEGrupo` (Task 2) and `orcamentoPorConta`/`realizadoPorConta` are `{ [contaId]: totalValor }` maps. Used by Task 11.

- [ ] **Step 1: Write the failing test**

Create `test/dashboardCalculos.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularMaiorDespesa, calcularMediaDiaria, diasNoAno, calcularDesvioPorGrupo } from '../js/shared/dashboardCalculos.js';

test('calcularMaiorDespesa retorna o maior valor entre lançamentos de despesa', () => {
    const lancamentos = [
        { tipo: 'RECEITA', valor: 5000 },
        { tipo: 'DESPESA', valor: 120 },
        { tipo: 'DESPESA', valor: 980 }
    ];
    assert.equal(calcularMaiorDespesa(lancamentos), 980);
});

test('calcularMaiorDespesa retorna 0 quando não há despesas', () => {
    assert.equal(calcularMaiorDespesa([{ tipo: 'RECEITA', valor: 100 }]), 0);
});

test('calcularMediaDiaria divide o total de despesas pelos dias informados', () => {
    const lancamentos = [{ tipo: 'DESPESA', valor: 300 }, { tipo: 'DESPESA', valor: 300 }];
    assert.equal(calcularMediaDiaria(lancamentos, 10), 60);
});

test('calcularMediaDiaria retorna 0 quando dias é 0', () => {
    assert.equal(calcularMediaDiaria([{ tipo: 'DESPESA', valor: 100 }], 0), 0);
});

test('diasNoAno reconhece anos bissextos', () => {
    assert.equal(diasNoAno(2024), 366);
    assert.equal(diasNoAno(2026), 365);
    assert.equal(diasNoAno(1900), 365);
    assert.equal(diasNoAno(2000), 366);
});

test('calcularDesvioPorGrupo soma orçado/realizado por grupo e calcula o desvio percentual', () => {
    const secoes = [{
        tipo: 'DESPESA',
        grupos: [{ id: 1, nome: 'Casa', contas: [{ id: 10 }, { id: 11 }] }]
    }];
    const orcamentoPorConta = { 10: 100, 11: 100 };
    const realizadoPorConta = { 10: 150, 11: 90 };
    const resultado = calcularDesvioPorGrupo(secoes, orcamentoPorConta, realizadoPorConta);
    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].orcado, 200);
    assert.equal(resultado[0].realizado, 240);
    assert.equal(resultado[0].desvioPct, 20);
});

test('calcularDesvioPorGrupo trata orçado zero sem dividir por zero', () => {
    const secoes = [{ tipo: 'DESPESA', grupos: [{ id: 1, nome: 'Casa', contas: [{ id: 10 }] }] }];
    const semRealizado = calcularDesvioPorGrupo(secoes, {}, {});
    assert.equal(semRealizado[0].desvioPct, 0);
    const comRealizado = calcularDesvioPorGrupo(secoes, {}, { 10: 50 });
    assert.equal(comRealizado[0].desvioPct, 100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/dashboardCalculos.test.js`
Expected: FAIL — `Cannot find module '../js/shared/dashboardCalculos.js'`

- [ ] **Step 3: Write the implementation**

Create `js/shared/dashboardCalculos.js`:

```javascript
export function calcularMaiorDespesa(lancamentos) {
    const valores = lancamentos.filter(l => l.tipo === 'DESPESA').map(l => l.valor);
    return valores.length ? Math.max(...valores) : 0;
}

export function calcularMediaDiaria(lancamentos, dias) {
    if (!dias) return 0;
    const totalDespesas = lancamentos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + l.valor, 0);
    return totalDespesas / dias;
}

export function diasNoAno(ano) {
    return ((ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0) ? 366 : 365;
}

export function calcularDesvioPorGrupo(secoes, orcamentoPorConta, realizadoPorConta) {
    return secoes.flatMap(secao => secao.grupos.map(grupo => {
        const orcado = grupo.contas.reduce((s, c) => s + (orcamentoPorConta[c.id] ?? 0), 0);
        const realizado = grupo.contas.reduce((s, c) => s + (realizadoPorConta[c.id] ?? 0), 0);
        const desvioPct = orcado > 0 ? ((realizado - orcado) / orcado) * 100 : (realizado > 0 ? 100 : 0);
        return { tipo: secao.tipo, nome: grupo.nome, orcado, realizado, desvioPct };
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/dashboardCalculos.test.js`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add js/shared/dashboardCalculos.js test/dashboardCalculos.test.js
git commit -m "feat: add dashboardCalculos.js for KPI and desvio-por-grupo math"
```

### Task 11: Dashboard — new KPI cards + desvio-por-grupo table

**Files:**
- Modify: `js/dashboard.js` (full rewrite)

**Interfaces:**
- Consumes: `agruparPorTipoEGrupo` (Task 2); `calcularMaiorDespesa`, `calcularMediaDiaria`, `diasNoAno`, `calcularDesvioPorGrupo` (Task 10).
- Produces: no exports beyond the existing `montarTela(container)`. Also fixes the dark-theme chart colors left over from `cfa2b52`.

- [ ] **Step 1: Rewrite `js/dashboard.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarMoeda, escapeHtml } from './shared/formato.js';
import { agruparPorTipoEGrupo } from './shared/grupos.js';
import { calcularMaiorDespesa, calcularMediaDiaria, diasNoAno, calcularDesvioPorGrupo } from './shared/dashboardCalculos.js';

let grafico = null;

export async function montarTela(container) {
    const anoAtual = new Date().getFullYear();

    container.innerHTML = `
        <div class="card">
            <div class="page-header">
                <h3>Execução do ano</h3>
                <select id="dash-ano"></select>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem;">
                <div class="summary-card" style="border-top:4px solid var(--cor-receita);">
                    <div class="text-muted" style="font-size:0.75rem; text-transform:uppercase;">Receitas</div>
                    <div style="display:flex; justify-content:space-between; margin-top:0.5rem;">
                        <div><div class="text-muted" style="font-size:0.7rem;">Orçado</div><div id="dash-orc-receita" style="font-weight:800;">—</div></div>
                        <div style="text-align:right;"><div class="text-muted" style="font-size:0.7rem;">Realizado</div><div id="dash-real-receita" style="font-weight:800; color:var(--cor-receita);">—</div></div>
                    </div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--cor-despesa);">
                    <div class="text-muted" style="font-size:0.75rem; text-transform:uppercase;">Despesas</div>
                    <div style="display:flex; justify-content:space-between; margin-top:0.5rem;">
                        <div><div class="text-muted" style="font-size:0.7rem;">Orçado</div><div id="dash-orc-despesa" style="font-weight:800;">—</div></div>
                        <div style="text-align:right;"><div class="text-muted" style="font-size:0.7rem;">Realizado</div><div id="dash-real-despesa" style="font-weight:800; color:var(--cor-despesa);">—</div></div>
                    </div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--cor-primaria);">
                    <div class="text-muted" style="font-size:0.75rem; text-transform:uppercase;">Saldo do ano</div>
                    <div id="dash-saldo" style="font-weight:800; font-size:1.3rem; margin-top:0.5rem;">—</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:1rem;">
                <div class="summary-card" style="margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Maior despesa</div>
                    <div id="dash-maior-despesa" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Média diária de despesas</div>
                    <div id="dash-media-diaria" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Qtd. de lançamentos</div>
                    <div id="dash-qtd-lancamentos" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-top:0;">Receitas × Despesas por mês</h3>
            <canvas id="dash-grafico" height="90"></canvas>
        </div>

        <div class="card">
            <h3 style="margin-top:0;">Desvio por grupo de contas</h3>
            <table class="data-table">
                <thead><tr><th>Grupo</th><th>Orçado</th><th>Realizado</th><th>Desvio</th></tr></thead>
                <tbody id="dash-desvio-body"><tr><td colspan="4" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>
    `;

    const selectAno = container.querySelector('#dash-ano');
    for (let ano = anoAtual - 2; ano <= anoAtual + 1; ano++) {
        const opt = document.createElement('option');
        opt.value = ano;
        opt.textContent = ano;
        if (ano === anoAtual) opt.selected = true;
        selectAno.appendChild(opt);
    }
    selectAno.addEventListener('change', () => carregar(Number(selectAno.value)));

    async function carregar(ano) {
        const inicio = `${ano}-01-01`;
        const fim = `${ano}-12-31`;

        const [{ data: lancamentos, error: erroLanc }, { data: orcamentos, error: erroOrc }, { data: planos, error: erroPlanos }, { data: contas, error: erroContas }] = await Promise.all([
            supabase.from('lancamentos').select('tipo, valor, data, conta_id').gte('data', inicio).lte('data', fim),
            supabase.from('orcamento_valores').select('*, contas(plano_contas(tipo))').eq('ano', ano),
            supabase.from('plano_contas').select('*'),
            supabase.from('contas').select('*')
        ]);

        if (erroLanc || erroOrc || erroPlanos || erroContas) {
            mostrarToast('Erro ao carregar dashboard: ' + (erroLanc || erroOrc || erroPlanos || erroContas).message, 'erro');
            return;
        }

        const realReceita = lancamentos.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + l.valor, 0);
        const realDespesa = lancamentos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + l.valor, 0);
        const orcReceita = orcamentos.filter(o => o.contas?.plano_contas?.tipo === 'RECEITA').reduce((s, o) => s + o.valor, 0);
        const orcDespesa = orcamentos.filter(o => o.contas?.plano_contas?.tipo === 'DESPESA').reduce((s, o) => s + o.valor, 0);

        container.querySelector('#dash-orc-receita').textContent = formatarMoeda(orcReceita);
        container.querySelector('#dash-real-receita').textContent = formatarMoeda(realReceita);
        container.querySelector('#dash-orc-despesa').textContent = formatarMoeda(orcDespesa);
        container.querySelector('#dash-real-despesa').textContent = formatarMoeda(realDespesa);
        const saldo = realReceita - realDespesa;
        const saldoEl = container.querySelector('#dash-saldo');
        saldoEl.textContent = formatarMoeda(saldo);
        saldoEl.style.color = saldo >= 0 ? 'var(--cor-receita)' : 'var(--cor-despesa)';

        const hoje = new Date();
        const diasDoPeriodo = ano === anoAtual
            ? Math.ceil((hoje - new Date(ano, 0, 0)) / 86400000)
            : diasNoAno(ano);

        container.querySelector('#dash-maior-despesa').textContent = formatarMoeda(calcularMaiorDespesa(lancamentos));
        container.querySelector('#dash-media-diaria').textContent = formatarMoeda(calcularMediaDiaria(lancamentos, diasDoPeriodo));
        container.querySelector('#dash-qtd-lancamentos').textContent = String(lancamentos.length);

        const secoes = agruparPorTipoEGrupo(planos, contas);
        const orcamentoPorConta = {};
        orcamentos.forEach(o => { orcamentoPorConta[o.conta_id] = (orcamentoPorConta[o.conta_id] ?? 0) + o.valor; });
        const realizadoPorConta = {};
        lancamentos.forEach(l => { if (l.conta_id) realizadoPorConta[l.conta_id] = (realizadoPorConta[l.conta_id] ?? 0) + l.valor; });

        renderizarDesvioPorGrupo(calcularDesvioPorGrupo(secoes, orcamentoPorConta, realizadoPorConta));
        renderizarGrafico(lancamentos);
    }

    function renderizarDesvioPorGrupo(linhas) {
        const tbody = container.querySelector('#dash-desvio-body');
        if (!linhas.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum grupo configurado.</td></tr>';
            return;
        }
        tbody.innerHTML = linhas.map(l => {
            const cor = l.tipo === 'RECEITA' ? 'var(--cor-receita)' : 'var(--cor-despesa)';
            const sinalDesvio = l.desvioPct > 0 ? '+' : '';
            return `<tr>
                <td>${escapeHtml(l.nome)}</td>
                <td>${formatarMoeda(l.orcado)}</td>
                <td style="color:${cor};">${formatarMoeda(l.realizado)}</td>
                <td>${sinalDesvio}${l.desvioPct.toFixed(1)}%</td>
            </tr>`;
        }).join('');
    }

    function renderizarGrafico(lancamentos) {
        const receitasPorMes = Array(12).fill(0);
        const despesasPorMes = Array(12).fill(0);
        lancamentos.forEach(l => {
            const mes = new Date(l.data + 'T00:00:00').getMonth();
            if (l.tipo === 'RECEITA') receitasPorMes[mes] += l.valor;
            else despesasPorMes[mes] += l.valor;
        });

        if (grafico) grafico.destroy();
        grafico = new Chart(container.querySelector('#dash-grafico'), {
            type: 'bar',
            data: {
                labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
                datasets: [
                    { label: 'Receitas', data: receitasPorMes, backgroundColor: '#10b981' },
                    { label: 'Despesas', data: despesasPorMes, backgroundColor: '#ef4444' }
                ]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
    }

    await carregar(anoAtual);
}
```

- [ ] **Step 2: Sanity-check the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Open Dashboard:
1. The bar chart renders in green/red (not the leftover dark-theme purple/lavender), with default (light) axis and legend colors readable on the white card background.
2. "Maior Despesa", "Média Diária de Despesas", and "Qtd. de Lançamentos" cards show plausible numbers for the selected year (média diária should reflect only-elapsed-days for the current year, and full-year days for past years).
3. The "Desvio por grupo de contas" table lists every grupo from Plano de Contas with correct orçado/realizado sums and a sensible desvio % (positive when overspent, and 0% for a grupo with no orçado and no realizado).
4. Switching the year selector updates everything, including the new cards and table.

- [ ] **Step 4: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: add KPI cards and desvio-por-grupo table to Dashboard"
```

---

### Task 12: Relatórios pure-logic utilities

**Files:**
- Create: `js/shared/relatoriosCalculos.js`
- Create: `js/shared/csv.js`
- Test: `test/relatoriosCalculos.test.js`
- Test: `test/csv.test.js`

**Interfaces:**
- Produces: `calcularResumoPeriodo(lancamentos)` → `{ receitas, despesas, resultado }`; `agruparEvolucaoDiaria(lancamentos)` → `[{ data, saldo }]` sorted ascending by `data`, `saldo` = signed daily net (receita positive, despesa negative). Produces `paraCSV(colunas, linhas)` → CSV string, `colunas`: `[{ chave, rotulo }]`, `linhas`: array of plain objects; fields containing a comma, quote, or newline are quoted per RFC4180 (internal quotes doubled). Used by Task 13.

- [ ] **Step 1: Write the failing tests**

Create `test/relatoriosCalculos.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularResumoPeriodo, agruparEvolucaoDiaria } from '../js/shared/relatoriosCalculos.js';

test('calcularResumoPeriodo soma receitas, despesas e calcula o resultado', () => {
    const lancamentos = [
        { tipo: 'RECEITA', valor: 1000 },
        { tipo: 'DESPESA', valor: 300 },
        { tipo: 'DESPESA', valor: 200 }
    ];
    assert.deepEqual(calcularResumoPeriodo(lancamentos), { receitas: 1000, despesas: 500, resultado: 500 });
});

test('calcularResumoPeriodo lida com lista vazia', () => {
    assert.deepEqual(calcularResumoPeriodo([]), { receitas: 0, despesas: 0, resultado: 0 });
});

test('agruparEvolucaoDiaria soma o saldo líquido por dia e ordena por data', () => {
    const lancamentos = [
        { tipo: 'DESPESA', valor: 50, data: '2026-08-11' },
        { tipo: 'RECEITA', valor: 100, data: '2026-08-10' },
        { tipo: 'DESPESA', valor: 30, data: '2026-08-10' }
    ];
    assert.deepEqual(agruparEvolucaoDiaria(lancamentos), [
        { data: '2026-08-10', saldo: 70 },
        { data: '2026-08-11', saldo: -50 }
    ]);
});
```

Create `test/csv.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paraCSV } from '../js/shared/csv.js';

test('paraCSV monta cabeçalho e linhas separados por vírgula', () => {
    const colunas = [{ chave: 'nome', rotulo: 'Nome' }, { chave: 'valor', rotulo: 'Valor' }];
    const linhas = [{ nome: 'Aluguel', valor: '1500' }, { nome: 'Mercado', valor: '400' }];
    assert.equal(paraCSV(colunas, linhas), 'Nome,Valor\r\nAluguel,1500\r\nMercado,400');
});

test('paraCSV retorna apenas o cabeçalho quando não há linhas', () => {
    const colunas = [{ chave: 'nome', rotulo: 'Nome' }];
    assert.equal(paraCSV(colunas, []), 'Nome');
});

test('paraCSV coloca entre aspas um campo que contém vírgula', () => {
    const colunas = [{ chave: 'historico', rotulo: 'Histórico' }];
    const linhas = [{ historico: 'Mercado, feira e padaria' }];
    assert.equal(paraCSV(colunas, linhas), 'Histórico\r\n"Mercado, feira e padaria"');
});

test('paraCSV escapa aspas internas dobrando-as', () => {
    const colunas = [{ chave: 'historico', rotulo: 'Histórico' }];
    const linhas = [{ historico: 'Pagamento "extra"' }];
    assert.equal(paraCSV(colunas, linhas), 'Histórico\r\n"Pagamento ""extra"""');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/relatoriosCalculos.test.js test/csv.test.js`
Expected: FAIL — both modules missing.

- [ ] **Step 3: Write the implementations**

Create `js/shared/relatoriosCalculos.js`:

```javascript
export function calcularResumoPeriodo(lancamentos) {
    const receitas = lancamentos.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + l.valor, 0);
    const despesas = lancamentos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + l.valor, 0);
    return { receitas, despesas, resultado: receitas - despesas };
}

export function agruparEvolucaoDiaria(lancamentos) {
    const porDia = {};
    lancamentos.forEach(l => {
        const sinal = l.tipo === 'RECEITA' ? 1 : -1;
        porDia[l.data] = (porDia[l.data] ?? 0) + sinal * l.valor;
    });
    return Object.keys(porDia).sort().map(data => ({ data, saldo: porDia[data] }));
}
```

Create `js/shared/csv.js`:

```javascript
function escapeCampoCSV(valor) {
    const texto = String(valor ?? '');
    if (/[",\n]/.test(texto)) {
        return '"' + texto.replace(/"/g, '""') + '"';
    }
    return texto;
}

export function paraCSV(colunas, linhas) {
    const cabecalho = colunas.map(c => escapeCampoCSV(c.rotulo)).join(',');
    const corpo = linhas.map(linha => colunas.map(c => escapeCampoCSV(linha[c.chave])).join(','));
    return [cabecalho, ...corpo].join('\r\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/relatoriosCalculos.test.js test/csv.test.js`
Expected: PASS (3/3 and 4/4)

- [ ] **Step 5: Commit**

```bash
git add js/shared/relatoriosCalculos.js js/shared/csv.js test/relatoriosCalculos.test.js test/csv.test.js
git commit -m "feat: add relatoriosCalculos.js and csv.js utilities"
```

---

### Task 13: Relatórios — summary cards, evolução diária, CSV export

**Files:**
- Modify: `js/relatorios.js` (full rewrite)

**Interfaces:**
- Consumes: `calcularResumoPeriodo`, `agruparEvolucaoDiaria` (Task 12); `paraCSV` (Task 12).
- Produces: no exports beyond the existing `montarTela(container)`. The existing date-range (`#rel-inicio`/`#rel-fim`) and tipo filter already exist in this file and are NOT being added — only the summary cards, the second chart, and CSV export are new.

- [ ] **Step 1: Rewrite `js/relatorios.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarMoeda, formatarData, escapeHtml } from './shared/formato.js';
import { calcularResumoPeriodo, agruparEvolucaoDiaria } from './shared/relatoriosCalculos.js';
import { paraCSV } from './shared/csv.js';

let grafico = null;
let graficoEvolucao = null;
let ultimoResultado = [];

export async function montarTela(container) {
    const hoje = new Date().toISOString().slice(0, 10);
    const inicioAno = hoje.slice(0, 4) + '-01-01';

    container.innerHTML = `
        <div class="card">
            <div class="page-header">
                <h3>Análise por categoria</h3>
                <button class="btn-secondary" id="btn-exportar-csv">Exportar CSV</button>
            </div>
            <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap; margin-bottom:1rem;">
                <div class="form-group" style="margin:0;"><label for="rel-inicio">De</label><input type="date" id="rel-inicio" value="${inicioAno}"></div>
                <div class="form-group" style="margin:0;"><label for="rel-fim">Até</label><input type="date" id="rel-fim" value="${hoje}"></div>
                <div class="form-group" style="margin:0;">
                    <label for="rel-tipo">Tipo</label>
                    <select id="rel-tipo"><option value="DESPESA">Despesas</option><option value="RECEITA">Receitas</option></select>
                </div>
                <button class="btn-primary" id="btn-gerar-relatorio">Gerar</button>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:1rem; margin-bottom:1rem;">
                <div class="summary-card" style="border-top:4px solid var(--cor-receita); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Receitas no período</div>
                    <div id="rel-resumo-receitas" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--cor-despesa); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Despesas no período</div>
                    <div id="rel-resumo-despesas" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--cor-primaria); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Resultado</div>
                    <div id="rel-resumo-resultado" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
            </div>

            <canvas id="rel-grafico" height="100"></canvas>
        </div>

        <div class="card">
            <h3 style="margin-top:0;">Evolução diária</h3>
            <canvas id="rel-grafico-evolucao" height="90"></canvas>
        </div>

        <div class="card">
            <h3 style="margin-top:0;">Totais por conta</h3>
            <table class="data-table">
                <thead><tr><th>Conta</th><th>Total</th><th>% do período</th></tr></thead>
                <tbody id="rel-tabela-body"><tr><td colspan="3" class="text-center">Escolha um período e clique em Gerar.</td></tr></tbody>
            </table>
        </div>
    `;

    async function gerar() {
        const inicio = container.querySelector('#rel-inicio').value;
        const fim = container.querySelector('#rel-fim').value;
        const tipo = container.querySelector('#rel-tipo').value;

        const [{ data: doTipo, error: erroTipo }, { data: doPeriodo, error: erroPeriodo }] = await Promise.all([
            supabase.from('lancamentos').select('data, valor, tipo, contas(nome)').eq('tipo', tipo).gte('data', inicio).lte('data', fim),
            supabase.from('lancamentos').select('data, valor, tipo').gte('data', inicio).lte('data', fim)
        ]);

        if (erroTipo || erroPeriodo) { mostrarToast('Erro ao gerar relatório: ' + (erroTipo || erroPeriodo).message, 'erro'); return; }

        ultimoResultado = doTipo;

        const totalPorConta = {};
        doTipo.forEach(l => {
            const nome = l.contas?.nome ?? 'Sem conta';
            totalPorConta[nome] = (totalPorConta[nome] ?? 0) + l.valor;
        });

        const contas = Object.keys(totalPorConta).sort((a, b) => totalPorConta[b] - totalPorConta[a]);
        const totalGeral = contas.reduce((s, c) => s + totalPorConta[c], 0);

        renderizarTabela(contas, totalPorConta, totalGeral);
        renderizarGrafico(contas, totalPorConta);

        const resumo = calcularResumoPeriodo(doPeriodo);
        container.querySelector('#rel-resumo-receitas').textContent = formatarMoeda(resumo.receitas);
        container.querySelector('#rel-resumo-despesas').textContent = formatarMoeda(resumo.despesas);
        const resultadoEl = container.querySelector('#rel-resumo-resultado');
        resultadoEl.textContent = formatarMoeda(resumo.resultado);
        resultadoEl.style.color = resumo.resultado >= 0 ? 'var(--cor-receita)' : 'var(--cor-despesa)';

        renderizarEvolucao(agruparEvolucaoDiaria(doPeriodo));
    }

    function renderizarTabela(contas, totalPorConta, totalGeral) {
        const tbody = container.querySelector('#rel-tabela-body');
        if (!contas.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum lançamento no período.</td></tr>';
            return;
        }
        tbody.innerHTML = contas.map(nome => {
            const valor = totalPorConta[nome];
            const pct = totalGeral > 0 ? ((valor / totalGeral) * 100).toFixed(1) : '0.0';
            return `<tr><td>${escapeHtml(nome)}</td><td>${formatarMoeda(valor)}</td><td>${pct}%</td></tr>`;
        }).join('');
    }

    function renderizarGrafico(contas, totalPorConta) {
        if (grafico) grafico.destroy();
        const cores = ['#0ea5e9','#f5b700','#10b981','#ef4444','#6366f1','#0284c7','#f59e0b','#6b7280','#7dd3fc','#212121'];
        grafico = new Chart(container.querySelector('#rel-grafico'), {
            type: 'doughnut',
            data: {
                labels: contas,
                datasets: [{ data: contas.map(c => totalPorConta[c]), backgroundColor: contas.map((_, i) => cores[i % cores.length]) }]
            },
            options: { responsive: true }
        });
    }

    function renderizarEvolucao(pontos) {
        if (graficoEvolucao) graficoEvolucao.destroy();
        graficoEvolucao = new Chart(container.querySelector('#rel-grafico-evolucao'), {
            type: 'line',
            data: {
                labels: pontos.map(p => formatarData(p.data)),
                datasets: [{ label: 'Saldo diário', data: pontos.map(p => p.saldo), borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.15)', fill: true, tension: 0.25 }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: false } } }
        });
    }

    function exportarCSV() {
        if (!ultimoResultado.length) { mostrarToast('Gere o relatório antes de exportar.', 'erro'); return; }
        const colunas = [
            { chave: 'data', rotulo: 'Data' },
            { chave: 'conta', rotulo: 'Conta' },
            { chave: 'tipo', rotulo: 'Tipo' },
            { chave: 'valor', rotulo: 'Valor' }
        ];
        const linhas = ultimoResultado.map(l => ({
            data: formatarData(l.data),
            conta: l.contas?.nome ?? 'Sem conta',
            tipo: l.tipo === 'RECEITA' ? 'Receita' : 'Despesa',
            valor: l.valor.toFixed(2).replace('.', ',')
        }));
        const csv = paraCSV(colunas, linhas);
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'relatorio.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    container.querySelector('#btn-gerar-relatorio').addEventListener('click', gerar);
    container.querySelector('#btn-exportar-csv').addEventListener('click', exportarCSV);
    await gerar();
}
```

- [ ] **Step 2: Sanity-check the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Open Relatórios:
1. The doughnut chart now renders in the new blue/gold/green/red palette (not dark-theme purples), and still respects the tipo filter as before.
2. The 3 new summary cards (Receitas/Despesas/Resultado) reflect BOTH tipos over the selected date range, regardless of which tipo is selected in the filter.
3. The new "Evolução Diária" line chart shows a plausible daily net-balance line over the selected range.
4. Click "Exportar CSV" after generating a report → a `relatorio.csv` file downloads, opens correctly in a spreadsheet app, with Data/Conta/Tipo/Valor columns matching the currently filtered tipo.
5. Clicking "Exportar CSV" before ever clicking "Gerar" (fresh page load, which auto-generates once, so test by picking a range/tipo with zero results) shows the "Gere o relatório antes de exportar." toast instead of downloading an empty file.

- [ ] **Step 4: Commit**

```bash
git add js/relatorios.js
git commit -m "feat: add summary cards, evolução diária chart, and CSV export to Relatórios"
```

---

### Task 14: Full-suite run, manual QA pass, and push

**Files:** none (verification only)

**Interfaces:** none — this task verifies the combined output of Tasks 1-13.

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: every test across `test/*.js` PASSES (formato, ofxParser, grupos, conciliacaoAuto, dashboardCalculos, relatoriosCalculos, csv).

- [ ] **Step 2: Manual pass over every screen**

Log in and click through every sidebar item in order, confirming:
- **Dashboard, Plano de Contas, Orçamento, Lançamentos, Conciliação Bancária, Histórico, Relatórios**: per their individual manual-verification steps above (Tasks 1, 3-11, 13).
- **Membros**: needs no code change — confirm it now renders with the new blue `.btn-primary`/`.btn-secondary` buttons and chip-style badges automatically (it uses only shared CSS classes, no hardcoded colors), and that approval/role-toggle actions still work exactly as before.
- **Prestação de Contas** and **Transparência** (untouched by this plan): confirm they still load without errors (they inherit the new global CSS automatically; if either has hardcoded dark-theme inline colors left over from `cfa2b52`, note it, but do not fix it here — out of scope for this plan since neither was in the approved spec).

- [ ] **Step 3: Check git status is clean**

Run: `git status --short`
Expected: no output (everything from Tasks 1-13 was already committed).

- [ ] **Step 4: Push**

```bash
git push origin main
```

- [ ] **Step 5: Report**

Confirm to the user: all 13 feature/design commits are pushed to `origin/main`, the full test suite passes, and every screen was manually verified per the steps above. Call out explicitly if Step 2 found anything in Prestação de Contas/Transparência left over from the dark theme, since that's outside this plan's scope and would need a separate follow-up.

