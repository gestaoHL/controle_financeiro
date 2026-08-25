import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarDataHora, escapeHtml } from './shared/formato.js';

export async function montarTela(container, contexto) {
    const souAdmin = contexto.perfil.papel === 'admin';

    container.innerHTML = `
        <div class="card">
            <h3 style="margin-top:0;">Membros da família</h3>
            ${souAdmin ? '' : '<p class="text-muted">Somente administradores podem aprovar novos membros ou alterar papéis.</p>'}
            <table class="data-table">
                <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Desde</th>${souAdmin ? '<th></th>' : ''}</tr></thead>
                <tbody id="membros-body"><tr><td colspan="${souAdmin ? 6 : 5}" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>
    `;

    async function carregar() {
        const { data, error } = await supabase.from('perfis').select('*').order('created_at');
        if (error) { mostrarToast('Erro ao carregar membros: ' + error.message, 'erro'); return; }
        renderizar(data);
    }

    function renderizar(membros) {
        const tbody = container.querySelector('#membros-body');
        tbody.innerHTML = membros.map(m => {
            const badgeStatus = m.status === 'aprovado' ? 'badge-aprovado' : 'badge-pendente';
            const textoStatus = m.status === 'aprovado' ? 'Aprovado' : 'Pendente';
            let acoes = '';
            if (souAdmin && m.id !== contexto.perfil.id) {
                if (m.status === 'pendente') {
                    acoes += `<button class="btn-primary" data-aprovar="${m.id}">Aprovar</button> `;
                }
                const proximoPapel = m.papel === 'admin' ? 'membro' : 'admin';
                acoes += `<button class="btn-secondary" data-alternar-papel="${m.id}" data-proximo="${proximoPapel}">Tornar ${proximoPapel}</button>`;
            }
            return `<tr>
                <td>${escapeHtml(m.nome)}</td><td>${escapeHtml(m.email)}</td><td>${m.papel}</td>
                <td><span class="badge ${badgeStatus}">${textoStatus}</span></td>
                <td>${formatarDataHora(m.created_at)}</td>
                ${souAdmin ? `<td>${acoes}</td>` : ''}
            </tr>`;
        }).join('');

        if (!souAdmin) return;
        tbody.querySelectorAll('[data-aprovar]').forEach(btn =>
            btn.addEventListener('click', () => aprovar(btn.dataset.aprovar)));
        tbody.querySelectorAll('[data-alternar-papel]').forEach(btn =>
            btn.addEventListener('click', () => alternarPapel(btn.dataset.alternarPapel, btn.dataset.proximo)));
    }

    async function aprovar(id) {
        const { error } = await supabase.from('perfis').update({ status: 'aprovado' }).eq('id', id);
        if (error) { mostrarToast('Erro ao aprovar: ' + error.message, 'erro'); return; }
        await registrarHistorico('Membros', 'APROVAÇÃO', `Usuário ${id} aprovado`);
        mostrarToast('Membro aprovado.', 'sucesso');
        carregar();
    }

    async function alternarPapel(id, proximoPapel) {
        if (!confirm(`Confirma tornar este usuário "${proximoPapel}"?`)) return;
        const { error } = await supabase.from('perfis').update({ papel: proximoPapel }).eq('id', id);
        if (error) { mostrarToast('Erro ao alterar papel: ' + error.message, 'erro'); return; }
        await registrarHistorico('Membros', 'EDIÇÃO', `Usuário ${id} agora é "${proximoPapel}"`);
        mostrarToast('Papel atualizado.', 'sucesso');
        carregar();
    }

    await carregar();
}
