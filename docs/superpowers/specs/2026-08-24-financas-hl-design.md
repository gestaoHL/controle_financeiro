# Finanças HL — Design

## Contexto

Plataforma de controle financeiro familiar, inspirada no [Projeto Controle
Financeiro](../../../../Projeto%20Controle%20Financeiro) (app de finanças de
campanha eleitoral). Reaproveita a ideia das telas de plano de contas,
orçamento, prestação de contas, lançamentos, transparência, dashboard,
conciliação bancária e relatórios, adequando o plano de contas e as regras de
negócio à realidade de controle financeiro familiar em vez de campanha
eleitoral.

Diferença chave em relação ao projeto de referência: lá o backend é um
servidor Express + SQLite local (Supabase só é usado para conciliação
bancária e um formulário público). Aqui **não existe servidor local** — o
site é 100% estático, hospedado no GitHub Pages, e o Supabase é o único
backend (Auth + Postgres + Storage), acessado direto do client via
`supabase-js`.

## Uso e usuários

- Uso **compartilhado em família**: múltiplas pessoas com login próprio,
  todas veem e lançam dados no mesmo conjunto de contas/orçamento.
- Papéis: `admin` e `membro`.
  - `membro` pode criar/editar lançamentos, plano de contas, orçamento e
    contas bancárias — mas só pode **editar/excluir seus próprios
    lançamentos**.
  - `admin` pode editar/excluir lançamentos de **qualquer** usuário, além de
    aprovar novos cadastros.
- Cadastro: auto-cadastro (email/senha via Supabase Auth) + aprovação do
  admin. O primeiro usuário a se cadastrar no sistema vira `admin` e já
  entra `aprovado` (bootstrap). Os seguintes entram como `membro` /
  `pendente` até um admin aprovar na tela **Membros**.
- Usuário `pendente` logado não acessa o app — vê uma tela de "aguardando
  aprovação".

## Arquitetura

- **Stack**: HTML/CSS/JS puro, sem framework, sem build step. ES modules
  nativos do navegador (`<script type="module">`), um arquivo por
  tela/domínio. Chart.js (dashboard/relatórios) e SheetJS (export Excel) via
  CDN, como no projeto de referência.
- **Backend**: Supabase — Postgres via `supabase-js`, Auth (email/senha),
  Storage (comprovantes). Toda a segurança de dados é feita via **Row Level
  Security** no Postgres, já que não há servidor validando nada; a chave
  `anon` do Supabase fica exposta no client (comportamento normal de app
  estático — RLS é a linha de defesa real, não a chave).
- **Deploy**: GitHub Pages a partir da branch `main`. Site publicamente
  acessível, mas sem sessão Supabase válida nenhuma tela carrega dado.

### Estrutura de pastas

```
/index.html            shell: sidebar + todas as <section> de página
/login.html
/css/styles.css
/js/
  supabaseClient.js     init do client (URL + anon key)
  auth.js                login, signup, guard de sessão, tela de pendente
  dashboard.js
  planoContas.js
  orcamento.js
  lancamentos.js
  prestacaoContas.js
  conciliacao.js
  relatorios.js
  membros.js             admin: aprovar/gerenciar usuários
  historico.js
  shared/
    formato.js            formatação de moeda/data
    toast.js               feedback de UI (equivalente a ui-feedback.js)
    ofxParser.js            parser de extrato OFX (portado do original)
/supabase/
  schema.sql
/test/
  ofxParser.test.js
  formato.test.js
```

## Modelo de dados (Supabase / Postgres)

```sql
-- Usuários e papéis (1:1 com auth.users)
perfis (
  id          uuid primary key references auth.users(id),
  nome        text not null,
  email       text not null,
  papel       text not null default 'membro' check (papel in ('admin','membro')),
  status      text not null default 'pendente' check (status in ('pendente','aprovado')),
  created_at  timestamptz not null default now()
)

-- Plano de contas (2 níveis, igual ao projeto de referência)
plano_contas (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('RECEITA','DESPESA')),
  descricao   text
)

contas (
  id          bigint generated always as identity primary key,
  plano_id    bigint not null references plano_contas(id) on delete cascade,
  nome        text not null
)

-- Lançamentos (sem campos específicos de campanha: sem doador/pessoa/placa/tipificação)
lancamentos (
  id                 bigint generated always as identity primary key,
  tipo               text not null check (tipo in ('RECEITA','DESPESA')),
  conta_id           bigint references contas(id) on delete set null,
  usuario_id         uuid not null references perfis(id),
  forma_pagamento    text check (forma_pagamento in ('pix','transferencia','cartao','dinheiro','boleto')),
  conta_bancaria_id  bigint references contas_bancarias(id) on delete set null,
  data               date not null,
  historico          text not null,
  descricao          text,
  valor              numeric not null check (valor > 0),
  comprovante_url    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
)

-- Orçamento (igual ao original)
orcamento_valores (
  id          bigint generated always as identity primary key,
  ano         integer not null,
  mes         integer not null check (mes between 1 and 12),
  conta_id    bigint not null references contas(id) on delete cascade,
  valor       numeric not null default 0,
  unique (ano, mes, conta_id)
)

-- Conciliação bancária (igual ao original)
contas_bancarias (
  id            bigint generated always as identity primary key,
  nome          text not null,
  banco         text,
  agencia       text,
  numero_conta  text,
  created_at    timestamptz not null default now()
)

extrato_itens (
  id                 bigint generated always as identity primary key,
  conta_bancaria_id  bigint not null references contas_bancarias(id) on delete cascade,
  fitid              text not null,
  data               date not null,
  historico          text not null,
  tipo               text not null check (tipo in ('CREDITO','DEBITO')),
  valor              numeric not null check (valor > 0),
  status             text not null default 'pendente' check (status in ('pendente','conciliado')),
  lancamento_id      bigint references lancamentos(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (conta_bancaria_id, fitid)
)

-- Auditoria
historico_auditoria (
  id          bigint generated always as identity primary key,
  usuario_id  uuid references perfis(id),
  modulo      text,
  acao        text not null,
  detalhes    text,
  created_at  timestamptz not null default now()
)
```

**Prestação de Contas** não é uma tabela própria — é uma tela de relatório
que consulta `lancamentos` agrupando por `usuario_id` + período (mês ou
intervalo), mostrando quem gastou/recebeu o quê. Export em Excel (SheetJS,
client-side, como o original já faz) e uma visualização de impressão
(`window.print()`) no lugar de gerar PDF no servidor (o original usa
`pdfkit`, que não existe sem servidor).

**Seed inicial do Plano de Contas** (editável depois pela própria tela):
- Receitas: Salário, Renda Extra / Freelance, Investimentos, Outros
- Despesas: Moradia, Alimentação, Transporte, Saúde, Educação, Lazer,
  Assinaturas, Cartão de Crédito, Investimentos, Impostos, Doações, Outros

### Row Level Security

- `perfis`: usuário lê/edita o próprio registro; admin lê/edita todos.
  Necessário para a tela de aprovação (admin precisa ver `pendente`s) e
  para checar `papel`/`status` nas policies das outras tabelas.
- `plano_contas`, `contas`, `orcamento_valores`, `contas_bancarias`,
  `extrato_itens`: SELECT e INSERT/UPDATE/DELETE liberados para qualquer
  usuário com `perfis.status = 'aprovado'` (dado estrutural, tratado igual
  a lançamento — qualquer membro aprovado mexe).
- `lancamentos`: SELECT liberado para qualquer aprovado (implementa a tela
  **Transparência** — todos veem tudo). INSERT liberado para aprovados,
  sempre com `usuario_id = auth.uid()`. **UPDATE/DELETE**: só o próprio dono
  (`usuario_id = auth.uid()`) ou um admin.
- `historico_auditoria`: INSERT liberado para aprovados (toda ação grava um
  registro); SELECT liberado para aprovados (log visível a todos, não é
  dado sensível de terceiros).
- Sem policy nenhuma para `anon` em qualquer tabela — só `authenticated`
  (mesmo padrão do projeto de referência).
- Storage: bucket `comprovantes`, privado, acesso só para `authenticated`.

## Telas

1. **Dashboard** — KPIs orçado × realizado (receita/despesa), gráfico de
   execução orçamentária, filtros de período (mensal/trimestral/anual/
   intervalo). Sem os cards de teto de gastos TSE / sublimites de pessoal
   (específicos de campanha, removidos).
2. **Plano de Contas** — CRUD de `plano_contas`/`contas`.
3. **Orçamento** — grade mês × conta com valores planejados.
4. **Lançamentos** — CRUD com filtros por conta/tipo/usuário/período,
   upload de comprovante (Storage).
5. **Prestação de Contas** — relatório por membro/período (quem
   gastou/recebeu o quê), export Excel + impressão.
6. **Conciliação Bancária** — cadastro de contas bancárias da família,
   import de extrato `.OFX` (parser client-side portado do original), match
   com lançamentos.
7. **Transparência** — painel consolidado com todos os lançamentos de
   todos os membros (inclusive os que o usuário logado não pode editar).
   Só para usuários logados e aprovados — sem acesso público/sem login.
8. **Relatórios** — análise dinâmica por categoria/período com gráficos
   (equivalente à tela "Análise e Relatórios Dinâmicos" do original).
9. **Membros** *(nova — substitui as telas específicas de campanha:
   Doadores, Pessoal, Veículos, Combustível, Parâmetros, Agenda de
   Pagamento, Formulários, todas removidas)* — admin aprova cadastros
   pendentes e gerencia papéis (`admin`/`membro`).
10. **Histórico** — log de auditoria (quem criou/editou/excluiu o quê e
    quando), visível a todos os aprovados.

## Erros e validação

- Validação client-side antes de gravar (campos obrigatórios, `valor > 0`,
  datas válidas) — mesma UX do original.
- Erros do Supabase (rede, RLS negando a operação) exibidos via toast,
  reaproveitando o padrão do `ui-feedback.js` do projeto de referência.
- Guard de sessão em `auth.js`: sem sessão válida → redireciona para
  `login.html`. Sessão válida mas `perfis.status = 'pendente'` → tela de
  "aguardando aprovação" no lugar do shell do app.

## Testes

Sem servidor para testes de integração tipo `supertest` como no original.
Abordagem:
- Funções puras extraídas para `js/shared/` (parser OFX, formatação de
  moeda/data, cálculo de orçado × realizado) cobertas com `node --test`,
  igual ao padrão de testes de lógica pura que o projeto de referência já
  usa.
- RLS e fluxos de autenticação/aprovação: checklist de QA manual (testar
  com duas contas Supabase reais — uma `admin`, uma `membro` — confirmando
  que membro não edita lançamento de outro, que pendente não vê o app,
  etc.), documentado antes do primeiro deploy.
