import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarMoeda, formatarData, escapeHtml } from './shared/formato.js';

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
                <div style="font-weight:700;">${escapeHtml(nome)}</div>
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
            <td>${escapeHtml(l.perfis?.nome ?? '—')}</td>
            <td><span class="badge ${l.tipo === 'RECEITA' ? 'badge-receita' : 'badge-despesa'}">${l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</span></td>
            <td>${escapeHtml(l.contas?.nome ?? '—')}</td>
            <td>${escapeHtml(l.historico)}</td>
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
