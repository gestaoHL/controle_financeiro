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
                    { label: 'Receitas', data: receitasPorMes, backgroundColor: '#ab8ff1' },
                    { label: 'Despesas', data: despesasPorMes, backgroundColor: '#dad7de' }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#8b8e9c' }, grid: { color: 'rgba(174,170,192,0.12)' } },
                    x: { ticks: { color: '#8b8e9c' }, grid: { color: 'rgba(174,170,192,0.08)' } }
                },
                plugins: { legend: { labels: { color: '#aeaac0' } } }
            }
        });
    }

    await carregar(anoAtual);
}
