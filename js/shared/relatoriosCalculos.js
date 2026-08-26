export function calcularResumoPeriodo(lancamentos) {
    const receitas = lancamentos.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + l.valor, 0);
    const despesas = lancamentos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + l.valor, 0);
    return { receitas, despesas, resultado: receitas - despesas };
}

export function agruparEvolucaoDiaria(lancamentos) {
    const porDia = {};
    lancamentos.forEach(l => {
        const sinal = l.tipo === 'RECEITA' ? 1 : -1;
        porDia[l.data] = (porDia[l.data] ?? 0) + sinal * l.valor;
    });
    return Object.keys(porDia).sort().map(data => ({ data, saldo: porDia[data] }));
}
