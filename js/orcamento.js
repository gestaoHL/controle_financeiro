import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarMoeda, escapeHtml, aplicarMascaraMoeda, valorMoedaParaNumero } from './shared/formato.js';
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
            return `<td><input type="text" inputmode="decimal" style="width:90px;"
                data-conta="${conta.id}" data-mes="${mes}" value="${formatarMoeda(valorDe(conta.id, mes))}"></td>`;
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
            aplicarMascaraMoeda(input);
            input.addEventListener('change', () => salvarValor(ano, input));
        });
    }

    async function salvarValor(ano, input) {
        const contaId = Number(input.dataset.conta);
        const mes = Number(input.dataset.mes);
        const valor = valorMoedaParaNumero(input.value);

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
