import { supabase } from '../supabaseClient.js';

export async function registrarHistorico(modulo, acao, detalhes) {
    const { data: sessao } = await supabase.auth.getSession();
    const usuarioId = sessao?.session?.user?.id ?? null;

    const { error } = await supabase.from('historico_auditoria').insert({
        usuario_id: usuarioId,
        modulo,
        acao,
        detalhes
    });

    if (error) {
        console.error('Falha ao registrar histórico de auditoria:', error.message);
    }
}
