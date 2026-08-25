import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarMoeda, formatarData, escapeHtml } from './shared/formato.js';
import { parseOFX, lerArquivoComoTexto } from './shared/ofxParser.js';

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Contas bancárias</h3>
                <button class="btn-primary" id="btn-nova-conta-bancaria">+ Nova Conta Bancária</button>
            </div>
            <table class="data-table">
                <thead><tr><th>Nome</th><th>Banco</th><th>Agência</th><th>Número</th><th></th></tr></thead>
                <tbody id="contas-bancarias-body"><tr><td colspan="5" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>

        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0;">Extrato importado</h3>
                <button class="btn-primary" id="btn-importar-ofx">Importar extrato (.OFX)</button>
            </div>
            <select id="filtro-conta-bancaria" style="margin-bottom:1rem;"><option value="">Todas as contas</option></select>
            <table class="data-table">
                <thead><tr><th>Conta</th><th>Data</th><th>Histórico</th><th>Tipo</th><th>Valor</th><th>Status</th><th></th></tr></thead>
                <tbody id="extrato-body"><tr><td colspan="7" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>

        <div class="modal" id="modal-conta-bancaria">
            <div class="modal-content">
                <h3>Nova Conta Bancária</h3>
                <form id="form-conta-bancaria">
                    <div class="form-group"><label for="cb-nome">Nome</label><input type="text" id="cb-nome" required></div>
                    <div class="form-group"><label for="cb-banco">Banco</label><input type="text" id="cb-banco"></div>
                    <div class="form-group"><label for="cb-agencia">Agência</label><input type="text" id="cb-agencia"></div>
                    <div class="form-group"><label for="cb-numero">Número da conta</label><input type="text" id="cb-numero"></div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-conta-bancaria">Cancelar</button>
                        <button type="submit" class="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="modal" id="modal-importar-ofx">
            <div class="modal-content">
                <h3>Importar extrato</h3>
                <form id="form-importar-ofx">
                    <div class="form-group">
                        <label for="ofx-conta">Conta bancária</label>
                        <select id="ofx-conta" required></select>
                    </div>
                    <div class="form-group">
                        <label for="ofx-arquivo">Arquivo .OFX</label>
                        <input type="file" id="ofx-arquivo" accept=".ofx" required>
                    </div>
                    <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="btn-cancelar-importar-ofx">Cancelar</button>
                        <button type="submit" class="btn-primary">Importar</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="modal" id="modal-conciliar">
            <div class="modal-content">
                <h3>Conciliar transação</h3>
                <p id="conciliar-resumo" class="text-muted"></p>
                <input type="text" id="conciliar-busca" placeholder="Buscar lançamento por histórico..." style="width:100%; margin-bottom:0.75rem; padding:0.5rem; border:1px solid var(--cor-borda); border-radius:8px;">
                <div id="conciliar-candidatos" style="max-height:280px; overflow-y:auto;"></div>
                <div style="display:flex; justify-content:flex-end; margin-top:1rem;">
                    <button type="button" class="btn-secondary" id="btn-cancelar-conciliar">Fechar</button>
                </div>
            </div>
        </div>
    `;

    let contasBancarias = [];
    let extratoItens = [];
    let itemConciliacaoAtual = null;

    async function carregarContasBancarias() {
        const { data, error } = await supabase.from('contas_bancarias').select('*').order('nome');
        if (error) { mostrarToast('Erro ao carregar contas bancárias: ' + error.message, 'erro'); return; }
        contasBancarias = data;
        renderizarContasBancarias();

        const selectFiltro = container.querySelector('#filtro-conta-bancaria');
        const selectOfx = container.querySelector('#ofx-conta');
        const opcoes = contasBancarias.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');
        selectFiltro.innerHTML = '<option value="">Todas as contas</option>' + opcoes;
        selectOfx.innerHTML = opcoes;
    }

    function renderizarContasBancarias() {
        const tbody = container.querySelector('#contas-bancarias-body');
        if (!contasBancarias.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma conta bancária cadastrada.</td></tr>';
            return;
        }
        tbody.innerHTML = contasBancarias.map(c => `<tr>
            <td>${escapeHtml(c.nome)}</td><td>${escapeHtml(c.banco ?? '—')}</td><td>${escapeHtml(c.agencia ?? '—')}</td><td>${escapeHtml(c.numero_conta ?? '—')}</td>
            <td><button class="btn-danger" data-excluir-conta="${c.id}">Excluir</button></td>
        </tr>`).join('');

        tbody.querySelectorAll('[data-excluir-conta]').forEach(btn =>
            btn.addEventListener('click', () => excluirContaBancaria(Number(btn.dataset.excluirConta))));
    }

    async function excluirContaBancaria(id) {
        if (!confirm('Excluir esta conta bancária? Os itens de extrato importados dela também serão excluídos.')) return;
        const { error } = await supabase.from('contas_bancarias').delete().eq('id', id);
        if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }
        mostrarToast('Conta bancária excluída.', 'sucesso');
        await carregarContasBancarias();
        await carregarExtrato();
    }

    async function carregarExtrato() {
        const contaId = container.querySelector('#filtro-conta-bancaria').value;
        let query = supabase.from('extrato_itens').select('*, contas_bancarias(nome), lancamentos(data, historico)').order('data', { ascending: false });
        if (contaId) query = query.eq('conta_bancaria_id', contaId);

        const { data, error } = await query;
        if (error) { mostrarToast('Erro ao carregar extrato: ' + error.message, 'erro'); return; }
        extratoItens = data;
        renderizarExtrato();
    }

    function renderizarExtrato() {
        const tbody = container.querySelector('#extrato-body');
        if (!extratoItens.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum item de extrato. Importe um arquivo .OFX para começar.</td></tr>';
            return;
        }
        tbody.innerHTML = extratoItens.map(it => {
            const badgeStatus = it.status === 'conciliado'
                ? '<span class="badge badge-aprovado">Conciliado</span>'
                : '<span class="badge badge-pendente">Pendente</span>';
            const acao = it.status === 'conciliado'
                ? `<button class="btn-secondary" data-desfazer="${it.id}">Desfazer</button>`
                : `<button class="btn-primary" data-conciliar="${it.id}">Conciliar</button>`;
            return `<tr>
                <td>${escapeHtml(it.contas_bancarias?.nome ?? '—')}</td>
                <td>${formatarData(it.data)}</td>
                <td>${escapeHtml(it.historico)}</td>
                <td><span class="badge ${it.tipo === 'CREDITO' ? 'badge-receita' : 'badge-despesa'}">${it.tipo === 'CREDITO' ? 'Crédito' : 'Débito'}</span></td>
                <td>${formatarMoeda(it.valor)}</td>
                <td>${badgeStatus}</td>
                <td>${acao}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-conciliar]').forEach(btn =>
            btn.addEventListener('click', () => abrirModalConciliar(Number(btn.dataset.conciliar))));
        tbody.querySelectorAll('[data-desfazer]').forEach(btn =>
            btn.addEventListener('click', () => desfazerConciliacao(Number(btn.dataset.desfazer))));
    }

    async function abrirModalConciliar(itemId) {
        itemConciliacaoAtual = extratoItens.find(it => it.id === itemId);
        container.querySelector('#conciliar-resumo').textContent =
            `${formatarData(itemConciliacaoAtual.data)} · ${itemConciliacaoAtual.historico} · ${formatarMoeda(itemConciliacaoAtual.valor)}`;
        container.querySelector('#conciliar-busca').value = '';
        await renderizarCandidatos('');
        container.querySelector('#modal-conciliar').classList.add('show');
    }

    async function renderizarCandidatos(busca) {
        const tipoLancamento = itemConciliacaoAtual.tipo === 'CREDITO' ? 'RECEITA' : 'DESPESA';
        let query = supabase.from('lancamentos').select('*, contas(nome)')
            .eq('tipo', tipoLancamento).is('conta_bancaria_id', null)
            .order('data', { ascending: false }).limit(30);
        if (busca) query = query.ilike('historico', `%${busca}%`);

        const { data, error } = await query;
        const painel = container.querySelector('#conciliar-candidatos');
        if (error) { painel.innerHTML = `<p class="text-muted">Erro ao buscar lançamentos: ${error.message}</p>`; return; }
        if (!data.length) { painel.innerHTML = '<p class="text-muted">Nenhum lançamento compatível encontrado.</p>'; return; }

        painel.innerHTML = data.map(l => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--cor-borda);">
                <span>${formatarData(l.data)} — ${escapeHtml(l.historico)} (${escapeHtml(l.contas?.nome ?? '—')})</span>
                <span style="display:flex; align-items:center; gap:0.6rem;">
                    <strong>${formatarMoeda(l.valor)}</strong>
                    <button class="btn-primary" data-selecionar="${l.id}">Selecionar</button>
                </span>
            </div>
        `).join('');

        painel.querySelectorAll('[data-selecionar]').forEach(btn =>
            btn.addEventListener('click', () => conciliarComLancamento(Number(btn.dataset.selecionar))));
    }

    async function conciliarComLancamento(lancamentoId) {
        // RPC (Task 2), não update direto em duas tabelas: conciliar um
        // lançamento de outro membro a uma conta bancária compartilhada é
        // uma ação estrutural da família, e um update direto em
        // `lancamentos` esbarraria na policy de dono-ou-admin daquela
        // tabela (pensada para edição de campos, não para isto).
        const { error } = await supabase.rpc('conciliar_extrato', {
            p_item_id: itemConciliacaoAtual.id,
            p_lancamento_id: lancamentoId
        });

        if (error) { mostrarToast('Erro ao conciliar: ' + error.message, 'erro'); return; }
        await registrarHistorico('Conciliação Bancária', 'CONCILIAÇÃO', `Item de extrato #${itemConciliacaoAtual.id} conciliado com lançamento #${lancamentoId}`);
        mostrarToast('Conciliado com sucesso.', 'sucesso');
        container.querySelector('#modal-conciliar').classList.remove('show');
        await carregarExtrato();
    }

    async function desfazerConciliacao(itemId) {
        const { error } = await supabase.rpc('desfazer_conciliacao', { p_item_id: itemId });
        if (error) { mostrarToast('Erro ao desfazer: ' + error.message, 'erro'); return; }
        mostrarToast('Conciliação desfeita.', 'sucesso');
        await carregarExtrato();
    }

    // --- Modais de cadastro de conta bancária -----------------------------

    container.querySelector('#btn-nova-conta-bancaria').addEventListener('click', () =>
        container.querySelector('#modal-conta-bancaria').classList.add('show'));
    container.querySelector('#btn-cancelar-conta-bancaria').addEventListener('click', () =>
        container.querySelector('#modal-conta-bancaria').classList.remove('show'));

    container.querySelector('#form-conta-bancaria').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const payload = {
                nome: container.querySelector('#cb-nome').value.trim(),
                banco: container.querySelector('#cb-banco').value.trim() || null,
                agencia: container.querySelector('#cb-agencia').value.trim() || null,
                numero_conta: container.querySelector('#cb-numero').value.trim() || null
            };
            const { error } = await supabase.from('contas_bancarias').insert(payload);
            if (error) { mostrarToast('Erro ao salvar: ' + error.message, 'erro'); return; }
            await registrarHistorico('Conciliação Bancária', 'INSERÇÃO', `Conta bancária "${payload.nome}" cadastrada`);
            mostrarToast('Conta bancária salva.', 'sucesso');
            container.querySelector('#modal-conta-bancaria').classList.remove('show');
            e.target.reset();
            await carregarContasBancarias();
        });
    });

    // --- Modal de importação de extrato -----------------------------------

    container.querySelector('#btn-importar-ofx').addEventListener('click', () => {
        if (!contasBancarias.length) { mostrarToast('Cadastre uma conta bancária antes de importar.', 'erro'); return; }
        container.querySelector('#modal-importar-ofx').classList.add('show');
    });
    container.querySelector('#btn-cancelar-importar-ofx').addEventListener('click', () =>
        container.querySelector('#modal-importar-ofx').classList.remove('show'));

    container.querySelector('#form-importar-ofx').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        await executarComBloqueio(btn, async () => {
            const contaId = Number(container.querySelector('#ofx-conta').value);
            const arquivo = container.querySelector('#ofx-arquivo').files[0];
            if (!arquivo) { mostrarToast('Selecione um arquivo .OFX.', 'erro'); return; }

            let itens;
            try {
                itens = parseOFX(await lerArquivoComoTexto(arquivo));
            } catch (erro) {
                mostrarToast('Erro ao ler o arquivo: ' + erro.message, 'erro');
                return;
            }
            if (!itens.length) { mostrarToast('Nenhuma transação encontrada nesse arquivo.', 'erro'); return; }

            const { data: existentes } = await supabase.from('extrato_itens')
                .select('fitid').eq('conta_bancaria_id', contaId);
            const fitidsExistentes = new Set((existentes ?? []).map(e => e.fitid));
            const novos = itens.filter(it => !fitidsExistentes.has(it.fitid))
                .map(it => ({ ...it, conta_bancaria_id: contaId, status: 'pendente' }));

            if (!novos.length) { mostrarToast('Todas as transações desse arquivo já haviam sido importadas.', 'sucesso'); return; }

            const { error } = await supabase.from('extrato_itens').insert(novos);
            if (error) { mostrarToast('Erro ao importar: ' + error.message, 'erro'); return; }

            await registrarHistorico('Conciliação Bancária', 'IMPORTAÇÃO', `${novos.length} transação(ões) importada(s) de ${arquivo.name}`);
            mostrarToast(`${novos.length} transação(ões) importada(s).`, 'sucesso');
            container.querySelector('#modal-importar-ofx').classList.remove('show');
            e.target.reset();
            await carregarExtrato();
        });
    });

    container.querySelector('#filtro-conta-bancaria').addEventListener('change', carregarExtrato);
    container.querySelector('#btn-cancelar-conciliar').addEventListener('click', () =>
        container.querySelector('#modal-conciliar').classList.remove('show'));
    container.querySelector('#conciliar-busca').addEventListener('input', e => renderizarCandidatos(e.target.value));

    await carregarContasBancarias();
    await carregarExtrato();
}
