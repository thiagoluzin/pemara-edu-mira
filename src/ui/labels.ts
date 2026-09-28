/** Presentation labels only: stored codes and API contracts remain unchanged. */
const labels: Record<string, string> = {
  biology_model: 'Modelo animado',
  formula: 'Fórmula', definition: 'Definição', theory: 'Teoria', official: 'Fonte oficial', open_data: 'Dados públicos', open_content: 'Conteúdo aberto', institutional: 'Institucional', verified: 'Verificado', curated: 'Revisado', under_review: 'Em revisão', DEPRECATED: 'Substituído', REJECTED: 'Não aprovado', contains: 'Contém', preceded_by: 'Precedido por', followed_by: 'Seguido por', influenced_by: 'Influenciado por', example_of: 'Exemplo de', contrasts: 'Contraste', LESSON_CREATED: 'Aula criada', LESSON_UPDATED: 'Aula atualizada', LESSON_DELETED: 'Aula removida', PACK_VERSION_PUBLISHED: 'Conteúdo publicado',
  portuguese: 'Língua Portuguesa', arts: 'Arte', english: 'Língua Inglesa', physical_education: 'Educação Física', religious_education: 'Ensino Religioso', history: 'História', science: 'Ciências', physics: 'Física', math: 'Matemática', geography: 'Geografia', biology: 'Biologia', chemistry: 'Química',
  admin: 'Administrador', teacher: 'Professor', editor: 'Editor de conteúdo', curator: 'Revisor de conteúdo',
  title: 'Abertura', text: 'Texto', map: 'Mapa', comparison: 'Comparação', summary: 'Resumo', quiz: 'Questionário', timeline: 'Linha do tempo', physics_projectile: 'Trajetória', projectile: 'Trajetória', solar_system: 'Sistema Solar', math_function: 'Gráfico de função',
  person: 'Pessoa', place: 'Lugar', event: 'Acontecimento', concept: 'Conceito', period: 'Período', civilization: 'Civilização', topic: 'Tema', fact: 'Informação', process: 'Processo', object: 'Objeto',
  DRAFT: 'Rascunho', REVIEW: 'Em revisão', IN_REVIEW: 'Em revisão', APPROVED: 'Aprovado', PUBLISHED: 'Publicado', ARCHIVED: 'Arquivado', ACTIVE: 'Ativo', INACTIVE: 'Inativo', READY: 'Pronto', VALID: 'Válido', INVALID: 'Inválido', NEW: 'Novo', DUPLICATE: 'Já cadastrado', DISCARDED: 'Descartado', PENDING: 'Pendente', IMPORTED: 'Importado', COMPLETED: 'Concluído', FAILED: 'Falhou', PROCESSING: 'Em andamento', SUCCESS: 'Concluído', ERROR: 'Erro', PASS: 'Aprovado', FAIL: 'Precisa de ajuste', WARNING: 'Atenção', WARN: 'Atenção',
  LOGIN_SUCCESS: 'Entrada autorizada', LOGIN_FAILED: 'Tentativa de entrada recusada', LOGOUT: 'Saída da conta', PASSWORD_RESET: 'Senha redefinida', PASSWORD_CHANGE: 'Senha alterada', ROLE_CHANGE: 'Permissão alterada', ACCOUNT_CREATED: 'Conta criada', ACCOUNT_DEACTIVATED: 'Conta desativada', ACCOUNT_ACTIVATED: 'Conta ativada', SESSION_REVOKED: 'Acesso encerrado', ALL_SESSIONS_REVOKED: 'Todos os acessos encerrados', LESSON_TRANSFERRED: 'Aula transferida', LESSON_RESTORED: 'Versão recuperada', ARCHIVE_EXPORTED: 'Acervo exportado',
  Planner: 'Planejamento', Pedagogy: 'Didática', VisualDirector: 'Apresentação', FactCheck: 'Conferência de conteúdo', QA: 'Revisão', Maestro: 'Assistente',
  causes: 'Causa', caused_by: 'Causado por', part_of: 'Faz parte de', located_in: 'Localizado em', related_to: 'Relacionado a', precedes: 'Vem antes de', follows: 'Vem depois de', contrasts_with: 'Contrasta com',
  book: 'Livro', article: 'Artigo', website: 'Página da internet', document: 'Documento', image: 'Imagem', video: 'Vídeo', internal: 'Acervo da escola', government: 'Órgão público', encyclopedia: 'Enciclopédia',
};
export function label(value?: string | null): string {
  if (!value) return 'Não informado';
  return labels[value] || labels[value.toLowerCase()] || labels[value.toUpperCase()] || 'Outro';
}
export function gradeLabel(value?: string | number | null): string {
  const text = String(value ?? '');
  const band = text.replace(/EF$/, '');
  if (['67', '69', '89'].includes(band)) return `${band[0]}º ao ${band[1]}º ano do Fundamental`;
  if (/^[6-9]$/.test(text)) return `${text}º ano do Fundamental`;
  const match = /^(\d+)(EF|EM)$/.exec(text);
  return match ? `${match[1]}º ano ${match[2] === 'EF' ? 'do Fundamental' : 'do Médio'}` : text;
}

export function readableText(value?: string | null): string {
  if (!value) return '';
  const words: Record<string, string> = {
    'Public Domain': 'Domínio público', 'Internal': 'Uso interno', 'Educational Exemption': 'Uso educacional permitido',
    'Creative Commons Attribution-ShareAlike 4.0 International': 'Creative Commons — Atribuição e compartilhamento pela mesma licença 4.0',
    'PEMARA Curated Educational License': 'Licença educacional do PEMARA',
    'MODE_A_NO_AI': 'Sem inteligência artificial', 'MODE_B_LOCAL_AI': 'Variações para ensinar', 'MODE_C_API': 'Inteligência artificial opcional', 'MODE_D_AGENTS': 'Criação guiada',
    'Knowledge Core': 'Acervo de conteúdos', 'Content Pack': 'Conjunto de conteúdos', 'Content Packs': 'Conjuntos de conteúdos', 'Snapshot': 'Versão salva', 'snapshot': 'versão salva', 'Staging': 'Revisão de importações', 'staging': 'revisão de importações', 'PostgreSQL': 'banco de dados', 'Maestro': 'assistente', 'quiz': 'questionário', 'Quiz': 'Questionário', 'offline': 'sem internet', 'Offline': 'Sem internet', 'history': 'História', 'physics': 'Física', 'science': 'Ciências', 'math': 'Matemática',
  };
  return Object.entries(words).sort((a,b) => b[0].length-a[0].length).reduce((text,[from,to]) => text.replaceAll(from,to),value);
}
