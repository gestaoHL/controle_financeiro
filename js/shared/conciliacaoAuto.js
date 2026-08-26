const UM_DIA_MS = 24 * 60 * 60 * 1000;
const TOLERANCIA_VALOR = 0.005;

export function encontrarCorrespondenciasAutomaticas(itensExtrato, lancamentosDisponiveis) {
    const usados = new Set();
    const correspondencias = [];

    itensExtrato
        .filter(item => item.status !== 'conciliado')
        .forEach(item => {
            const tipoEsperado = item.tipo === 'CREDITO' ? 'RECEITA' : 'DESPESA';
            const dataItem = new Date(item.data + 'T00:00:00').getTime();

            const candidatos = lancamentosDisponiveis.filter(l =>
                !usados.has(l.id) &&
                l.tipo === tipoEsperado &&
                Math.abs(l.valor - item.valor) < TOLERANCIA_VALOR &&
                Math.abs(new Date(l.data + 'T00:00:00').getTime() - dataItem) <= UM_DIA_MS
            );

            if (candidatos.length === 1) {
                usados.add(candidatos[0].id);
                correspondencias.push({ itemId: item.id, lancamentoId: candidatos[0].id });
            }
        });

    return correspondencias;
}
