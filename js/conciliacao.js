import { supabase } from './supabaseClient.js';
import { mostrarToast, executarComBloqueio } from './shared/toast.js';
import { registrarHistorico } from './shared/auditoria.js';
import { formatarMoeda, formatarData, escapeHtml } from './shared/formato.js';
import { parseOFX, lerArquivoComoTexto } from './shared/ofxParser.js';
import { encontrarCorrespondenciasAutomaticas } from './shared/conciliacaoAuto.js';

export async function montarTela(container) {
    container.innerHTML = `
        <div class="card">
            <div class="page-header">
                <h3>Contas bancárias</h3>
                <button class="btn-primary" id="btn-nova-conta-bancaria">+ Nova Conta Bancária</button>
            </div>
            <table class="data-table">
                <thead><tr><th>Nome</th><th>Banco</th><th>Agência</th><th>Número</th><th></th></tr></thead>
                <tbody id="contas-bancarias-body"><tr><td colspan="5" class="text-center">Carregando...</td></tr></tbody>
            </table>
        </div>

        <div class="card">
            <div class="page-header">
                <h3>Extrato importado</h3>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-secondary" id="btn-auto-conciliar">Auto-conciliar</button>
                    <button class="btn-primary" id="btn-importar-ofx">Importar extrato (.OFX)</button>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:1rem; margin-bottom:1rem;">
                <div class="summary-card" style="border-top:4px solid var(--cor-receita); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Créditos no extrato</div>
                    <div id="resumo-creditos" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--cor-despesa); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Débitos no extrato</div>
                    <div id="resumo-debitos" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--cor-primaria); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Conciliados</div>
                    <div id="resumo-conciliados" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
                <div class="summary-card" style="border-top:4px solid var(--color-warning); margin-bottom:0;">
                    <div class="text-muted" style="font-size:0.72rem; text-transform:uppercase;">Pendentes</div>
                    <div id="resumo-pendentes" style="font-weight:800; margin-top:0.35rem;">—</div>
                </div>
            </div>

            <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
                <select id="filtro-conta-bancaria"><option value="">Todas as contas</option></select>
                <select id="filtro-status-extrato">
                    <option value="pendente">Pendentes</option>
                    <option value="conciliado">Conciliados</option>
                    <option value="">Todos</option>
                </select>
            </div>

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
                <input type="text" id="conciliar-busca" placeholder="Buscar lançamento por histórico..." style="width:100%; margin-bottom:0.75rem;">
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
        const conta = contasBancarias.find(c => c.id === id);
        const { error } = await supabase.from('contas_bancarias').delete().eq('id', id);
        if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }
        await registrarHistorico('Conciliação Bancária', 'EXCLUSÃO', `Conta bancária "${conta?.nome}" excluída (e seus itens de extrato)`);
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

    function itensFiltrados() {
        const status = container.querySelector('#filtro-status-extrato').value;
        return status ? extratoItens.filter(it => it.status === status) : extratoItens;
    }

    function atualizarResumo() {
        const creditos = extratoItens.filter(it => it.tipo === 'CREDITO').reduce((s, it) => s + it.valor, 0);
        const debitos = extratoItens.filter(it => it.tipo === 'DEBITO').reduce((s, it) => s + it.valor, 0);
        const conciliados = extratoItens.filter(it => it.status === 'conciliado').length;
        const pendentes = extratoItens.filter(it => it.status === 'pendente').length;

        container.querySelector('#resumo-creditos').textContent = formatarMoeda(creditos);
        container.querySelector('#resumo-debitos').textContent = formatarMoeda(debitos);
        container.querySelector('#resumo-conciliados').textContent = String(conciliados);
        container.querySelector('#resumo-pendentes').textContent = String(pendentes);
    }

    async function executarAutoConciliar() {
        const { data: lancamentosDisponiveis, error: erroLanc } = await supabase
            .from('lancamentos').select('id, tipo, valor, data').is('conta_bancaria_id', null);
        if (erroLanc) { mostrarToast('Erro ao buscar lançamentos: ' + erroLanc.message, 'erro'); return; }

        const pendentes = extratoItens.filter(it => it.status === 'pendente');
        const correspondencias = encontrarCorrespondenciasAutomaticas(pendentes, lancamentosDisponiveis);

        if (!correspondencias.length) { mostrarToast('Nenhuma correspondência automática encontrada.', 'sucesso'); return; }

        let sucesso = 0;
        for (const { itemId, lancamentoId } of correspondencias) {
            const { error } = await supabase.rpc('conciliar_extrato', { p_item_id: itemId, p_lancamento_id: lancamentoId });
            if (!error) {
                sucesso++;
                await registrarHistorico('Conciliação Bancária', 'CONCILIAÇÃO', `Item de extrato #${itemId} conciliado automaticamente com lançamento #${lancamentoId}`);
            }
        }

        mostrarToast(`${sucesso} de ${correspondencias.length} transação(ões) conciliada(s) automaticamente.`, 'sucesso');
        await carregarExtrato();
    }

    function renderizarExtrato() {
        atualizarResumo();
        const lista = itensFiltrados();

        const tbody = container.querySelector('#extrato-body');
        if (!lista.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum item de extrato para este filtro.</td></tr>';
            return;
        }
        tbody.innerHTML = lista.map(it => {
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
        await registrarHistorico('Conciliação Bancária', 'DESCONCILIAÇÃO', `Item de extrato #${itemId} desconciliado`);
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

            // upsert com ignoreDuplicates em vez de pré-buscar os fitids
            // existentes e filtrar no cliente: evita um round-trip, não
            // depende de o SELECT anterior ter trazido TODOS os itens já
            // importados daquela conta (o limite padrão de linhas do
            // PostgREST poderia esconder fitids antigos numa conta com
            // extrato grande), e não falha o lote inteiro se algum item
            // já existir — o unique (conta_bancaria_id, fitid) vira
            // "ignora e segue" em vez de rejeitar o insert todo.
            const candidatos = itens.map(it => ({ ...it, conta_bancaria_id: contaId, status: 'pendente' }));
            const { data: inseridos, error } = await supabase.from('extrato_itens')
                .upsert(candidatos, { onConflict: 'conta_bancaria_id,fitid', ignoreDuplicates: true })
                .select();
            if (error) { mostrarToast('Erro ao importar: ' + error.message, 'erro'); return; }

            if (!inseridos.length) { mostrarToast('Todas as transações desse arquivo já haviam sido importadas.', 'sucesso'); return; }

            await registrarHistorico('Conciliação Bancária', 'IMPORTAÇÃO', `${inseridos.length} transação(ões) importada(s) de ${arquivo.name}`);
            mostrarToast(`${inseridos.length} transação(ões) importada(s).`, 'sucesso');
            container.querySelector('#modal-importar-ofx').classList.remove('show');
            e.target.reset();
            await carregarExtrato();
        });
    });

    container.querySelector('#filtro-conta-bancaria').addEventListener('change', carregarExtrato);
    container.querySelector('#filtro-status-extrato').addEventListener('change', renderizarExtrato);
    container.querySelector('#btn-auto-conciliar').addEventListener('click', executarAutoConciliar);
    container.querySelector('#btn-cancelar-conciliar').addEventListener('click', () =>
        container.querySelector('#modal-conciliar').classList.remove('show'));
    container.querySelector('#conciliar-busca').addEventListener('input', e => renderizarCandidatos(e.target.value));

    await carregarContasBancarias();
    await carregarExtrato();
}
