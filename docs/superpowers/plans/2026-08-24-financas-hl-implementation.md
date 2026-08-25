# Finanças HL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Finanças HL — a family personal-finance control app, static (HTML/CSS/ES-modules, no build step), hosted on GitHub Pages, with Supabase (Auth + Postgres + Storage) as the only backend.

**Architecture:** One `index.html` shell with a sidebar and one `<section>` per screen, hydrated by per-screen ES modules under `js/`. `supabaseClient.js` is the single Supabase client instance; all data access goes through it directly from the browser, secured entirely by Postgres Row Level Security (no server validates anything).

**Tech Stack:** Vanilla JS (ES modules), Supabase JS SDK v2 (via CDN ESM import), Chart.js (CDN), SheetJS/xlsx (CDN), Node's built-in `node:test` for unit tests of pure functions.

**Spec:** `docs/superpowers/specs/2026-08-24-financas-hl-design.md`

## Global Constraints

- No server, no build step — every file must work when served as static assets (GitHub Pages).
- Data access only through `supabaseClient.js`; security enforced via RLS, not client logic.
- `membro` role can edit only their own `lancamentos`; `admin` can edit any. Structural data (`plano_contas`, `contas`, `orcamento_valores`, `contas_bancarias`, `extrato_itens`) is editable by any `aprovado` user.
- First user to sign up becomes `admin`/`aprovado` automatically; every subsequent signup is `membro`/`pendente` until an admin approves them.
- Language: all UI copy in pt-BR, matching the reference project's tone.
- Currency/date formatting: `pt-BR` locale, BRL currency (`Intl.NumberFormat`).
- No PDF generation library — "prestação de contas" export is Excel (SheetJS) + browser print (`window.print()`).

---

## Task 1: Repo scaffolding

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `README.md`
- Create (empty dirs via `.gitkeep` not needed — created implicitly by later tasks' files)

**Interfaces:**
- Produces: `npm test` script wired to `node --test test/*.js` (used by every later test task).

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
js/config.js
.DS_Store
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "financas-hl",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Controle financeiro familiar — estático, Supabase como backend",
  "scripts": {
    "test": "node --test test/*.js"
  }
}
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Finanças HL

Controle financeiro familiar. Site estático (sem servidor, sem build step),
hospedado no GitHub Pages. Supabase é o único backend (Auth + Postgres +
Storage).

## Configuração (primeira vez)

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor do projeto, rode o conteúdo de `supabase/schema.sql`
   inteiro, uma vez.
3. Em Storage, confirme que o bucket `comprovantes` foi criado (o script
   acima já cria) e está privado.
4. Copie `js/config.example.js` para `js/config.js` e preencha com a URL e
   a chave `anon` do seu projeto Supabase (Settings > API). `js/config.js`
   é ignorado pelo git — cada ambiente (seu navegador local, o GitHub
   Pages) precisa do seu próprio.
5. Abra `login.html` num servidor estático local (ex: `npx serve .`) ou
   publique via GitHub Pages.
6. Cadastre-se — o primeiro usuário a se cadastrar vira administrador
   automaticamente. Os seguintes precisam ser aprovados na tela Membros.

## Publicar no GitHub Pages

1. Configure o `js/config.js` de produção (repita o passo 4 acima, mas
   como esse arquivo é ignorado pelo git, publique-o manualmente: edite
   direto na branch de publicação ou adicione uma exceção no
   `.gitignore` só para esse deploy — a chave `anon` é pública por design,
   não é segredo).
2. No GitHub, em Settings > Pages, aponte para a branch `main`, pasta raiz.
3. O site fica em `https://<usuario>.github.io/<repo>/`.

## Testes

```
npm test
```

Cobre funções puras (formatação, parser de extrato OFX). Fluxos de
autenticação e RLS são verificados manualmente — ver checklist de QA no
final do plano de implementação.
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json README.md
git commit -m "chore: scaffold Finanças HL project"
```

---

## Task 2: Supabase schema

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Produces: tables `perfis`, `plano_contas`, `contas`, `lancamentos`, `orcamento_valores`, `contas_bancarias`, `extrato_itens`, `historico_auditoria`; storage bucket `comprovantes`; trigger that auto-creates a `perfis` row on signup (first user → admin/aprovado, rest → membro/pendente); RPC functions `conciliar_extrato(p_item_id bigint, p_lancamento_id bigint): void` and `desfazer_conciliacao(p_item_id bigint): void`, called via `supabase.rpc(...)` from Task 16 instead of raw table updates, since linking a lançamento to a shared bank account is a family-structural action that must not be blocked by the `lancamentos` UPDATE policy's dono-or-admin restriction (that restriction exists for editing a lançamento's own fields, not for reconciliation).

- [ ] **Step 1: Write `supabase/schema.sql`**

```sql
-- ============================================================
-- FINANÇAS HL — SETUP DO SUPABASE
-- Rode este script UMA VEZ, inteiro, no SQL Editor do projeto Supabase.
-- ============================================================

create table if not exists public.perfis (
    id          uuid primary key references auth.users(id) on delete cascade,
    nome        text not null,
    email       text not null,
    papel       text not null default 'membro' check (papel in ('admin', 'membro')),
    status      text not null default 'pendente' check (status in ('pendente', 'aprovado')),
    created_at  timestamptz not null default now()
);

create table if not exists public.plano_contas (
    id          bigint generated always as identity primary key,
    tipo        text not null check (tipo in ('RECEITA', 'DESPESA')),
    descricao   text
);

create table if not exists public.contas (
    id          bigint generated always as identity primary key,
    plano_id    bigint not null references public.plano_contas(id) on delete cascade,
    nome        text not null
);

create table if not exists public.contas_bancarias (
    id            bigint generated always as identity primary key,
    nome          text not null,
    banco         text,
    agencia       text,
    numero_conta  text,
    created_at    timestamptz not null default now()
);

create table if not exists public.lancamentos (
    id                 bigint generated always as identity primary key,
    tipo               text not null check (tipo in ('RECEITA', 'DESPESA')),
    conta_id           bigint references public.contas(id) on delete set null,
    usuario_id         uuid not null references public.perfis(id),
    forma_pagamento    text check (forma_pagamento in ('pix', 'transferencia', 'cartao', 'dinheiro', 'boleto')),
    conta_bancaria_id  bigint references public.contas_bancarias(id) on delete set null,
    data               date not null,
    historico          text not null,
    descricao          text,
    valor              numeric not null check (valor > 0),
    comprovante_url    text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create table if not exists public.orcamento_valores (
    id          bigint generated always as identity primary key,
    ano         integer not null,
    mes         integer not null check (mes between 1 and 12),
    conta_id    bigint not null references public.contas(id) on delete cascade,
    valor       numeric not null default 0,
    unique (ano, mes, conta_id)
);

create table if not exists public.extrato_itens (
    id                 bigint generated always as identity primary key,
    conta_bancaria_id  bigint not null references public.contas_bancarias(id) on delete cascade,
    fitid              text not null,
    data               date not null,
    historico          text not null,
    tipo               text not null check (tipo in ('CREDITO', 'DEBITO')),
    valor              numeric not null check (valor > 0),
    status             text not null default 'pendente' check (status in ('pendente', 'conciliado')),
    lancamento_id      bigint references public.lancamentos(id) on delete set null,
    created_at         timestamptz not null default now(),
    unique (conta_bancaria_id, fitid)
);

create table if not exists public.historico_auditoria (
    id          bigint generated always as identity primary key,
    usuario_id  uuid references public.perfis(id),
    modulo      text,
    acao        text not null,
    detalhes    text,
    created_at  timestamptz not null default now()
);

-- ============================================================
-- BOOTSTRAP DE USUÁRIO — ao criar uma conta no Supabase Auth, cria
-- automaticamente a linha correspondente em perfis. O primeiro usuário
-- do sistema vira admin/aprovado; todos os demais entram
-- membro/pendente até um admin aprovar na tela Membros.
-- ============================================================
create or replace function public.criar_perfil_no_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    eh_primeiro boolean;
begin
    select not exists (select 1 from public.perfis) into eh_primeiro;

    insert into public.perfis (id, nome, email, papel, status)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
        new.email,
        case when eh_primeiro then 'admin' else 'membro' end,
        case when eh_primeiro then 'aprovado' else 'pendente' end
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.criar_perfil_no_signup();

-- ============================================================
-- CONCILIAÇÃO BANCÁRIA — funções SECURITY DEFINER. Ligar/desligar um item
-- de extrato a um lançamento grava em duas tabelas (extrato_itens e
-- lancamentos), mas a policy de UPDATE de lancamentos só permite o dono
-- ou um admin (ver mais abaixo) — conciliar o extrato de uma conta
-- compartilhada, porém, é uma tarefa estrutural da família, não uma
-- edição de lançamento de terceiro, então passa por aqui em vez de
-- depender da policy de UPDATE de lancamentos.
-- ============================================================
create or replace function public.conciliar_extrato(p_item_id bigint, p_lancamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado') then
        raise exception 'Usuário não aprovado.';
    end if;

    update public.extrato_itens
    set status = 'conciliado', lancamento_id = p_lancamento_id
    where id = p_item_id;

    update public.lancamentos
    set conta_bancaria_id = (select conta_bancaria_id from public.extrato_itens where id = p_item_id)
    where id = p_lancamento_id;
end;
$$;

create or replace function public.desfazer_conciliacao(p_item_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_lancamento_id bigint;
begin
    if not exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado') then
        raise exception 'Usuário não aprovado.';
    end if;

    select lancamento_id into v_lancamento_id from public.extrato_itens where id = p_item_id;

    update public.extrato_itens set status = 'pendente', lancamento_id = null where id = p_item_id;

    if v_lancamento_id is not null then
        update public.lancamentos set conta_bancaria_id = null where id = v_lancamento_id;
    end if;
end;
$$;

grant execute on function public.conciliar_extrato(bigint, bigint) to authenticated;
grant execute on function public.desfazer_conciliacao(bigint) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.perfis enable row level security;
alter table public.plano_contas enable row level security;
alter table public.contas enable row level security;
alter table public.contas_bancarias enable row level security;
alter table public.lancamentos enable row level security;
alter table public.orcamento_valores enable row level security;
alter table public.extrato_itens enable row level security;
alter table public.historico_auditoria enable row level security;

-- perfis: usuário vê/edita o próprio; admin vê/edita todos.
drop policy if exists "ve proprio ou admin ve todos" on public.perfis;
create policy "ve proprio ou admin ve todos" on public.perfis for select to authenticated
    using (id = auth.uid() or exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'admin'));

drop policy if exists "admin edita qualquer perfil" on public.perfis;
create policy "admin edita qualquer perfil" on public.perfis for update to authenticated
    using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'admin'));

-- dado estrutural (plano_contas, contas, contas_bancarias, orcamento_valores):
-- qualquer aprovado lê e escreve.
do $$
declare
    nomes_tabelas text[] := array['plano_contas', 'contas', 'contas_bancarias', 'orcamento_valores'];
    nome_tabela text;
begin
    foreach nome_tabela in array nomes_tabelas loop
        execute format('drop policy if exists "aprovados tem acesso total" on public.%I;', nome_tabela);
        execute format(
            'create policy "aprovados tem acesso total" on public.%I for all to authenticated
             using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = ''aprovado''))
             with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = ''aprovado''));',
            nome_tabela
        );
    end loop;
end $$;

-- lancamentos: select liberado a qualquer aprovado (tela Transparência);
-- insert liberado a aprovados, sempre com usuario_id = auth.uid();
-- update/delete só pelo dono ou por admin.
drop policy if exists "aprovados leem todos os lancamentos" on public.lancamentos;
create policy "aprovados leem todos os lancamentos" on public.lancamentos for select to authenticated
    using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

drop policy if exists "aprovados inserem seu proprio lancamento" on public.lancamentos;
create policy "aprovados inserem seu proprio lancamento" on public.lancamentos for insert to authenticated
    with check (
        usuario_id = auth.uid()
        and exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado')
    );

drop policy if exists "dono ou admin edita lancamento" on public.lancamentos;
create policy "dono ou admin edita lancamento" on public.lancamentos for update to authenticated
    using (
        usuario_id = auth.uid()
        or exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'admin')
    );

drop policy if exists "dono ou admin exclui lancamento" on public.lancamentos;
create policy "dono ou admin exclui lancamento" on public.lancamentos for delete to authenticated
    using (
        usuario_id = auth.uid()
        or exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'admin')
    );

-- extrato_itens: mesmo padrão de dado estrutural (qualquer aprovado).
drop policy if exists "aprovados tem acesso total" on public.extrato_itens;
create policy "aprovados tem acesso total" on public.extrato_itens for all to authenticated
    using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'))
    with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

-- historico_auditoria: aprovados leem e inserem (não editam/excluem — é log).
drop policy if exists "aprovados leem historico" on public.historico_auditoria;
create policy "aprovados leem historico" on public.historico_auditoria for select to authenticated
    using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

drop policy if exists "aprovados inserem no historico" on public.historico_auditoria;
create policy "aprovados inserem no historico" on public.historico_auditoria for insert to authenticated
    with check (
        usuario_id = auth.uid()
        and exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado')
    );

grant select, insert, update, delete on public.perfis, public.plano_contas, public.contas,
    public.contas_bancarias, public.lancamentos, public.orcamento_valores, public.extrato_itens,
    public.historico_auditoria to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ============================================================
-- STORAGE — bucket privado para comprovantes de lançamento.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

drop policy if exists "aprovados acessam comprovantes" on storage.objects;
create policy "aprovados acessam comprovantes" on storage.objects for all to authenticated
    using (
        bucket_id = 'comprovantes'
        and exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado')
    )
    with check (
        bucket_id = 'comprovantes'
        and exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado')
    );

-- ============================================================
-- SEED — plano de contas padrão (editável depois pela tela Plano de Contas).
-- ============================================================
insert into public.plano_contas (tipo, descricao) values
    ('RECEITA', 'Receitas'),
    ('DESPESA', 'Despesas')
on conflict do nothing;

do $$
declare
    id_receita bigint;
    id_despesa bigint;
begin
    select id into id_receita from public.plano_contas where tipo = 'RECEITA' order by id limit 1;
    select id into id_despesa from public.plano_contas where tipo = 'DESPESA' order by id limit 1;

    if id_receita is not null and not exists (select 1 from public.contas where plano_id = id_receita) then
        insert into public.contas (plano_id, nome) values
            (id_receita, 'Salário'),
            (id_receita, 'Renda Extra / Freelance'),
            (id_receita, 'Investimentos'),
            (id_receita, 'Outros');
    end if;

    if id_despesa is not null and not exists (select 1 from public.contas where plano_id = id_despesa) then
        insert into public.contas (plano_id, nome) values
            (id_despesa, 'Moradia'),
            (id_despesa, 'Alimentação'),
            (id_despesa, 'Transporte'),
            (id_despesa, 'Saúde'),
            (id_despesa, 'Educação'),
            (id_despesa, 'Lazer'),
            (id_despesa, 'Assinaturas'),
            (id_despesa, 'Cartão de Crédito'),
            (id_despesa, 'Investimentos'),
            (id_despesa, 'Impostos'),
            (id_despesa, 'Doações'),
            (id_despesa, 'Outros');
    end if;
end $$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema, RLS policies and seed plano de contas"
```

*(This file is applied manually by the user in the Supabase SQL Editor — there is no automated way to run it against a live project from this repo. Verification happens in Task 9's manual QA checklist once auth exists.)*

---

## Task 3: Supabase client and config

**Files:**
- Create: `js/config.example.js`
- Create: `js/supabaseClient.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `js/supabaseClient.js` exports `supabase` (a configured `SupabaseClient` instance) — every other JS module imports this.

- [ ] **Step 1: Write `js/config.example.js`**

```javascript
// Copie este arquivo para js/config.js e preencha com os dados do seu
// projeto Supabase (Settings > API). js/config.js é ignorado pelo git.
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_PUBLICA';
```

- [ ] **Step 2: Write `js/supabaseClient.js`**

```javascript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- [ ] **Step 3: Create a local `js/config.js` for development (not committed)**

Copy `js/config.example.js` to `js/config.js` and fill in real values from
your Supabase project so later manual-verification steps in this plan can
run against a live project.

```bash
cp "js/config.example.js" "js/config.js"
```

- [ ] **Step 4: Commit (config.example.js only — config.js is gitignored)**

```bash
git add js/config.example.js js/supabaseClient.js
git commit -m "feat: add Supabase client module and config template"
```

---

## Task 4: Formatting helpers

**Files:**
- Create: `js/shared/formato.js`
- Test: `test/formato.test.js`

**Interfaces:**
- Produces: `formatarMoeda(valor: number): string`, `formatarData(dataString: string): string`, `formatarDataHora(iso: string): string` — used by every screen module that renders currency or dates.

- [ ] **Step 1: Write the failing test**

```javascript
// test/formato.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarMoeda, formatarData, formatarDataHora } from '../js/shared/formato.js';

test('formatarMoeda formats BRL currency', () => {
    assert.equal(formatarMoeda(1234.5), 'R$ 1.234,50');
});

test('formatarData formats an ISO date string as pt-BR without timezone drift', () => {
    assert.equal(formatarData('2026-08-24'), '24/08/2026');
});

test('formatarDataHora formats an ISO timestamp as pt-BR date + time', () => {
    const resultado = formatarDataHora('2026-08-24T13:05:00.000Z');
    assert.match(resultado, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
});

test('formatarDataHora returns em dash for empty input', () => {
    assert.equal(formatarDataHora(''), '—');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '../js/shared/formato.js'"

- [ ] **Step 3: Write `js/shared/formato.js`**

```javascript
export function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function formatarData(dataString) {
    const data = new Date(dataString);
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    return data.toLocaleDateString('pt-BR');
}

export function formatarDataHora(iso) {
    if (!iso) return '—';
    const data = new Date(iso);
    if (isNaN(data.getTime())) return '—';
    return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/shared/formato.js test/formato.test.js
git commit -m "feat: add currency/date formatting helpers"
```

---

## Task 5: Toast feedback module

**Files:**
- Create: `js/shared/toast.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `mostrarToast(mensagem: string, tipo: 'sucesso'|'erro'): void`, `executarComBloqueio(botao: HTMLButtonElement|null, fnAsync: () => Promise<any>): Promise<any>` — used by every screen module after a Supabase call to give user feedback and prevent double-submits.

- [ ] **Step 1: Write `js/shared/toast.js`** (ported from the reference project's `ui-feedback.js`, converted to an ES module)

```javascript
function obterContainerToast() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed; top:1rem; right:1rem; z-index:9999; display:flex; flex-direction:column; gap:0.6rem; align-items:flex-end;';
        document.body.appendChild(container);
    }
    return container;
}

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

export async function executarComBloqueio(botao, fnAsync) {
    if (!botao) return fnAsync();
    const textoOriginal = botao.innerHTML;
    const eraDisabled = botao.disabled;
    botao.disabled = true;
    botao.dataset.textoOriginal = botao.dataset.textoOriginal || textoOriginal;
    botao.innerHTML = 'Salvando...';
    try {
        return await fnAsync();
    } finally {
        botao.disabled = eraDisabled;
        botao.innerHTML = botao.dataset.textoOriginal;
        delete botao.dataset.textoOriginal;
    }
}
```

- [ ] **Step 2: Manual verification**

This module has no pure-logic branch worth a unit test (it's DOM
manipulation); it will be exercised visually once a screen calls it in
Task 12+. No standalone test file for this task.

- [ ] **Step 3: Commit**

```bash
git add js/shared/toast.js
git commit -m "feat: add toast feedback module"
```

---

## Task 6: OFX statement parser

**Files:**
- Create: `js/shared/ofxParser.js`
- Test: `test/ofxParser.test.js`

**Interfaces:**
- Produces: `parseOFX(texto: string): Array<{fitid: string, data: string, historico: string, valor: number, tipo: 'CREDITO'|'DEBITO'}>`, `lerArquivoComoTexto(arquivo: File): Promise<string>` — used by `conciliacao.js` (Task 16).

- [ ] **Step 1: Write the failing test**

```javascript
// test/ofxParser.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOFX } from '../js/shared/ofxParser.js';

const OFX_AMOSTRA = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260810120000
<TRNAMT>1500.00
<FITID>ABC123
<MEMO>Salário
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260812090000
<TRNAMT>-89.90
<FITID>ABC124
<MEMO>Supermercado
</STMTTRN>
</BANKTRANLIST>
</OFX>
`;

test('parseOFX extracts credit and debit transactions', () => {
    const itens = parseOFX(OFX_AMOSTRA);
    assert.equal(itens.length, 2);
    assert.deepEqual(itens[0], {
        fitid: 'ABC123',
        data: '2026-08-10',
        historico: 'Salário',
        valor: 1500,
        tipo: 'CREDITO'
    });
    assert.deepEqual(itens[1], {
        fitid: 'ABC124',
        data: '2026-08-12',
        historico: 'Supermercado',
        valor: 89.90,
        tipo: 'DEBITO'
    });
});

test('parseOFX ignores transactions without a valid date or zero value', () => {
    const semData = `<STMTTRN><TRNTYPE>CREDIT<TRNAMT>10.00<FITID>X<MEMO>teste</STMTTRN>`;
    assert.equal(parseOFX(semData).length, 0);
});

test('parseOFX falls back to a generated fitid when none is present', () => {
    const semFitid = `<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260101<TRNAMT>10.00<MEMO>teste</STMTTRN>`;
    const itens = parseOFX(semFitid);
    assert.equal(itens.length, 1);
    assert.match(itens[0].fitid, /^20260101_10\.00_teste$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '../js/shared/ofxParser.js'"

- [ ] **Step 3: Write `js/shared/ofxParser.js`** (ported as-is from the reference project's `parseOFX`/`lerArquivoComoTexto`, since it's already pure client-side logic with no server dependency)

```javascript
// Extrai as transações de um extrato OFX (formato padrão de internet
// banking, usado pela maioria dos bancos brasileiros). Aceita tanto o
// OFX "texto plano" (tags sem fechamento, SGML) quanto o OFX 2.x (XML de
// verdade) — em ambos os casos as tags de interesse aparecem como
// <TAG>valor, então extrair por regex cobre os dois formatos.
export function parseOFX(texto) {
    const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

    const extrairCampo = (bloco, tag) => {
        const m = bloco.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i'));
        return m ? m[1].trim() : '';
    };

    return blocos.map(bloco => {
        const tipo = extrairCampo(bloco, 'TRNTYPE').toUpperCase();
        const dataRaw = extrairCampo(bloco, 'DTPOSTED');
        const valorRaw = extrairCampo(bloco, 'TRNAMT').replace(',', '.');
        const fitid = extrairCampo(bloco, 'FITID');
        const historico = extrairCampo(bloco, 'MEMO') || extrairCampo(bloco, 'NAME') || '(sem histórico)';
        const valor = parseFloat(valorRaw) || 0;
        const ano = dataRaw.slice(0, 4), mes = dataRaw.slice(4, 6), dia = dataRaw.slice(6, 8);

        return {
            fitid: fitid || `${dataRaw}_${valorRaw}_${historico}`.replace(/\s+/g, '_'),
            data: (ano && mes && dia) ? `${ano}-${mes}-${dia}` : '',
            historico,
            valor: Math.abs(valor),
            tipo: (tipo === 'DEBIT' || valor < 0) ? 'DEBITO' : 'CREDITO'
        };
    }).filter(item => item.data && item.valor > 0);
}

export function lerArquivoComoTexto(arquivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo "${arquivo.name}".`));
        reader.readAsText(arquivo);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests, 7 total with Task 4's)

- [ ] **Step 5: Commit**

```bash
git add js/shared/ofxParser.js test/ofxParser.test.js
git commit -m "feat: port OFX statement parser"
```

---

## Task 7: Audit log helper

**Files:**
- Create: `js/shared/auditoria.js`

**Interfaces:**
- Consumes: `supabase` from `js/supabaseClient.js`.
- Produces: `registrarHistorico(modulo: string, acao: string, detalhes: string): Promise<void>` — called by every CRUD module (Tasks 11-16) after a successful insert/update/delete, and read back by `historico.js` (Task 19).

- [ ] **Step 1: Write `js/shared/auditoria.js`**

```javascript
import { supabase } from '../supabaseClient.js';

export async function registrarHistorico(modulo, acao, detalhes) {
    const { data: sessao } = await supabase.auth.getSession();
    const usuarioId = sessao?.session?.user?.id ?? null;

    const { error } = await supabase.from('historico_auditoria').insert({
        usuario_id: usuarioId,
        modulo,
        acao,
        detalhes
    });

    if (error) {
        console.error('Falha ao registrar histórico de auditoria:', error.message);
    }
}
```

- [ ] **Step 2: Manual verification**

No standalone unit test — this is a thin Supabase wrapper with no branching
logic worth testing in isolation (the `console.error` fallback avoids
letting an audit-log failure block the actual CRUD operation that called
it). It gets exercised end-to-end once Task 11 calls it against a real
Supabase project and Task 19 reads the rows back in the Histórico screen.

- [ ] **Step 3: Commit**

```bash
git add js/shared/auditoria.js
git commit -m "feat: add audit log helper"
```

---

## Task 8: Base stylesheet

**Files:**
- Create: `css/styles.css`

**Interfaces:**
- Produces: CSS classes consumed by every HTML task from here on: `.app-container`, `.sidebar`, `.sidebar-nav`, `.main-content`, `.page`, `.page.active`, `.card`, `.summary-card`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.form-group`, `.data-table`, `.badge`, `.badge-receita`, `.badge-despesa`, `.badge-pendente`, `.badge-aprovado`, `.modal`, `.modal.show`, `.text-center`, `.text-muted`, `.login-page`, `.login-card`.

- [ ] **Step 1: Write `css/styles.css`**

New visual identity for Finanças HL — deep teal/emerald as the primary
accent (distinct from the reference project's black/slate sidebar),
warm off-white content background, generous card radius. Single file,
no preprocessor.

```css
:root {
    --cor-primaria: #0f766e;
    --cor-primaria-escura: #0b5b54;
    --cor-primaria-clara: #ccfbf1;
    --cor-receita: #16a34a;
    --cor-despesa: #dc2626;
    --cor-fundo: #f7f5f0;
    --cor-superficie: #ffffff;
    --cor-borda: #e7e2d8;
    --cor-texto: #1f2937;
    --cor-texto-suave: #6b7280;
    --sombra: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06);
    --raio: 12px;
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
    background: linear-gradient(180deg, var(--cor-primaria-escura), var(--cor-primaria));
    color: #ecfdf5;
    display: flex;
    flex-direction: column;
}

.sidebar-header { padding: 1.5rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.15); }
.sidebar-header h2 { margin: 0; font-size: 1.15rem; }

.sidebar-nav { display: flex; flex-direction: column; padding: 0.75rem 0; flex: 1; overflow-y: auto; }

.nav-link {
    color: #d1fae5;
    text-decoration: none;
    padding: 0.65rem 1.25rem;
    font-size: 0.9rem;
    border-left: 3px solid transparent;
    transition: background 0.15s, border-color 0.15s;
}

.nav-link:hover { background: rgba(255,255,255,0.08); }
.nav-link.active { background: rgba(255,255,255,0.14); border-left-color: #6ee7b7; color: #fff; font-weight: 600; }

.sidebar-footer { padding: 1rem 1.25rem; border-top: 1px solid rgba(255,255,255,0.15); }
.user-name { display: block; font-size: 0.85rem; margin-bottom: 0.5rem; }
.btn-logout { width: 100%; padding: 0.5rem; border: none; border-radius: 8px; background: rgba(0,0,0,0.2); color: #fff; cursor: pointer; }

.main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.top-header { padding: 1.25rem 2rem; background: var(--cor-superficie); border-bottom: 1px solid var(--cor-borda); }
.top-header h2 { margin: 0; }
.page-content { padding: 1.5rem 2rem; flex: 1; }

.page { display: none; }
.page.active { display: block; }

.card, .summary-card {
    background: var(--cor-superficie);
    border-radius: var(--raio);
    box-shadow: var(--sombra);
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.5rem;
}

.btn-primary, .btn-secondary, .btn-danger {
    padding: 0.55rem 1.1rem;
    border-radius: 8px;
    border: none;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
}

.btn-primary { background: var(--cor-primaria); color: #fff; }
.btn-primary:hover { background: var(--cor-primaria-escura); }
.btn-secondary { background: var(--cor-fundo); color: var(--cor-texto); border: 1px solid var(--cor-borda); }
.btn-danger { background: var(--cor-despesa); color: #fff; }
button:disabled { opacity: 0.6; cursor: not-allowed; }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem; }
.form-group input, .form-group select, .form-group textarea {
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--cor-borda);
    border-radius: 8px;
    font-size: 0.9rem;
    font-family: inherit;
}

.data-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.data-table th, .data-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--cor-borda); text-align: left; }
.data-table th { color: var(--cor-texto-suave); font-weight: 600; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.04em; }

.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
.badge-receita { background: #dcfce7; color: #166534; }
.badge-despesa { background: #fee2e2; color: #991b1b; }
.badge-pendente { background: #fef3c7; color: #92400e; }
.badge-aprovado { background: #dcfce7; color: #166534; }

.modal { display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.45); align-items: center; justify-content: center; z-index: 1000; }
.modal.show { display: flex; }
.modal-content { background: var(--cor-superficie); border-radius: var(--raio); padding: 1.5rem; max-width: 520px; width: 92%; max-height: 88vh; overflow-y: auto; }

.text-center { text-align: center; }
.text-muted { color: var(--cor-texto-suave); }

.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, var(--cor-primaria-escura), var(--cor-primaria)); }
.login-card { background: var(--cor-superficie); border-radius: var(--raio); padding: 2.5rem; width: 100%; max-width: 380px; box-shadow: var(--sombra); }
.login-card h1 { margin-top: 0; font-size: 1.4rem; color: var(--cor-primaria-escura); }
.alert { display: none; align-items: center; gap: 0.5rem; background: #fee2e2; color: #991b1b; padding: 0.7rem 0.9rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1rem; }
.btn-loader { display: none; }

@media print {
    .sidebar, .top-header, .btn-primary, .btn-secondary, .btn-danger { display: none !important; }
    .main-content { width: 100%; }
}
```

- [ ] **Step 2: Manual verification**

No automated test for a stylesheet. It gets verified visually once
`login.html` (Task 9) and `index.html` (Task 10) exist and are opened in a
browser.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat: add base stylesheet with new visual identity"
```

---

## Task 9: Login/signup page and auth module

**Files:**
- Create: `login.html`
- Create: `js/auth.js`

**Interfaces:**
- Consumes: `supabase` from `js/supabaseClient.js`; `mostrarToast` from `js/shared/toast.js`.
- Produces: `exigirSessao(): Promise<{session, perfil}>` (redirects to `login.html` if there is no session, or shows the pending-approval block if `perfil.status !== 'aprovado'`; otherwise resolves) and `sair(): Promise<void>` (signs out and redirects to `login.html`) — both imported by `index.html`'s inline bootstrap script in Task 10, and by every screen module that needs to know the current user's `id`/`papel`.

- [ ] **Step 1: Write `login.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Finanças HL — Entrar</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body class="login-page">
    <div class="login-card">
        <h1 id="titulo-formulario">Finanças HL</h1>

        <div class="alert" id="alerta-erro"><span>⚠️</span><span class="alert-text"></span></div>

        <form id="form-login">
            <div class="form-group">
                <label for="login-email">E-mail</label>
                <input type="email" id="login-email" required>
            </div>
            <div class="form-group">
                <label for="login-senha">Senha</label>
                <input type="password" id="login-senha" required minlength="6">
            </div>
            <button type="submit" class="btn-primary" style="width:100%;">
                <span class="btn-text">Entrar</span>
                <span class="btn-loader">Entrando...</span>
            </button>
        </form>

        <form id="form-cadastro" style="display:none;">
            <div class="form-group">
                <label for="cadastro-nome">Nome</label>
                <input type="text" id="cadastro-nome" required>
            </div>
            <div class="form-group">
                <label for="cadastro-email">E-mail</label>
                <input type="email" id="cadastro-email" required>
            </div>
            <div class="form-group">
                <label for="cadastro-senha">Senha</label>
                <input type="password" id="cadastro-senha" required minlength="6">
            </div>
            <button type="submit" class="btn-primary" style="width:100%;">
                <span class="btn-text">Criar conta</span>
                <span class="btn-loader">Criando...</span>
            </button>
        </form>

        <p class="text-center" style="margin-top:1rem; font-size:0.85rem;">
            <a href="#" id="link-alternar-modo">Ainda não tem conta? Cadastre-se</a>
        </p>
    </div>

    <script type="module" src="js/auth.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `js/auth.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';

// --- API pública, usada por index.html e pelos módulos de tela ---------

export async function exigirSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    const perfil = await buscarPerfil(session.user.id);
    if (!perfil || perfil.status !== 'aprovado') {
        mostrarBloqueioPendente();
        return null;
    }

    return { session, perfil };
}

export async function sair() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

async function buscarPerfil(usuarioId) {
    const { data, error } = await supabase.from('perfis').select('*').eq('id', usuarioId).single();
    if (error) {
        console.error('Falha ao carregar perfil:', error.message);
        return null;
    }
    return data;
}

function mostrarBloqueioPendente() {
    document.body.innerHTML = `
        <div class="login-page">
            <div class="login-card text-center">
                <h1>Aguardando aprovação</h1>
                <p class="text-muted">Sua conta foi criada, mas ainda precisa ser aprovada por um administrador da família antes de acessar o sistema.</p>
                <button class="btn-secondary" id="btn-sair-pendente" style="margin-top:1rem;">Sair</button>
            </div>
        </div>
    `;
    document.getElementById('btn-sair-pendente').addEventListener('click', sair);
}

// --- Lógica exclusiva de login.html -------------------------------------

async function inicializarLoginPage() {
    if (!document.getElementById('form-login')) return; // não estamos em login.html

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('form-login').addEventListener('submit', handleLoginSubmit);
    document.getElementById('form-cadastro').addEventListener('submit', handleCadastroSubmit);
    document.getElementById('link-alternar-modo').addEventListener('click', alternarModo);
}

function alternarModo(e) {
    e.preventDefault();
    const emLogin = document.getElementById('form-login').style.display !== 'none';
    document.getElementById('form-login').style.display = emLogin ? 'none' : 'block';
    document.getElementById('form-cadastro').style.display = emLogin ? 'block' : 'none';
    document.getElementById('titulo-formulario').textContent = emLogin ? 'Criar conta' : 'Finanças HL';
    e.target.textContent = emLogin ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Cadastre-se';
    esconderErro();
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const btn = e.target.querySelector('button[type="submit"]');

    esconderErro();
    mostrarCarregamento(btn);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    ocultarCarregamento(btn);

    if (error) {
        mostrarErro('E-mail ou senha inválidos.');
        return;
    }
    window.location.href = 'index.html';
}

async function handleCadastroSubmit(e) {
    e.preventDefault();
    const nome = document.getElementById('cadastro-nome').value;
    const email = document.getElementById('cadastro-email').value;
    const senha = document.getElementById('cadastro-senha').value;
    const btn = e.target.querySelector('button[type="submit"]');

    esconderErro();
    mostrarCarregamento(btn);
    const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome } }
    });
    ocultarCarregamento(btn);

    if (error) {
        mostrarErro(error.message);
        return;
    }
    mostrarToast('Conta criada! Se for a primeira do sistema você já é admin, senão aguarde aprovação.', 'sucesso');
    window.location.href = 'index.html';
}

function mostrarErro(mensagem) {
    const alertEl = document.getElementById('alerta-erro');
    alertEl.querySelector('.alert-text').textContent = mensagem;
    alertEl.style.display = 'flex';
}

function esconderErro() {
    document.getElementById('alerta-erro').style.display = 'none';
}

function mostrarCarregamento(btn) {
    btn.disabled = true;
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loader').style.display = 'inline';
}

function ocultarCarregamento(btn) {
    btn.disabled = false;
    btn.querySelector('.btn-text').style.display = 'inline';
    btn.querySelector('.btn-loader').style.display = 'none';
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarLoginPage);
} else {
    inicializarLoginPage();
}
```

- [ ] **Step 3: Manual verification**

No `better-sqlite3`/local backend to fake here — `auth.js` talks straight
to a live Supabase project, so this task is verified by hand once
`js/config.js` (Task 3, Step 3) points at a real project:

1. Open `login.html` in a local static server (`npx serve .`).
2. Sign up with a first test account → should redirect straight into
   `index.html` (even though it doesn't exist yet as a real app shell
   until Task 10 — a blank page or 404 there is expected right now; what
   matters is no error was thrown and a session was created).
3. In the Supabase dashboard, confirm a row was created in `perfis` with
   `papel = 'admin'` and `status = 'aprovado'` for that first user.
4. Sign up a second test account → confirm its `perfis` row has
   `papel = 'membro'` and `status = 'pendente'`.
5. Log out (call `sair()` from the browser console: `import('./js/auth.js').then(m => m.sair())`) and log back in as the second account → `exigirSessao()` should trigger the "Aguardando aprovação" block, not the app.

- [ ] **Step 4: Commit**

```bash
git add login.html js/auth.js
git commit -m "feat: add login/signup page and auth guard module"
```

---

## Task 10: App shell and router

**Files:**
- Create: `index.html`
- Create: `js/main.js`

**Interfaces:**
- Consumes: `exigirSessao`, `sair` from `js/auth.js`.
- Produces: the screen-module contract every later screen task implements:
  `export async function montarTela(container: HTMLElement, contexto: {session, perfil}): Promise<void>`
  — `main.js` dynamically imports the screen's module the first time its
  nav link is clicked and calls `montarTela(secaoEl, contexto)`, passing an
  empty `<section>` element for the module to fill with its own markup and
  event listeners, plus the current user's session/perfil so the module
  can enforce "only mine unless admin" in the UI without re-fetching the
  profile itself.

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Finanças HL</title>
    <link rel="stylesheet" href="css/styles.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
</head>
<body>
    <div class="app-container">
        <aside class="sidebar">
            <div class="sidebar-header"><h2>Finanças HL</h2></div>
            <nav class="sidebar-nav">
                <a href="#dashboard" class="nav-link active" data-page="dashboard">📊 Dashboard</a>
                <a href="#plano-contas" class="nav-link" data-page="plano-contas">🗂️ Plano de Contas</a>
                <a href="#orcamento" class="nav-link" data-page="orcamento">💵 Orçamento</a>
                <a href="#lancamentos" class="nav-link" data-page="lancamentos">📝 Lançamentos</a>
                <a href="#prestacao-contas" class="nav-link" data-page="prestacao-contas">📋 Prestação de Contas</a>
                <a href="#conciliacao-bancaria" class="nav-link" data-page="conciliacao-bancaria">🏦 Conciliação Bancária</a>
                <a href="#transparencia" class="nav-link" data-page="transparencia">🔍 Transparência</a>
                <a href="#relatorios" class="nav-link" data-page="relatorios">📈 Relatórios</a>
                <a href="#membros" class="nav-link" data-page="membros">👥 Membros</a>
                <a href="#historico" class="nav-link" data-page="historico">🕒 Histórico</a>
            </nav>
            <div class="sidebar-footer">
                <span id="user-name" class="user-name">Carregando...</span>
                <button id="logout-btn" class="btn-logout">Sair 🚪</button>
            </div>
        </aside>

        <main class="main-content">
            <header class="top-header"><h2 id="page-title">Dashboard</h2></header>
            <div class="page-content">
                <section id="page-dashboard" class="page active"></section>
                <section id="page-plano-contas" class="page"></section>
                <section id="page-orcamento" class="page"></section>
                <section id="page-lancamentos" class="page"></section>
                <section id="page-prestacao-contas" class="page"></section>
                <section id="page-conciliacao-bancaria" class="page"></section>
                <section id="page-transparencia" class="page"></section>
                <section id="page-relatorios" class="page"></section>
                <section id="page-membros" class="page"></section>
                <section id="page-historico" class="page"></section>
            </div>
        </main>
    </div>

    <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `js/main.js`**

```javascript
import { exigirSessao, sair } from './auth.js';

const TITULOS = {
    'dashboard': 'Dashboard',
    'plano-contas': 'Plano de Contas',
    'orcamento': 'Orçamento',
    'lancamentos': 'Lançamentos',
    'prestacao-contas': 'Prestação de Contas',
    'conciliacao-bancaria': 'Conciliação Bancária',
    'transparencia': 'Transparência',
    'relatorios': 'Relatórios',
    'membros': 'Membros',
    'historico': 'Histórico'
};

// Cada módulo de tela exporta `montarTela(container, contexto)`. Import
// dinâmico: só carrega o código da tela quando ela é aberta pela primeira
// vez.
const CARREGADORES_TELA = {
    'dashboard': () => import('./dashboard.js'),
    'plano-contas': () => import('./planoContas.js'),
    'orcamento': () => import('./orcamento.js'),
    'lancamentos': () => import('./lancamentos.js'),
    'prestacao-contas': () => import('./prestacaoContas.js'),
    'conciliacao-bancaria': () => import('./conciliacao.js'),
    'transparencia': () => import('./transparencia.js'),
    'relatorios': () => import('./relatorios.js'),
    'membros': () => import('./membros.js'),
    'historico': () => import('./historico.js')
};

let contextoAtual = null;

async function abrirPagina(pagina) {
    document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === pagina));
    document.querySelectorAll('.page').forEach(s => s.classList.toggle('active', s.id === `page-${pagina}`));
    document.getElementById('page-title').textContent = TITULOS[pagina] || pagina;

    const secao = document.getElementById(`page-${pagina}`);
    const carregar = CARREGADORES_TELA[pagina];
    if (!secao || !carregar) return;

    secao.innerHTML = '<p class="text-muted">Carregando...</p>';
    try {
        const modulo = await carregar();
        await modulo.montarTela(secao, contextoAtual);
    } catch (erro) {
        console.error(`Falha ao carregar a tela "${pagina}":`, erro);
        secao.innerHTML = '<p class="text-muted">Não foi possível carregar esta tela.</p>';
    }
}

async function inicializar() {
    const resultado = await exigirSessao();
    if (!resultado) return; // exigirSessao já redirecionou ou mostrou o bloqueio de pendente

    contextoAtual = resultado;
    document.getElementById('user-name').textContent = `${resultado.perfil.nome} (${resultado.perfil.papel})`;
    document.getElementById('logout-btn').addEventListener('click', sair);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            abrirPagina(link.dataset.page);
        });
    });

    abrirPagina('dashboard');
}

inicializar();
```

- [ ] **Step 3: Manual verification**

1. Serve the folder locally (`npx serve .`) and open `index.html` while
   logged out → `exigirSessao()` should redirect to `login.html`.
2. Log in with the admin test account created in Task 9 → the shell loads,
   sidebar shows "Nome (admin)", and clicking each nav link switches the
   active section and page title (the sections themselves stay blank until
   Tasks 11-20 add their modules — a "Carregando..." message followed by a
   "Não foi possível carregar esta tela" failure on click is expected until
   then, since the imported files don't exist yet).
3. Click "Sair" → redirects to `login.html` and the Supabase session is
   cleared (confirm via `supabase.auth.getSession()` in the console).

- [ ] **Step 4: Commit**

```bash
git add index.html js/main.js
git commit -m "feat: add app shell with sidebar router"
```

---

## Task 11: Plano de Contas screen

**Files:**
- Create: `js/planoContas.js`

**Interfaces:**
- Consumes: `supabase` (`js/supabaseClient.js`), `mostrarToast`/`executarComBloqueio` (`js/shared/toast.js`), `registrarHistorico` (`js/shared/auditoria.js`). Implements the `montarTela(container, contexto)` contract from Task 10.
- Produces: nothing consumed elsewhere directly, but every later screen that needs a `<select>` of contas (Orçamento, Lançamentos, Dashboard, Relatórios) queries `contas`/`plano_contas` straight from Supabase rather than importing this module — screens stay decoupled from each other, only sharing the database.

- [ ] **Step 1: Write `js/planoContas.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Contas de Receita e Despesa</h3>
                <button class="btn-primary" id="btn-nova-conta">+ Nova Conta</button>
            </div>
            <table class="data-table">
                <thead><tr><th>Tipo</th><th>Conta</th><th></th></tr></thead>
                <tbody id="plano-contas-body"><tr><td colspan="3" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>

        <div class="modal" id="modal-conta">
            <div class="modal-content">
                <h3 id="modal-conta-titulo">Nova Conta</h3>
                <form id="form-conta">
                    <input type="hidden" id="conta-id">
                    <div class="form-group">
                        <label for="conta-tipo">Tipo</label>
                        <select id="conta-tipo" required>
                            <option value="RECEITA">Receita</option>
                            <option value="DESPESA">Despesa</option>
                        </select>
                    </div>
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
            supabase.from('plano_contas').select('*').order('tipo'),
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

    function idPlanoPorTipo(tipo) {
        return planos.find(p => p.tipo === tipo)?.id ?? null;
    }

    function renderizar() {
        const tbody = container.querySelector('#plano-contas-body');
        if (!contas.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhuma conta cadastrada.</td></tr>';
            return;
        }
        tbody.innerHTML = contas.map(conta => {
            const plano = planos.find(p => p.id === conta.plano_id);
            const tipo = plano?.tipo === 'RECEITA' ? 'Receita' : 'Despesa';
            const badge = plano?.tipo === 'RECEITA' ? 'badge-receita' : 'badge-despesa';
            return `<tr>
                <td><span class="badge ${badge}">${tipo}</span></td>
                <td>${conta.nome}</td>
                <td>
                    <button class="btn-secondary" data-editar="${conta.id}">Editar</button>
                    <button class="btn-danger" data-excluir="${conta.id}">Excluir</button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-editar]').forEach(btn =>
            btn.addEventListener('click', () => abrirModal(contas.find(c => c.id === Number(btn.dataset.editar)))));
        tbody.querySelectorAll('[data-excluir]').forEach(btn =>
            btn.addEventListener('click', () => excluirConta(Number(btn.dataset.excluir))));
    }

    function abrirModal(conta) {
        const modal = container.querySelector('#modal-conta');
        container.querySelector('#modal-conta-titulo').textContent = conta ? 'Editar Conta' : 'Nova Conta';
        container.querySelector('#conta-id').value = conta?.id ?? '';
        container.querySelector('#conta-nome').value = conta?.nome ?? '';
        const plano = conta ? planos.find(p => p.id === conta.plano_id) : null;
        container.querySelector('#conta-tipo').value = plano?.tipo ?? 'RECEITA';
        modal.classList.add('show');
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

    container.querySelector('#btn-nova-conta').addEventListener('click', () => abrirModal(null));
    container.querySelector('#btn-cancelar-conta').addEventListener('click', () =>
        container.querySelector('#modal-conta').classList.remove('show'));

    container.querySelector('#form-conta').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const id = container.querySelector('#conta-id').value;
            const nome = container.querySelector('#conta-nome').value.trim();
            const tipo = container.querySelector('#conta-tipo').value;
            const planoId = idPlanoPorTipo(tipo);

            const payload = { plano_id: planoId, nome };
            const { error } = id
                ? await supabase.from('contas').update(payload).eq('id', id)
                : await supabase.from('contas').insert(payload);

            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Plano de Contas', id ? 'EDIÇÃO' : 'INSERÇÃO', `Conta "${nome}" (${tipo})`);
            mostrarToast('Conta salva.', 'sucesso');
            container.querySelector('#modal-conta').classList.remove('show');
            carregar();
        });
    });

    await carregar();
}
```

- [ ] **Step 2: Manual verification**

1. Log in as the admin test account, open "Plano de Contas" → confirm the
   seeded accounts from `schema.sql` (Salário, Moradia, etc.) render with
   the correct Receita/Despesa badge.
2. Create a new conta, edit it, delete it — confirm each action shows a
   toast and the table refreshes.
3. In the Supabase dashboard, confirm a row was written to
   `historico_auditoria` for each action.
4. Log in as the `membro` test account (after approving it via direct SQL:
   `update perfis set status = 'aprovado' where email = '...'`, since Task
   18 hasn't built the approval UI yet) and confirm they can also create/
   edit/delete — structural data has no ownership restriction per the spec.

- [ ] **Step 3: Commit**

```bash
git add js/planoContas.js
git commit -m "feat: add Plano de Contas screen"
```

---

## Task 12: Orçamento screen

**Files:**
- Create: `js/orcamento.js`

**Interfaces:**
- Consumes: `supabase`, `mostrarToast`/`executarComBloqueio`, `registrarHistorico`, `formatarMoeda` (`js/shared/formato.js`). Implements `montarTela(container, contexto)`.

- [ ] **Step 1: Write `js/orcamento.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarMoeda } from './shared/formato.js';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export async function montarTela(container) {
    const anoAtual = new Date().getFullYear();

    container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Orçamento por conta</h3>
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

    let contas = [];
    let valores = [];

    async function carregar() {
        const ano = Number(selectAno.value);
        const [{ data: contasData, error: erroContas }, { data: valoresData, error: erroValores }] = await Promise.all([
            supabase.from('contas').select('*, plano_contas(tipo)').order('nome'),
            supabase.from('orcamento_valores').select('*').eq('ano', ano)
        ]);
        if (erroContas || erroValores) {
            mostrarToast('Erro ao carregar orçamento: ' + (erroContas || erroValores).message, 'erro');
            return;
        }
        contas = contasData;
        valores = valoresData;
        renderizar(ano);
    }

    function valorDe(contaId, mes) {
        return valores.find(v => v.conta_id === contaId && v.mes === mes)?.valor ?? 0;
    }

    function renderizar(ano) {
        const tbody = container.querySelector('#orcamento-body');
        tbody.innerHTML = contas.map(conta => {
            const celulas = MESES.map((_, i) => {
                const mes = i + 1;
                return `<td><input type="number" step="0.01" min="0" style="width:80px;"
                    data-conta="${conta.id}" data-mes="${mes}" value="${valorDe(conta.id, mes)}"></td>`;
            }).join('');
            const total = MESES.reduce((soma, _, i) => soma + valorDe(conta.id, i + 1), 0);
            return `<tr><td>${conta.nome}</td>${celulas}<td><strong data-total="${conta.id}">${formatarMoeda(total)}</strong></td></tr>`;
        }).join('');

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

        const totalEl = container.querySelector(`[data-total="${contaId}"]`);
        const total = MESES.reduce((soma, _, i) => soma + valorDe(contaId, i + 1), 0);
        totalEl.textContent = formatarMoeda(total);

        const conta = contas.find(c => c.id === contaId);
        await registrarHistorico('Orçamento', 'EDIÇÃO', `${conta?.nome} — ${MESES[mes - 1]}/${ano}: ${formatarMoeda(valor)}`);
    }

    await carregar();
}
```

- [ ] **Step 2: Manual verification**

1. Open "Orçamento" → confirm every conta from Plano de Contas shows a row
   with 12 month inputs, defaulting to 0.
2. Change a value in one cell, tab out (triggers the `change` event) →
   confirm a toast is not shown per se (this screen saves silently on
   blur, matching a spreadsheet-like feel) but the row's Total column
   updates immediately and a row appears in `historico_auditoria`.
3. Reload the page → confirm the value persisted (re-fetches from
   `orcamento_valores`).
4. Switch the year selector → confirm the grid reloads with that year's
   values (all zero for a year with no data yet).

- [ ] **Step 3: Commit**

```bash
git add js/orcamento.js
git commit -m "feat: add Orçamento screen"
```

---

## Task 13: Lançamentos screen

**Files:**
- Create: `js/lancamentos.js`

**Interfaces:**
- Consumes: `supabase`, `mostrarToast`/`executarComBloqueio`, `registrarHistorico`, `formatarMoeda`/`formatarData`. Implements `montarTela(container, contexto)` — uses `contexto.perfil.id`/`contexto.perfil.papel` to decide whether Edit/Excluir show for a given row (RLS still enforces this server-side regardless of what the UI hides).
- Produces: rows in `lancamentos` and files in the `comprovantes` Storage bucket, both read by Dashboard (Task 14), Prestação de Contas (Task 15), Conciliação Bancária (Task 16), Transparência (Task 18) and Relatórios (Task 17).

- [ ] **Step 1: Write `js/lancamentos.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarMoeda, formatarData } from './shared/formato.js';

const FORMAS_PAGAMENTO = { pix: 'Pix', transferencia: 'Transferência', cartao: 'Cartão', dinheiro: 'Dinheiro', boleto: 'Boleto' };

export async function montarTela(container, contexto) {
    container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Lançamentos</h3>
                <button class="btn-primary" id="btn-novo-lancamento">+ Novo Lançamento</button>
            </div>
            <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
                <select id="filtro-tipo"><option value="">Todos os tipos</option><option value="RECEITA">Receita</option><option value="DESPESA">Despesa</option></select>
                <select id="filtro-conta"><option value="">Todas as contas</option></select>
            </div>
            <table class="data-table">
                <thead><tr><th>Data</th><th>Tipo</th><th>Conta</th><th>Histórico</th><th>Quem lançou</th><th>Valor</th><th>Comprovante</th><th></th></tr></thead>
                <tbody id="lancamentos-body"><tr><td colspan="8" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>

        <div class="modal" id="modal-lancamento">
            <div class="modal-content">
                <h3 id="modal-lancamento-titulo">Novo Lançamento</h3>
                <form id="form-lancamento">
                    <input type="hidden" id="lancamento-id">
                    <div class="form-group">
                        <label for="lancamento-tipo">Tipo</label>
                        <select id="lancamento-tipo" required>
                            <option value="RECEITA">Receita</option>
                            <option value="DESPESA">Despesa</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-conta">Conta</label>
                        <select id="lancamento-conta" required></select>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-data">Data</label>
                        <input type="date" id="lancamento-data" required>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-historico">Histórico</label>
                        <input type="text" id="lancamento-historico" required>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-descricao">Descrição (opcional)</label>
                        <textarea id="lancamento-descricao" rows="2"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-valor">Valor (R$)</label>
                        <input type="number" id="lancamento-valor" step="0.01" min="0.01" required>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-forma">Forma de pagamento</label>
                        <select id="lancamento-forma">
                            ${Object.entries(FORMAS_PAGAMENTO).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-comprovante">Comprovante (opcional)</label>
                        <input type="file" id="lancamento-comprovante" accept="image/*,application/pdf">
                    </div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-lancamento">Cancelar</button>
                        <button type="submit" class="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    let contas = [];
    let lancamentos = [];

    async function carregarContas() {
        const { data, error } = await supabase.from('contas').select('*, plano_contas(tipo)').order('nome');
        if (error) { mostrarToast('Erro ao carregar contas: ' + error.message, 'erro'); return; }
        contas = data;

        const selectFiltro = container.querySelector('#filtro-conta');
        selectFiltro.innerHTML = '<option value="">Todas as contas</option>' +
            contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }

    function popularSelectContaModal(tipo) {
        const select = container.querySelector('#lancamento-conta');
        const filtradas = contas.filter(c => c.plano_contas?.tipo === tipo);
        select.innerHTML = filtradas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }

    async function carregarLancamentos() {
        const tipo = container.querySelector('#filtro-tipo').value;
        const contaId = container.querySelector('#filtro-conta').value;

        let query = supabase.from('lancamentos').select('*, contas(nome), perfis(nome)').order('data', { ascending: false });
        if (tipo) query = query.eq('tipo', tipo);
        if (contaId) query = query.eq('conta_id', contaId);

        const { data, error } = await query;
        if (error) { mostrarToast('Erro ao carregar lançamentos: ' + error.message, 'erro'); return; }
        lancamentos = data;
        renderizar();
    }

    function renderizar() {
        const tbody = container.querySelector('#lancamentos-body');
        if (!lancamentos.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum lançamento encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = lancamentos.map(l => {
            const podeEditar = contexto.perfil.papel === 'admin' || l.usuario_id === contexto.perfil.id;
            const acoes = podeEditar
                ? `<button class="btn-secondary" data-editar="${l.id}">Editar</button>
                   <button class="btn-danger" data-excluir="${l.id}">Excluir</button>`
                : '<span class="text-muted">—</span>';
            const comprovante = l.comprovante_url
                ? `<button class="btn-secondary" data-ver-comprovante="${l.comprovante_url}">Ver</button>`
                : '<span class="text-muted">—</span>';

            return `<tr>
                <td>${formatarData(l.data)}</td>
                <td><span class="badge ${l.tipo === 'RECEITA' ? 'badge-receita' : 'badge-despesa'}">${l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</span></td>
                <td>${l.contas?.nome ?? '—'}</td>
                <td>${l.historico}</td>
                <td>${l.perfis?.nome ?? '—'}</td>
                <td><strong>${formatarMoeda(l.valor)}</strong></td>
                <td>${comprovante}</td>
                <td>${acoes}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-editar]').forEach(btn =>
            btn.addEventListener('click', () => abrirModal(lancamentos.find(l => l.id === Number(btn.dataset.editar)))));
        tbody.querySelectorAll('[data-excluir]').forEach(btn =>
            btn.addEventListener('click', () => excluirLancamento(Number(btn.dataset.excluir))));
        tbody.querySelectorAll('[data-ver-comprovante]').forEach(btn =>
            btn.addEventListener('click', () => abrirComprovante(btn.dataset.verComprovante)));
    }

    async function abrirComprovante(path) {
        const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(path, 60);
        if (error) { mostrarToast('Erro ao abrir comprovante: ' + error.message, 'erro'); return; }
        window.open(data.signedUrl, '_blank');
    }

    function abrirModal(lancamento) {
        const modal = container.querySelector('#modal-lancamento');
        container.querySelector('#modal-lancamento-titulo').textContent = lancamento ? 'Editar Lançamento' : 'Novo Lançamento';
        container.querySelector('#lancamento-id').value = lancamento?.id ?? '';
        container.querySelector('#lancamento-tipo').value = lancamento?.tipo ?? 'DESPESA';
        popularSelectContaModal(container.querySelector('#lancamento-tipo').value);
        container.querySelector('#lancamento-conta').value = lancamento?.conta_id ?? '';
        container.querySelector('#lancamento-data').value = lancamento?.data ?? new Date().toISOString().slice(0, 10);
        container.querySelector('#lancamento-historico').value = lancamento?.historico ?? '';
        container.querySelector('#lancamento-descricao').value = lancamento?.descricao ?? '';
        container.querySelector('#lancamento-valor').value = lancamento?.valor ?? '';
        container.querySelector('#lancamento-forma').value = lancamento?.forma_pagamento ?? 'pix';
        container.querySelector('#lancamento-comprovante').value = '';
        modal.classList.add('show');
    }

    async function excluirLancamento(id) {
        if (!confirm('Excluir este lançamento?')) return;
        const lancamento = lancamentos.find(l => l.id === id);
        const { error } = await supabase.from('lancamentos').delete().eq('id', id);
        if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }
        await registrarHistorico('Lançamentos', 'EXCLUSÃO', `"${lancamento?.historico}" — ${formatarMoeda(lancamento?.valor)}`);
        mostrarToast('Lançamento excluído.', 'sucesso');
        carregarLancamentos();
    }

    async function enviarComprovante(arquivo) {
        const caminho = `${contexto.perfil.id}/${crypto.randomUUID()}-${arquivo.name}`;
        const { error } = await supabase.storage.from('comprovantes').upload(caminho, arquivo);
        if (error) throw new Error('Erro ao enviar comprovante: ' + error.message);
        return caminho;
    }

    container.querySelector('#btn-novo-lancamento').addEventListener('click', () => abrirModal(null));
    container.querySelector('#btn-cancelar-lancamento').addEventListener('click', () =>
        container.querySelector('#modal-lancamento').classList.remove('show'));
    container.querySelector('#lancamento-tipo').addEventListener('change', e => popularSelectContaModal(e.target.value));
    container.querySelector('#filtro-tipo').addEventListener('change', carregarLancamentos);
    container.querySelector('#filtro-conta').addEventListener('change', carregarLancamentos);

    container.querySelector('#form-lancamento').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const id = container.querySelector('#lancamento-id').value;
            const arquivo = container.querySelector('#lancamento-comprovante').files[0];

            let comprovanteUrl;
            try {
                comprovanteUrl = arquivo ? await enviarComprovante(arquivo) : undefined;
            } catch (erro) {
                mostrarToast(erro.message, 'erro');
                return;
            }

            const payload = {
                tipo: container.querySelector('#lancamento-tipo').value,
                conta_id: Number(container.querySelector('#lancamento-conta').value),
                data: container.querySelector('#lancamento-data').value,
                historico: container.querySelector('#lancamento-historico').value.trim(),
                descricao: container.querySelector('#lancamento-descricao').value.trim() || null,
                valor: Number(container.querySelector('#lancamento-valor').value),
                forma_pagamento: container.querySelector('#lancamento-forma').value,
                ...(comprovanteUrl ? { comprovante_url: comprovanteUrl } : {})
            };

            let error;
            if (id) {
                ({ error } = await supabase.from('lancamentos').update(payload).eq('id', id));
            } else {
                payload.usuario_id = contexto.perfil.id;
                ({ error } = await supabase.from('lancamentos').insert(payload));
            }

            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Lançamentos', id ? 'EDIÇÃO' : 'INSERÇÃO', `"${payload.historico}" — ${formatarMoeda(payload.valor)}`);
            mostrarToast('Lançamento salvo.', 'sucesso');
            container.querySelector('#modal-lancamento').classList.remove('show');
            carregarLancamentos();
        });
    });

    await carregarContas();
    popularSelectContaModal('DESPESA');
    await carregarLancamentos();
}
```

- [ ] **Step 2: Manual verification**

1. Log in as the `membro` test account, create a lançamento with a
   comprovante file attached → confirm it appears in the table, "Ver"
   opens the file in a new tab via a signed URL, and Edit/Excluir show for
   this row.
2. Log in as the admin account → confirm the membro's lançamento is
   visible (Transparência-style shared read) and Edit/Excluir show for it
   too (admin override).
3. Create a second `membro` test account, approve it via SQL, log in as
   it, and confirm it can see the first membro's lançamento but Edit/
   Excluir do **not** show for that row (ownership check) — then try
   calling `supabase.from('lancamentos').update(...)` on that row directly
   from the browser console while logged in as this second membro, and
   confirm Postgres rejects it (RLS enforcement, not just UI hiding).
4. Filter by tipo and by conta → confirm the table narrows correctly.

- [ ] **Step 3: Commit**

```bash
git add js/lancamentos.js
git commit -m "feat: add Lançamentos screen with comprovante upload"
```

---

## Task 14: Dashboard screen

**Files:**
- Create: `js/dashboard.js`

**Interfaces:**
- Consumes: `supabase`, `mostrarToast`, `formatarMoeda`. Uses the global `Chart` (loaded via CDN `<script>` in `index.html`, Task 10). Implements `montarTela(container, contexto)`.

- [ ] **Step 1: Write `js/dashboard.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarMoeda } from './shared/formato.js';

let grafico = null;

export async function montarTela(container) {
    const anoAtual = new Date().getFullYear();

    container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Execução do ano</h3>
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
            <h3 style="margin-top:0;">Receitas × Despesas por mês</h3>
            <canvas id="dash-grafico" height="90"></canvas>
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

        const [{ data: lancamentos, error: erroLanc }, { data: orcamentos, error: erroOrc }] = await Promise.all([
            supabase.from('lancamentos').select('tipo, valor, data').gte('data', inicio).lte('data', fim),
            supabase.from('orcamento_valores').select('*, contas(plano_contas(tipo))').eq('ano', ano)
        ]);

        if (erroLanc || erroOrc) {
            mostrarToast('Erro ao carregar dashboard: ' + (erroLanc || erroOrc).message, 'erro');
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

        renderizarGrafico(lancamentos);
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
                    { label: 'Receitas', data: receitasPorMes, backgroundColor: '#16a34a' },
                    { label: 'Despesas', data: despesasPorMes, backgroundColor: '#dc2626' }
                ]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
    }

    await carregar(anoAtual);
}
```

- [ ] **Step 2: Manual verification**

1. With the lançamentos and orçamento data created in Tasks 12-13, open
   "Dashboard" → confirm the Receitas/Despesas cards show correct orçado
   vs realizado totals for the current year, saldo is receitas minus
   despesas colored green/red accordingly, and the bar chart renders one
   bar pair per month with data in the right months.
2. Switch the year selector to a year with no data → confirm all values
   go to zero/R$ 0,00 without throwing.
3. Navigate away and back to Dashboard → confirm the chart re-renders
   cleanly (no duplicate/stacked canvas — `grafico.destroy()` before
   re-creating covers this).

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: add Dashboard screen"
```

---

## Task 15: Prestação de Contas screen

**Files:**
- Create: `js/prestacaoContas.js`

**Interfaces:**
- Consumes: `supabase`, `mostrarToast`, `formatarMoeda`/`formatarData`. Uses the global `XLSX` (loaded via CDN `<script>` in `index.html`, Task 10). Implements `montarTela(container, contexto)`.

- [ ] **Step 1: Write `js/prestacaoContas.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarMoeda, formatarData } from './shared/formato.js';

export async function montarTela(container) {
    const hoje = new Date().toISOString().slice(0, 10);
    const primeiroDiaDoMes = hoje.slice(0, 8) + '01';

    container.innerHTML = `
        <div class="card">
            <h3 style="margin-top:0;">Prestação de Contas entre membros</h3>
            <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap; margin-bottom:1rem;">
                <div class="form-group" style="margin:0;">
                    <label for="pc-data-inicio">De</label>
                    <input type="date" id="pc-data-inicio" value="${primeiroDiaDoMes}">
                </div>
                <div class="form-group" style="margin:0;">
                    <label for="pc-data-fim">Até</label>
                    <input type="date" id="pc-data-fim" value="${hoje}">
                </div>
                <button class="btn-primary" id="btn-gerar-pc">Gerar</button>
                <button class="btn-secondary" id="btn-exportar-pc">Exportar Excel</button>
                <button class="btn-secondary" id="btn-imprimir-pc">Imprimir</button>
            </div>
            <div id="pc-resumo-membros" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; margin-bottom:1.5rem;"></div>
            <table class="data-table">
                <thead><tr><th>Data</th><th>Membro</th><th>Tipo</th><th>Conta</th><th>Histórico</th><th>Valor</th></tr></thead>
                <tbody id="pc-detalhe-body"><tr><td colspan="6" class="text-center">Escolha um período e clique em Gerar.</td></tr></tbody>
            </table>
        </div>
    `;

    let ultimosLancamentos = [];

    async function gerar() {
        const inicio = container.querySelector('#pc-data-inicio').value;
        const fim = container.querySelector('#pc-data-fim').value;

        const { data, error } = await supabase.from('lancamentos')
            .select('*, contas(nome), perfis(nome)')
            .gte('data', inicio).lte('data', fim)
            .order('data');

        if (error) { mostrarToast('Erro ao gerar relatório: ' + error.message, 'erro'); return; }
        ultimosLancamentos = data;
        renderizarResumoPorMembro(data);
        renderizarDetalhe(data);
    }

    function renderizarResumoPorMembro(lancamentos) {
        const porMembro = {};
        lancamentos.forEach(l => {
            const nome = l.perfis?.nome ?? 'Desconhecido';
            if (!porMembro[nome]) porMembro[nome] = { receitas: 0, despesas: 0 };
            if (l.tipo === 'RECEITA') porMembro[nome].receitas += l.valor;
            else porMembro[nome].despesas += l.valor;
        });

        const container2 = container.querySelector('#pc-resumo-membros');
        const nomes = Object.keys(porMembro);
        if (!nomes.length) {
            container2.innerHTML = '<p class="text-muted">Nenhum lançamento no período.</p>';
            return;
        }

        container2.innerHTML = nomes.map(nome => {
            const { receitas, despesas } = porMembro[nome];
            return `<div class="summary-card">
                <div style="font-weight:700;">${nome}</div>
                <div class="text-muted" style="font-size:0.8rem; margin-top:0.4rem;">Receitas: <strong style="color:var(--cor-receita);">${formatarMoeda(receitas)}</strong></div>
                <div class="text-muted" style="font-size:0.8rem;">Despesas: <strong style="color:var(--cor-despesa);">${formatarMoeda(despesas)}</strong></div>
            </div>`;
        }).join('');
    }

    function renderizarDetalhe(lancamentos) {
        const tbody = container.querySelector('#pc-detalhe-body');
        if (!lancamentos.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum lançamento no período.</td></tr>';
            return;
        }
        tbody.innerHTML = lancamentos.map(l => `<tr>
            <td>${formatarData(l.data)}</td>
            <td>${l.perfis?.nome ?? '—'}</td>
            <td><span class="badge ${l.tipo === 'RECEITA' ? 'badge-receita' : 'badge-despesa'}">${l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</span></td>
            <td>${l.contas?.nome ?? '—'}</td>
            <td>${l.historico}</td>
            <td>${formatarMoeda(l.valor)}</td>
        </tr>`).join('');
    }

    function exportarExcel() {
        if (!ultimosLancamentos.length) { mostrarToast('Gere o relatório antes de exportar.', 'erro'); return; }
        const linhas = ultimosLancamentos.map(l => ({
            Data: formatarData(l.data),
            Membro: l.perfis?.nome ?? '',
            Tipo: l.tipo,
            Conta: l.contas?.nome ?? '',
            Histórico: l.historico,
            Valor: l.valor
        }));
        const planilha = XLSX.utils.json_to_sheet(linhas);
        const livro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(livro, planilha, 'Prestação de Contas');
        XLSX.writeFile(livro, `prestacao-de-contas-${container.querySelector('#pc-data-inicio').value}-a-${container.querySelector('#pc-data-fim').value}.xlsx`);
    }

    container.querySelector('#btn-gerar-pc').addEventListener('click', gerar);
    container.querySelector('#btn-exportar-pc').addEventListener('click', exportarExcel);
    container.querySelector('#btn-imprimir-pc').addEventListener('click', () => window.print());

    await gerar();
}
```

- [ ] **Step 2: Manual verification**

1. With lançamentos from at least two different member accounts (Task 13),
   open "Prestação de Contas", pick a date range covering both, click
   "Gerar" → confirm one summary card per member with correct receitas/
   despesas totals, and a detail table listing every lançamento in range
   with the right member name.
2. Click "Exportar Excel" → confirm a `.xlsx` file downloads and opens
   with the expected columns.
3. Click "Imprimir" → confirm the browser print dialog opens showing only
   the report content (sidebar/header/buttons hidden per the `@media
   print` rule in `css/styles.css`, Task 8).
4. Change the date range to a period with no lançamentos → confirm both
   the summary and detail table show "Nenhum lançamento no período"
   instead of erroring.

- [ ] **Step 3: Commit**

```bash
git add js/prestacaoContas.js
git commit -m "feat: add Prestação de Contas screen"
```

---

## Task 16: Conciliação Bancária screen

**Files:**
- Create: `js/conciliacao.js`

**Interfaces:**
- Consumes: `supabase`, `mostrarToast`/`executarComBloqueio`, `registrarHistorico`, `formatarMoeda`/`formatarData`, `parseOFX`/`lerArquivoComoTexto` (`js/shared/ofxParser.js`), and Task 2's `conciliar_extrato`/`desfazer_conciliacao` RPC functions (called via `supabase.rpc(...)`, not raw `.update()` calls on `lancamentos` — see Task 2's Interfaces note on why). Implements `montarTela(container, contexto)`.

- [ ] **Step 1: Write `js/conciliacao.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarMoeda, formatarData } from './shared/formato.js';
import { parseOFX, lerArquivoComoTexto } from './shared/ofxParser.js';

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Contas bancárias</h3>
                <button class="btn-primary" id="btn-nova-conta-bancaria">+ Nova Conta Bancária</button>
            </div>
            <table class="data-table">
                <thead><tr><th>Nome</th><th>Banco</th><th>Agência</th><th>Número</th><th></th></tr></thead>
                <tbody id="contas-bancarias-body"><tr><td colspan="5" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>

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

        <div class="modal" id="modal-conta-bancaria">
            <div class="modal-content">
                <h3>Nova Conta Bancária</h3>
                <form id="form-conta-bancaria">
                    <div class="form-group"><label for="cb-nome">Nome</label><input type="text" id="cb-nome" required></div>
                    <div class="form-group"><label for="cb-banco">Banco</label><input type="text" id="cb-banco"></div>
                    <div class="form-group"><label for="cb-agencia">Agência</label><input type="text" id="cb-agencia"></div>
                    <div class="form-group"><label for="cb-numero">Número da conta</label><input type="text" id="cb-numero"></div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-conta-bancaria">Cancelar</button>
                        <button type="submit" class="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="modal" id="modal-importar-ofx">
            <div class="modal-content">
                <h3>Importar extrato</h3>
                <form id="form-importar-ofx">
                    <div class="form-group">
                        <label for="ofx-conta">Conta bancária</label>
                        <select id="ofx-conta" required></select>
                    </div>
                    <div class="form-group">
                        <label for="ofx-arquivo">Arquivo .OFX</label>
                        <input type="file" id="ofx-arquivo" accept=".ofx" required>
                    </div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-importar-ofx">Cancelar</button>
                        <button type="submit" class="btn-primary">Importar</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="modal" id="modal-conciliar">
            <div class="modal-content">
                <h3>Conciliar transação</h3>
                <p id="conciliar-resumo" class="text-muted"></p>
                <input type="text" id="conciliar-busca" placeholder="Buscar lançamento por histórico..." style="width:100%; margin-bottom:0.75rem; padding:0.5rem; border:1px solid var(--cor-borda); border-radius:8px;">
                <div id="conciliar-candidatos" style="max-height:280px; overflow-y:auto;"></div>
                <div style="display:flex; justify-content:flex-end; margin-top:1rem;">
                    <button type="button" class="btn-secondary" id="btn-cancelar-conciliar">Fechar</button>
                </div>
            </div>
        </div>
    `;

    let contasBancarias = [];
    let extratoItens = [];
    let itemConciliacaoAtual = null;

    async function carregarContasBancarias() {
        const { data, error } = await supabase.from('contas_bancarias').select('*').order('nome');
        if (error) { mostrarToast('Erro ao carregar contas bancárias: ' + error.message, 'erro'); return; }
        contasBancarias = data;
        renderizarContasBancarias();

        const selectFiltro = container.querySelector('#filtro-conta-bancaria');
        const selectOfx = container.querySelector('#ofx-conta');
        const opcoes = contasBancarias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        selectFiltro.innerHTML = '<option value="">Todas as contas</option>' + opcoes;
        selectOfx.innerHTML = opcoes;
    }

    function renderizarContasBancarias() {
        const tbody = container.querySelector('#contas-bancarias-body');
        if (!contasBancarias.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma conta bancária cadastrada.</td></tr>';
            return;
        }
        tbody.innerHTML = contasBancarias.map(c => `<tr>
            <td>${c.nome}</td><td>${c.banco ?? '—'}</td><td>${c.agencia ?? '—'}</td><td>${c.numero_conta ?? '—'}</td>
            <td><button class="btn-danger" data-excluir-conta="${c.id}">Excluir</button></td>
        </tr>`).join('');

        tbody.querySelectorAll('[data-excluir-conta]').forEach(btn =>
            btn.addEventListener('click', () => excluirContaBancaria(Number(btn.dataset.excluirConta))));
    }

    async function excluirContaBancaria(id) {
        if (!confirm('Excluir esta conta bancária? Os itens de extrato importados dela também serão excluídos.')) return;
        const { error } = await supabase.from('contas_bancarias').delete().eq('id', id);
        if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }
        mostrarToast('Conta bancária excluída.', 'sucesso');
        await carregarContasBancarias();
        await carregarExtrato();
    }

    async function carregarExtrato() {
        const contaId = container.querySelector('#filtro-conta-bancaria').value;
        let query = supabase.from('extrato_itens').select('*, contas_bancarias(nome), lancamentos(data, historico)').order('data', { ascending: false });
        if (contaId) query = query.eq('conta_bancaria_id', contaId);

        const { data, error } = await query;
        if (error) { mostrarToast('Erro ao carregar extrato: ' + error.message, 'erro'); return; }
        extratoItens = data;
        renderizarExtrato();
    }

    function renderizarExtrato() {
        const tbody = container.querySelector('#extrato-body');
        if (!extratoItens.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum item de extrato. Importe um arquivo .OFX para começar.</td></tr>';
            return;
        }
        tbody.innerHTML = extratoItens.map(it => {
            const badgeStatus = it.status === 'conciliado'
                ? '<span class="badge badge-aprovado">Conciliado</span>'
                : '<span class="badge badge-pendente">Pendente</span>';
            const acao = it.status === 'conciliado'
                ? `<button class="btn-secondary" data-desfazer="${it.id}">Desfazer</button>`
                : `<button class="btn-primary" data-conciliar="${it.id}">Conciliar</button>`;
            return `<tr>
                <td>${it.contas_bancarias?.nome ?? '—'}</td>
                <td>${formatarData(it.data)}</td>
                <td>${it.historico}</td>
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

    async function abrirModalConciliar(itemId) {
        itemConciliacaoAtual = extratoItens.find(it => it.id === itemId);
        container.querySelector('#conciliar-resumo').textContent =
            `${formatarData(itemConciliacaoAtual.data)} · ${itemConciliacaoAtual.historico} · ${formatarMoeda(itemConciliacaoAtual.valor)}`;
        container.querySelector('#conciliar-busca').value = '';
        await renderizarCandidatos('');
        container.querySelector('#modal-conciliar').classList.add('show');
    }

    async function renderizarCandidatos(busca) {
        const tipoLancamento = itemConciliacaoAtual.tipo === 'CREDITO' ? 'RECEITA' : 'DESPESA';
        let query = supabase.from('lancamentos').select('*, contas(nome)')
            .eq('tipo', tipoLancamento).is('conta_bancaria_id', null)
            .order('data', { ascending: false }).limit(30);
        if (busca) query = query.ilike('historico', `%${busca}%`);

        const { data, error } = await query;
        const painel = container.querySelector('#conciliar-candidatos');
        if (error) { painel.innerHTML = `<p class="text-muted">Erro ao buscar lançamentos: ${error.message}</p>`; return; }
        if (!data.length) { painel.innerHTML = '<p class="text-muted">Nenhum lançamento compatível encontrado.</p>'; return; }

        painel.innerHTML = data.map(l => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--cor-borda);">
                <span>${formatarData(l.data)} — ${l.historico} (${l.contas?.nome ?? '—'})</span>
                <span style="display:flex; align-items:center; gap:0.6rem;">
                    <strong>${formatarMoeda(l.valor)}</strong>
                    <button class="btn-primary" data-selecionar="${l.id}">Selecionar</button>
                </span>
            </div>
        `).join('');

        painel.querySelectorAll('[data-selecionar]').forEach(btn =>
            btn.addEventListener('click', () => conciliarComLancamento(Number(btn.dataset.selecionar))));
    }

    async function conciliarComLancamento(lancamentoId) {
        // RPC (Task 2), não update direto em duas tabelas: conciliar um
        // lançamento de outro membro a uma conta bancária compartilhada é
        // uma ação estrutural da família, e um update direto em
        // `lancamentos` esbarraria na policy de dono-ou-admin daquela
        // tabela (pensada para edição de campos, não para isto).
        const { error } = await supabase.rpc('conciliar_extrato', {
            p_item_id: itemConciliacaoAtual.id,
            p_lancamento_id: lancamentoId
        });

        if (error) { mostrarToast('Erro ao conciliar: ' + error.message, 'erro'); return; }
        await registrarHistorico('Conciliação Bancária', 'CONCILIAÇÃO', `Item de extrato #${itemConciliacaoAtual.id} conciliado com lançamento #${lancamentoId}`);
        mostrarToast('Conciliado com sucesso.', 'sucesso');
        container.querySelector('#modal-conciliar').classList.remove('show');
        await carregarExtrato();
    }

    async function desfazerConciliacao(itemId) {
        const { error } = await supabase.rpc('desfazer_conciliacao', { p_item_id: itemId });
        if (error) { mostrarToast('Erro ao desfazer: ' + error.message, 'erro'); return; }
        mostrarToast('Conciliação desfeita.', 'sucesso');
        await carregarExtrato();
    }

    // --- Modais de cadastro de conta bancária -----------------------------

    container.querySelector('#btn-nova-conta-bancaria').addEventListener('click', () =>
        container.querySelector('#modal-conta-bancaria').classList.add('show'));
    container.querySelector('#btn-cancelar-conta-bancaria').addEventListener('click', () =>
        container.querySelector('#modal-conta-bancaria').classList.remove('show'));

    container.querySelector('#form-conta-bancaria').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const payload = {
                nome: container.querySelector('#cb-nome').value.trim(),
                banco: container.querySelector('#cb-banco').value.trim() || null,
                agencia: container.querySelector('#cb-agencia').value.trim() || null,
                numero_conta: container.querySelector('#cb-numero').value.trim() || null
            };
            const { error } = await supabase.from('contas_bancarias').insert(payload);
            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Conciliação Bancária', 'INSERÇÃO', `Conta bancária "${payload.nome}" cadastrada`);
            mostrarToast('Conta bancária salva.', 'sucesso');
            container.querySelector('#modal-conta-bancaria').classList.remove('show');
            e.target.reset();
            await carregarContasBancarias();
        });
    });

    // --- Modal de importação de extrato -----------------------------------

    container.querySelector('#btn-importar-ofx').addEventListener('click', () => {
        if (!contasBancarias.length) { mostrarToast('Cadastre uma conta bancária antes de importar.', 'erro'); return; }
        container.querySelector('#modal-importar-ofx').classList.add('show');
    });
    container.querySelector('#btn-cancelar-importar-ofx').addEventListener('click', () =>
        container.querySelector('#modal-importar-ofx').classList.remove('show'));

    container.querySelector('#form-importar-ofx').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const contaId = Number(container.querySelector('#ofx-conta').value);
            const arquivo = container.querySelector('#ofx-arquivo').files[0];
            if (!arquivo) { mostrarToast('Selecione um arquivo .OFX.', 'erro'); return; }

            let itens;
            try {
                itens = parseOFX(await lerArquivoComoTexto(arquivo));
            } catch (erro) {
                mostrarToast('Erro ao ler o arquivo: ' + erro.message, 'erro');
                return;
            }
            if (!itens.length) { mostrarToast('Nenhuma transação encontrada nesse arquivo.', 'erro'); return; }

            const { data: existentes } = await supabase.from('extrato_itens')
                .select('fitid').eq('conta_bancaria_id', contaId);
            const fitidsExistentes = new Set((existentes ?? []).map(e => e.fitid));
            const novos = itens.filter(it => !fitidsExistentes.has(it.fitid))
                .map(it => ({ ...it, conta_bancaria_id: contaId, status: 'pendente' }));

            if (!novos.length) { mostrarToast('Todas as transações desse arquivo já haviam sido importadas.', 'sucesso'); return; }

            const { error } = await supabase.from('extrato_itens').insert(novos);
            if (error) { mostrarToast('Erro ao importar: ' + error.message, 'erro'); return; }

            await registrarHistorico('Conciliação Bancária', 'IMPORTAÇÃO', `${novos.length} transação(ões) importada(s) de ${arquivo.name}`);
            mostrarToast(`${novos.length} transação(ões) importada(s).`, 'sucesso');
            container.querySelector('#modal-importar-ofx').classList.remove('show');
            e.target.reset();
            await carregarExtrato();
        });
    });

    container.querySelector('#filtro-conta-bancaria').addEventListener('change', carregarExtrato);
    container.querySelector('#btn-cancelar-conciliar').addEventListener('click', () =>
        container.querySelector('#modal-conciliar').classList.remove('show'));
    container.querySelector('#conciliar-busca').addEventListener('input', e => renderizarCandidatos(e.target.value));

    await carregarContasBancarias();
    await carregarExtrato();
}
```

- [ ] **Step 2: Manual verification**

1. Register a test conta bancária.
2. Build a small sample `.ofx` file locally (same shape as the one used in
   `test/ofxParser.test.js`, Task 6) and import it → confirm the two
   sample transactions appear under "Extrato importado" with status
   Pendente.
3. Create a matching lançamento (via Task 13) with the same tipo/valor as
   one imported transaction, then click "Conciliar" on that transaction →
   confirm it shows up in the candidate list, selecting it flips the
   extrato item to "Conciliado" and sets `conta_bancaria_id` on the
   lançamento (check in the Supabase dashboard).
4. Click "Desfazer" → confirm it goes back to "Pendente" and the
   lançamento's `conta_bancaria_id` clears.
5. Re-import the same `.ofx` file → confirm the toast reports that every
   transaction already existed (fitid de-duplication working) and no new
   rows are inserted.

- [ ] **Step 3: Commit**

```bash
git add js/conciliacao.js
git commit -m "feat: add Conciliação Bancária screen"
```

---

## Task 17: Relatórios screen

**Files:**
- Create: `js/relatorios.js`

**Interfaces:**
- Consumes: `supabase`, `mostrarToast`, `formatarMoeda`. Uses the global `Chart`. Implements `montarTela(container, contexto)`.

- [ ] **Step 1: Write `js/relatorios.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarMoeda } from './shared/formato.js';

let grafico = null;

export async function montarTela(container) {
    const hoje = new Date().toISOString().slice(0, 10);
    const inicioAno = hoje.slice(0, 4) + '-01-01';

    container.innerHTML = `
        <div class="card">
            <h3 style="margin-top:0;">Análise por categoria</h3>
            <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap; margin-bottom:1rem;">
                <div class="form-group" style="margin:0;"><label for="rel-inicio">De</label><input type="date" id="rel-inicio" value="${inicioAno}"></div>
                <div class="form-group" style="margin:0;"><label for="rel-fim">Até</label><input type="date" id="rel-fim" value="${hoje}"></div>
                <div class="form-group" style="margin:0;">
                    <label for="rel-tipo">Tipo</label>
                    <select id="rel-tipo"><option value="DESPESA">Despesas</option><option value="RECEITA">Receitas</option></select>
                </div>
                <button class="btn-primary" id="btn-gerar-relatorio">Gerar</button>
            </div>
            <canvas id="rel-grafico" height="100"></canvas>
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

        const { data, error } = await supabase.from('lancamentos')
            .select('valor, contas(nome)').eq('tipo', tipo).gte('data', inicio).lte('data', fim);

        if (error) { mostrarToast('Erro ao gerar relatório: ' + error.message, 'erro'); return; }

        const totalPorConta = {};
        data.forEach(l => {
            const nome = l.contas?.nome ?? 'Sem conta';
            totalPorConta[nome] = (totalPorConta[nome] ?? 0) + l.valor;
        });

        const contas = Object.keys(totalPorConta).sort((a, b) => totalPorConta[b] - totalPorConta[a]);
        const totalGeral = contas.reduce((s, c) => s + totalPorConta[c], 0);

        renderizarTabela(contas, totalPorConta, totalGeral);
        renderizarGrafico(contas, totalPorConta);
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
            return `<tr><td>${nome}</td><td>${formatarMoeda(valor)}</td><td>${pct}%</td></tr>`;
        }).join('');
    }

    function renderizarGrafico(contas, totalPorConta) {
        if (grafico) grafico.destroy();
        const cores = ['#0f766e','#16a34a','#f59e0b','#dc2626','#6366f1','#ec4899','#0891b2','#84cc16','#8b5cf6','#f97316'];
        grafico = new Chart(container.querySelector('#rel-grafico'), {
            type: 'doughnut',
            data: {
                labels: contas,
                datasets: [{ data: contas.map(c => totalPorConta[c]), backgroundColor: contas.map((_, i) => cores[i % cores.length]) }]
            },
            options: { responsive: true }
        });
    }

    container.querySelector('#btn-gerar-relatorio').addEventListener('click', gerar);
    await gerar();
}
```

- [ ] **Step 2: Manual verification**

1. With lançamentos across at least three different contas, open
   "Relatórios", leave the default (Despesas, current year) and click
   "Gerar" → confirm the doughnut chart and the table both show one slice/
   row per conta with a value, and the percentages sum to ~100%.
2. Switch tipo to "Receitas" → confirm the chart/table update to receita
   data only.
3. Pick a date range with no lançamentos → confirm the table shows
   "Nenhum lançamento no período" and the chart doesn't throw (empty
   `contas` array).

- [ ] **Step 3: Commit**

```bash
git add js/relatorios.js
git commit -m "feat: add Relatórios screen"
```

---

## Task 18: Transparência screen

**Files:**
- Create: `js/transparencia.js`

**Interfaces:**
- Consumes: `supabase`, `mostrarToast`, `formatarMoeda`/`formatarData`. Implements `montarTela(container, contexto)`.

- [ ] **Step 1: Write `js/transparencia.js`**

Read-only consolidated view — deliberately has no Editar/Excluir controls
regardless of who is logged in, unlike Lançamentos (Task 13). This is the
"painel só para membros logados" from the spec: every approved member sees
every lançamento from every member here, but can only act on their own
from the Lançamentos screen.

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarMoeda, formatarData } from './shared/formato.js';

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <h3 style="margin-top:0;">Transparência — todos os lançamentos da família</h3>
            <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
                <select id="transp-filtro-membro"><option value="">Todos os membros</option></select>
                <select id="transp-filtro-tipo"><option value="">Todos os tipos</option><option value="RECEITA">Receita</option><option value="DESPESA">Despesa</option></select>
            </div>
            <table class="data-table">
                <thead><tr><th>Data</th><th>Membro</th><th>Tipo</th><th>Conta</th><th>Histórico</th><th>Valor</th></tr></thead>
                <tbody id="transp-body"><tr><td colspan="6" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>
    `;

    const { data: membros } = await supabase.from('perfis').select('id, nome').eq('status', 'aprovado').order('nome');
    const selectMembro = container.querySelector('#transp-filtro-membro');
    selectMembro.innerHTML += (membros ?? []).map(m => `<option value="${m.id}">${m.nome}</option>`).join('');

    async function carregar() {
        const membroId = selectMembro.value;
        const tipo = container.querySelector('#transp-filtro-tipo').value;

        let query = supabase.from('lancamentos').select('*, contas(nome), perfis(nome)').order('data', { ascending: false });
        if (membroId) query = query.eq('usuario_id', membroId);
        if (tipo) query = query.eq('tipo', tipo);

        const { data, error } = await query;
        if (error) { mostrarToast('Erro ao carregar: ' + error.message, 'erro'); return; }
        renderizar(data);
    }

    function renderizar(lancamentos) {
        const tbody = container.querySelector('#transp-body');
        if (!lancamentos.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum lançamento encontrado.</td></tr>';
            return;
        }
        tbody.innerHTML = lancamentos.map(l => `<tr>
            <td>${formatarData(l.data)}</td>
            <td>${l.perfis?.nome ?? '—'}</td>
            <td><span class="badge ${l.tipo === 'RECEITA' ? 'badge-receita' : 'badge-despesa'}">${l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</span></td>
            <td>${l.contas?.nome ?? '—'}</td>
            <td>${l.historico}</td>
            <td>${formatarMoeda(l.valor)}</td>
        </tr>`).join('');
    }

    selectMembro.addEventListener('change', carregar);
    container.querySelector('#transp-filtro-tipo').addEventListener('change', carregar);

    await carregar();
}
```

- [ ] **Step 2: Manual verification**

1. Logged in as any approved member (not just admin), open "Transparência"
   → confirm lançamentos from every member appear, including ones the
   logged-in user doesn't own (no Editar/Excluir columns at all here).
2. Filter by a specific membro → confirm only their lançamentos show.
3. Log in as a `pendente` user directly hitting `index.html#transparencia`
   → confirm `exigirSessao()` (Task 9) still blocks them with the
   "Aguardando aprovação" screen before this module ever loads (this is
   enforced once in `main.js`/`auth.js`, not per-screen).

- [ ] **Step 3: Commit**

```bash
git add js/transparencia.js
git commit -m "feat: add Transparência screen"
```

---

## Task 19: Membros screen

**Files:**
- Create: `js/membros.js`

**Interfaces:**
- Consumes: `supabase`, `mostrarToast`/`executarComBloqueio`, `registrarHistorico`, `formatarDataHora`. Implements `montarTela(container, contexto)`.

- [ ] **Step 1: Write `js/membros.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarDataHora } from './shared/formato.js';

export async function montarTela(container, contexto) {
    const souAdmin = contexto.perfil.papel === 'admin';

    container.innerHTML = `
        <div class="card">
            <h3 style="margin-top:0;">Membros da família</h3>
            ${souAdmin ? '' : '<p class="text-muted">Somente administradores podem aprovar novos membros ou alterar papéis.</p>'}
            <table class="data-table">
                <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Desde</th>${souAdmin ? '<th></th>' : ''}</tr></thead>
                <tbody id="membros-body"><tr><td colspan="${souAdmin ? 6 : 5}" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>
    `;

    async function carregar() {
        const { data, error } = await supabase.from('perfis').select('*').order('created_at');
        if (error) { mostrarToast('Erro ao carregar membros: ' + error.message, 'erro'); return; }
        renderizar(data);
    }

    function renderizar(membros) {
        const tbody = container.querySelector('#membros-body');
        tbody.innerHTML = membros.map(m => {
            const badgeStatus = m.status === 'aprovado' ? 'badge-aprovado' : 'badge-pendente';
            const textoStatus = m.status === 'aprovado' ? 'Aprovado' : 'Pendente';
            let acoes = '';
            if (souAdmin && m.id !== contexto.perfil.id) {
                if (m.status === 'pendente') {
                    acoes += `<button class="btn-primary" data-aprovar="${m.id}">Aprovar</button> `;
                }
                const proximoPapel = m.papel === 'admin' ? 'membro' : 'admin';
                acoes += `<button class="btn-secondary" data-alternar-papel="${m.id}" data-proximo="${proximoPapel}">Tornar ${proximoPapel}</button>`;
            }
            return `<tr>
                <td>${m.nome}</td><td>${m.email}</td><td>${m.papel}</td>
                <td><span class="badge ${badgeStatus}">${textoStatus}</span></td>
                <td>${formatarDataHora(m.created_at)}</td>
                ${souAdmin ? `<td>${acoes}</td>` : ''}
            </tr>`;
        }).join('');

        if (!souAdmin) return;
        tbody.querySelectorAll('[data-aprovar]').forEach(btn =>
            btn.addEventListener('click', () => aprovar(btn.dataset.aprovar)));
        tbody.querySelectorAll('[data-alternar-papel]').forEach(btn =>
            btn.addEventListener('click', () => alternarPapel(btn.dataset.alternarPapel, btn.dataset.proximo)));
    }

    async function aprovar(id) {
        const { error } = await supabase.from('perfis').update({ status: 'aprovado' }).eq('id', id);
        if (error) { mostrarToast('Erro ao aprovar: ' + error.message, 'erro'); return; }
        await registrarHistorico('Membros', 'APROVAÇÃO', `Usuário ${id} aprovado`);
        mostrarToast('Membro aprovado.', 'sucesso');
        carregar();
    }

    async function alternarPapel(id, proximoPapel) {
        if (!confirm(`Confirma tornar este usuário "${proximoPapel}"?`)) return;
        const { error } = await supabase.from('perfis').update({ papel: proximoPapel }).eq('id', id);
        if (error) { mostrarToast('Erro ao alterar papel: ' + error.message, 'erro'); return; }
        await registrarHistorico('Membros', 'EDIÇÃO', `Usuário ${id} agora é "${proximoPapel}"`);
        mostrarToast('Papel atualizado.', 'sucesso');
        carregar();
    }

    await carregar();
}
```

- [ ] **Step 2: Manual verification**

1. Log in as admin, open "Membros" → confirm every signed-up test account
   shows with correct papel/status, and Aprovar/Tornar admin buttons
   appear for everyone except the admin's own row.
2. Approve the pending `membro` test account from Task 9 → confirm its
   badge flips to Aprovado and it can now log in past the pending block
   (re-verify `exigirSessao()` from Task 9 lets it through).
3. Log in as a non-admin `membro` and open "Membros" → confirm the table
   is read-only (no action buttons, and the "somente administradores..."
   notice shows).
4. As admin, try promoting a membro to admin and back → confirm both
   directions work and are reflected in `historico_auditoria`.

- [ ] **Step 3: Commit**

```bash
git add js/membros.js
git commit -m "feat: add Membros screen (approval and role management)"
```

---

## Task 20: Histórico screen

**Files:**
- Create: `js/historico.js`

**Interfaces:**
- Consumes: `supabase`, `mostrarToast`, `formatarDataHora`. Implements `montarTela(container, contexto)`. Reads the `historico_auditoria` rows written by Tasks 7 and 11-16, 19.

- [ ] **Step 1: Write `js/historico.js`**

```javascript
import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarDataHora } from './shared/formato.js';

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <h3 style="margin-top:0;">Histórico de ações</h3>
            <select id="hist-filtro-modulo" style="margin-bottom:1rem;"><option value="">Todos os módulos</option></select>
            <table class="data-table">
                <thead><tr><th>Data/Hora</th><th>Quem</th><th>Módulo</th><th>Ação</th><th>Detalhes</th></tr></thead>
                <tbody id="hist-body"><tr><td colspan="5" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>
    `;

    const MODULOS = ['Plano de Contas', 'Orçamento', 'Lançamentos', 'Conciliação Bancária', 'Membros'];
    const selectModulo = container.querySelector('#hist-filtro-modulo');
    selectModulo.innerHTML += MODULOS.map(m => `<option value="${m}">${m}</option>`).join('');

    async function carregar() {
        const modulo = selectModulo.value;
        let query = supabase.from('historico_auditoria').select('*, perfis(nome)').order('created_at', { ascending: false }).limit(200);
        if (modulo) query = query.eq('modulo', modulo);

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
            <td>${it.perfis?.nome ?? '—'}</td>
            <td>${it.modulo ?? '—'}</td>
            <td>${it.acao}</td>
            <td>${it.detalhes ?? '—'}</td>
        </tr>`).join('');
    }

    selectModulo.addEventListener('change', carregar);
    await carregar();
}
```

- [ ] **Step 2: Manual verification**

1. After exercising Tasks 11-16 and 19 (creating/editing/deleting contas,
   lançamentos, importing an OFX file, approving a membro), open
   "Histórico" → confirm every one of those actions shows up, newest
   first, with the correct member name, módulo, ação and detalhes text.
2. Filter by a specific módulo (e.g. "Lançamentos") → confirm the list
   narrows to just that módulo's entries.
3. Confirm no Editar/Excluir controls exist anywhere on this screen — it's
   an append-only log, matching the RLS policy from Task 2 (insert/select
   only, no update/delete policy exists for `historico_auditoria`).

- [ ] **Step 3: Commit**

```bash
git add js/historico.js
git commit -m "feat: add Histórico screen"
```

---

## Task 21: Publish to GitHub Pages and run full QA pass

**Files:**
- Modify: `README.md` (replace the placeholder GitHub Pages section from Task 1 with the exact steps below, now that every screen exists to verify against)
- No new source files — this task is deployment + end-to-end verification of everything built in Tasks 1-20 together.

**Interfaces:**
- Consumes: the whole app.

- [ ] **Step 1: Push the repo to GitHub**

Confirm with the user which GitHub repo to push to before running this —
pushing is a shared-system action. Once confirmed:

```bash
git remote add origin <repo-url>
git push -u origin main
```

- [ ] **Step 2: Enable GitHub Pages**

In the GitHub repo, Settings > Pages > Source: Deploy from a branch >
`main` > `/ (root)`. Save, then wait for the Pages build to finish (check
the "pages build and deployment" run under the Actions tab).

- [ ] **Step 3: Publish a production `js/config.js`**

`js/config.js` is gitignored (Task 1) because it holds environment-specific
values, but on a static host there is no server-side env-var injection —
the file has to physically exist in the published output. Two ways to
handle this, pick one with the user:
- Commit `js/config.js` anyway (the `anon` key is meant to be public; only
  `.gitignore`'s existing line needs a one-time exception via
  `git add -f js/config.js`), or
- Keep it gitignored locally and add it directly through the GitHub web
  UI ("Add file" > "Create new file") on the `main` branch after every
  key rotation.

- [ ] **Step 4: Verify the published site**

Open `https://<usuario>.github.io/<repo>/login.html` and repeat, against
the **live GitHub Pages URL** (not local `npx serve .`), the sign-up →
admin-bootstrap check from Task 9 Step 3, to confirm the deployed
`config.js` actually points at the right Supabase project.

- [ ] **Step 5: Run the full manual QA checklist**

This repeats the key assertions from every task's "Manual verification"
step in one pass, now against the deployed site, to catch anything that
only breaks when everything runs together:

- [ ] First sign-up becomes `admin`/`aprovado`; second sign-up is
      `membro`/`pendente` and sees the "Aguardando aprovação" screen.
- [ ] Admin approves the pending membro from Membros; membro can then log
      in normally.
- [ ] Membro creates a lançamento with a comprovante; only that membro and
      the admin see Editar/Excluir on it; a third approved membro sees it
      (read-only) in both Lançamentos and Transparência but cannot edit it
      even via a direct `supabase.from('lancamentos').update(...)` call
      from the browser console (RLS rejects it).
- [ ] Admin edits/deletes the membro's lançamento successfully.
- [ ] Orçamento values entered for the current year show up correctly on
      the Dashboard's orçado columns; the realizado columns match the sum
      of that year's lançamentos.
- [ ] Prestação de Contas for a date range covering multiple membros
      shows correct per-membro totals, Excel export downloads, and Print
      shows a clean report without the sidebar.
- [ ] Conciliação Bancária: import a sample `.ofx`, conciliate one item
      manually against a matching lançamento, confirm the lançamento's
      `conta_bancaria_id` updates, and re-importing the same file reports
      zero new transactions.
- [ ] Relatórios doughnut chart and table match for both Receitas and
      Despesas.
- [ ] Histórico shows an entry for every one of the actions above, with
      the correct member name attributed to each.
- [ ] Logging out from any screen returns to `login.html` and a
      subsequent direct visit to `index.html` while logged out redirects
      back to `login.html` (session guard holds across every screen, not
      just the ones tested individually in earlier tasks).

- [ ] **Step 6: Update `README.md`'s GitHub Pages section with the confirmed steps**

Replace the "Publicar no GitHub Pages" section written in Task 1 with the
exact steps that worked in Steps 1-4 above (fill in the real repo URL and
note whichever `config.js` approach was chosen in Step 3).

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: finalize GitHub Pages deployment instructions"
```

---

## Plan Self-Review

**Spec coverage:**
- Uso compartilhado + papéis admin/membro → Task 2 (schema/RLS), Task 9
  (bootstrap trigger), Task 13 (ownership UI), Task 19 (role management).
- Transparência como painel só para logados → Task 18.
- Prestação de Contas entre membros → Task 15.
- Plano de contas padrão editável → Task 2 seed + Task 11.
- GitHub Pages + Supabase único backend, sem servidor → Tasks 1, 3, 10,
  21.
- Conciliação bancária com import OFX → Tasks 6, 16.
- Identidade visual nova → Task 8.
- Auto-cadastro + aprovação do admin → Tasks 2 (trigger), 9 (signup UI),
  19 (approval UI).
- Anexo de comprovante → Task 13 (Storage bucket policy from Task 2).
- Histórico/auditoria → Tasks 2, 7, 20 (and every CRUD task calls
  `registrarHistorico`).
- Testes de funções puras (formato, OFX parser) via `node --test` → Tasks
  4, 6. RLS/fluxos de auth como checklist manual → Task 21 Step 5.
No gaps found.

**Placeholder scan:** no TBD/TODO, no "add appropriate error handling"
phrasing, no "similar to Task N" shortcuts — every step has literal code
or a literal checklist item.

**Type consistency:** `montarTela(container, contexto)` signature and the
`contexto.perfil.{id,papel,nome}` / `contexto.session` shape (set in Task
9's `exigirSessao`, consumed identically in Tasks 13, 18, 19) match across
every task. `registrarHistorico(modulo, acao, detalhes)` call sites in
Tasks 11-16 and 19 all pass the same three-string-argument order defined
in Task 7. Table/column names in every screen's Supabase queries (`contas`,
`plano_contas`, `lancamentos`, `orcamento_valores`, `contas_bancarias`,
`extrato_itens`, `perfis`, `historico_auditoria`) match `supabase/schema.sql`
from Task 2 exactly, including nested-select syntax like
`contas(plano_contas(tipo))` matching the FK from `contas.plano_id` to
`plano_contas.id`.
