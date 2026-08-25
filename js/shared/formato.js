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