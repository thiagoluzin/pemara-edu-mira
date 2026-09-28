import {aiGenerationProblem} from '../services/aiGenerationAvailability';
import { gradeLabel } from '../ui/labels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA FORMULÁRIO DE CRIAÇÃO DO PROFESSOR (V1 DETERMINÍSTICO)
 * Foco em EF Anos Finais (6º a 9º ano): História, Geografia, Ciências e Matemática
 * Conexão direta com acervo de conteúdos e Conjuntos de conteúdos determinísticos
 */

import { knowledgeApi } from '../services/knowledgeApi';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Subject, GenerationMode } from '../types/lesson';
import { GenerationInput } from '../maestro/pemaraMaestro';
import {
  CurriculumTopicEntry,
  searchCurriculumTopics,
  isGradeCompatible,
  getTopicsForSubjectAndGrade,
  resolvePackSlugForInput
} from '../catalog/curriculumCatalog';
import {
  Sparkles,
  Upload,
  Cpu,
  Server,
  Layers,
  CheckCircle2,
  FileText,
  Clock,
  GraduationCap,
  BookOpen,
  Database
} from 'lucide-react';

interface Props {
  onCreateLesson: (input: GenerationInput) => Promise<void>;
  isGenerating: boolean;
  errorMessage?: string | null;
}

export const LessonCreator: React.FC<Props> = ({ onCreateLesson, isGenerating, errorMessage }) => {
  const [subject, setSubject] = useState<Subject>('history');
  const [grade, setGrade] = useState<string>('6EF');
  const [topic, setTopic] = useState<string>('Grécia Antiga: Pólis, Democracia e Sociedade');
  const [duration, setDuration] = useState<number>(45);
  const [didacticStyle, setDidacticStyle] = useState<'visual' | 'summary' | 'review' | 'exercises' | 'complete'>('visual');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('MODE_A_NO_AI');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [materialText, setMaterialText] = useState<string>('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ id: string; name: string; model: string; configured: boolean }[]>([]);
  const [aiProvider, setAiProvider] = useState('');
  const [providerError, setProviderError] = useState('');
  const errorRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(clientError){errorRef.current?.focus();errorRef.current?.scrollIntoView({block:'center',behavior:'smooth'});}},[clientError]);
  const [catalog, setCatalog] = useState<CurriculumTopicEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    knowledgeApi.getCatalog(controller.signal).then(setCatalog).catch(err => {
      if (!controller.signal.aborted) setCatalogError('Não foi possível carregar os temas publicados. ' + err.message);
    }).finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/ai/providers', { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('Entre na sua conta para consultar os provedores de IA.');
      const data = await res.json();
      if (controller.signal.aborted) return;
      setProviders(data.providers);
      setAiProvider(data.providers.find((p: any) => p.id === data.defaultProvider && p.configured)?.id ||
        data.providers.find((p: any) => p.configured)?.id || '');
    }).catch(err => { if (!controller.signal.aborted) setProviderError(err.message); });
    return () => controller.abort();
  }, []);

  // Atualiza automaticamente o tema sugerido ao mudar a disciplina ou o ano
  useEffect(() => {
    const topics = getTopicsForSubjectAndGrade(subject, grade, catalog);
    setTopic(previous => resolvePackSlugForInput(subject, grade, previous, catalog) ? previous : topics[0]?.title || '');
  }, [subject, grade, catalog]);

  // Catálogo com status explícito de disponibilidade no piloto (A04 / E1)
  const catalogTopics = getTopicsForSubjectAndGrade(subject, grade, catalog);
  const matchingTopics = useMemo(() => searchCurriculumTopics(subject, topic, catalog), [subject, topic, catalog]);
  const selectedEntry = catalog.find(entry => entry.slug === resolvePackSlugForInput(subject, grade, topic, catalog));
  const matchingCurrentYear = matchingTopics.filter(t => isGradeCompatible(grade, t.gradeLevel));
  const matchingOtherYears = matchingTopics.filter(t => !isGradeCompatible(grade, t.gradeLevel));
  const chooseTopic = (entry: CurriculumTopicEntry) => {
    if (!isGradeCompatible(grade, entry.gradeLevel)) setGrade(entry.gradeLevel);
    setTopic(entry.title);
    setClientError(null);
  };

  // Simulação de leitura de material temporário do professor/escola
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        setMaterialText(text.slice(0, 3000));
      };
      reader.readAsText(file);
    }
  };

  const generate = (mode:GenerationMode) => {
    if(isGenerating)return;
    setGenerationMode(mode);
    setClientError(null);
    if (!topic.trim()) return;
    if(mode==='MODE_C_API'){
      const problem=aiGenerationProblem(providers,aiProvider,providerError);
      if(problem){setClientError(problem);return;}
    }

    if (topic.includes('[Indisponível no piloto]')) {
      setClientError(`O tema selecionado não faz parte do catálogo oficial do piloto. Selecione um dos temas publicados no acervo curricular.`);
      return;
    }

    const matchedSlug = resolvePackSlugForInput(subject, grade, topic, catalog)
      || (matchingCurrentYear.length === 1 ? matchingCurrentYear[0].slug : null);
    const matchedEntry = catalog.find(entry => entry.slug === matchedSlug);

    if (catalogLoading || catalogError || !matchedSlug) {
      setClientError(catalogError || (matchingOtherYears.length && !matchingCurrentYear.length ? 'Encontramos esse assunto em outros anos. Confira os resultados e escolha o ano desejado.' : matchingCurrentYear.length > 1 ? 'Encontramos mais de um conteúdo. Escolha abaixo o tema que deseja usar.' : 'Não encontramos conteúdo para essa busca. Consulte os temas disponíveis ou tente outra palavra.'));
      return;
    }
    onCreateLesson({
      subject,
      grade,
      topic: matchedEntry?.title || topic,
      duration_minutes: duration,
      didactic_style: didacticStyle,
      material_text: materialText,
      generation_mode: mode,
      ai_provider: mode === 'MODE_C_API' ? aiProvider : undefined,
      pack_slug: matchedSlug || undefined
    });
  };

  const handleSubmit=(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const button=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    generate(button?.value==='MODE_C_API'?'MODE_C_API':button?.value==='MODE_A_NO_AI'?'MODE_A_NO_AI':generationMode);
  };

  const displayedError = clientError || catalogError || errorMessage;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100">
      <div className="border-b border-slate-800 pb-5 mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Seu espaço para preparar aulas
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight">Criar uma aula</h2>
        <p className="text-slate-400 text-sm mt-1">
          Escolha a disciplina e o ano para consultar os temas realmente publicados no banco local. Novos temas aparecem aqui quando são publicados.
        </p>
      </div>

      {displayedError && (
        <div role="alert" tabIndex={-1} ref={errorRef} className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <span className="font-bold text-rose-400 mt-0.5">⚠️ Aviso de Indisponibilidade:</span>
          <div className="space-y-3"><p>{displayedError}</p>{generationMode==='MODE_C_API'&&<div className="flex flex-wrap gap-3"><button type="button" disabled={isGenerating} onClick={()=>generate('MODE_A_NO_AI')} className="rounded-lg bg-emerald-700 px-4 py-2 text-white font-bold">Gerar sem IA agora</button><a href="/settings" className="underline">Configurar IA (administrador)</a></div>}</div>
        </div>
      )}

      <p role="status" className="mb-4 text-sm text-slate-300">
        {catalogLoading ? 'Carregando o acervo local…' : `${catalogTopics.length} tema(s) disponível(is) para esta disciplina e ano.`}
        {!catalogLoading && !catalogError && !catalogTopics.length && ' Ainda não há conteúdo publicado nesta seleção. Consulte a cobertura curricular no Acervo de conteúdos.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* LINHA 1: DISCIPLINA, SÉRIE E DURAÇÃO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Disciplina */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              Disciplina
            </label>
            <select
              value={subject}
              onChange={(e) => {
                const s = e.target.value as Subject;
                setSubject(s);
                const available = getTopicsForSubjectAndGrade(s, grade, catalog);
                if (available.length > 0) {
                  setTopic(available[0].title);
                } else { setTopic(''); }
              }}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="portuguese">Língua Portuguesa</option>
              <option value="english">Língua Inglesa</option>
              <option value="arts">Arte</option>
              <option value="physical_education">Educação Física</option>
              <option value="math">Matemática</option>
              <option value="science">Ciências</option>
              <option value="history">História</option>
              <option value="geography">Geografia</option>
              <option value="religious_education">Ensino Religioso</option>
              <option value="physics">Física (Ensino Médio)</option>
              <option value="biology">Biologia (Ensino Médio)</option>
              <option value="chemistry">Química (Ensino Médio)</option>
            </select>
          </div>

          {/* Série / Ano */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
              Ano Escolar (BNCC)
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="6EF">6º Ano (Ensino Fundamental)</option>
              <option value="7EF">7º Ano (Ensino Fundamental)</option>
              <option value="8EF">8º Ano (Ensino Fundamental)</option>
              <option value="9EF">9º Ano (Ensino Fundamental)</option>
              <option value="67EF">6º/7º Anos (Faixa Multiano BNCC)</option>
              <option value="69EF">6º ao 9º Anos (Faixa Multiano BNCC)</option>
              <option value="89EF">8º/9º Anos (Faixa Multiano BNCC)</option>
              <option value="1EM">1º Ano (Ensino Médio)</option>
              <option value="2EM">2º Ano (Ensino Médio)</option>
              <option value="3EM">3º Ano (Ensino Médio)</option>
            </select>
          </div>

          {/* Duração */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Duração Estimada
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={15}>15 minutos (Pílula Rápida)</option>
              <option value={30}>30 minutos (Conceito + Fixação)</option>
              <option value={45}>45 minutos (Aula Padrão)</option>
              <option value={60}>60 minutos (Aula Completa)</option>
            </select>
          </div>
        </div>

        {/* TEMA DA AULA */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Tema da aula
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setClientError(null); }}
            aria-label="Pesquisar assunto da aula"
            placeholder="Pesquise um assunto ou código da BNCC"
            className="w-full px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
            required
          />

          <div className="mt-3 space-y-3" aria-live="polite">
            {selectedEntry?.editorialStatus === 'pending_teacher_review' && <p className="text-sm text-amber-200">Material disponível para preparar a aula. Revise os exemplos e as atividades antes de apresentar à turma.</p>}
            <p className="text-sm text-slate-300">A busca consulta todos os anos desta disciplina. Escolha o conteúdo abaixo para preparar a aula.</p>
            {matchingCurrentYear.length > 0 && <div className="space-y-2">
              <h3 className="text-sm font-semibold text-emerald-300">Encontrados no ano selecionado</h3>
              <div className="flex flex-wrap gap-2">{matchingCurrentYear.map(entry => <button key={entry.slug} type="button" onClick={() => chooseTopic(entry)} className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-left">{entry.title} — {gradeLabel(entry.gradeLevel)}</button>)}</div>
            </div>}
            {matchingOtherYears.length > 0 && <div className="space-y-2 border border-amber-600/50 rounded-xl p-3">
              <h3 className="text-sm font-semibold text-amber-300">Também encontramos em outros anos</h3>
              <p className="text-sm text-slate-300">O ano só será alterado se você escolher uma destas opções.</p>
              <div className="flex flex-wrap gap-2">{matchingOtherYears.map(entry => <button key={entry.slug} type="button" onClick={() => chooseTopic(entry)} className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-amber-700/50 text-white text-left">Usar {gradeLabel(entry.gradeLevel)}: {entry.title}</button>)}</div>
            </div>}
            {!!topic.trim() && !matchingTopics.length && <p className="text-sm text-amber-300">Nenhum conteúdo encontrado para essa busca nesta disciplina, em nenhum ano. Tente outra palavra ou consulte o acervo abaixo.</p>}
            <details className="text-sm text-slate-300">
              <summary className="cursor-pointer py-2">Ver todos os {catalogTopics.length} conteúdos do ano selecionado</summary>
              <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto">{catalogTopics.map(entry => <button key={entry.slug} type="button" onClick={() => chooseTopic(entry)} className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-left">{entry.title}</button>)}</div>
            </details>
          </div>
        </div>

        {/* ESTILO DIDÁTICO */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Como você quer ensinar?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'visual', label: 'Imagens e simulações', desc: 'Foco em mapas e modelos' },
              { id: 'summary', label: 'Resumo Sintético', desc: 'Conceitos em tópicos diretos' },
              { id: 'review', label: 'Revisão de Prova', desc: 'Pontos-chave e fórmulas' },
              { id: 'exercises', label: 'Exercícios e perguntas', desc: 'Perguntas para praticar' },
              { id: 'complete', label: 'Aula Completa', desc: 'Teoria, mapa, comparação e perguntas' }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setDidacticStyle(st.id as any)}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  didacticStyle === st.id
                    ? 'bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/30 text-white'
                    : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{st.label}</span>
                  {didacticStyle === st.id && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  )}
                </div>
                <span className="text-[11px] text-slate-400 mt-2">{st.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MATERIAL TEMPORÁRIO DO PROFESSOR (Regra Congelada 3) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Material Temporário do Professor / Escola (Opcional)
          </label>
          <div className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-2xl p-5 text-center transition-colors bg-slate-950/30">
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <Upload className="w-7 h-7 text-indigo-400" />
              {attachedFileName ? (
                <div className="flex items-center gap-2 text-sm text-emerald-400 font-semibold">
                  <FileText className="w-4 h-4" />
                  <span>Arquivo anexado: {attachedFileName}</span>
                </div>
              ) : (
                <>
                  <span className="text-sm font-semibold text-slate-200">
                    Anexar plano de aula ou documento da escola (referência)
                  </span>
                  <span className="text-xs text-slate-400">
                    🔒 Nota do Piloto V1: Extração automática de arquivos não implementada nesta fase. O anexo serve apenas como referência visual e não altera a composição determinística.
                  </span>
                </>
              )}
            </label>
          </div>
        </div>

        {/* MODOS DE OPERAÇÃO */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Como preparar sua aula
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-3">
            {[
              {
                id: 'MODE_A_NO_AI',
                icon: Layers,
                name: 'Sem inteligência artificial',
                badge: 'Pronto para usar',
                badgeColor: 'text-emerald-400 bg-emerald-950/70 border-emerald-500/40',
                desc: 'Crie uma aula com os materiais disponíveis. Funciona sem internet e sem chave de inteligência artificial.'
              },
              {
                id: 'MODE_C_API',
                icon: Server,
                name: 'Com inteligência artificial',
                badge: 'Local ou na nuvem',
                badgeColor: 'text-indigo-400 bg-indigo-950/70 border-indigo-500/40',
                desc: 'Escolha um provedor configurado. Ollama e LM Studio podem funcionar sem chave. A opção sem IA continua disponível.'
              },
            ].map((mode) => {
              const Icon = mode.icon;
              const isSelected = generationMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {setGenerationMode(mode.id as GenerationMode);setClientError(null);}}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
                      : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${mode.badgeColor}`}>
                        {mode.badge}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm">{mode.name}</h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">{mode.desc}</p>
                  </div>
                  {isSelected && (
                    <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center gap-1.5 text-xs text-indigo-300 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Selecionado</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {generationMode === 'MODE_C_API' && (
          <div className="rounded-xl border border-indigo-500/40 p-4 space-y-3">
            <p className="text-sm text-slate-300">IA local ou serviço com chave. O administrador pode cadastrar ambos em <a href="/settings" className="text-cyan-300 underline">Configurações de IA</a>.</p>
            <label htmlFor="ai-provider" className="block font-semibold">Provedor de inteligência artificial</label>
            <select id="ai-provider" value={aiProvider} onChange={e => setAiProvider(e.target.value)} className="w-full rounded-lg bg-slate-900 p-3 border border-slate-600">
              <option value="">Selecione um provedor configurado</option>
              {providers.map(p => <option key={p.id} value={p.id} disabled={!p.configured}>{p.name}{p.configured ? ` — ${p.model}` : ' — não configurado'}</option>)}
            </select>
            <p className="text-sm text-slate-300">O tema e os parâmetros da aula serão enviados somente ao provedor selecionado. Provedores na nuvem podem cobrar pelo uso. O administrador cadastra chaves e modelos em Configurações de IA.</p>
            <p className="text-sm text-slate-400">Não há exigência de Gemini nem de chave para usar o sistema. Para trabalhar sem IA, use o botão Gerar sem IA.</p>
            {providerError && <p role="alert" className="text-amber-300">{providerError}</p>}
          </div>
        )}

        {/* Escolha explícita: nunca substituir geração com IA silenciosamente. */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <p className="text-sm text-slate-300">Você escolhe como gerar. Sem IA usa o acervo local e não exige modelo nem chave de API.</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="submit" value="MODE_A_NO_AI" disabled={isGenerating||catalogLoading||!!catalogError||!topic} className="rounded-xl bg-emerald-700 hover:bg-emerald-600 px-6 py-4 font-bold disabled:opacity-50">Gerar sem IA</button>
            <button type="submit" value="MODE_C_API" disabled={isGenerating||catalogLoading||!!catalogError||!topic} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-4 font-bold disabled:opacity-50">Gerar com IA</button>
          </div>
          {isGenerating&&<p role="status">Preparando sua aula…</p>}
        </div>
      </form>
    </div>
  );
};
