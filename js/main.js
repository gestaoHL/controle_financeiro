import { exigirSessao, sair } from './auth.js';

const TITULOS = {
    'dashboard': 'Dashboard',
    'plano-contas': 'Plano de Contas',
    'orcamento': 'Orçamento',
    'lancamentos': 'Lançamentos',
    'prestacao-contas': 'Prestação de Contas',
    'conciliacao-bancaria': 'Conciliação Bancária',
    'transparencia': 'Transparência',
    'relatorios': 'Relatórios',
    'membros': 'Membros',
    'historico': 'Histórico'
};

// Cada módulo de tela exporta `montarTela(container, contexto)`. Import
// dinâmico: só carrega o código da tela quando ela é aberta pela primeira
// vez.
const CARREGADORES_TELA = {
    'dashboard': () => import('./dashboard.js'),
    'plano-contas': () => import('./planoContas.js'),
    'orcamento': () => import('./orcamento.js'),
    'lancamentos': () => import('./lancamentos.js'),
    'prestacao-contas': () => import('./prestacaoContas.js'),
    'conciliacao-bancaria': () => import('./conciliacao.js'),
    'transparencia': () => import('./transparencia.js'),
    'relatorios': () => import('./relatorios.js'),
    'membros': () => import('./membros.js'),
    'historico': () => import('./historico.js')
};

let contextoAtual = null;

async function abrirPagina(pagina) {
    document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === pagina));
    document.querySelectorAll('.page').forEach(s => s.classList.toggle('active', s.id === `page-${pagina}`));
    document.getElementById('page-title').textContent = TITULOS[pagina] || pagina;

    const secao = document.getElementById(`page-${pagina}`);
    const carregar = CARREGADORES_TELA[pagina];
    if (!secao || !carregar) return;

    secao.innerHTML = '<p class="text-muted">Carregando...</p>';
    try {
        const modulo = await carregar();
        await modulo.montarTela(secao, contextoAtual);
    } catch (erro) {
        console.error(`Falha ao carregar a tela "${pagina}":`, erro);
        secao.innerHTML = '<p class="text-muted">Não foi possível carregar esta tela.</p>';
    }
}

async function inicializar() {
    const resultado = await exigirSessao();
    if (!resultado) return; // exigirSessao já redirecionou ou mostrou o bloqueio de pendente

    contextoAtual = resultado;
    document.getElementById('user-name').textContent = `${resultado.perfil.nome} (${resultado.perfil.papel})`;
    document.getElementById('logout-btn').addEventListener('click', sair);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            abrirPagina(link.dataset.page);
        });
    });

    abrirPagina('dashboard');
}

inicializar();
