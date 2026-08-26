import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularResumoPeriodo, agruparEvolucaoDiaria } from '../js/shared/relatoriosCalculos.js';

test('calcularResumoPeriodo soma receitas, despesas e calcula o resultado', () => {
    const lancamentos = [
        { tipo: 'RECEITA', valor: 1000 },
        { tipo: 'DESPESA', valor: 300 },
        { tipo: 'DESPESA', valor: 200 }
    ];
    assert.deepEqual(calcularResumoPeriodo(lancamentos), { receitas: 1000, despesas: 500, resultado: 500 });
});

test('calcularResumoPeriodo lida com lista vazia', () => {
    assert.deepEqual(calcularResumoPeriodo([]), { receitas: 0, despesas: 0, resultado: 0 });
});

test('agruparEvolucaoDiaria soma o saldo líquido por dia e ordena por data', () => {
    const lancamentos = [
        { tipo: 'DESPESA', valor: 50, data: '2026-08-11' },
        { tipo: 'RECEITA', valor: 100, data: '2026-08-10' },
        { tipo: 'DESPESA', valor: 30, data: '2026-08-10' }
    ];
    assert.deepEqual(agruparEvolucaoDiaria(lancamentos), [
        { data: '2026-08-10', saldo: 70 },
        { data: '2026-08-11', saldo: -50 }
    ]);
});
