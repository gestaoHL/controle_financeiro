import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';
import { formatarDataHora, escapeHtml } from './shared/formato.js';

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
            <td>${escapeHtml(it.perfis?.nome ?? '—')}</td>
            <td>${escapeHtml(it.modulo ?? '—')}</td>
            <td>${escapeHtml(it.acao)}</td>
            <td>${escapeHtml(it.detalhes ?? '—')}</td>
        </tr>`).join('');
    }

    selectModulo.addEventListener('change', carregar);
    await carregar();
}
