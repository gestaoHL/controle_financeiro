import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { escapeHtml } from './shared/formato.js';
import { agruparPorTipoEGrupo } from './shared/grupos.js';

const ROTULO_TIPO = { RECEITA: 'Receita', DESPESA: 'Despesa' };

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <div class="page-header">
                <h3>Plano de Contas</h3>
                <button class="btn-primary" id="btn-novo-grupo">+ Novo Grupo</button>
            </div>
            <div id="plano-contas-secoes"><p class="text-center text-muted">Carregando...</p></div>
        </div>

        <div class="modal" id="modal-grupo">
            <div class="modal-content">
                <h3 id="modal-grupo-titulo">Novo Grupo</h3>
                <form id="form-grupo">
                    <input type="hidden" id="grupo-id">
                    <div class="form-group">
                        <label for="grupo-tipo">Tipo</label>
                        <select id="grupo-tipo" required>
                            <option value="RECEITA">Receita</option>
                            <option value="DESPESA">Despesa</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="grupo-descricao">Nome do grupo</label>
                        <input type="text" id="grupo-descricao" required placeholder="Ex: Salários, Casa, Lazer...">
                    </div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-grupo">Cancelar</button>
                        <button type="submit" class="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="modal" id="modal-conta">
            <div class="modal-content">
                <h3 id="modal-conta-titulo">Nova Conta</h3>
                <form id="form-conta">
                    <input type="hidden" id="conta-id">
                    <input type="hidden" id="conta-grupo-id">
                    <div class="form-group">
                        <label for="conta-nome">Nome da conta</label>
                        <input type="text" id="conta-nome" required>
                    </div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-conta">Cancelar</button>
                        <button type="submit" class="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    let planos = [];
    let contas = [];

    async function carregar() {
        const [{ data: planosData, error: erroPlanos }, { data: contasData, error: erroContas }] = await Promise.all([
            supabase.from('plano_contas').select('*').order('tipo').order('id'),
            supabase.from('contas').select('*').order('nome')
        ]);
        if (erroPlanos || erroContas) {
            mostrarToast('Erro ao carregar plano de contas: ' + (erroPlanos || erroContas).message, 'erro');
            return;
        }
        planos = planosData;
        contas = contasData;
        renderizar();
    }

    function renderizar() {
        const alvo = container.querySelector('#plano-contas-secoes');
        const secoes = agruparPorTipoEGrupo(planos, contas);
        if (!secoes.length) {
            alvo.innerHTML = '<p class="text-center text-muted">Nenhum grupo configurado.</p>';
            return;
        }

        alvo.innerHTML = secoes.map(secao => {
            const cor = secao.tipo === 'RECEITA' ? 'var(--cor-receita)' : 'var(--cor-despesa)';
            const totalContas = secao.grupos.reduce((s, g) => s + g.contas.length, 0);

            const gruposHtml = secao.grupos.map(grupo => `
                <div style="border:1px solid var(--cor-borda); border-radius:var(--raio); overflow:hidden; margin-bottom:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.75rem; padding:0.65rem 1rem; background:var(--cor-fundo); border-bottom:1px solid var(--cor-borda);">
                        <strong>${escapeHtml(grupo.nome)}</strong>
                        <span class="badge" style="background:transparent; border:1px solid ${cor}; color:${cor};">
                            ${grupo.contas.length} ${grupo.contas.length === 1 ? 'conta' : 'contas'}
                        </span>
                        <div style="margin-left:auto; display:flex; gap:0.25rem; align-items:center;">
                            <button class="btn-secondary" data-nova-conta="${grupo.id}">+ Conta</button>
                            <button class="btn-icon" data-editar-grupo="${grupo.id}" title="Editar grupo">✏️</button>
                            <button class="btn-icon icon-danger" data-excluir-grupo="${grupo.id}" title="Excluir grupo">🗑️</button>
                        </div>
                    </div>
                    ${grupo.contas.length === 0
                        ? '<p class="text-muted" style="padding:0.6rem 1rem; margin:0;">Nenhuma conta cadastrada neste grupo.</p>'
                        : grupo.contas.map(conta => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 1rem; border-top:1px solid var(--cor-borda);">
                                <span>${escapeHtml(conta.nome)}</span>
                                <span style="display:flex; gap:0.25rem;">
                                    <button class="btn-icon" data-editar-conta="${conta.id}" title="Editar conta">✏️</button>
                                    <button class="btn-icon icon-danger" data-excluir-conta="${conta.id}" title="Excluir conta">🗑️</button>
                                </span>
                            </div>
                        `).join('')}
                </div>
            `).join('');

            return `
                <div style="margin-bottom:1.5rem;">
                    <h4 style="margin:0 0 0.5rem; color:${cor};">
                        ${ROTULO_TIPO[secao.tipo]}
                        <span class="text-muted" style="font-weight:400; font-size:0.8rem;">
                            — ${secao.grupos.length} grupo${secao.grupos.length === 1 ? '' : 's'} · ${totalContas} conta${totalContas === 1 ? '' : 's'}
                        </span>
                    </h4>
                    ${gruposHtml}
                </div>
            `;
        }).join('');

        alvo.querySelectorAll('[data-nova-conta]').forEach(btn =>
            btn.addEventListener('click', () => abrirModalConta(null, Number(btn.dataset.novaConta))));
        alvo.querySelectorAll('[data-editar-conta]').forEach(btn =>
            btn.addEventListener('click', () => {
                const conta = contas.find(c => c.id === Number(btn.dataset.editarConta));
                abrirModalConta(conta, conta.plano_id);
            }));
        alvo.querySelectorAll('[data-excluir-conta]').forEach(btn =>
            btn.addEventListener('click', () => excluirConta(Number(btn.dataset.excluirConta))));
        alvo.querySelectorAll('[data-editar-grupo]').forEach(btn =>
            btn.addEventListener('click', () => abrirModalGrupo(planos.find(p => p.id === Number(btn.dataset.editarGrupo)))));
        alvo.querySelectorAll('[data-excluir-grupo]').forEach(btn =>
            btn.addEventListener('click', () => excluirGrupo(Number(btn.dataset.excluirGrupo))));
    }

    function abrirModalGrupo(grupo) {
        container.querySelector('#modal-grupo-titulo').textContent = grupo ? 'Editar Grupo' : 'Novo Grupo';
        container.querySelector('#grupo-id').value = grupo?.id ?? '';
        container.querySelector('#grupo-tipo').value = grupo?.tipo ?? 'RECEITA';
        container.querySelector('#grupo-descricao').value = grupo?.descricao ?? '';
        container.querySelector('#modal-grupo').classList.add('show');
    }

    async function excluirGrupo(id) {
        const grupo = planos.find(p => p.id === id);
        if (!confirm(`Excluir o grupo "${grupo?.descricao ?? grupo?.tipo}"? Todas as contas dele (e a referência delas em lançamentos) serão excluídas.`)) return;
        const { error } = await supabase.from('plano_contas').delete().eq('id', id);
        if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }
        await registrarHistorico('Plano de Contas', 'EXCLUSÃO', `Grupo "${grupo?.descricao ?? grupo?.tipo}" excluído`);
        mostrarToast('Grupo excluído.', 'sucesso');
        carregar();
    }

    function abrirModalConta(conta, grupoId) {
        container.querySelector('#modal-conta-titulo').textContent = conta ? 'Editar Conta' : 'Nova Conta';
        container.querySelector('#conta-id').value = conta?.id ?? '';
        container.querySelector('#conta-grupo-id').value = grupoId;
        container.querySelector('#conta-nome').value = conta?.nome ?? '';
        container.querySelector('#modal-conta').classList.add('show');
    }

    async function excluirConta(id) {
        if (!confirm('Excluir esta conta? Lançamentos ligados a ela perdem a referência.')) return;
        const conta = contas.find(c => c.id === id);
        const { error } = await supabase.from('contas').delete().eq('id', id);
        if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }
        await registrarHistorico('Plano de Contas', 'EXCLUSÃO', `Conta "${conta?.nome}" excluída`);
        mostrarToast('Conta excluída.', 'sucesso');
        carregar();
    }

    container.querySelector('#btn-novo-grupo').addEventListener('click', () => abrirModalGrupo(null));
    container.querySelector('#btn-cancelar-grupo').addEventListener('click', () =>
        container.querySelector('#modal-grupo').classList.remove('show'));
    container.querySelector('#btn-cancelar-conta').addEventListener('click', () =>
        container.querySelector('#modal-conta').classList.remove('show'));

    container.querySelector('#form-grupo').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const id = container.querySelector('#grupo-id').value;
            const tipo = container.querySelector('#grupo-tipo').value;
            const descricao = container.querySelector('#grupo-descricao').value.trim();

            const payload = { tipo, descricao };
            const { error } = id
                ? await supabase.from('plano_contas').update(payload).eq('id', id)
                : await supabase.from('plano_contas').insert(payload);

            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Plano de Contas', id ? 'EDIÇÃO' : 'INSERÇÃO', `Grupo "${descricao}" (${tipo})`);
            mostrarToast('Grupo salvo.', 'sucesso');
            container.querySelector('#modal-grupo').classList.remove('show');
            carregar();
        });
    });

    container.querySelector('#form-conta').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const id = container.querySelector('#conta-id').value;
            const planoId = Number(container.querySelector('#conta-grupo-id').value);
            const nome = container.querySelector('#conta-nome').value.trim();

            const payload = { plano_id: planoId, nome };
            const { error } = id
                ? await supabase.from('contas').update(payload).eq('id', id)
                : await supabase.from('contas').insert(payload);

            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Plano de Contas', id ? 'EDIÇÃO' : 'INSERÇÃO', `Conta "${nome}"`);
            mostrarToast('Conta salva.', 'sucesso');
            container.querySelector('#modal-conta').classList.remove('show');
            carregar();
        });
    });

    await carregar();
}
