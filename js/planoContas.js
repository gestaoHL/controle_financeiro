import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Contas de Receita e Despesa</h3>
                <button class="btn-primary" id="btn-nova-conta">+ Nova Conta</button>
            </div>
            <table class="data-table">
                <thead><tr><th>Tipo</th><th>Conta</th><th></th></tr></thead>
                <tbody id="plano-contas-body"><tr><td colspan="3" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>

        <div class="modal" id="modal-conta">
            <div class="modal-content">
                <h3 id="modal-conta-titulo">Nova Conta</h3>
                <form id="form-conta">
                    <input type="hidden" id="conta-id">
                    <div class="form-group">
                        <label for="conta-tipo">Tipo</label>
                        <select id="conta-tipo" required>
                            <option value="RECEITA">Receita</option>
                            <option value="DESPESA">Despesa</option>
                        </select>
                    </div>
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
            supabase.from('plano_contas').select('*').order('tipo'),
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

    function idPlanoPorTipo(tipo) {
        return planos.find(p => p.tipo === tipo)?.id ?? null;
    }

    function renderizar() {
        const tbody = container.querySelector('#plano-contas-body');
        if (!contas.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhuma conta cadastrada.</td></tr>';
            return;
        }
        tbody.innerHTML = contas.map(conta => {
            const plano = planos.find(p => p.id === conta.plano_id);
            const tipo = plano?.tipo === 'RECEITA' ? 'Receita' : 'Despesa';
            const badge = plano?.tipo === 'RECEITA' ? 'badge-receita' : 'badge-despesa';
            return `<tr>
                <td><span class="badge ${badge}">${tipo}</span></td>
                <td>${conta.nome}</td>
                <td>
                    <button class="btn-secondary" data-editar="${conta.id}">Editar</button>
                    <button class="btn-danger" data-excluir="${conta.id}">Excluir</button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-editar]').forEach(btn =>
            btn.addEventListener('click', () => abrirModal(contas.find(c => c.id === Number(btn.dataset.editar)))));
        tbody.querySelectorAll('[data-excluir]').forEach(btn =>
            btn.addEventListener('click', () => excluirConta(Number(btn.dataset.excluir))));
    }

    function abrirModal(conta) {
        const modal = container.querySelector('#modal-conta');
        container.querySelector('#modal-conta-titulo').textContent = conta ? 'Editar Conta' : 'Nova Conta';
        container.querySelector('#conta-id').value = conta?.id ?? '';
        container.querySelector('#conta-nome').value = conta?.nome ?? '';
        const plano = conta ? planos.find(p => p.id === conta.plano_id) : null;
        container.querySelector('#conta-tipo').value = plano?.tipo ?? 'RECEITA';
        modal.classList.add('show');
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

    container.querySelector('#btn-nova-conta').addEventListener('click', () => abrirModal(null));
    container.querySelector('#btn-cancelar-conta').addEventListener('click', () =>
        container.querySelector('#modal-conta').classList.remove('show'));

    container.querySelector('#form-conta').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const id = container.querySelector('#conta-id').value;
            const nome = container.querySelector('#conta-nome').value.trim();
            const tipo = container.querySelector('#conta-tipo').value;
            const planoId = idPlanoPorTipo(tipo);

            const payload = { plano_id: planoId, nome };
            const { error } = id
                ? await supabase.from('contas').update(payload).eq('id', id)
                : await supabase.from('contas').insert(payload);

            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Plano de Contas', id ? 'EDIÇÃO' : 'INSERÇÃO', `Conta "${nome}" (${tipo})`);
            mostrarToast('Conta salva.', 'sucesso');
            container.querySelector('#modal-conta').classList.remove('show');
            carregar();
        });
    });

    await carregar();
}
