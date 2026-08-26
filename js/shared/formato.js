export function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function formatarData(dataString) {
    const data = new Date(dataString);
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    return data.toLocaleDateString('pt-BR');
}

export function formatarDataHora(iso) {
    if (!iso) return '—';
    const data = new Date(iso);
    if (isNaN(data.getTime())) return '—';
    return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

const ENTIDADES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ENTIDADES_HTML[c]);
}

const CLASSES_ACAO = {
    'INSERÇÃO': 'badge-acao-inserir',
    'EDIÇÃO': 'badge-acao-editar',
    'EXCLUSÃO': 'badge-acao-excluir',
    'IMPORTAÇÃO': 'badge-acao-importacao',
    'CONCILIAÇÃO': 'badge-acao-conciliacao',
    'DESCONCILIAÇÃO': 'badge-acao-conciliacao',
    'APROVAÇÃO': 'badge-acao-conciliacao'
};

export function classeParaAcao(acao) {
    return CLASSES_ACAO[acao] ?? 'badge-acao-outro';
}

export function valorMoedaParaNumero(texto) {
    const digitos = String(texto ?? '').replace(/\D/g, '');
    return digitos ? Number(digitos) / 100 : 0;
}

export function aplicarMascaraMoeda(input) {
    input.setAttribute('inputmode', 'decimal');
    input.addEventListener('input', () => {
        const digitos = input.value.replace(/\D/g, '');
        input.value = digitos ? formatarMoeda(Number(digitos) / 100) : '';
    });
}