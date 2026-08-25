import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarMoeda, formatarData, formatarDataHora, escapeHtml } from '../js/shared/formato.js';

test('formatarMoeda formats BRL currency', () => {
    assert.equal(formatarMoeda(1234.5), 'R$ 1.234,50');
});

test('formatarData formats an ISO date string as pt-BR without timezone drift', () => {
    assert.equal(formatarData('2026-08-24'), '24/08/2026');
});

test('formatarDataHora formats an ISO timestamp as pt-BR date + time', () => {
    const resultado = formatarDataHora('2026-08-24T13:05:00.000Z');
    assert.match(resultado, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
});

test('formatarDataHora returns em dash for empty input', () => {
    assert.equal(formatarDataHora(''), '—');
});

test('escapeHtml escapes all five HTML-significant characters', () => {
    assert.equal(escapeHtml(`<img src=x onerror="alert('x')">&`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
});

test('escapeHtml passes through a safe string unchanged', () => {
    assert.equal(escapeHtml('Supermercado'), 'Supermercado');
});

test('escapeHtml treats null/undefined as an empty string', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
});