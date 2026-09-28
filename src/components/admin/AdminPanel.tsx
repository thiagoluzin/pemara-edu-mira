import { label, gradeLabel } from '../../ui/labels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — PAINEL ADMINISTRATIVO GERAL (/admin) (E3 / E4)
 * Visão Geral, Gestão de Usuários & RBAC, Controle de Sessões & Auditoria,
 * Acervo Geral de Professores e Restauração de Revisões.
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  KeyRound,
  History,
  BookOpen,
  Activity,
  Database,
  Download,
  Search,
  UserPlus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RotateCcw,
  ArrowRightLeft,
  ExternalLink,
  Lock,
  Eye,
  X
} from 'lucide-react';
import {
  adminApi,
  AdminOverview,
  AdminSession,
  AdminLogEvent,
  AdminLessonDetail
} from '../../services/adminApi';
import { AuthUser } from '../../services/authApi';

interface Props {
  currentUser: AuthUser;
}

export const AdminPanel: React.FC<Props> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'sessions' | 'lessons'>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Estados de Usuários
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState<AuthUser | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'teacher' as AuthUser['role'],
  });

  // Estados de Sessões e Logs
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [logs, setLogs] = useState<AdminLogEvent[]>([]);

  // Estados de Aulas e Restauração
  const [lessons, setLessons] = useState<AdminLessonDetail[]>([]);
  const [lessonSearch, setLessonSearch] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<{
    lesson: any;
    currentSpec: any;
    revisions: any[];
    activity: any[];
  } | null>(null);
  const [transferModalLesson, setTransferModalLesson] = useState<AdminLessonDetail | null>(null);
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [restoreModalVersion, setRestoreModalVersion] = useState<{ lessonId: string; version: number } | null>(null);
  const [restoreReason, setRestoreReason] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      if (activeTab === 'overview') {
        const data = await adminApi.getOverview();
        setOverview(data);
      } else if (activeTab === 'users') {
        const res = await adminApi.listUsers({ search: userSearch });
        setUsers(res.users);
      } else if (activeTab === 'sessions') {
        const sessRes = await adminApi.listSessions({ activeOnly: true });
        setSessions(sessRes.sessions);
        const logsRes = await adminApi.listLogs();
        setLogs(logsRes.events);
      } else if (activeTab === 'lessons') {
        const lRes = await adminApi.listLessons({ search: lessonSearch, includeDeleted: true });
        setLessons(lRes.lessons);
        const uRes = await adminApi.listUsers();
        setUsers(uRes.users);
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Erro ao carregar dados do painel.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createUser(newUserForm);
      setStatusMessage({ text: `Usuário ${newUserForm.username} criado com sucesso!`, type: 'success' });
      setIsAddUserModalOpen(false);
      setNewUserForm({ username: '', name: '', email: '', password: '', role: 'teacher' });
      loadData();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  const handleToggleUserActive = async (user: AuthUser) => {
    const isActivating = !user.is_active;
    const confirmMsg = isActivating
      ? `Deseja reativar a conta de ${user.name}?`
      : `Deseja desativar a conta de ${user.name}? Todas as sessões ativas serão revogadas imediatamente. O acervo de aulas será preservado.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await adminApi.updateUser(user.id, { is_active: isActivating });
      setStatusMessage({
        text: `Conta de ${user.name} ${isActivating ? 'ativada' : 'desativada'} com sucesso!`,
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isResetPassModalOpen || !newPasswordValue) return;

    try {
      const res = await adminApi.resetPassword(isResetPassModalOpen.id, newPasswordValue);
      setStatusMessage({ text: res.message, type: 'success' });
      setIsResetPassModalOpen(null);
      setNewPasswordValue('');
      loadData();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!window.confirm('Deseja encerrar esta sessão ativa imediatamente?')) return;
    try {
      await adminApi.revokeSession(sessionId);
      setStatusMessage({ text: 'Sessão revogada com sucesso.', type: 'success' });
      loadData();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  const handleRevokeAllUserSessions = async (userId: string, name: string) => {
    if (!window.confirm(`Deseja encerrar todas as sessões de ${name}?`)) return;
    try {
      const res = await adminApi.revokeAllUserSessions(userId);
      setStatusMessage({ text: `${res.count} sessão(ões) revogada(s) com sucesso.`, type: 'success' });
      loadData();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  const handleOpenLessonDetails = async (lessonId: string) => {
    try {
      const details = await adminApi.getLessonDetails(lessonId);
      setSelectedLesson(details);
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  const handleRestoreRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreModalVersion || !restoreReason.trim()) return;

    try {
      await adminApi.restoreRevision(
        restoreModalVersion.lessonId,
        restoreModalVersion.version,
        restoreReason.trim()
      );
      setStatusMessage({
        text: `Versão ${restoreModalVersion.version} restaurada com sucesso como nova revisão!`,
        type: 'success',
      });
      setRestoreModalVersion(null);
      setRestoreReason('');
      if (selectedLesson) {
        handleOpenLessonDetails(selectedLesson.lesson.id);
      }
      loadData();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalLesson || !transferTargetUserId || !transferReason.trim()) return;

    try {
      await adminApi.transferOwnership(
        transferModalLesson.id,
        transferTargetUserId,
        transferReason.trim()
      );
      setStatusMessage({ text: 'Titularidade da aula transferida com sucesso!', type: 'success' });
      setTransferModalLesson(null);
      setTransferTargetUserId('');
      setTransferReason('');
      loadData();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO PAINEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 border border-indigo-500/40 text-indigo-300">
              ACESSO ADMINISTRATIVO GERAL
            </span>
          </div>
          <h1 className="text-xl xl:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-indigo-400" />
            <span>Painel do Administrador</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestão integral do sistema, contas de professores, sessões ativas e histórico do acervo.
          </p>
        </div>

        {/* Abas do Painel */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Visão Geral</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'users' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Usuários & Permissões</span>
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'sessions' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Sessões & Auditoria</span>
          </button>
          <button
            onClick={() => setActiveTab('lessons')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'lessons' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Acervo Geral</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK DE STATUS */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* 1. ABA VISÃO GERAL */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* CARDS DE INDICADORES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Contas Cadastradas
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-xl xl:text-2xl font-black text-white">{overview.users.total}</span>
                <span className="text-xs text-emerald-400 font-semibold">({overview.users.active} ativas)</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {overview.users.inactive} conta(s) inativa(s)
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Sessões Ativas
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-xl xl:text-2xl font-black text-indigo-400">{overview.sessions.activeCount}</span>
                <span className="text-xs text-slate-400 font-medium">no momento</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Tokens com TTL de 7 dias</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Segurança (24h)
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-xl xl:text-2xl font-black text-amber-400">{overview.security.recentLoginFailures}</span>
                <span className="text-xs text-slate-400 font-medium">falhas de login</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Rate limit de 5 tentativas ativo</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Infraestrutura banco de dados
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-xs font-black uppercase text-emerald-400">
                  {overview.system.database.status === 'ok' ? 'Operacional' : 'Degradado'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block truncate" title={overview.system.lastBackup}>
                Backup: {overview.system.lastBackup}
              </span>
            </div>
          </div>

          {/* TABELA DE AULAS POR PROFESSOR */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Aulas e Rascunhos por Professor</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-2.5">Professor</th>
                    <th className="pb-2.5">Usuário</th>
                    <th className="pb-2.5 text-center">Aulas Salvas</th>
                    <th className="pb-2.5 text-center">Rascunhos Pendentes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {overview.lessons.byTeacher.map((t) => (
                    <tr key={t.username} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-bold text-slate-200">{t.teacherName}</td>
                      <td className="py-2.5 text-slate-400">{t.username}</td>
                      <td className="py-2.5 text-center font-semibold text-emerald-400">{t.lessonsCount}</td>
                      <td className="py-2.5 text-center font-semibold text-amber-400">{t.draftsCount}</td>
                    </tr>
                  ))}
                  {overview.lessons.byTeacher.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-500">
                        Nenhuma aula registrada até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABA USUÁRIOS E PERMISSÕES */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Pesquisar por nome ou usuário..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            </div>

            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Novo Professor / Usuário</span>
            </button>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Usuário / E-mail</th>
                  <th className="py-3 px-4">Permissão de acesso</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações Administrativas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => {
                  const isCurrentAdmin = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-slate-200">{u.name}</td>
                      <td className="py-3 px-4">
                        <div className="text-slate-300 font-medium">{u.username}</div>
                        <div className="text-[10px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-500/30 text-indigo-300">
                          {label(u.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            u.is_active
                              ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                              : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {u.is_active ? 'Ativa' : 'Desativada'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => setIsResetPassModalOpen(u)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors"
                        >
                          Redefinir Senha
                        </button>
                        <button
                          onClick={() => handleToggleUserActive(u)}
                          disabled={isCurrentAdmin}
                          title={isCurrentAdmin ? 'Você não pode desativar seu próprio usuário administrador.' : ''}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            u.is_active
                              ? 'bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 disabled:opacity-40'
                              : 'bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300'
                          }`}
                        >
                          {u.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ABA SESSÕES E AUDITORIA */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* SESSÕES ATIVAS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Sessões Ativas no Servidor</span>
              </span>
              <button
                onClick={loadData}
                className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar</span>
              </button>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-2.5">Usuário</th>
                    <th className="pb-2.5">Endereço IP</th>
                    <th className="pb-2.5">Navegador / Dispositivo</th>
                    <th className="pb-2.5">Início</th>
                    <th className="pb-2.5">Última Atividade</th>
                    <th className="pb-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-slate-200">
                        {s.name} <span className="text-[10px] text-slate-500 font-normal">({s.username})</span>
                      </td>
                      <td className="py-2.5 text-slate-300 font-mono text-[11px]">{s.ip_address || '127.0.0.1'}</td>
                      <td className="py-2.5 text-slate-400 text-[10px] max-w-[200px] truncate" title={s.user_agent || ''}>
                        {s.user_agent || 'Navegador Padrão'}
                      </td>
                      <td className="py-2.5 text-slate-400 text-[10px]">
                        {new Date(s.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 text-slate-400 text-[10px]">
                        {new Date(s.last_activity_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleRevokeSession(s.id)}
                          className="px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[10px] font-semibold"
                        >
                          Encerrar
                        </button>
                        <button
                          onClick={() => handleRevokeAllUserSessions(s.user_id, s.name)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold"
                        >
                          Encerrar Todas
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-500">
                        Nenhuma sessão ativa identificada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* HISTÓRICO DE AUDITORIA */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Registro de Eventos de Autenticação e Segurança (Auth Audit Registros)</span>
            </h3>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold sticky top-0 bg-slate-900">
                    <th className="pb-2.5">Data/Hora (UTC &rarr; Local)</th>
                    <th className="pb-2.5">Evento</th>
                    <th className="pb-2.5">Usuário Solicitado</th>
                    <th className="pb-2.5">Origem (IP)</th>
                    <th className="pb-2.5">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/20">
                      <td className="py-2 text-[11px] text-slate-400 font-mono">
                        {new Date(l.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            l.event_type.includes('SUCCESS')
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                              : l.event_type.includes('FAIL')
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {label(l.event_type)}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-slate-200">{l.username_attempted}</td>
                      <td className="py-2 font-mono text-[10px] text-slate-400">{l.ip_address || '127.0.0.1'}</td>
                      <td className="py-2 text-[10px] text-slate-500 font-mono truncate max-w-xs" title={JSON.stringify(l.details_json)}>
                        {JSON.stringify(l.details_json)}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-500">
                        Nenhum registro de auditoria gravado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. ABA ACERVO GERAL */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Pesquisar por título ou tema..."
                value={lessonSearch}
                onChange={(e) => setLessonSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            </div>

            <a
              href={adminApi.getExportUrl()}
              download
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Exportar Acervo Administrativo (.json)</span>
            </a>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Título da Aula</th>
                  <th className="py-3 px-4">Professor Titular</th>
                  <th className="py-3 px-4">Disciplina / Série</th>
                  <th className="py-3 px-4 text-center">Versão</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {lessons.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-200">{l.title}</div>
                      <div className="text-[10px] text-slate-500">{l.topic}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-300">{l.owner_name}</div>
                      <div className="text-[10px] text-slate-500">{l.owner_username}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {label(l.subject_code.toUpperCase())} • {gradeLabel(l.grade_level)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-indigo-400">v{l.current_version}</td>
                    <td className="py-3 px-4">
                      {l.is_deleted ? (
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                          Excluída (Recuperável)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          {label(l.status)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenLessonDetails(l.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium"
                      >
                        Revisões
                      </button>
                      <button
                        onClick={() => setTransferModalLesson(l)}
                        className="px-2.5 py-1 rounded bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 text-[11px] font-medium"
                      >
                        Transferir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR NOVO PROFESSOR/USUÁRIO */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <span>Cadastrar Novo Usuário</span>
              </h3>
              <button onClick={() => setIsAddUserModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prof. Thiago Luzin"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nome de Usuário (login único)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: prof.thiago"
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: thiago@escola.local"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Senha Inicial</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 4 caracteres"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Permissão de acesso</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                >
                  <option value="teacher">Professor (teacher)</option>
                  <option value="editor">Editor Didático (editor)</option>
                  <option value="curator">Curador de Conteúdo (curator)</option>
                  <option value="admin">Administrador Geral (admin)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REDEFINIR SENHA DE USUÁRIO */}
      {isResetPassModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-white text-sm mb-2">Redefinir Senha</h3>
            <p className="text-xs text-slate-400 mb-4">
              Informe a nova senha para <strong className="text-slate-200">{isResetPassModalOpen.name}</strong>. Todas as sessões anteriores serão revogadas.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <input
                type="password"
                required
                placeholder="Nova senha temporária"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPassModalOpen(null);
                    setNewPasswordValue('');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Confirmar Redefinição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFERÊNCIA DE TITULARIDADE DE AULA */}
      {transferModalLesson && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
              <span>Transferir Titularidade de Aula</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Aula: <strong className="text-slate-200">{transferModalLesson.title}</strong>
            </p>

            <form onSubmit={handleTransferOwnership} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Novo Professor Proprietário</label>
                <select
                  required
                  value={transferTargetUserId}
                  onChange={(e) => setTransferTargetUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                >
                  <option value="">Selecione um professor...</option>
                  {users
                    .filter((u) => u.id !== transferModalLesson.owner_id && u.is_active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.username})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Motivo Administrativo (Obrigatório para Auditoria)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Mudança de grade curricular ou substituição de professor..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransferModalLesson(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Transferir Aula
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: DETALHES DA AULA E RESTAURAÇÃO DE VERSÃO */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col p-6 shadow-2xl">
            <div className="flex justify-between items-start pb-4 border-b border-slate-800 mb-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  Inspeção Administrativa de Acervo
                </span>
                <h3 className="font-bold text-white text-base mt-0.5">{selectedLesson.lesson.title}</h3>
                <span className="text-xs text-slate-400">
                  {label(selectedLesson.lesson.subject_code.toUpperCase())} • {gradeLabel(selectedLesson.lesson.grade_level)} • Versão Atual: v{selectedLesson.lesson.current_version}
                </span>
              </div>
              <button onClick={() => setSelectedLesson(null)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1 text-xs">
              <div>
                <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Histórico de Revisões Imutáveis</span>
                </h4>
                <div className="space-y-2">
                  {selectedLesson.revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-indigo-400">v{rev.version}</span>
                          <span className="text-slate-300 font-medium">{rev.change_summary || 'Revisão registrada'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(rev.created_at).toLocaleString('pt-BR')} • Hash: <code className="font-mono">{rev.content_hash.slice(0, 10)}...</code>
                        </div>
                      </div>
                      {rev.version !== selectedLesson.lesson.current_version && (
                        <button
                          onClick={() => setRestoreModalVersion({ lessonId: selectedLesson.lesson.id, version: rev.version })}
                          className="px-2.5 py-1 rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 font-semibold text-[10px] flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restaurar</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Trilha de Auditoria da Aula</span>
                </h4>
                <div className="space-y-1.5">
                  {selectedLesson.activity.map((act) => (
                    <div key={act.id} className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-300">{label(act.action)}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(act.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Ator: {act.actor_name || 'Sistema'} ({act.actor_username || 'sistema'})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR RESTAURAÇÃO DE VERSÃO COM MOTIVO */}
      {restoreModalVersion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-400" />
              <span>Restaurar Versão v{restoreModalVersion.version}</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              A versão selecionada será aplicada como uma nova revisão, preservando o histórico integral e registrando seu usuário administrador como autor da restauração.
            </p>

            <form onSubmit={handleRestoreRevision} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Motivo da Restauração (Auditoria)</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Recuperação solicitada pelo professor..."
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestoreModalVersion(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Confirmar Restauração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
