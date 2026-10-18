import React, { useMemo, useState } from 'react';
import { ATLAS } from '../animations/atlas';
import { EXPLORER_MODELS } from '../animations/atlasExplorer';
import { TEMPLATE_SOLAR_SYSTEM } from '../templates/deterministicTemplates';
import type { LessonSpec, Scene, Subject } from '../types/lesson';
import { PemaraRenderer } from '../renderer/PemaraRenderer';

const models = [...ATLAS.map(model => ({ id: model.id, name: model.name, subject: model.subjects[0], caption: model.caption })),
  { id: 'movement', name: 'Corpo em movimento', subject: 'physical_education', caption: 'Figura articulada para observar coordenação e movimentos corporais.' }];

export function atlasLesson(id: string): LessonSpec {
  const model = models.find(item => item.id === id);
  if (!model) throw new Error('Modelo do Atlas não encontrado.');
  const lesson = structuredClone(TEMPLATE_SOLAR_SYSTEM);
  const scene: Scene = { id: 'modelo-' + id, type: 'text', title: model.name,
    content: [EXPLORER_MODELS[id].action, 'Faça uma previsão, altere um controle e explique o que observou.'],
    teacher_notes: model.caption,
    ...(id === 'movement' ? {} : { atlas_model: ATLAS.find(item => item.id === id)!.id }) };
  lesson.lesson = { ...lesson.lesson, id: 'atlas-' + crypto.randomUUID(), title: model.name, topic: model.name,
    subject: model.subject as Subject, grade: '6EF', duration_minutes: 15, generation_mode: 'MODE_A_NO_AI', visual_status: 'NEEDS_REVIEW' };
  lesson.objectives = ['Observar o modelo, comparar situações e explicar os limites da representação.'];
  lesson.scenes = [{ id: 'abertura', type: 'title', title: model.name, subtitle: 'Prever · explorar · explicar', teacher_notes: 'Escolha o ano e adapte a explicação à turma antes da apresentação.' }, scene,
    { id: 'sintese', type: 'summary', title: 'O que observamos?', takeaways: ['O que mudou quando você alterou o controle?', 'O que esse modelo ajuda a entender? Quais são seus limites?'] }];
  return lesson;
}

export function AtlasLibrary({ onSave }: { onSave: (lesson: LessonSpec) => Promise<void> }) {
  const [selected, setSelected] = useState('respiration');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lesson = useMemo(() => atlasLesson(selected), [selected]);
  return <section className="space-y-5" aria-label="Atlas de animações">
    <div><h1 className="text-2xl font-bold text-white">Atlas de animações</h1><p className="text-slate-400 mt-2">Escolha, experimente os controles e salve uma aula para adaptar à sua turma. Funciona sem internet.</p></div>
    <input aria-label="Buscar animação" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar animação…" className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white" />
    <div className="flex gap-2 flex-wrap">{models.filter(model => model.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(model => <button key={model.id} aria-pressed={selected === model.id} onClick={() => setSelected(model.id)} className={'px-3 py-2 rounded-lg border text-sm ' + (selected === model.id ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-900 text-slate-300 border-slate-700')}>{model.name}</button>)}</div>
    <div className="rounded-2xl border border-slate-700 overflow-hidden"><PemaraRenderer key={selected} lesson={lesson.lesson} scene={lesson.scenes[1]} /></div>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    <button disabled={saving} onClick={async () => { setSaving(true); setError(''); try { await onSave(lesson); } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.'); } finally { setSaving(false); } }} className="px-5 py-3 bg-indigo-600 text-white rounded-xl disabled:opacity-50">{saving ? 'Salvando…' : 'Criar aula com este modelo'}</button>
  </section>;
}
