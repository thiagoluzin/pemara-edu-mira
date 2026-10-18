import { AtlasLibrary } from './components/AtlasLibrary';
import {AISettings} from './components/admin/AISettings';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — APLICAÇÃO PRINCIPAL (APP.TSX)
 * Arquitetura completa do motor gerador de aulas visuais:
 * - Núcleo determinístico sem IA (acervo de conteúdos + Conjuntos de conteúdos)
 * - Provas obrigatórias: Grécia Antiga (6EF), Sistema Solar (6EF), Lançamento Oblíquo (Física)
 * - Layout Engine com Zonas Fixas e Safe Areas
 * - Revisar apresentação com detecção de colisão analítica
 * - Integração completa com banco de dados (E4 / B2): acervo docente isolado, autosave com debounce, controle otimista 409 e histórico de revisões
 */

import React, { useState, useEffect, useRef } from 'react';
import { LessonSpec, Scene } from './types/lesson';
import {
  TEMPLATE_GREECE_6EF,
  TEMPLATE_PROJECTILE_MOTION,
  TEMPLATE_SOLAR_SYSTEM,
  TEMPLATE_MATH_FUNCTION
} from './templates/deterministicTemplates';
import { PemaraMaestro, GenerationInput } from './maestro/pemaraMaestro';
import { Navbar } from './components/Navbar';
import { LessonEditor } from './components/LessonEditor';
import { LessonCreator } from './components/LessonCreator';
import { SavedLessonsList } from './components/SavedLessonsList';
import { PresentationMode } from './components/PresentationMode';
import { ExportModal } from './components/ExportModal';
import { MaestroLogViewer } from './components/MaestroLogViewer';
import { KnowledgeStudio } from './knowledge/studio/KnowledgeStudio';

import {
  loadLessonsFromStorage,
  saveLessonsToStorage,
  QuarantinedItem
} from './storage/lessonStorage';
import { authApi, AuthUser } from './services/authApi';
import { lessonsApi } from './services/lessonsApi';
import { knowledgeApi } from './services/knowledgeApi';
import { LoginModal } from './components/LoginModal';
import { AccountModal } from './components/AccountModal';
import { AdminPanel } from './components/admin/AdminPanel';
import { resolvePackSlugForInput } from './catalog/curriculumCatalog';
import { MigrationModal } from './components/MigrationModal';
import { ShieldAlert, Download, CheckCircle2, UploadCloud } from 'lucide-react';

function getTabFromPath(): 'editor' | 'create' | 'library' | 'knowledge' | 'admin' | 'settings' | 'atlas' {
  if (typeof window === 'undefined') return 'editor';
  const path = window.location.pathname.replace(/^\//, '');
  if (path === 'atlas') return 'atlas';
  if (path === 'admin') return 'admin';
  if (path === 'settings') return 'settings';
  if (path === 'library') return 'library';
  if (path === 'create') return 'create';
  if (path === 'knowledge') return 'knowledge';
  return 'editor';
}

export default function App() {
  // Inicialização segura com migração e quarentena garantindo que nenhum dado do professor seja perdido (R1)
  const [initialLoad] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return loadLessonsFromStorage(window.localStorage);
      }
    } catch {
      // Storage indisponível
    }
    return {
      validLessons: [
        structuredClone(TEMPLATE_GREECE_6EF),
        structuredClone(TEMPLATE_SOLAR_SYSTEM),
        structuredClone(TEMPLATE_PROJECTILE_MOTION),
        structuredClone(TEMPLATE_MATH_FUNCTION)
      ],
      quarantinedItems: [],
      recoveredCount: 0
    };
  });

  const [savedLessons, setSavedLessons] = useState<LessonSpec[]>(() => {
    if (initialLoad.validLessons && initialLoad.validLessons.length > 0) {
      return initialLoad.validLessons;
    }
    return [
      structuredClone(TEMPLATE_GREECE_6EF),          // Prova Obrigatória 1: História 6º ano — Grécia Antiga
      structuredClone(TEMPLATE_SOLAR_SYSTEM),         // Prova Obrigatória 2: Ciências 6º ano — Sistema Solar
      structuredClone(TEMPLATE_PROJECTILE_MOTION),    // Prova Obrigatória 3: Física — Lançamento Oblíquo
      structuredClone(TEMPLATE_MATH_FUNCTION)         // Prova Complementar: Matemática — Função Quadrática
    ];
  });

  const [quarantinedItems, setQuarantinedItems] = useState<QuarantinedItem[]>(initialLoad.quarantinedItems || []);
  const [recoveredNotice, setRecoveredNotice] = useState<number>(initialLoad.recoveredCount || 0);

  // Aula Ativa selecionada no Estúdio
  const [currentLesson, setCurrentLesson] = useState<LessonSpec>(savedLessons[0] || TEMPLATE_GREECE_6EF);

  // Autenticação e Sessão Individual do Usuário (E3)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);

  // Navegação de Abas e Roteamento URL SPA (B2.2)
  const [activeTab, setActiveTabState] = useState<'editor' | 'create' | 'library' | 'knowledge' | 'admin' | 'settings' | 'atlas'>(getTabFromPath);

  const setActiveTab = (tab: 'editor' | 'create' | 'library' | 'knowledge' | 'admin' | 'settings' | 'atlas') => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const targetPath = tab === 'editor' ? '/' : `/${tab}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ tab }, '', targetPath);
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getTabFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Estados de Modais e Erro
  const [isPresentationOpen, setIsPresentationOpen] = useState<boolean>(false);
  const [presentationStartScene, setPresentationStartScene] = useState<number>(0);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isMaestroLogsOpen, setIsMaestroLogsOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Estados de Integração banco de dados / Autosave / Conflitos (B2 / R6)
  const [isLibraryLoading, setIsLibraryLoading] = useState<boolean>(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState<boolean>(false);
  const [hasUnsyncedLocalLessons, setHasUnsyncedLocalLessons] = useState<boolean>(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  useEffect(() => {
    document.documentElement.dataset.pemaraSaveState = autosaveStatus;
    return () => { delete document.documentElement.dataset.pemaraSaveState; };
  }, [autosaveStatus]);
  const [conflictData, setConflictData] = useState<any>(null);

  const autosaveTimeoutRef = useRef(new Map<string,ReturnType<typeof setTimeout>>());
  const activeUserIdRef = useRef<string | null>(null);
  activeUserIdRef.current = currentUser?.id || null;
  const sessionGenerationRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Carrega e sincroniza o acervo do professor no banco de dados (B2.1)
  const loadUserLessons = async (user: AuthUser | null) => {
    // 1. Invalida imediatamente qualquer carga anterior em trânsito
    sessionGenerationRef.current++;
    const currentGen = sessionGenerationRef.current;
    const targetUserId = user?.id || null;

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    if (!user) {
      // Usuário anônimo/visitante: exibe templates demonstrativos do piloto
      setIsLibraryLoading(false);
      setSavedLessons(
        initialLoad.validLessons && initialLoad.validLessons.length > 0
          ? initialLoad.validLessons
          : [
              structuredClone(TEMPLATE_GREECE_6EF),
              structuredClone(TEMPLATE_SOLAR_SYSTEM),
              structuredClone(TEMPLATE_PROJECTILE_MOTION),
              structuredClone(TEMPLATE_MATH_FUNCTION)
            ]
      );
      setHasUnsyncedLocalLessons(false);
      return;
    }

    setIsLibraryLoading(true);
    try {
      const remoteList = await lessonsApi.listMyLessons({ signal: abortController.signal });

      // Verificação de integridade pós-await: se a sessão mudou durante a requisição, descarta imediatamente
      if (sessionGenerationRef.current !== currentGen || activeUserIdRef.current !== targetUserId) {
        console.warn('[SessionGuard] Resposta de listMyLessons descartada após troca/encerramento de sessão.');
        return;
      }

      if (remoteList.length > 0) {
        const fullLessons: LessonSpec[] = [];
        for (const item of remoteList) {
          if (sessionGenerationRef.current !== currentGen || activeUserIdRef.current !== targetUserId) {
            console.warn('[SessionGuard] Iteração de aulas interrompida por troca de sessão.');
            return;
          }
          try {
            const full = await lessonsApi.getLesson(item.id, { signal: abortController.signal });
            if (sessionGenerationRef.current !== currentGen || activeUserIdRef.current !== targetUserId) {
              return;
            }
            const activeSpec = full.draft?.draft_spec_json || full.currentSpec;
            activeSpec.lesson_version = full.currentVersion;
            fullLessons.push(activeSpec);
          } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error(`Erro ao carregar aula ${item.id}:`, err);
          }
        }

        // Guarda final antes de aplicar estado
        if (sessionGenerationRef.current !== currentGen || activeUserIdRef.current !== targetUserId) {
          return;
        }

        setSavedLessons(fullLessons);
        if (fullLessons.length > 0) {
          const lastOpened = window.localStorage.getItem('pemara-last-opened-lesson');
          setCurrentLesson(fullLessons.find(lesson => lesson.lesson.id === lastOpened) || fullLessons[0]);
        }
      } else {
        // Professor sem aulas salvas no banco de dados (Empty State honesto, sem auto-criação)
        setSavedLessons([]);
      }

      if (initialLoad.validLessons && initialLoad.validLessons.length > 0) {
        setHasUnsyncedLocalLessons(true);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Requisição abortada intencionalmente
      }
      if (sessionGenerationRef.current === currentGen && activeUserIdRef.current === targetUserId) {
        console.error('Erro ao consultar acervo do professor:', err);
      }
    } finally {
      if (sessionGenerationRef.current === currentGen && activeUserIdRef.current === targetUserId) {
        setIsLibraryLoading(false);
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
      const user = await authApi.getMe();
      if (user) {
        setCurrentUser(user);
      }
      setIsOpeningWorkspace(false);
      } catch { setWorkspaceError('Não foi possível abrir suas aulas. Inicie o PEMARA e tente novamente.'); }
    };
    initAuth();
  }, []);

  useEffect(() => {
    loadUserLessons(currentUser);
  }, [currentUser]);

  // Logout seguro: limpa imediatamente todo estado privado e cancela autosaves em voo (B2.5 / P1)
  const handleLogout = async () => {
    // 1. Cancela timer de autosave pendente imediatamente
    for(const timer of autosaveTimeoutRef.current.values())clearTimeout(timer);
    autosaveTimeoutRef.current.clear();
    lessonsApi.clearSessionCache();

    // 2. Aborta qualquer requisição de rede em voo
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }

    // 3. Incrementa geração de sessão para invalidar respostas assíncronas tardias
    sessionGenerationRef.current++;
    activeUserIdRef.current = null;

    // 4. Limpeza IMEDIATA e síncrona de todo estado privado antes de qualquer requisição de rede
    setCurrentUser(null);
    setAutosaveStatus('idle');
    setConflictData(null);
    setIsLoginModalOpen(false);
    setIsAccountModalOpen(false);
    setIsPresentationOpen(false);
    setIsExportModalOpen(false);
    setIsMaestroLogsOpen(false);
    setIsMigrationModalOpen(false);
    setIsLibraryLoading(false);
    setSavedLessons(
      initialLoad.validLessons && initialLoad.validLessons.length > 0
        ? initialLoad.validLessons
        : [
            structuredClone(TEMPLATE_GREECE_6EF),
            structuredClone(TEMPLATE_SOLAR_SYSTEM),
            structuredClone(TEMPLATE_PROJECTILE_MOTION),
            structuredClone(TEMPLATE_MATH_FUNCTION)
          ]
    );
    setCurrentLesson(TEMPLATE_GREECE_6EF);
    if (activeTab === 'admin' || activeTab === 'settings') {
      setActiveTab('editor');
    }

    // 5. Invalidação no servidor via cookie/API
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('[Logout] Aviso: Falha ao confirmar revogação no servidor (rede indisponível). O estado local foi limpo integralmente.', err);
    }
  };

  // Persistência segura em LocalStorage para visitantes e modo offline (R1)
  useEffect(() => {
    if (currentUser) return; // Quando logado, a persistência é prioritariamente no banco de dados
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const res = saveLessonsToStorage(window.localStorage, savedLessons, quarantinedItems);
        if (!res.success) {
          setStorageError(res.error || 'Falha ao persistir no armazenamento local.');
        } else {
          setStorageError(null);
        }
      }
    } catch (err: any) {
      setStorageError(err?.message || 'Falha de armazenamento.');
    }
  }, [savedLessons, quarantinedItems, currentUser]);

  const handleExportQuarantine = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(quarantinedItems, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `pemara_aulas_quarentena_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportEmergencyBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      user: currentUser?.username || 'visitante',
      currentLesson,
      savedLessons,
      quarantinedItems
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `pemara_backup_emergencia_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Atualizar a aula atual com autosave debounced no banco de dados (B2.3)
  useEffect(() => {
    if (currentUser && !isLibraryLoading && savedLessons.some(lesson => lesson.lesson.id === currentLesson.lesson.id)) {
      try { window.localStorage.setItem('pemara-last-opened-lesson', currentLesson.lesson.id); } catch { /* The database remains authoritative. */ }
    }
  }, [currentUser, isLibraryLoading, savedLessons, currentLesson.lesson.id]);

  const handleUpdateCurrentLesson = (updatedLesson: LessonSpec) => {
    // A edição é um rascunho. Só o servidor incrementa a versão publicada;
    // incrementar aqui fazia a primeira troca de modelo gerar conflito 409.
    if(currentUser&&updatedLesson.lesson.id===currentLesson.lesson.id){
      updatedLesson={...updatedLesson,lesson_version:currentLesson.lesson_version};
    }
    setCurrentLesson(updatedLesson);
    setSavedLessons((prev) =>
      prev.map((item) => (item.lesson.id === updatedLesson.lesson.id ? updatedLesson : item))
    );

    // Se estiver logado e a aula for persistente (não demo/template temporário), dispara autosave com debounce
    if (currentUser && !updatedLesson.lesson.id.startsWith('pemara-demo-') && !updatedLesson.lesson.id.startsWith('template-')) {
      setAutosaveStatus('unsaved');
      const userId = currentUser.id;
      const capturedGen = sessionGenerationRef.current;

      const previousTimer=autosaveTimeoutRef.current.get(updatedLesson.lesson.id);
      if(previousTimer)clearTimeout(previousTimer);

      autosaveTimeoutRef.current.set(updatedLesson.lesson.id, setTimeout(async () => {
        autosaveTimeoutRef.current.delete(updatedLesson.lesson.id);
        // Proteção contra troca de conta durante o debounce (B2.5)
        if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== userId) {
          console.warn('[Autosave] Sessão do professor alterada durante debounce. Autosave cancelado.');
          return;
        }

        setAutosaveStatus('saving');
        try {
          const res = await lessonsApi.saveDraft(
            updatedLesson.lesson.id,
            updatedLesson,
            updatedLesson.lesson_version
          );

          // Proteção pós-await: se a conta mudou enquanto a requisição estava na rede, descarta imediatamente
          if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== userId) {
            console.warn('[Autosave] Resposta tardia de salvamento descartada após troca de sessão.');
            return;
          }

          setAutosaveStatus('saved');
          setLastSavedAt(res.savedAt);
          setConflictData(null);
        } catch (err: any) {
          // Proteção pós-await no erro: nunca atribui conflito ou erro à sessão seguinte
          if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== userId) {
            console.warn('[Autosave] Erro/conflito tardio descartado após troca de sessão.');
            return;
          }

          if (err.status === 409 || err.code === 'DRAFT_CONFLICT') {
            setAutosaveStatus('conflict');
            setConflictData({
              currentVersion: err.currentVersion,
              expectedVersion: err.expectedVersion,
              serverDraft: err.serverDraft,
              currentSpec: err.currentSpec,
            });
          } else {
            setAutosaveStatus('error');
          }
        }
      }, 1500));
    }
  };

  // Publicar Nova Versão Oficial no banco de dados (B2.4 / R6)
  const handlePublishVersion = async (changeSummary: string) => {
    const timer=autosaveTimeoutRef.current.get(currentLesson.lesson.id);
    if(timer)clearTimeout(timer);
    autosaveTimeoutRef.current.delete(currentLesson.lesson.id);
    if (!currentUser) {
      setIsLoginModalOpen(true);
      return;
    }
    const capturedGen = sessionGenerationRef.current;
    const targetUserId = activeUserIdRef.current;

    // Se for template didático, cria primeiro a aula definitiva no banco
    if (currentLesson.lesson.id.startsWith('pemara-demo-') || currentLesson.lesson.id.startsWith('template-')) {
      const res = await lessonsApi.createLesson({
        title: currentLesson.lesson.title,
        subjectCode: currentLesson.lesson.subject,
        gradeLevel: currentLesson.lesson.grade,
        topic: currentLesson.lesson.topic,
        spec: currentLesson,
      });
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) {
        console.warn('[SessionGuard] Publicação inicial descartada após troca/encerramento de sessão.');
        return;
      }
      const newLesson = {
        ...currentLesson,
        lesson_version: res.lesson.current_version,
        lesson: { ...currentLesson.lesson, id: res.lesson.id },
      };
      setCurrentLesson(newLesson);
      setSavedLessons((prev) => [newLesson, ...prev]);
      setAutosaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
      return;
    }

    try {
      const res = await lessonsApi.saveVersion(
        currentLesson.lesson.id,
        currentLesson,
        changeSummary,
        currentLesson.lesson_version
      );
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) {
        console.warn('[SessionGuard] Publicação de versão descartada após troca/encerramento de sessão.');
        return;
      }

      const updated = {
        ...currentLesson,
        lesson_version: res.lesson.current_version,
      };
      setCurrentLesson(updated);
      setSavedLessons((prev) => prev.map((l) => (l.lesson.id === updated.lesson.id ? updated : l)));
      setAutosaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
    } catch (err: any) {
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) {
        return;
      }
      if (err.status === 409 || err.code === 'DRAFT_CONFLICT') {
        setAutosaveStatus('conflict');
        setConflictData({
          currentVersion: err.currentVersion,
          expectedVersion: err.expectedVersion,
          serverDraft: err.serverDraft,
          currentSpec: err.currentSpec,
        });
      }
      throw err;
    }
  };

  // Restaurar Versão Anterior do Histórico (B2.6)
  const handleRestoreRevision = async (revisionId: string, summary: string) => {
    const capturedGen = sessionGenerationRef.current;
    const targetUserId = activeUserIdRef.current;
    const res = await lessonsApi.restoreRevision(currentLesson.lesson.id, revisionId, summary);
    if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) return;
    const full = await lessonsApi.getLesson(currentLesson.lesson.id);
    if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) return;
    const activeSpec = full.draft?.draft_spec_json || full.currentSpec;
    activeSpec.lesson_version = res.lesson.current_version;
    setCurrentLesson(activeSpec);
    setSavedLessons((prev) => prev.map((l) => (l.lesson.id === activeSpec.lesson.id ? activeSpec : l)));
    setAutosaveStatus('saved');
    setLastSavedAt(new Date().toISOString());
  };

  // Recarregar Versão do Servidor após Conflito (B2.4)
  const handleReloadServerLesson = async () => {
    const capturedGen = sessionGenerationRef.current;
    const targetUserId = activeUserIdRef.current;
    try {
      const full = await lessonsApi.getLesson(currentLesson.lesson.id);
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) return;
      const activeSpec = full.draft?.draft_spec_json || full.currentSpec;
      activeSpec.lesson_version = full.currentVersion;
      setCurrentLesson(activeSpec);
      setSavedLessons((prev) => prev.map((l) => (l.lesson.id === activeSpec.lesson.id ? activeSpec : l)));
      setAutosaveStatus('saved');
      setConflictData(null);
    } catch (err) {
      console.error('Erro ao recarregar aula do servidor:', err);
    }
  };

  // Forçar Sobrescrita de Versão em Conflito
  const handleForceSaveVersion = async () => {
    if (!currentUser) return;
    const capturedGen = sessionGenerationRef.current;
    const targetUserId = activeUserIdRef.current;
    try {
      // Salva rascunho com force: true
      await lessonsApi.saveDraft(currentLesson.lesson.id, currentLesson, currentLesson.lesson_version, { force: true });
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) return;
      // Salva versão sem expectedVersion restrito
      const res = await lessonsApi.saveVersion(currentLesson.lesson.id, currentLesson, 'Sobrescrita forçada pelo autor');
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) return;
      const updated = { ...currentLesson, lesson_version: res.lesson.current_version };
      setCurrentLesson(updated);
      setSavedLessons((prev) => prev.map((l) => (l.lesson.id === updated.lesson.id ? updated : l)));
      setAutosaveStatus('saved');
      setConflictData(null);
    } catch (err) {
      console.error('Falha ao forçar gravação:', err);
    }
  };

  // Criar Nova Aula através do Maestro / Lesson Composer
  const handleCreateLesson = async (input: GenerationInput) => {
    setIsGenerating(true);
    setGenerationError(null);
    const capturedGen = sessionGenerationRef.current;
    const targetUserId = activeUserIdRef.current;
    try {
      let dynamicPackPayload: any = undefined;
      const publishedCatalog = currentUser ? await knowledgeApi.getCatalog() : undefined;
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) return;
      const targetSlug = resolvePackSlugForInput(input.subject, input.grade, input.topic, publishedCatalog);
      if (!targetSlug || (input.pack_slug && input.pack_slug !== targetSlug)) {
        throw new Error('Não há um tema publicado correspondente à disciplina, ao ano e ao assunto informados. Escolha um tema disponível no acervo.');
      }
      input = { ...input, pack_slug: targetSlug };

      if (targetSlug) {
        if (currentUser) {
          // Professor autenticado: obtém obrigatoriamente o Content Pack publicado no banco de dados
          const activeVer = await knowledgeApi.getActivePack(targetSlug);
          if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) {
            console.warn('[SessionGuard] Geração de aula abortada após troca/encerramento de sessão.');
            return;
          }
          if (!activeVer?.payload_json || !Array.isArray(activeVer.payload_json.nodes) || !activeVer.payload_json.nodes.length) {
            throw new Error('Este conjunto não possui conteúdo publicado utilizável. Consulte o Acervo de conteúdos.');
          }
          dynamicPackPayload = activeVer.payload_json;
        } else {
          // Modo desconectado / demonstração local sem usuário autenticado
          try {
            const activeVer = await knowledgeApi.getActivePack(targetSlug);
            if (activeVer && activeVer.payload_json && Object.keys(activeVer.payload_json).length > 0) {
              dynamicPackPayload = activeVer.payload_json;
            }
          } catch {
            // Em modo puramente desconectado sem servidor, utiliza a fixture canônica local
          }
        }
      }
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) {
        console.warn('[SessionGuard] Geração de aula abortada antes do Maestro.');
        return;
      }
      const { lesson } = await PemaraMaestro.generateLesson(input, dynamicPackPayload);
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) {
        console.warn('[SessionGuard] Geração de aula descartada após troca/encerramento de sessão.');
        return;
      }
      if (currentUser) {
        // Grava no banco de dados na conta do professor logado
        const res = await lessonsApi.createLesson({
          title: lesson.lesson.title,
          subjectCode: lesson.lesson.subject,
          gradeLevel: lesson.lesson.grade,
          topic: lesson.lesson.topic,
          spec: lesson,
        });
        if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) {
          console.warn('[SessionGuard] Gravação de nova aula descartada após troca/encerramento de sessão.');
          return;
        }
        const created = {
          ...lesson,
          lesson_version: res.lesson.current_version,
          lesson: { ...lesson.lesson, id: res.lesson.id },
        };
        setSavedLessons((prev) => [created, ...prev]);
        setCurrentLesson(created);
      } else {
        setSavedLessons((prev) => [lesson, ...prev]);
        setCurrentLesson(lesson);
      }
      setActiveTab('editor');
    } catch (err: any) {
      if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) {
        return;
      }
      console.error('Erro na geração da aula:', err);
      setGenerationError(err.message || 'Erro ao gerar aula.');
    } finally {
      if (sessionGenerationRef.current === capturedGen && activeUserIdRef.current === targetUserId) {
        setIsGenerating(false);
      }
    }
  };

  // Duplicar Aula
  const handleDuplicateLesson = async (lesson: LessonSpec) => {
    const capturedGen = sessionGenerationRef.current;
    const targetUserId = activeUserIdRef.current;
    if (currentUser && !lesson.lesson.id.startsWith('pemara-demo-') && !lesson.lesson.id.startsWith('template-')) {
      try {
        const res = await lessonsApi.duplicateLesson(lesson.lesson.id);
        if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) return;
        const full = await lessonsApi.getLesson(res.lesson.id);
        if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) return;
        const dupSpec = full.currentSpec;
        dupSpec.lesson_version = res.lesson.current_version;
        setSavedLessons((prev) => [dupSpec, ...prev]);
        setCurrentLesson(dupSpec);
        setActiveTab('editor');
        return;
      } catch (err) {
        if (sessionGenerationRef.current !== capturedGen || activeUserIdRef.current !== targetUserId) return;
        console.error('Erro ao duplicar aula no banco de dados:', err);
      }
    }

    const duplicated: LessonSpec = {
      ...JSON.parse(JSON.stringify(lesson)),
      schema_version: '1.0',
      lesson_version: 1,
      lesson: {
        ...lesson.lesson,
        id: `pemara-copy-${Date.now()}`,
        title: `${lesson.lesson.title} (Cópia)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    setSavedLessons((prev) => [duplicated, ...prev]);
    setCurrentLesson(duplicated);
    setActiveTab('editor');
  };

  // Excluir Aula (soft delete no banco de dados se logado)
  const handleDeleteLesson = async (lessonId: string) => {
    if (currentUser && !lessonId.startsWith('pemara-demo-') && !lessonId.startsWith('template-')) {
      try {
        await lessonsApi.deleteLesson(lessonId);
      } catch (err) {
        console.error('Erro ao excluir aula no banco de dados:', err);
      }
    }

    const remaining = savedLessons.filter((l) => l.lesson.id !== lessonId);
    setSavedLessons(remaining);
    if (currentLesson.lesson.id === lessonId) {
      if (remaining.length > 0) {
        setCurrentLesson(remaining[0]);
      } else {
        setCurrentLesson(TEMPLATE_GREECE_6EF);
      }
    }
  };

  // Iniciar Apresentação
  const handleStartPresentation = (startScene = 0) => {
    setPresentationStartScene(startScene);
    setIsPresentationOpen(true);
  };

  if (workspaceError) return <div role="alert" className="min-h-screen bg-slate-950 text-slate-100 p-8"><p>{workspaceError}</p><button className="mt-4 rounded bg-indigo-600 px-4 py-2" onClick={()=>window.location.reload()}>Tentar novamente</button></div>;
  if (isOpeningWorkspace) return <div role="status" className="min-h-screen bg-slate-950 text-slate-100 p-8">Abrindo suas aulas…</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* NAVBAR SUPERIOR */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeMode={currentLesson.lesson.generation_mode}
        onStartPresentation={() => handleStartPresentation(0)}
        canPresent={currentLesson.scenes.length > 0}
        currentUser={currentUser}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onOpenAccount={() => setIsAccountModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-8">
        {/* BANNER CRÍTICO DE ERRO DE ARMAZENAMENTO / COTA */}
        {storageError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-500/50 text-red-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-300 text-sm">
                  Alerta Crítico de Armazenamento: {storageError}
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  O navegador não conseguiu persistir os dados no disco local. Seu acervo anterior foi protegido intacto. Baixe uma cópia de segurança imediatamente.
                </p>
              </div>
            </div>
            <button
              onClick={handleExportEmergencyBackup}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Exportar Cópia de segurança de Emergência (.json)
            </button>
          </div>
        )}

        {/* BANNER DE QUARENTENA SEGURA (R1: Proteção contra perda de dados) */}
        {quarantinedItems.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300 text-sm">
                  Proteção de Dados: {quarantinedItems.length} aula(s) legada(s) mantida(s) em Quarentena Segura.
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Nenhuma aula foi descartada. Registros com formato incompatível foram preservados intactos para inspeção e exportação.
                </p>
              </div>
            </div>
            <button
              onClick={handleExportQuarantine}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Exportar Quarentena (.json)
            </button>
          </div>
        )}

        {/* NOTIFICAÇÃO DE RECUPERAÇÃO AUTOMÁTICA */}
        {recoveredNotice > 0 && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{recoveredNotice} aula(s) legada(s) foram migradas com sucesso para o formato v1.0.</span>
            </div>
            <button onClick={() => setRecoveredNotice(0)} className="text-emerald-400 hover:text-emerald-300 font-bold ml-2">
              ✕
            </button>
          </div>
        )}

        {/* RENDERIZAÇÃO DAS TELAS PRINCIPAIS */}
        {activeTab === 'editor' && (
          <LessonEditor
            lesson={currentLesson}
            onUpdateLesson={handleUpdateCurrentLesson}
            onStartPresentation={(idx) => handleStartPresentation(idx)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onOpenMaestroLogs={() => setIsMaestroLogsOpen(true)}
            currentUser={currentUser}
            autosaveStatus={autosaveStatus}
            lastSavedAt={lastSavedAt}
            onPublishVersion={handlePublishVersion}
            onRestoreRevision={handleRestoreRevision}
            conflictData={conflictData}
            onReloadServerLesson={handleReloadServerLesson}
            onForceSaveVersion={handleForceSaveVersion}
            onExportLocalBackup={handleExportEmergencyBackup}
          />
        )}

        {activeTab === 'atlas' && <AtlasLibrary onSave={async spec => {
          if (!currentUser) throw new Error('Aguarde a abertura do acervo local.');
          const result = await lessonsApi.createLesson({ title: spec.lesson.title, subjectCode: spec.lesson.subject, gradeLevel: spec.lesson.grade, topic: spec.lesson.topic, spec });
          const saved = { ...spec, lesson_version: result.lesson.current_version, lesson: { ...spec.lesson, id: result.lesson.id } };
          setSavedLessons(previous => [saved, ...previous]); setCurrentLesson(saved); setAutosaveStatus('saved'); setActiveTab('editor');
        }} />}
        {activeTab === 'create' && (
          <LessonCreator
            onCreateLesson={handleCreateLesson}
            isGenerating={isGenerating}
            errorMessage={generationError}
            onOpenSavedLesson={async id=>{const result=await lessonsApi.getLesson(id);setCurrentLesson(result.currentSpec);setSavedLessons(previous=>[result.currentSpec,...previous.filter(l=>l.lesson.id!==id)]);setAutosaveStatus('saved');setActiveTab('editor');}}
          />
        )}

        {activeTab === 'library' && (
          <div className="space-y-4">
            {hasUnsyncedLocalLessons && currentUser && (
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-indigo-200 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <UploadCloud className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <span>{currentUser.local ? 'Há aulas guardadas neste navegador. Você pode copiá-las para o acervo deste computador.' : 'Você possui aulas salvas localmente no navegador desta máquina. Deseja migrá-las para sua conta no servidor da escola?'}</span>
                </div>
                <button
                  onClick={() => setIsMigrationModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md flex-shrink-0 flex items-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Migrar Aulas Locais</span>
                </button>
              </div>
            )}

            <SavedLessonsList
              lessons={savedLessons}
              activeLessonId={currentLesson.lesson.id}
              isLoading={isLibraryLoading}
              isRemoteDb={!!currentUser}
              onSelectLesson={(lesson) => {
                setCurrentLesson(lesson);
                setActiveTab('editor');
              }}
              onDuplicateLesson={handleDuplicateLesson}
              onDeleteLesson={handleDeleteLesson}
              onNewLesson={() => setActiveTab('create')}
              onLoadDemoTemplate={() => {
                setCurrentLesson(TEMPLATE_GREECE_6EF);
                setActiveTab('editor');
              }}
              onStartPresentation={(lesson) => {
                setCurrentLesson(lesson);
                handleStartPresentation(0);
              }}
            />
          </div>
        )}

        {activeTab === 'knowledge' && (
          <KnowledgeStudio
            onLoadLesson={(lesson) => {
              setCurrentLesson(lesson);
              setSavedLessons((prev) => [lesson, ...prev.filter((l) => l.lesson.id !== lesson.lesson.id)]);
            }}
            onNavigateToEditor={() => setActiveTab('editor')}
          />
        )}

        {activeTab === 'settings' && currentUser?.role === 'admin' && <AISettings />}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <AdminPanel currentUser={currentUser} />
        )}

        {(activeTab === 'admin' || activeTab === 'settings') && currentUser?.role !== 'admin' && (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl max-w-md mx-auto space-y-4 shadow-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Acesso Restrito ao Administrador</h3>
              <p className="text-xs text-slate-400 mt-1">
                O Administraçãoistrativo Geral requer login com privilégios de administrador do sistema.
              </p>
            </div>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
            >
              Fazer Login como Administrador
            </button>
          </div>
        )}
      </main>

      {/* MODAL DE APRESENTAÇÃO FULLSCREEN */}
      {isPresentationOpen && (
        <PresentationMode
          lesson={currentLesson}
          initialSceneIndex={presentationStartScene}
          onClose={() => setIsPresentationOpen(false)}
          onUpdateScene={(updatedScene: Scene) => {
            const newScenes = currentLesson.scenes.map((s) =>
              s.id === updatedScene.id ? updatedScene : s
            );
            handleUpdateCurrentLesson({
              ...currentLesson,
              scenes: newScenes
            });
          }}
        />
      )}

      {/* MODAL DE EXPORTAÇÃO */}
      <ExportModal
        lesson={currentLesson}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* MODAL DE LOGS DO MAESTRO & AGENTES */}
      <MaestroLogViewer
        logs={currentLesson.agent_logs}
        isOpen={isMaestroLogsOpen}
        onClose={() => setIsMaestroLogsOpen(false)}
      />

      {/* MODAL DE LOGIN INDIVIDUAL */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsLoginModalOpen(false);
        }}
      />

      {/* MODAL DE MINHA CONTA & TROCA DE SENHA */}
      <AccountModal
        isOpen={isAccountModalOpen}
        currentUser={currentUser}
        onClose={() => setIsAccountModalOpen(false)}
      />

      {/* MODAL DE MIGRAÇÃO CONTROLADA DE LOCALSTORAGE */}
      {currentUser && (
        <MigrationModal
          isOpen={isMigrationModalOpen}
          currentUser={currentUser}
          localLessons={initialLoad.validLessons || []}
          onClose={() => setIsMigrationModalOpen(false)}
          onMigrationComplete={() => {
            loadUserLessons(currentUser);
            setHasUnsyncedLocalLessons(false);
          }}
        />
      )}
    </div>
  );
}
