import { supabase } from './supabaseClient.js';
import { mostrarToast } from './shared/toast.js';

// --- API pública, usada por index.html e pelos módulos de tela ---------

export async function exigirSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    const perfil = await buscarPerfil(session.user.id);
    if (!perfil || perfil.status !== 'aprovado') {
        mostrarBloqueioPendente();
        return null;
    }

    return { session, perfil };
}

export async function sair() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

async function buscarPerfil(usuarioId) {
    const { data, error } = await supabase.from('perfis').select('*').eq('id', usuarioId).single();
    if (error) {
        console.error('Falha ao carregar perfil:', error.message);
        return null;
    }
    return data;
}

function mostrarBloqueioPendente() {
    document.body.innerHTML = `
        <div class="login-page">
            <div class="login-card text-center">
                <h1>Aguardando aprovação</h1>
                <p class="text-muted">Sua conta foi criada, mas ainda precisa ser aprovada por um administrador da família antes de acessar o sistema.</p>
                <button class="btn-secondary" id="btn-sair-pendente" style="margin-top:1rem;">Sair</button>
            </div>
        </div>
    `;
    document.getElementById('btn-sair-pendente').addEventListener('click', sair);
}

// --- Lógica exclusiva de login.html -------------------------------------

async function inicializarLoginPage() {
    if (!document.getElementById('form-login')) return; // não estamos em login.html

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('form-login').addEventListener('submit', handleLoginSubmit);
    document.getElementById('form-cadastro').addEventListener('submit', handleCadastroSubmit);
    document.getElementById('link-alternar-modo').addEventListener('click', alternarModo);
}

function alternarModo(e) {
    e.preventDefault();
    const emLogin = document.getElementById('form-login').style.display !== 'none';
    document.getElementById('form-login').style.display = emLogin ? 'none' : 'block';
    document.getElementById('form-cadastro').style.display = emLogin ? 'block' : 'none';
    document.getElementById('titulo-formulario').textContent = emLogin ? 'Criar conta' : 'Finanças HL';
    e.target.textContent = emLogin ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Cadastre-se';
    esconderErro();
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const btn = e.target.querySelector('button[type="submit"]');

    esconderErro();
    mostrarCarregamento(btn);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    ocultarCarregamento(btn);

    if (error) {
        mostrarErro('E-mail ou senha inválidos.');
        return;
    }
    window.location.href = 'index.html';
}

async function handleCadastroSubmit(e) {
    e.preventDefault();
    const nome = document.getElementById('cadastro-nome').value;
    const email = document.getElementById('cadastro-email').value;
    const senha = document.getElementById('cadastro-senha').value;
    const btn = e.target.querySelector('button[type="submit"]');

    esconderErro();
    mostrarCarregamento(btn);
    const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome } }
    });
    ocultarCarregamento(btn);

    if (error) {
        mostrarErro(error.message);
        return;
    }
    mostrarToast('Conta criada! Se for a primeira do sistema você já é admin, senão aguarde aprovação.', 'sucesso');
    window.location.href = 'index.html';
}

function mostrarErro(mensagem) {
    const alertEl = document.getElementById('alerta-erro');
    alertEl.querySelector('.alert-text').textContent = mensagem;
    alertEl.style.display = 'flex';
}

function esconderErro() {
    document.getElementById('alerta-erro').style.display = 'none';
}

function mostrarCarregamento(btn) {
    btn.disabled = true;
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loader').style.display = 'inline';
}

function ocultarCarregamento(btn) {
    btn.disabled = false;
    btn.querySelector('.btn-text').style.display = 'inline';
    btn.querySelector('.btn-loader').style.display = 'none';
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarLoginPage);
} else {
    inicializarLoginPage();
}
