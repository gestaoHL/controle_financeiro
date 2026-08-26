function escapeCampoCSV(valor) {
    const texto = String(valor ?? '');
    if (/[",\n]/.test(texto)) {
        return '"' + texto.replace(/"/g, '""') + '"';
    }
    return texto;
}

export function paraCSV(colunas, linhas) {
    const cabecalho = colunas.map(c => escapeCampoCSV(c.rotulo)).join(',');
    const corpo = linhas.map(linha => colunas.map(c => escapeCampoCSV(linha[c.chave])).join(','));
    return [cabecalho, ...corpo].join('\r\n');
}
