function obterContainerToast() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed; top:1rem; right:1rem; z-index:9999; display:flex; flex-direction:column; gap:0.6rem; align-items:flex-end;';
        document.body.appendChild(container);
    }
    return container;
}

export function mostrarToast(mensagem, tipo) {
    const cores = {
        sucesso: { bg: '#ecfdf5', border: '#10b981', texto: '#065f46', icone: '✅' },
        erro:    { bg: '#fef2f2', border: '#ef4444', texto: '#991b1b', icone: '⚠️' }
    };
    const cor = cores[tipo] || cores.sucesso;

    const container = obterContainerToast();
    const toast = document.createElement('div');
    toast.style.cssText = `
        background:${cor.bg}; color:${cor.texto}; border-left:4px solid ${cor.border};
        border-radius:8px; padding:0.85rem 1.1rem; box-shadow:0 4px 16px rgba(0,0,0,0.15);
        font-size:0.88rem; line-height:1.4; max-width:360px; display:flex; align-items:flex-start;
        gap:0.6rem; opacity:0; transform:translateX(20px); transition:opacity 0.25s ease, transform 0.25s ease;
    `;
    const icone = document.createElement('span');
    icone.style.flexShrink = '0';
    icone.textContent = cor.icone;
    const texto = document.createElement('span');
    texto.textContent = mensagem;
    toast.append(icone, texto);
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

export async function executarComBloqueio(botao, fnAsync) {
    if (!botao) return fnAsync();
    const textoOriginal = botao.innerHTML;
    const eraDisabled = botao.disabled;
    botao.disabled = true;
    botao.dataset.textoOriginal = botao.dataset.textoOriginal || textoOriginal;
    botao.innerHTML = 'Salvando...';
    try {
        return await fnAsync();
    } finally {
        botao.disabled = eraDisabled;
        botao.innerHTML = botao.dataset.textoOriginal;
        delete botao.dataset.textoOriginal;
    }
}
