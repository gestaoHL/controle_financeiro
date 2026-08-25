import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOFX } from '../js/shared/ofxParser.js';

const OFX_AMOSTRA = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260810120000
<TRNAMT>1500.00
<FITID>ABC123
<MEMO>Salário
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260812090000
<TRNAMT>-89.90
<FITID>ABC124
<MEMO>Supermercado
</STMTTRN>
</BANKTRANLIST>
</OFX>
`;

test('parseOFX extracts credit and debit transactions', () => {
    const itens = parseOFX(OFX_AMOSTRA);
    assert.equal(itens.length, 2);
    assert.deepEqual(itens[0], {
        fitid: 'ABC123',
        data: '2026-08-10',
        historico: 'Salário',
        valor: 1500,
        tipo: 'CREDITO'
    });
    assert.deepEqual(itens[1], {
        fitid: 'ABC124',
        data: '2026-08-12',
        historico: 'Supermercado',
        valor: 89.90,
        tipo: 'DEBITO'
    });
});

test('parseOFX ignores transactions without a valid date or zero value', () => {
    const semData = `<STMTTRN><TRNTYPE>CREDIT<TRNAMT>10.00<FITID>X<MEMO>teste</STMTTRN>`;
    assert.equal(parseOFX(semData).length, 0);
});

test('parseOFX falls back to a generated fitid when none is present', () => {
    const semFitid = `<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260101<TRNAMT>10.00<MEMO>teste</STMTTRN>`;
    const itens = parseOFX(semFitid);
    assert.equal(itens.length, 1);
    assert.match(itens[0].fitid, /^20260101_10\.00_teste$/);
});
