/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — MODAL DE MIGRAÇÃO CONTROLADA DE LOCALSTORAGE PARA POSTGRESQL (B2.10)
 * Permite que o professor visualize, faça backup e migre explicitamente suas aulas locais para o banco de dados da escola.
 */

import React, { useState } from 'react';
import { LessonSpec } from '../types/lesson';
import { AuthUser } from '../services/authApi';
import { lessonsApi } from '../services/lessonsApi';
import { ArrowRight, Download, UploadCloud, X, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface Props {
  isOpen: boolean;
  currentUser: AuthUser;
  localLessons: LessonSpec[];
  onClose: () => void;
  onMigrationComplete: () => void;
}

export const MigrationModal: React.FC<Props> = ({
  isOpen,
  currentUser,
  localLessons,
  onClose,
  onMigrationComplete,
}) => {
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [report, setReport] = useState<{ imported: number; failed: number; skipped: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportPreMigrationBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      user: currentUser.username,
      lessons: localLessons,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `pemara_backup_local_pre_migracao_${currentUser.username}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExecuteMigration = async () => {
    setIsMigrating(true);
    setErrorMessage(null);
    let imported = 0;
    let failed = 0;
    let skipped = 0;

    try {
      // 1. Obter acervo já existente no servidor para evitar duplicações
      const existing = await lessonsApi.listMyLessons().catch(() => []);
      const existingTitles = new Set(existing.map((l) => l.title.toLowerCase().trim()));

      for (const spec of localLessons) {
        const title = spec.lesson?.title || (spec as any).title || 'Aula Sem Título';
        if (existingTitles.has(title.toLowerCase().trim())) {
          skipped++;
          continue;
        }

        try {
          await lessonsApi.createLesson({
            title,
            subjectCode: spec.lesson?.subject || 'history',
            gradeLevel: spec.lesson?.grade || '6EF',
            topic: spec.lesson?.topic || 'geral',
            spec,
          });
          imported++;
        } catch (err) {
          console.error(`Falha ao migrar aula "${title}":`, err);
          failed++;
        }
      }

      setReport({ imported, failed, skipped });
      onMigrationComplete();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha durante o processo de migração.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Migração de Aulas do Navegador</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Destinatário confirmado: <span className="text-indigo-400 font-bold">{currentUser.name}</span> ({currentUser.username})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-300">
          {report ? (
            <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span>Migração Concluída com Sucesso!</span>
              </div>
              <ul className="space-y-1.5 font-mono text-xs">
                <li>• Aulas migradas para o banco de dados: <strong>{report.imported}</strong></li>
                <li>• Aulas já existentes (não duplicadas): <strong>{report.skipped}</strong></li>
                {report.failed > 0 && <li className="text-rose-400">• Falhas na validação: <strong>{report.failed}</strong></li>}
              </ul>
              <p className="text-xs text-slate-400 pt-2 border-t border-emerald-500/20">
                Seu acervo no banco agora está sincronizado e acessível em qualquer computador da rede escolar.
              </p>
            </div>
          ) : (
            <>
              <p className="leading-relaxed">
                Identificamos <strong>{localLessons.length}</strong> aula(s) armazenada(s) temporariamente no navegador desta máquina. Você pode sincronizá-las diretamente com sua conta no servidor seguro banco de dados da escola.
              </p>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Lista Prévia */}
              <div className="space-y-2">
                <span className="font-semibold text-white block">Prévia das Aulas a Migrar:</span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-slate-800 p-2 bg-slate-950/50">
                  {localLessons.map((l, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Layers className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="font-medium text-white truncate">{l.lesson?.title || (l as any).title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono flex-shrink-0">
                        {l.scenes?.length || 0} cenas • {l.lesson?.subject || 'história'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block">Cópia de segurança de Segurança Pré-Migração</span>
                  <span className="text-[11px] text-slate-400">Guarde uma cópia em disco antes da importação.</span>
                </div>
                <button
                  onClick={handleExportPreMigrationBackup}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Cópia de segurança</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
          >
            {report ? 'Concluir' : 'Cancelar'}
          </button>

          {!report && (
            <button
              disabled={isMigrating || localLessons.length === 0}
              onClick={handleExecuteMigration}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{isMigrating ? 'Sincronizando com banco de dados...' : 'Importar para Minha Conta'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
