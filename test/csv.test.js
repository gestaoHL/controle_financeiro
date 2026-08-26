import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paraCSV } from '../js/shared/csv.js';

test('paraCSV monta cabeçalho e linhas separados por vírgula', () => {
    const colunas = [{ chave: 'nome', rotulo: 'Nome' }, { chave: 'valor', rotulo: 'Valor' }];
    const linhas = [{ nome: 'Aluguel', valor: '1500' }, { nome: 'Mercado', valor: '400' }];
    assert.equal(paraCSV(colunas, linhas), 'Nome,Valor\r\nAluguel,1500\r\nMercado,400');
});

test('paraCSV retorna apenas o cabeçalho quando não há linhas', () => {
    const colunas = [{ chave: 'nome', rotulo: 'Nome' }];
    assert.equal(paraCSV(colunas, []), 'Nome');
});

test('paraCSV coloca entre aspas um campo que contém vírgula', () => {
    const colunas = [{ chave: 'historico', rotulo: 'Histórico' }];
    const linhas = [{ historico: 'Mercado, feira e padaria' }];
    assert.equal(paraCSV(colunas, linhas), 'Histórico\r\n"Mercado, feira e padaria"');
});

test('paraCSV escapa aspas internas dobrando-as', () => {
    const colunas = [{ chave: 'historico', rotulo: 'Histórico' }];
    const linhas = [{ historico: 'Pagamento "extra"' }];
    assert.equal(paraCSV(colunas, linhas), 'Histórico\r\n"Pagamento ""extra"""');
});
