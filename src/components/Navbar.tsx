/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — NAVBAR PRINCIPAL COM RBAC E STATUS DO POSTGRESQL (E3 / E4)
 * Login individual, sem senhas no bundle e sem autenticação automática.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  User,
  Play,
  PlusCircle,
  Database,
  ChevronDown,
  LogOut,
  Shield,
  KeyRound,
  LogIn
} from 'lucide-react';
import { GenerationMode } from '../types/lesson';
import { AuthUser } from '../services/authApi';
import { knowledgeApi } from '../services/knowledgeApi';

interface Props {
  activeTab: 'editor' | 'create' | 'library' | 'knowledge' | 'admin' | 'settings';
  onTabChange: (tab: 'editor' | 'create' | 'library' | 'knowledge' | 'admin' | 'settings') => void;
  activeMode: GenerationMode;
  onStartPresentation: () => void;
  canPresent: boolean;
  currentUser?: AuthUser | null;
  onLoginClick?: () => void;
  onOpenAccount?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  onTabChange,
  activeMode,
  onStartPresentation,
  canPresent,
  currentUser = null,
  onLoginClick = () => {},
  onOpenAccount = () => {},
  onLogout = () => {}
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDbHealthy, setIsDbHealthy] = useState<boolean>(true);

  const modeLabels: Record<GenerationMode, { label: string; color: string }> = {
    MODE_A_NO_AI: { label: 'Aula sem inteligência artificial', color: 'text-emerald-400 bg-emerald-950/70 border-emerald-500/40' },
    MODE_B_LOCAL_AI: { label: 'Variações para ensinar', color: 'text-cyan-400 bg-cyan-950/70 border-cyan-500/40' },
    MODE_C_API: { label: 'Inteligência artificial opcional', color: 'text-indigo-400 bg-indigo-950/70 border-indigo-500/40' },
    MODE_D_AGENTS: { label: 'Criação guiada (demonstração)', color: 'text-amber-400 bg-amber-950/70 border-amber-500/40' }
  };

  const roleBadges: Record<string, { label: string; color: string }> = {
    teacher: { label: 'Professor', color: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40' },
    editor: { label: 'Editor', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' },
    curator: { label: 'Curador', color: 'bg-amber-950/80 text-amber-300 border-amber-500/40' },
    admin: { label: 'Administrador', color: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40' }
  };

  const currentModeBadge = modeLabels[activeMode] || modeLabels.MODE_A_NO_AI;

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await knowledgeApi.checkDatabaseHealth();
        setIsDbHealthy(health.healthy);
      } catch {
        setIsDbHealthy(false);
      }
    };
    checkHealth();
  }, []);

  const activeRoleBadge = currentUser?.role ? roleBadges[currentUser.role] : roleBadges.teacher;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Identity */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onTabChange('editor')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                PEMARA <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">AULA</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-medium">
                Crie e apresente suas aulas
              </span>
            </div>
          </div>

          {/* Active Generation Mode Pill */}
          <span className={`hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${currentModeBadge.color}`}>
            {currentModeBadge.label}
          </span>

          {/* banco de dados DB Connection Pill */}
          <span
            title={isDbHealthy ? 'Conexão com o acervo disponível' : 'Sem conexão com o acervo'}
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
              isDbHealthy
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isDbHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span>{isDbHealthy ? 'Acervo conectado' : 'Sem conexão com o acervo'}</span>
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => onTabChange('editor')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'editor'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Editar aula
          </button>
          <button
            onClick={() => onTabChange('create')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Nova Aula</span>
          </button>
          <button
            onClick={() => onTabChange('library')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'library'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Minhas Aulas</span>
          </button>
          <button
            onClick={() => onTabChange('knowledge')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'knowledge'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Acervo de conteúdos</span>
          </button>

          {/* Administraçãoistrativo — Exclusivo para administradores */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onTabChange('admin')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Administração</span>
            </button>
          )}
          {currentUser?.role==='admin'&&<button onClick={()=>onTabChange('settings')} className={`px-3.5 py-1.5 rounded-lg ${activeTab==='settings'?'bg-indigo-600 text-white':'text-indigo-300 hover:text-white'}`}>Configurações de IA</button>}
        </nav>

        {/* Right Action: Present & Profile */}
        <div className="flex items-center gap-3">
          {canPresent && (
            <button
              onClick={onStartPresentation}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all transform hover:scale-105"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>APRESENTAR</span>
            </button>
          )}

          {/* Usuário autenticado ou botão de login */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 pl-3 border-l border-slate-800 text-xs hover:opacity-90 transition-opacity cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="text-left hidden md:block">
                  <span className="font-semibold text-slate-200 block text-xs">
                    {currentUser.name}
                  </span>
                  <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border ${activeRoleBadge.color}`}>
                    {activeRoleBadge.label}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Menu da Conta Individual */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-xs animate-in fade-in duration-150">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <div className="font-bold text-slate-200">{currentUser.name}</div>
                    <div className="text-[10px] text-slate-500">{currentUser.username} ({currentUser.email})</div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenAccount();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Minha Conta / Alterar Senha</span>
                    </button>

                    {currentUser.role === 'admin' && (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          onTabChange('admin');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-indigo-300 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Painel do Administrador</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Desconectar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
