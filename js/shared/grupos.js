const TIPOS = ['RECEITA', 'DESPESA'];

export function agruparPorTipoEGrupo(planos, contas) {
    return TIPOS
        .map(tipo => ({
            tipo,
            grupos: planos
                .filter(p => p.tipo === tipo)
                .map(p => ({
                    id: p.id,
                    nome: p.descricao || (tipo === 'RECEITA' ? 'Receitas' : 'Despesas'),
                    contas: contas.filter(c => c.plano_id === p.id)
                }))
        }))
        .filter(secao => secao.grupos.length > 0);
}
