import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorTipoEGrupo } from '../js/shared/grupos.js';

test('agrupa contas por tipo e depois por grupo (plano_contas)', () => {
    const planos = [
        { id: 1, tipo: 'RECEITA', descricao: 'Salários' },
        { id: 2, tipo: 'DESPESA', descricao: 'Casa' }
    ];
    const contas = [
        { id: 10, plano_id: 1, nome: 'Salário' },
        { id: 11, plano_id: 2, nome: 'Aluguel' },
        { id: 12, plano_id: 2, nome: 'Condomínio' }
    ];

    const resultado = agruparPorTipoEGrupo(planos, contas);

    assert.equal(resultado.length, 2);
    assert.equal(resultado[0].tipo, 'RECEITA');
    assert.equal(resultado[0].grupos.length, 1);
    assert.equal(resultado[0].grupos[0].nome, 'Salários');
    assert.equal(resultado[0].grupos[0].contas.length, 1);
    assert.equal(resultado[1].grupos[0].contas.length, 2);
});

test('usa um nome padrão quando o grupo não tem descrição', () => {
    const planos = [{ id: 1, tipo: 'RECEITA', descricao: null }];
    const resultado = agruparPorTipoEGrupo(planos, []);
    assert.equal(resultado[0].grupos[0].nome, 'Receitas');
});

test('omite tipos sem nenhum grupo cadastrado', () => {
    const planos = [{ id: 1, tipo: 'RECEITA', descricao: 'Salários' }];
    const resultado = agruparPorTipoEGrupo(planos, []);
    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].tipo, 'RECEITA');
});
