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
