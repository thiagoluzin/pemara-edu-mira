import { label, gradeLabel } from '../ui/labels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA BIBLIOTECA DE AULAS SALVAS
 * Permite reabrir aulas, duplicar, deletar e filtrar por matéria.
 */

import React, { useState } from 'react';
import { LessonSpec, Subject } from '../types/lesson';
import {
  BookOpen,
  Play,
  Edit,
  Copy,
  Trash2,
  Calendar,
  Clock,
  Layers,
  Search,
  Plus
} from 'lucide-react';

interface Props {
  lessons: LessonSpec[];
  activeLessonId: string;
  onSelectLesson: (lesson: LessonSpec) => void;
  onDuplicateLesson: (lesson: LessonSpec) => void;
  onDeleteLesson: (lessonId: string) => void;
  onNewLesson: () => void;
  onStartPresentation: (lesson: LessonSpec) => void;
  isLoading?: boolean;
  onLoadDemoTemplate?: () => void;
  isRemoteDb?: boolean;
}

export const SavedLessonsList: React.FC<Props> = ({
  lessons,
  activeLessonId,
  onSelectLesson,
  onDuplicateLesson,
  onDeleteLesson,
  onNewLesson,
  onStartPresentation,
  isLoading = false,
  onLoadDemoTemplate,
  isRemoteDb = false,
}) => {
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredLessons = lessons.filter((l) => {
    const matchesSubject = filterSubject === 'all' || l.lesson.subject === filterSubject;
    const matchesSearch =
      l.lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.lesson.topic.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por tema ou título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64"
            />
          </div>

          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:outline-none"
          >
            <option value="all">Todas as Disciplinas</option>
            <option value="portuguese">Língua Portuguesa</option>
            <option value="english">Língua Inglesa</option>
            <option value="arts">Arte</option>
            <option value="physical_education">Educação Física</option>
            <option value="math">Matemática</option>
            <option value="science">Ciências</option>
            <option value="history">História</option>
            <option value="geography">Geografia</option>
            <option value="religious_education">Ensino Religioso</option>
            <option value="physics">Física</option>
            <option value="biology">Biologia</option>
            <option value="chemistry">Química</option>
          </select>
        </div>

        <button
          onClick={onNewLesson}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Nova Aula</span>
        </button>
      </div>

      {/* Estado de Carregamento */}
      {isLoading ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">Carregando acervo de aulas...</p>
        </div>
      ) : filteredLessons.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nenhuma aula encontrada</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
              {searchTerm || filterSubject !== 'all'
                ? 'Nenhuma aula corresponde aos filtros de busca selecionados.'
                : isRemoteDb
                ? 'Seu acervo privado no banco de dados da escola está vazio. Você pode criar sua primeira aula autoral ou carregar um dos modelos didáticos do piloto.'
                : 'Nenhuma aula salva no navegador. Crie uma nova aula ou explore os modelos didáticos.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onNewLesson}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeira Aula</span>
            </button>
            {onLoadDemoTemplate && (
              <button
                onClick={onLoadDemoTemplate}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-2"
              >
                <Layers className="w-4 h-4" />
                <span>Carregar Modelo do Piloto</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Grid de Cards de Aulas */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredLessons.map((item) => {
          const isActive = item.lesson.id === activeLessonId;
          const subjectColors: Record<Subject, string> = {
            portuguese: 'from-sky-600 to-blue-700 border-sky-500/40 text-sky-300',
            english: 'from-violet-600 to-purple-700 border-violet-500/40 text-violet-300',
            arts: 'from-pink-600 to-rose-700 border-pink-500/40 text-pink-300',
            physical_education: 'from-orange-600 to-amber-700 border-orange-500/40 text-orange-300',
            math: 'from-emerald-600 to-teal-700 border-emerald-500/40 text-emerald-300',
            science: 'from-amber-600 to-orange-700 border-amber-500/40 text-amber-300',
            history: 'from-rose-600 to-red-700 border-rose-500/40 text-rose-300',
            geography: 'from-cyan-600 to-blue-700 border-cyan-500/40 text-cyan-300',
            religious_education: 'from-teal-600 to-emerald-700 border-teal-500/40 text-teal-300',
            physics: 'from-blue-600 to-indigo-700 border-indigo-500/40 text-blue-300',
            biology: 'from-green-600 to-emerald-700 border-green-500/40 text-green-300',
            chemistry: 'from-purple-600 to-fuchsia-700 border-purple-500/40 text-purple-300'
          };

          const colorTheme = subjectColors[item.lesson.subject] || subjectColors.physics;

          return (
            <div
              key={item.lesson.id}
              className={`flex flex-col justify-between p-6 rounded-2xl bg-slate-900 border transition-all duration-200 hover:shadow-2xl ${
                isActive
                  ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-indigo-900/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Cabeçalho do Card */}
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-slate-800 border ${colorTheme}`}>
                    {label(item.lesson.subject)}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    v{item.lesson_version} • {item.scenes.length} cenas
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 leading-snug line-clamp-2">
                  {item.lesson.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                  {item.objectives && item.objectives[0] ? item.objectives[0] : item.lesson.topic}
                </p>

                {/* Metadados */}
                <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-6">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {item.lesson.duration_minutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    {gradeLabel(item.lesson.grade)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(item.lesson.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onStartPresentation(item)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
                    title="Apresentar Aula em Tela Cheia"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Apresentar</span>
                  </button>

                  <button
                    onClick={() => onSelectLesson(item)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                    title="Editar no Estúdio"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Editar</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onDuplicateLesson(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Duplicar Aula"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {lessons.length > 1 && (
                    <button
                      onClick={() => onDeleteLesson(item.lesson.id)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                      title="Excluir Aula"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
