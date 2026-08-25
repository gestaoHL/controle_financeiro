import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarMoeda, escapeHtml } from './shared/formato.js';

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
            return `<tr><td>${escapeHtml(nome)}</td><td>${formatarMoeda(valor)}</td><td>${pct}%</td></tr>`;
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
