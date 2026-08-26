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
