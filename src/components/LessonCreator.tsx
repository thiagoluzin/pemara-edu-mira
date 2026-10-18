import {MaterialPicker} from './MaterialPicker';
import {OpenCodeLessonCreator} from './OpenCodeLessonCreator';
import type {MaterialSelection,MaterialSceneOptions} from '../types/material';
import {materialSceneCount,manualSelections,materialHeading,materialPart,orderedMaterials} from '../composer/materialScenes';
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
  onOpenSavedLesson?: (id:string)=>Promise<void>;
}

export const LessonCreator: React.FC<Props> = ({ onCreateLesson, isGenerating, errorMessage, onOpenSavedLesson }) => {
  const [openCode,setOpenCode]=useState<{model:string}|null>(null);
  const [checkingProvider,setCheckingProvider]=useState(true);
  const [subject, setSubject] = useState<Subject>('history');
  const [grade, setGrade] = useState<string>('6EF');
  const [topic, setTopic] = useState<string>('Grécia Antiga: Pólis, Democracia e Sociedade');
  const [duration, setDuration] = useState<number>(45);
  const [didacticStyle, setDidacticStyle] = useState<'visual' | 'summary' | 'review' | 'exercises' | 'complete'>('visual');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('MODE_A_NO_AI');
  const [materials,setMaterials]=useState<MaterialSelection[]>([]);
  const [materialBusy,setMaterialBusy]=useState(false);
  const [materialLimit,setMaterialLimit]=useState(8);
  const [materialPosition,setMaterialPosition]=useState<MaterialSceneOptions['position']>('material-only');
  const [materialReviewed,setMaterialReviewed]=useState(false);
  const [materialText, setMaterialText] = useState<string>('');
  useEffect(()=>setMaterialReviewed(false),[materials,materialText,materialPosition]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ id: string; name: string; model: string; configured: boolean }[]>([]);
  const [aiProvider, setAiProvider] = useState('');
  const [providerError, setProviderError] = useState('');
  const [offline,setOffline]=useState(false);
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
      if(data.opencode){setOpenCode({model:data.model});return;}
      setProviders(data.providers);
      if(data.offline){setOffline(true);setGenerationMode('MODE_A_NO_AI');setProviderError('Instalação offline: use Gerar sem IA.');}
      setAiProvider(data.providers.find((p: any) => p.id === data.defaultProvider && p.configured)?.id ||
        data.providers.find((p: any) => p.configured)?.id || '');
    }).catch(err => { if (!controller.signal.aborted) setProviderError(err.message); }).finally(()=>{if(!controller.signal.aborted)setCheckingProvider(false);});
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

  const generate = (mode:GenerationMode) => {
    if(isGenerating||materialBusy)return;
    const selected=[...materials,...manualSelections(materialText)];
    if(selected.length&&!materialReviewed){setClientError('Confira os trechos e marque a revisão antes de gerar.');return;}
    if(selected.reduce((n,s)=>n+s.text.length,0)>120000){setClientError('Reduza a seleção para até 120 mil caracteres.');return;}
    const needed=materialSceneCount(selected);
    if(needed>materialLimit){setClientError(`A seleção precisa de ${needed} cenas. Reduza os trechos ou ajuste o limite.`);return;}
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
      materials,
      material_options:{maxScenes:materialLimit,position:materialPosition},
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

  if(checkingProvider)return <p role="status">Preparando criação de aula…</p>;
  if(providerError&&!offline)return <section role="alert" className="rounded-xl border border-amber-500 p-5 space-y-3"><p>Não foi possível consultar a IA. Seus dados continuam guardados.</p><button className="rounded-lg bg-indigo-600 px-4 py-2" onClick={()=>window.location.reload()}>Tentar novamente</button></section>;
  if(openCode&&onOpenSavedLesson)return <OpenCodeLessonCreator model={openCode.model} onOpenLesson={onOpenSavedLesson}/>;

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

        <div className="space-y-4 rounded-xl border border-slate-600 p-4">
          <h3 className="font-semibold">Materiais do professor (opcional)</h3>
          <MaterialPicker value={materials} onChange={setMaterials} onBusy={setMaterialBusy}/>
          <label className="block">Ou escreva seu texto<textarea aria-label="Texto do professor" rows={5} value={materialText} maxLength={120000} onChange={e=>setMaterialText(e.target.value)} className="block w-full rounded bg-slate-950 p-3 mt-2"/></label>
          <div className="flex gap-4 flex-wrap"><label>Máximo de cenas do material<input aria-label="Máximo de cenas do material" type="number" min="1" max="24" value={materialLimit} onChange={e=>setMaterialLimit(Math.max(1,Math.min(24,Number(e.target.value)||1)))} className="block w-24 rounded bg-slate-950 p-2"/></label>
          <label>Como montar a aula<select aria-label="Como montar a aula" value={materialPosition} onChange={e=>setMaterialPosition(e.target.value as MaterialSceneOptions['position'])} className="block rounded bg-slate-950 p-2"><option value="material-only">Usar meu material como roteiro</option><option value="lesson-flow">Acrescentar ao acervo por etapa</option></select></label></div>
          {materials.length>0&&<section aria-label="Organizar trechos" className="space-y-3 rounded border border-slate-600 p-3">
            <h3>Ordem da aula: abertura → desenvolvimento → avaliação</h3>
            <p className="text-sm">Confira a etapa sugerida pelo título de cada trecho. As setas mudam a ordem dentro da etapa. O texto original é preservado.</p>
            {orderedMaterials(materials).map((selection,index,ordered)=><div key={`${selection.materialId}-${selection.sourceIndex}-${index}`} className="flex flex-wrap items-center gap-2 border-t border-slate-700 pt-2">
              <span>{index+1}. {materialHeading(selection)}</span>
              <select aria-label={`Etapa de ${selection.sourceLabel}`} value={materialPart(selection)} onChange={e=>setMaterials(materials.map(s=>s===selection?{...s,lessonPart:e.target.value as MaterialSelection['lessonPart']}:s))} className="bg-slate-950 p-2 rounded"><option value="opening">Abertura</option><option value="development">Desenvolvimento</option><option value="assessment">Avaliação e encerramento</option></select>
              {([-1,1] as const).map(delta=><button key={delta} type="button" aria-label={`${delta<0?'Subir':'Descer'} ${selection.sourceLabel}`} disabled={!ordered[index+delta]||materialPart(ordered[index+delta])!==materialPart(selection)} onClick={()=>{const next=[...ordered];[next[index],next[index+delta]]=[next[index+delta],next[index]];setMaterials(next);}} className="border rounded px-3 py-2 disabled:opacity-30">{delta<0?'↑':'↓'}</button>)}
            </div>)}
          </section>}
          {(materials.length>0||materialText.trim())&&<p className="text-amber-200 text-sm">{materialPosition==='material-only'?`Roteiro com ${1+materialSceneCount([...materials,...manualSelections(materialText)])} páginas, incluindo a abertura; sem páginas extras do acervo.`:'O acervo será mantido. Abertura no início, desenvolvimento antes das atividades e avaliação antes da síntese.'} Reserve tempo para discussão e avaliação; a duração escolhida não é calculada automaticamente.</p>}
          <p className="text-sm">A seleção precisa de {materialSceneCount([...materials,...manualSelections(materialText)])} cenas. Ajuste a seleção ao tempo disponível da aula.</p>
          {(materials.length>0||materialText.trim())&&<label className="block"><input type="checkbox" checked={materialReviewed} onChange={e=>setMaterialReviewed(e.target.checked)}/> Conferi a leitura, as fontes e a pertinência dos trechos para esta aula.</label>}
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
            ].filter(mode=>!offline||mode.id==='MODE_A_NO_AI').map((mode) => {
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
            <button type="submit" value="MODE_A_NO_AI" disabled={isGenerating||materialBusy||catalogLoading||!!catalogError||!topic} className="rounded-xl bg-emerald-700 hover:bg-emerald-600 px-6 py-4 font-bold disabled:opacity-50">Gerar sem IA</button>
            {!offline&&<button type="submit" value="MODE_C_API" disabled={isGenerating||materialBusy||catalogLoading||!!catalogError||!topic} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-4 font-bold disabled:opacity-50">Gerar com IA</button>}
          </div>
          {isGenerating&&<p role="status">Preparando sua aula…</p>}
        </div>
      </form>
    </div>
  );
};
