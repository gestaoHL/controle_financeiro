// Extrai as transações de um extrato OFX (formato padrão de internet
// banking, usado pela maioria dos bancos brasileiros). Aceita tanto o
// OFX "texto plano" (tags sem fechamento, SGML) quanto o OFX 2.x (XML de
// verdade) — em ambos os casos as tags de interesse aparecem como
// <TAG>valor, então extrair por regex cobre os dois formatos.
export function parseOFX(texto) {
    const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

    const extrairCampo = (bloco, tag) => {
        const m = bloco.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i'));
        return m ? m[1].trim() : '';
    };

    return blocos.map(bloco => {
        const tipo = extrairCampo(bloco, 'TRNTYPE').toUpperCase();
        const dataRaw = extrairCampo(bloco, 'DTPOSTED');
        const valorRaw = extrairCampo(bloco, 'TRNAMT').replace(',', '.');
        const fitid = extrairCampo(bloco, 'FITID');
        const historico = extrairCampo(bloco, 'MEMO') || extrairCampo(bloco, 'NAME') || '(sem histórico)';
        const valor = parseFloat(valorRaw) || 0;
        const ano = dataRaw.slice(0, 4), mes = dataRaw.slice(4, 6), dia = dataRaw.slice(6, 8);

        return {
            fitid: fitid || `${dataRaw}_${valorRaw}_${historico}`.replace(/\s+/g, '_'),
            data: (ano && mes && dia) ? `${ano}-${mes}-${dia}` : '',
            historico,
            valor: Math.abs(valor),
            tipo: (tipo === 'DEBIT' || valor < 0) ? 'DEBITO' : 'CREDITO'
        };
    }).filter(item => item.data && item.valor > 0);
}

export function lerArquivoComoTexto(arquivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo "${arquivo.name}".`));
        reader.readAsText(arquivo);
    });
}
