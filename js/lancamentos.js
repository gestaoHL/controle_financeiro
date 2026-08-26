import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarMoeda, formatarData, escapeHtml } from './shared/formato.js';
import { agruparPorTipoEGrupo } from './shared/grupos.js';

const FORMAS_PAGAMENTO = { pix: 'Pix', transferencia: 'Transferência', cartao: 'Cartão', dinheiro: 'Dinheiro', boleto: 'Boleto' };
const ROTULO_TIPO = { RECEITA: 'Receita', DESPESA: 'Despesa' };

export async function montarTela(container, contexto) {
    container.innerHTML = `
        <div class="card">
            <div class="page-header">
                <h3>Lançamentos</h3>
                <button class="btn-primary" id="btn-novo-lancamento">+ Novo Lançamento</button>
            </div>
            <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
                <select id="filtro-tipo"><option value="">Todos os tipos</option><option value="RECEITA">Receita</option><option value="DESPESA">Despesa</option></select>
                <select id="filtro-conta"><option value="">Todas as contas</option></select>
            </div>
            <div id="lancamentos-lista"><p class="text-center text-muted">Carregando...</p></div>
        </div>

        <div class="modal" id="modal-lancamento">
            <div class="modal-content">
                <h3 id="modal-lancamento-titulo">Novo Lançamento</h3>
                <form id="form-lancamento">
                    <input type="hidden" id="lancamento-id">
                    <div class="form-group">
                        <label for="lancamento-tipo">Tipo</label>
                        <select id="lancamento-tipo" required>
                            <option value="RECEITA">Receita</option>
                            <option value="DESPESA">Despesa</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-conta">Conta</label>
                        <select id="lancamento-conta" required></select>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-data">Data</label>
                        <input type="date" id="lancamento-data" required>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-historico">Título</label>
                        <input type="text" id="lancamento-historico" required>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-descricao">Descrição (opcional)</label>
                        <textarea id="lancamento-descricao" rows="2"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-valor">Valor (R$)</label>
                        <input type="number" id="lancamento-valor" step="0.01" min="0.01" required>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-forma">Forma de pagamento</label>
                        <select id="lancamento-forma">
                            ${Object.entries(FORMAS_PAGAMENTO).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="lancamento-comprovante">Comprovante (opcional)</label>
                        <input type="file" id="lancamento-comprovante" accept="image/*,application/pdf">
                    </div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-lancamento">Cancelar</button>
                        <button type="submit" class="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    let secoes = [];
    let lancamentos = [];

    async function carregarContas() {
        const [{ data: planosData, error: erroPlanos }, { data: contasData, error: erroContas }] = await Promise.all([
            supabase.from('plano_contas').select('*'),
            supabase.from('contas').select('*').order('nome')
        ]);
        if (erroPlanos || erroContas) {
            mostrarToast('Erro ao carregar contas: ' + (erroPlanos || erroContas).message, 'erro');
            return;
        }
        secoes = agruparPorTipoEGrupo(planosData, contasData);
        popularFiltroConta();
    }

    function popularFiltroConta() {
        const selectFiltro = container.querySelector('#filtro-conta');
        const opcoes = secoes.flatMap(secao => secao.grupos.map(grupo => `
            <optgroup label="${escapeHtml(ROTULO_TIPO[secao.tipo] + ' · ' + grupo.nome)}">
                ${grupo.contas.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')}
            </optgroup>
        `)).join('');
        selectFiltro.innerHTML = '<option value="">Todas as contas</option>' + opcoes;
    }

    function popularSelectContaModal(tipo) {
        const select = container.querySelector('#lancamento-conta');
        const secao = secoes.find(s => s.tipo === tipo);
        select.innerHTML = !secao || !secao.grupos.length
            ? '<option value="" disabled>Nenhuma conta cadastrada para este tipo.</option>'
            : secao.grupos.map(grupo => `
                <optgroup label="${escapeHtml(grupo.nome)}">
                    ${grupo.contas.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')}
                </optgroup>
            `).join('');
    }

    async function carregarLancamentos() {
        const tipo = container.querySelector('#filtro-tipo').value;
        const contaId = container.querySelector('#filtro-conta').value;

        let query = supabase.from('lancamentos').select('*, contas(nome), perfis(nome)').order('data', { ascending: false });
        if (tipo) query = query.eq('tipo', tipo);
        if (contaId) query = query.eq('conta_id', contaId);

        const { data, error } = await query;
        if (error) { mostrarToast('Erro ao carregar lançamentos: ' + error.message, 'erro'); return; }
        lancamentos = data;
        renderizar();
    }

    function renderizar() {
        const lista = container.querySelector('#lancamentos-lista');
        if (!lancamentos.length) {
            lista.innerHTML = '<p class="text-center text-muted">Nenhum lançamento encontrado.</p>';
            return;
        }

        lista.innerHTML = lancamentos.map(l => {
            const podeEditar = contexto.perfil.papel === 'admin' || l.usuario_id === contexto.perfil.id;
            const tipoClasse = l.tipo === 'RECEITA' ? 'tipo-receita' : 'tipo-despesa';
            const acoes = `
                ${l.comprovante_url ? `<button class="btn-icon" data-ver-comprovante="${escapeHtml(l.comprovante_url)}" title="Ver comprovante">📎</button>` : ''}
                ${podeEditar ? `<button class="btn-icon" data-editar="${l.id}" title="Editar">✏️</button>
                                <button class="btn-icon icon-danger" data-excluir="${l.id}" title="Excluir">🗑️</button>` : ''}
            `;

            return `<div class="list-card ${tipoClasse}">
                <div class="list-card-main">
                    <span class="badge ${l.tipo === 'RECEITA' ? 'badge-receita' : 'badge-despesa'}" style="width:fit-content;">${l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</span>
                    <span class="list-card-titulo">${escapeHtml(l.historico)}</span>
                    <span class="list-card-sub">${formatarData(l.data)} · ${escapeHtml(l.contas?.nome ?? '—')} · ${escapeHtml(l.perfis?.nome ?? '—')}</span>
                </div>
                <div class="list-card-valor" style="color:${l.tipo === 'RECEITA' ? 'var(--cor-receita)' : 'var(--cor-despesa)'};">${formatarMoeda(l.valor)}</div>
                <div class="list-card-acoes">${acoes}</div>
            </div>`;
        }).join('');

        lista.querySelectorAll('[data-editar]').forEach(btn =>
            btn.addEventListener('click', () => abrirModal(lancamentos.find(l => l.id === Number(btn.dataset.editar)))));
        lista.querySelectorAll('[data-excluir]').forEach(btn =>
            btn.addEventListener('click', () => excluirLancamento(Number(btn.dataset.excluir))));
        lista.querySelectorAll('[data-ver-comprovante]').forEach(btn =>
            btn.addEventListener('click', () => abrirComprovante(btn.dataset.verComprovante)));
    }

    async function abrirComprovante(path) {
        const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(path, 60);
        if (error) { mostrarToast('Erro ao abrir comprovante: ' + error.message, 'erro'); return; }
        window.open(data.signedUrl, '_blank');
    }

    function abrirModal(lancamento) {
        const modal = container.querySelector('#modal-lancamento');
        container.querySelector('#modal-lancamento-titulo').textContent = lancamento ? 'Editar Lançamento' : 'Novo Lançamento';
        container.querySelector('#lancamento-id').value = lancamento?.id ?? '';
        container.querySelector('#lancamento-tipo').value = lancamento?.tipo ?? 'DESPESA';
        popularSelectContaModal(container.querySelector('#lancamento-tipo').value);
        container.querySelector('#lancamento-conta').value = lancamento?.conta_id ?? '';
        container.querySelector('#lancamento-data').value = lancamento?.data ?? new Date().toISOString().slice(0, 10);
        container.querySelector('#lancamento-historico').value = lancamento?.historico ?? '';
        container.querySelector('#lancamento-descricao').value = lancamento?.descricao ?? '';
        container.querySelector('#lancamento-valor').value = lancamento?.valor ?? '';
        container.querySelector('#lancamento-forma').value = lancamento?.forma_pagamento ?? 'pix';
        container.querySelector('#lancamento-comprovante').value = '';
        modal.classList.add('show');
    }

    async function excluirLancamento(id) {
        if (!confirm('Excluir este lançamento?')) return;
        const lancamento = lancamentos.find(l => l.id === id);
        const { error } = await supabase.from('lancamentos').delete().eq('id', id);
        if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }
        await registrarHistorico('Lançamentos', 'EXCLUSÃO', `"${lancamento?.historico}" — ${formatarMoeda(lancamento?.valor)}`);
        mostrarToast('Lançamento excluído.', 'sucesso');
        carregarLancamentos();
    }

    async function enviarComprovante(arquivo) {
        const caminho = `${contexto.perfil.id}/${crypto.randomUUID()}-${arquivo.name}`;
        const { error } = await supabase.storage.from('comprovantes').upload(caminho, arquivo);
        if (error) throw new Error('Erro ao enviar comprovante: ' + error.message);
        return caminho;
    }

    container.querySelector('#btn-novo-lancamento').addEventListener('click', () => abrirModal(null));
    container.querySelector('#btn-cancelar-lancamento').addEventListener('click', () =>
        container.querySelector('#modal-lancamento').classList.remove('show'));
    container.querySelector('#lancamento-tipo').addEventListener('change', e => popularSelectContaModal(e.target.value));
    container.querySelector('#filtro-tipo').addEventListener('change', carregarLancamentos);
    container.querySelector('#filtro-conta').addEventListener('change', carregarLancamentos);

    container.querySelector('#form-lancamento').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const id = container.querySelector('#lancamento-id').value;
            const arquivo = container.querySelector('#lancamento-comprovante').files[0];

            let comprovanteUrl;
            try {
                comprovanteUrl = arquivo ? await enviarComprovante(arquivo) : undefined;
            } catch (erro) {
                mostrarToast(erro.message, 'erro');
                return;
            }

            const payload = {
                tipo: container.querySelector('#lancamento-tipo').value,
                conta_id: Number(container.querySelector('#lancamento-conta').value),
                data: container.querySelector('#lancamento-data').value,
                historico: container.querySelector('#lancamento-historico').value.trim(),
                descricao: container.querySelector('#lancamento-descricao').value.trim() || null,
                valor: Number(container.querySelector('#lancamento-valor').value),
                forma_pagamento: container.querySelector('#lancamento-forma').value,
                ...(comprovanteUrl ? { comprovante_url: comprovanteUrl } : {})
            };

            let error;
            if (id) {
                ({ error } = await supabase.from('lancamentos').update(payload).eq('id', id));
            } else {
                payload.usuario_id = contexto.perfil.id;
                ({ error } = await supabase.from('lancamentos').insert(payload));
            }

            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Lançamentos', id ? 'EDIÇÃO' : 'INSERÇÃO', `"${payload.historico}" — ${formatarMoeda(payload.valor)}`);
            mostrarToast('Lançamento salvo.', 'sucesso');
            container.querySelector('#modal-lancamento').classList.remove('show');
            carregarLancamentos();
        });
    });

    await carregarContas();
    popularSelectContaModal('DESPESA');
    await carregarLancamentos();
}
