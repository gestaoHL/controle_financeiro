import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarMoeda, formatarData, escapeHtml } from './shared/formato.js';

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
    selectMembro.innerHTML += (membros ?? []).map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');

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
            <td>${escapeHtml(l.perfis?.nome ?? '—')}</td>
            <td><span class="badge ${l.tipo === 'RECEITA' ? 'badge-receita' : 'badge-despesa'}">${l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</span></td>
            <td>${escapeHtml(l.contas?.nome ?? '—')}</td>
            <td>${escapeHtml(l.historico)}</td>
            <td>${formatarMoeda(l.valor)}</td>
        </tr>`).join('');
    }

    selectMembro.addEventListener('change', carregar);
    container.querySelector('#transp-filtro-tipo').addEventListener('change', carregar);

    await carregar();
}
