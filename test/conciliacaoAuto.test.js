import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encontrarCorrespondenciasAutomaticas } from '../js/shared/conciliacaoAuto.js';

test('casa um item de crédito com um lançamento de receita de mesmo valor e data', () => {
    const itens = [{ id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [{ id: 100, tipo: 'RECEITA', valor: 150, data: '2026-08-10' }];
    const resultado = encontrarCorrespondenciasAutomaticas(itens, lancamentos);
    assert.deepEqual(resultado, [{ itemId: 1, lancamentoId: 100 }]);
});

test('aceita diferença de até 1 dia na data', () => {
    const itens = [{ id: 1, tipo: 'DEBITO', valor: 80, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [{ id: 100, tipo: 'DESPESA', valor: 80, data: '2026-08-11' }];
    const resultado = encontrarCorrespondenciasAutomaticas(itens, lancamentos);
    assert.deepEqual(resultado, [{ itemId: 1, lancamentoId: 100 }]);
});

test('não casa quando a diferença de data é maior que 1 dia', () => {
    const itens = [{ id: 1, tipo: 'DEBITO', valor: 80, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [{ id: 100, tipo: 'DESPESA', valor: 80, data: '2026-08-13' }];
    assert.deepEqual(encontrarCorrespondenciasAutomaticas(itens, lancamentos), []);
});

test('não casa quando o valor é diferente', () => {
    const itens = [{ id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [{ id: 100, tipo: 'RECEITA', valor: 151, data: '2026-08-10' }];
    assert.deepEqual(encontrarCorrespondenciasAutomaticas(itens, lancamentos), []);
});

test('ignora itens já conciliados', () => {
    const itens = [{ id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'conciliado' }];
    const lancamentos = [{ id: 100, tipo: 'RECEITA', valor: 150, data: '2026-08-10' }];
    assert.deepEqual(encontrarCorrespondenciasAutomaticas(itens, lancamentos), []);
});

test('não casa quando há mais de um candidato ambíguo', () => {
    const itens = [{ id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' }];
    const lancamentos = [
        { id: 100, tipo: 'RECEITA', valor: 150, data: '2026-08-10' },
        { id: 101, tipo: 'RECEITA', valor: 150, data: '2026-08-10' }
    ];
    assert.deepEqual(encontrarCorrespondenciasAutomaticas(itens, lancamentos), []);
});

test('não reutiliza um lançamento já usado em outra correspondência', () => {
    const itens = [
        { id: 1, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' },
        { id: 2, tipo: 'CREDITO', valor: 150, data: '2026-08-10', status: 'pendente' }
    ];
    const lancamentos = [{ id: 100, tipo: 'RECEITA', valor: 150, data: '2026-08-10' }];
    const resultado = encontrarCorrespondenciasAutomaticas(itens, lancamentos);
    assert.equal(resultado.length, 1);
});
