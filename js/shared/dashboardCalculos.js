export function calcularMaiorDespesa(lancamentos) {
    const valores = lancamentos.filter(l => l.tipo === 'DESPESA').map(l => l.valor);
    return valores.length ? Math.max(...valores) : 0;
}

export function calcularMediaDiaria(lancamentos, dias) {
    if (!dias) return 0;
    const totalDespesas = lancamentos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + l.valor, 0);
    return totalDespesas / dias;
}

export function diasNoAno(ano) {
    return ((ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0) ? 366 : 365;
}

export function calcularDesvioPorGrupo(secoes, orcamentoPorConta, realizadoPorConta) {
    return secoes.flatMap(secao => secao.grupos.map(grupo => {
        const orcado = grupo.contas.reduce((s, c) => s + (orcamentoPorConta[c.id] ?? 0), 0);
        const realizado = grupo.contas.reduce((s, c) => s + (realizadoPorConta[c.id] ?? 0), 0);
        const desvioPct = orcado > 0 ? ((realizado - orcado) / orcado) * 100 : (realizado > 0 ? 100 : 0);
        return { tipo: secao.tipo, nome: grupo.nome, orcado, realizado, desvioPct };
    }));
}
