import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularMaiorDespesa, calcularMediaDiaria, diasNoAno, calcularDesvioPorGrupo } from '../js/shared/dashboardCalculos.js';

test('calcularMaiorDespesa retorna o maior valor entre lançamentos de despesa', () => {
    const lancamentos = [
        { tipo: 'RECEITA', valor: 5000 },
        { tipo: 'DESPESA', valor: 120 },
        { tipo: 'DESPESA', valor: 980 }
    ];
    assert.equal(calcularMaiorDespesa(lancamentos), 980);
});

test('calcularMaiorDespesa retorna 0 quando não há despesas', () => {
    assert.equal(calcularMaiorDespesa([{ tipo: 'RECEITA', valor: 100 }]), 0);
});

test('calcularMediaDiaria divide o total de despesas pelos dias informados', () => {
    const lancamentos = [{ tipo: 'DESPESA', valor: 300 }, { tipo: 'DESPESA', valor: 300 }];
    assert.equal(calcularMediaDiaria(lancamentos, 10), 60);
});

test('calcularMediaDiaria retorna 0 quando dias é 0', () => {
    assert.equal(calcularMediaDiaria([{ tipo: 'DESPESA', valor: 100 }], 0), 0);
});

test('diasNoAno reconhece anos bissextos', () => {
    assert.equal(diasNoAno(2024), 366);
    assert.equal(diasNoAno(2026), 365);
    assert.equal(diasNoAno(1900), 365);
    assert.equal(diasNoAno(2000), 366);
});

test('calcularDesvioPorGrupo soma orçado/realizado por grupo e calcula o desvio percentual', () => {
    const secoes = [{
        tipo: 'DESPESA',
        grupos: [{ id: 1, nome: 'Casa', contas: [{ id: 10 }, { id: 11 }] }]
    }];
    const orcamentoPorConta = { 10: 100, 11: 100 };
    const realizadoPorConta = { 10: 150, 11: 90 };
    const resultado = calcularDesvioPorGrupo(secoes, orcamentoPorConta, realizadoPorConta);
    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].orcado, 200);
    assert.equal(resultado[0].realizado, 240);
    assert.equal(resultado[0].desvioPct, 20);
});

test('calcularDesvioPorGrupo trata orçado zero sem dividir por zero', () => {
    const secoes = [{ tipo: 'DESPESA', grupos: [{ id: 1, nome: 'Casa', contas: [{ id: 10 }] }] }];
    const semRealizado = calcularDesvioPorGrupo(secoes, {}, {});
    assert.equal(semRealizado[0].desvioPct, 0);
    const comRealizado = calcularDesvioPorGrupo(secoes, {}, { 10: 50 });
    assert.equal(comRealizado[0].desvioPct, 100);
});
