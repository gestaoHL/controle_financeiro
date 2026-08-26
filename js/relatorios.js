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
