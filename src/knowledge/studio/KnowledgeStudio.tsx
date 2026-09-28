import { isGradeCompatible } from '../../catalog/curriculumCatalog';
import { label, gradeLabel, readableText } from '../../ui/labels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA KNOWLEDGE STUDIO — CONECTADO AO POSTGRESQL (E3)
 * Painel completo de gestão do acervo de conteúdos conectado diretamente ao banco de dados canônico:
 * - Ontologia e Grafo de Conhecimento com snapshots e controle otimista de versão (409)
 * - Mapeamento Curricular BNCC e Gestão de Fontes e Licenças
 * - Ingestão Externa, Staging e Detecção de Duplicatas com deduplicação transacional
 * - Indicador dinâmico de status do banco de dados e tratamento de erros e permissões (RBAC)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  GitFork,
  BookMarked,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  FileCode,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  ArrowRight,
  Info,
  Clock,
  Sparkles,
  ChevronRight,
  X,
  FileText,
  Edit3,
  Lock,
  ShieldAlert,
  Loader2,
  BookOpen
} from 'lucide-react';
import { knowledgeApi, ApiError } from '../../services/knowledgeApi';
import { authApi, AuthUser } from '../../services/authApi';
import {
  KnowledgeNodeRecord,
  KnowledgeRelationRecord,
  Source,
  License,
  CurriculumSkill,
  StagingNodeRecord,
  ImportBatchRecord,
  ContentPackRecord,
  KnowledgeNodeType,
  RelationType
} from './schema';
import { LessonSpec } from '../../types/lesson';
import { LessonComposer } from '../../composer/lessonComposer';

interface Props {
  onLoadLesson: (lesson: LessonSpec) => void;
  onNavigateToEditor: () => void;
}

export const KnowledgeStudio: React.FC<Props> = ({ onLoadLesson, onNavigateToEditor }) => {
  // Estado de Dados do banco de dados
  const [nodes, setNodes] = useState<KnowledgeNodeRecord[]>([]);
  const [relations, setRelations] = useState<KnowledgeRelationRecord[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumSkill[]>([]);
  const [staging, setStaging] = useState<StagingNodeRecord[]>([]);
  const [batches, setBatches] = useState<ImportBatchRecord[]>([]);
  const [packs, setPacks] = useState<ContentPackRecord[]>([]);

  // Estados de Conexão, Carregamento e Erros
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dbHealthy, setDbHealthy] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [coverage, setCoverage] = useState<{ subject_code: string; skills: number; linked_skills: number }[]>([]);
  const [curriculumSearch, setCurriculumSearch] = useState('');
  const [curriculumPage, setCurriculumPage] = useState(0);
  const filteredCurriculum = curriculum.filter(c => `${c.code} ${c.description} ${c.thematic_unit}`.toLocaleLowerCase('pt-BR').includes(curriculumSearch.toLocaleLowerCase('pt-BR')));
  const curriculumPageSize = 30;
  // Aba ativa do Studio
  const [activeTab, setActiveTab] = useState<'nodes' | 'curriculum' | 'sources' | 'staging' | 'packs'>('nodes');

  // Filtros de Nós
  const [searchQuery, setSearchQuery] = useState('');
  const [nodePage, setNodePage] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  useEffect(() => setNodePage(0), [searchQuery, selectedSubject, selectedGrade, selectedType]);

  // Nó inspecionado no Drawer
  const [selectedNode, setSelectedNode] = useState<KnowledgeNodeRecord | null>(null);

  // Modais
  const [isCreateNodeOpen, setIsCreateNodeOpen] = useState(false);
  const [isEditNodeOpen, setIsEditNodeOpen] = useState(false);
  const [isCreateRelationOpen, setIsCreateRelationOpen] = useState(false);
  const [isExportSqlOpen, setIsExportSqlOpen] = useState(false);
  const [sqlContent, setSqlContent] = useState<string>('-- Carregando DDL do servidor...');
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineToast, setPipelineToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Estado de Conflito de Concorrência Otimista (409)
  const [optimisticConflict, setOptimisticConflict] = useState<{
    entity: string;
    expectedVersion: number;
    currentVersion: number;
    message: string;
  } | null>(null);

  // Formulário de Criação de Nó
  const [newNodeForm, setNewNodeForm] = useState({
    title: '',
    slug: '',
    type: 'concept' as KnowledgeNodeType,
    short_description: '',
    subject_code: 'history' as 'history' | 'geography' | 'science' | 'math',
    grade_level: 6 as 6 | 7 | 8 | 9,
    summary: '',
    key_points: '',
    source_id: 'src-bncc-mec-2018',
    license_id: 'lic-cc-by-sa-4'
  });

  // Formulário de Edição de Nó com Optimistic Locking
  const [editNodeForm, setEditNodeForm] = useState({
    title: '',
    short_description: '',
    summary: '',
    status: 'PUBLISHED' as 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'DEPRECATED' | 'REJECTED',
    change_reason: ''
  });

  // Formulário de Criação de Relação
  const [newRelForm, setNewRelForm] = useState({
    from_node_id: '',
    relation_type: 'part_of' as RelationType,
    to_node_id: ''
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success', duration = 4000) => {
    setPipelineToast({ message, type });
    setTimeout(() => setPipelineToast(null), duration);
  };

  // Carregar todos os dados do banco de dados
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // 1. Checagem de saúde do banco de dados
      const health = await knowledgeApi.checkDatabaseHealth();
      setDbHealthy(health.healthy);

      // 2. Consulta paralela de todas as entidades do acervo de conteúdos
      const [
        nodesResult,
        relationsData,
        sourcesData,
        licensesData,
        curriculumData,
        stagingData,
        batchesData,
        packsData,
        userData, coverageData
      ] = await Promise.all([
        knowledgeApi.getAllNodes(),
        knowledgeApi.getRelations(),
        knowledgeApi.getSources(),
        knowledgeApi.getLicenses(),
        knowledgeApi.getCurriculum(),
        knowledgeApi.getStaging(),
        knowledgeApi.getBatches(),
        knowledgeApi.getPacks(),
        authApi.getMe(), knowledgeApi.getCoverage()
      ]);

      setNodes(nodesResult.nodes || []);
      setRelations(relationsData || []);
      setSources(sourcesData || []);
      setLicenses(licensesData || []);
      setCurriculum(curriculumData || []);
      setCoverage(coverageData.subjects);
      setStaging(stagingData || []);
      setBatches(batchesData || []);
      setPacks(packsData || []);
      if (userData) setCurrentUser(userData);

      // Atualiza o nó selecionado caso ainda exista no novo conjunto
      if (selectedNode) {
        const refreshed = (nodesResult.nodes || []).find((n) => n.id === selectedNode.id);
        if (refreshed) {
          setSelectedNode(refreshed);
        }
      }
    } catch (err: any) {
      console.error('[KnowledgeStudio] Erro ao carregar dados do banco de dados:', err);
      setLoadError(err.message || 'Falha ao conectar com a API do acervo de conteúdos.');
      setDbHealthy(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNode]);

  // Carga inicial
  useEffect(() => {
    refreshData();
  }, []);

  // Filtragem de Nós
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const matchesSearch =
        node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.short_description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject = selectedSubject === 'all' || node.subject_code === selectedSubject;
      const matchesGrade = selectedGrade === 'all' || isGradeCompatible(`${selectedGrade}EF`, `${node.grade_level}EF`);
      const matchesType = selectedType === 'all' || node.type === selectedType;
      return matchesSearch && matchesSubject && matchesGrade && matchesType;
    });
  }, [nodes, searchQuery, selectedSubject, selectedGrade, selectedType]);

  // Relações do nó selecionado
  const selectedNodeRelations = useMemo(() => {
    if (!selectedNode) return { outgoing: [], incoming: [] };
    const outgoing = relations
      .filter((r) => r.from_node_id === selectedNode.id)
      .map((r) => ({
        ...r,
        targetNode: nodes.find((n) => n.id === r.to_node_id)
      }));
    const incoming = relations
      .filter((r) => r.to_node_id === selectedNode.id)
      .map((r) => ({
        ...r,
        sourceNode: nodes.find((n) => n.id === r.from_node_id)
      }));
    return { outgoing, incoming };
  }, [selectedNode, relations, nodes]);

  // Executar simulação de pipeline de ingestão
  const handleRunPipeline = async () => {
    setPipelineLoading(true);
    try {
      const result = await knowledgeApi.runImport('Wikidata', 'Grécia Antiga', 4);
      await refreshData();
      showToast(`Lote ${result.batch.id} concluído no banco de dados: ${result.batch.records_imported} itens importados para revisão.`, 'success', 5000);
    } catch (err: any) {
      showToast(err.message || 'Erro ao executar pipeline de importação.', 'error');
    } finally {
      setPipelineLoading(false);
    }
  };

  // Aprovar item do Staging
  const handleApproveStaging = async (stagingId: string) => {
    try {
      const res = await knowledgeApi.approveStaging(stagingId);
      await refreshData();
      showToast(res.message, res.duplicateHandled ? 'warning' : 'success');
    } catch (err: any) {
      showToast(err.message || 'Falha ao aprovar item do staging.', 'error');
    }
  };

  // Descartar item do Staging
  const handleDiscardStaging = async (stagingId: string) => {
    try {
      await knowledgeApi.discardStaging(stagingId, 'Descartado pelo curador');
      await refreshData();
      showToast('Conteúdo retirado da revisão.', 'warning');
    } catch (err: any) {
      showToast(err.message || 'Falha ao descartar item do staging.', 'error');
    }
  };

  // Criar Nó no banco de dados
  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeForm.title || !newNodeForm.slug) return;

    try {
      const created = await knowledgeApi.createNode({
        title: newNodeForm.title,
        slug: newNodeForm.slug,
        type: newNodeForm.type,
        short_description: newNodeForm.short_description,
        subject_code: newNodeForm.subject_code,
        grade_level: newNodeForm.grade_level,
        summary: newNodeForm.summary,
        key_points: newNodeForm.key_points,
        source_id: newNodeForm.source_id,
        license_id: newNodeForm.license_id,
        status: 'PUBLISHED'
      });

      await refreshData();
      setIsCreateNodeOpen(false);
      setSelectedNode(created);
      showToast(`Nó "${created.title}" gravado com sucesso no banco de dados!`);
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar nó no banco de dados.', 'error');
    }
  };

  // Abrir Modal de Edição
  const openEditModal = (node: KnowledgeNodeRecord) => {
    setEditNodeForm({
      title: node.title,
      short_description: node.short_description,
      summary: node.data_json?.summary || '',
      status: (node.status as any) || 'PUBLISHED',
      change_reason: ''
    });
    setIsEditNodeOpen(true);
  };

  // Salvar Edição com Optimistic Locking
  const handleUpdateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    if (!editNodeForm.change_reason.trim()) {
      showToast('O motivo da alteração é obrigatório para registrar a revisão.', 'warning');
      return;
    }

    try {
      const updated = await knowledgeApi.updateNode(selectedNode.id, {
        expected_version: selectedNode.version,
        title: editNodeForm.title,
        short_description: editNodeForm.short_description,
        data_json: {
          ...selectedNode.data_json,
          summary: editNodeForm.summary
        },
        status: editNodeForm.status,
        reason: editNodeForm.change_reason
      });

      await refreshData();
      setSelectedNode(updated);
      setIsEditNodeOpen(false);
      showToast(`Nó atualizado para versão v${updated.version} com histórico preservado!`);
    } catch (err: any) {
      if (err.status === 409 || err.details?.expectedVersion !== undefined) {
        // Conflito de versão detectado
        setOptimisticConflict({
          entity: 'knowledge_node',
          expectedVersion: selectedNode.version,
          currentVersion: err.details?.currentVersion || (selectedNode.version + 1),
          message: err.message || 'Este nó foi modificado concorrentemente por outro usuário no banco de dados.'
        });
      } else {
        showToast(err.message || 'Erro ao atualizar nó.', 'error');
      }
    }
  };

  // Criar Relação no banco de dados
  const handleCreateRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelForm.from_node_id || !newRelForm.to_node_id) return;
    if (newRelForm.from_node_id === newRelForm.to_node_id) {
      showToast('Auto-ciclo reflexivo inválido: o nó de origem e destino devem ser distintos.', 'warning');
      return;
    }

    try {
      await knowledgeApi.createRelation({
        from_node_id: newRelForm.from_node_id,
        relation_type: newRelForm.relation_type,
        to_node_id: newRelForm.to_node_id
      });

      await refreshData();
      setIsCreateRelationOpen(false);
      showToast('Ligação entre os conteúdos salva!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar relação.', 'error');
    }
  };

  // Disparar Compilação de Aula a partir do Conjunto de conteúdos
  const handleCompilePackToLesson = async (packSlug: string) => {
    try {
      const activeVer = await knowledgeApi.getActivePack(packSlug);
      const dynamicPackPayload = activeVer?.payload_json;
      if (!dynamicPackPayload?.nodes?.length) throw new Error('Este tema ainda não tem conteúdo publicado.');
      const lesson = LessonComposer.compose({
        discipline: dynamicPackPayload.subjectCode,
        grade: `${dynamicPackPayload.gradeLevel}EF`,
        topic: dynamicPackPayload.title,
        duration: 45,
        teaching_method: 'complete'
      }, dynamicPackPayload);

      onLoadLesson(lesson);
      onNavigateToEditor();
      showToast(`Aula criada com a versão ${activeVer?.version || 1} dos conteúdos.`);
    } catch (err: any) {
      showToast(`Erro ao compilar aula: ${err.message}`, 'error');
    }
  };

  // Publicar Nova Versão / Snapshot do Conjunto de conteúdos no banco de dados (B4)
  const handlePublishPackSnapshot = async (packSlug: string) => {
    try {
      const newVer = await knowledgeApi.publishPackVersion(packSlug);
      showToast(`Versão ${newVer.version} publicada. Ela já pode ser usada nas próximas aulas.`);
      refreshData();
    } catch (err: any) {
      showToast(`Erro ao publicar versão do pack: ${err.message}`, 'error');
    }
  };

  // Baixar cópia do acervo Canônico direto do banco de dados
  const handleExportJsonDump = async () => {
    try {
      const dump = await knowledgeApi.getDumpJson();
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pemara-knowledge-dump-v1.0-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Dump JSON canônico exportado com sucesso do banco de dados!');
    } catch (err: any) {
      showToast('Falha ao exportar dump JSON do acervo.', 'error');
    }
  };

  // Abrir DDL SQL canônico
  const handleOpenSqlExport = async () => {
    setIsExportSqlOpen(true);
    try {
      const res = await fetch('/api/knowledge/schema.sql');
      if (res.ok) {
        const text = await res.text();
        setSqlContent(text);
      } else {
        setSqlContent('-- Erro ao buscar schema.sql do servidor');
      }
    } catch {
      setSqlContent('-- Erro de rede ao buscar schema.sql');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast de Notificação */}
      {pipelineToast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs animate-in fade-in duration-200 border ${
            pipelineToast.type === 'error'
              ? 'bg-rose-950 border-rose-500/80 text-rose-200'
              : pipelineToast.type === 'warning'
              ? 'bg-amber-950 border-amber-500/80 text-amber-200'
              : 'bg-emerald-950 border-emerald-500/80 text-emerald-200'
          }`}
        >
          {pipelineToast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : pipelineToast.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{pipelineToast.message}</span>
        </div>
      )}

      {/* Alerta de Conflito de Concorrência Otimista (409) */}
      {optimisticConflict && (
        <div className="bg-amber-950/80 border border-amber-500 rounded-2xl p-5 shadow-2xl space-y-3">
          <div className="flex items-center gap-3 text-amber-300 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Conflito de Concorrência Otimista (HTTP 409)</span>
          </div>
          <p className="text-xs text-amber-200">
            {optimisticConflict.message} A sua versão local era <strong>v{optimisticConflict.expectedVersion}</strong>,
            mas outro usuário gravou uma revisão mais recente no banco de dados.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={async () => {
                setOptimisticConflict(null);
                setIsEditNodeOpen(false);
                await refreshData();
              }}
              className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recarregar Versão Mais Recente do Banco</span>
            </button>
            <button
              onClick={() => setOptimisticConflict(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
            >
              Fechar Alerta
            </button>
          </div>
        </div>
      )}

      {/* Header Principal do Acervo de conteúdos */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                acervo de conteúdos v1.0
              </span>

              {/* Indicador Dinâmico do banco de dados (E3: se não estiver saudável, badge muda) */}
              {dbHealthy ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Acervo disponível
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  Acervo indisponível
                </span>
              )}

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-slate-800 text-slate-400 border border-slate-700">
                Permissões e histórico
              </span>
            </div>

            <h1 className="text-xl xl:text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <Database className="w-7 h-7 text-indigo-400" />
              Acervo de conteúdos
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
              Encontre materiais para suas aulas, confira as fontes e organize os conteúdos por tema. As alterações ficam guardadas no histórico.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="px-3 py-1.5 border-r border-slate-800/80">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Conteúdos</div>
              <div className="text-lg font-black text-indigo-400">{nodes.length}</div>
            </div>
            <div className="px-3 py-1.5 border-r border-slate-800/80">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Ligações entre temas</div>
              <div className="text-lg font-black text-cyan-400">{relations.length}</div>
            </div>
            <div className="px-3 py-1.5 border-r border-slate-800/80">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Fontes / BNCC</div>
              <div className="text-lg font-black text-amber-400">{sources.length}</div>
            </div>
            <div className="px-3 py-1.5">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Aguardando revisão</div>
              <div className="text-lg font-black text-emerald-400">{staging.length}</div>
            </div>
          </div>
        </div>

        {/* Global Studio Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-800/80">
          {/* Sub-tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('nodes')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'nodes'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Conteúdos ({nodes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('curriculum')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'curriculum'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>Matriz BNCC ({curriculum.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'sources'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Fontes & Licenças ({sources.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('staging')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'staging'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Importar e revisar ({staging.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('packs')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'packs'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Conjuntos de conteúdos ({packs.length})</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              disabled={isLoading}
              title="Recarregar dados do banco de dados"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            
            <button
              onClick={handleExportJsonDump}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Baixar cópia do acervo</span>
            </button>
            <button
              onClick={() => setIsCreateNodeOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-950/50 transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Novo conteúdo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Banner de Erro de Conexão com o banco de dados */}
      {loadError && (
        <div className="bg-rose-950/70 border border-rose-500/80 rounded-2xl p-5 flex items-start justify-between gap-4 text-rose-200 text-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-300">Falha na Comunicação com o banco de dados</div>
              <p className="mt-1 text-rose-200/90">{loadError}</p>
            </div>
          </div>
          <button
            onClick={refreshData}
            className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-semibold shrink-0"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Indicador de Carregamento */}
      {isLoading && nodes.length === 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs">Carregando os conteúdos disponíveis...</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: GRAFO DE CONHECIMENTO & NÓS CANÔNICOS                              */}
      {/* ========================================================================= */}
      {activeTab === 'nodes' && !isLoading && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Coluna da Esquerda: Filtros e Lista de Nós */}
          <div className="xl:col-span-7 space-y-4">
            {/* Barra de Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="sm:col-span-12 relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar um conteúdo pelo nome ou tema..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="sm:col-span-4 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none"
              >
                <option value="all">Todas as matérias</option>
                  <option value="portuguese">Língua Portuguesa</option><option value="english">Língua Inglesa</option><option value="arts">Arte</option><option value="physical_education">Educação Física</option><option value="religious_education">Ensino Religioso</option>
                <option value="history">História</option>
                <option value="geography">Geografia</option>
                <option value="science">Ciências</option>
                <option value="math">Matemática</option>
              </select>

              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="sm:col-span-4 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none"
              >
                <option value="all">Todos os anos</option>
                <option value="6">6º Ano</option>
                <option value="7">7º Ano</option>
                <option value="8">8º Ano</option>
                <option value="9">9º Ano</option>
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="sm:col-span-4 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none"
              >
                <option value="all">Todos os tipos</option>
                <option value="concept">Conceito</option>
                <option value="place">Lugar</option>
                <option value="person">Pessoa</option>
                <option value="event">Evento</option>
                <option value="period">Período</option>
                <option value="theory">Teoria</option>
                <option value="object">Objeto/Geografia</option>
              </select>
            </div>

            {/* Lista de Conteúdos */}
            <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
              {filteredNodes.slice(nodePage * 30, (nodePage + 1) * 30).map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const nodeRelCount = relations.filter(
                  (r) => r.from_node_id === node.id || r.to_node_id === node.id
                ).length;

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white tracking-tight">{node.title}</h3>
                          
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{node.short_description}</p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-indigo-300 border border-slate-700">
                          {label(node.type)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">v{node.version}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="capitalize text-slate-400 font-medium">
                          {label(node.subject_code)} • {gradeLabel(node.grade_level)}
                        </span>
                        <span className="flex items-center gap-1 text-cyan-400">
                          <GitFork className="w-3 h-3" />
                          <span>{nodeRelCount} relações</span>
                        </span>
                      </div>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{label(node.status)}</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="col-span-full flex flex-wrap justify-between gap-3 text-sm text-slate-300">
                <button type="button" disabled={nodePage===0} onClick={()=>setNodePage(p=>p-1)} className="disabled:opacity-40">Anterior</button>
                <span>{filteredNodes.length} conteúdos — página {nodePage+1} de {Math.max(1,Math.ceil(filteredNodes.length/30))}</span>
                <button type="button" disabled={(nodePage+1)*30>=filteredNodes.length} onClick={()=>setNodePage(p=>p+1)} className="disabled:opacity-40">Próxima</button>
              </div>
              {filteredNodes.length === 0 && (
                <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-xl text-slate-500 text-xs">
                  Nenhum nó de conhecimento corresponde aos filtros selecionados no banco de dados.
                </div>
              )}
            </div>
          </div>

          {/* Coluna da Direita: Inspetor do Nó Selecionado & Grafo Local */}
          <div className="xl:col-span-5">
            {selectedNode ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 sticky top-24 shadow-xl">
                {/* Cabeçalho do Inspetor */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-400 tracking-wider uppercase font-semibold">
                      Inspetor de Entidade (banco de dados)
                    </span>
                    <h2 className="text-lg font-black text-white">{selectedNode.title}</h2>
                    
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(selectedNode)}
                      title="Editar com controle de versão"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4 text-indigo-400" />
                    </button>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="p-1.5 text-slate-500 hover:text-white rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Badges e Status */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-semibold">
                    {label(selectedNode.type)}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {label(selectedNode.subject_code)} ({gradeLabel(selectedNode.grade_level)})
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                    Status: {label(selectedNode.status)}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    Versão {selectedNode.version}
                  </span>
                </div>

                {/* Descrição e Resumo Didático */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Definição / Descrição Curta</span>
                    <p className="text-slate-300 mt-0.5">{selectedNode.short_description}</p>
                  </div>
                  {selectedNode.data_json?.summary && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Resumo Canônico</span>
                      <p className="text-slate-400 mt-0.5 text-[11px] leading-relaxed">
                        {selectedNode.data_json.summary}
                      </p>
                    </div>
                  )}
                  {selectedNode.data_json?.key_points && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Pontos Didáticos Centrais</span>
                      <ul className="list-disc list-inside text-slate-400 text-[11px] mt-1 space-y-0.5">
                        {selectedNode.data_json.key_points.map((pt: string, idx: number) => (
                          <li key={idx}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Fonte Acadêmica e Licença Vinculadas */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Fonte Canônica:</span>
                    <span className="text-indigo-400 font-medium font-mono text-[11px]">{sources.find(s => s.id === selectedNode.source_id)?.title || 'Fonte não informada'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Licença Legal:</span>
                    <span className="text-emerald-400 font-medium font-mono text-[11px]">{licenses.find(l => l.id === selectedNode.license_id)?.name || 'Licença não informada'}</span>
                  </div>
                </div>

                {/* Ligações entre temaslógicas deste Nó */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <GitFork className="w-3.5 h-3.5 text-cyan-400" />
                      Relações no Grafo ({selectedNodeRelations.outgoing.length + selectedNodeRelations.incoming.length})
                    </span>
                    <button
                      onClick={() => {
                        setNewRelForm((prev) => ({ ...prev, from_node_id: selectedNode.id }));
                        setIsCreateRelationOpen(true);
                      }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      + Conectar
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                    {/* Saindo deste nó */}
                    {selectedNodeRelations.outgoing.map((rel) => (
                      <div
                        key={rel.id}
                        className="p-2 bg-slate-950/70 border border-slate-800/80 rounded-lg flex items-center justify-between gap-2"
                      >
                        <span className="text-slate-400 font-mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded">
                          --[{label(rel.relation_type)}]--&gt;
                        </span>
                        <span
                          onClick={() => rel.targetNode && setSelectedNode(rel.targetNode)}
                          className="text-white font-bold cursor-pointer hover:text-indigo-400 truncate flex-1 text-right"
                        >
                          {rel.targetNode?.title || rel.to_node_id}
                        </span>
                      </div>
                    ))}

                    {/* Chegando neste nó */}
                    {selectedNodeRelations.incoming.map((rel) => (
                      <div
                        key={rel.id}
                        className="p-2 bg-slate-950/70 border border-slate-800/80 rounded-lg flex items-center justify-between gap-2"
                      >
                        <span
                          onClick={() => rel.sourceNode && setSelectedNode(rel.sourceNode)}
                          className="text-white font-bold cursor-pointer hover:text-indigo-400 truncate flex-1"
                        >
                          {rel.sourceNode?.title || rel.from_node_id}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded">
                          --[{label(rel.relation_type)}]--&gt;
                        </span>
                      </div>
                    ))}

                    {selectedNodeRelations.outgoing.length === 0 && selectedNodeRelations.incoming.length === 0 && (
                      <div className="text-[11px] text-slate-500 py-2">
                        Este conteúdo ainda não tem temas relacionados.
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações Rápidas */}
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(selectedNode)}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Editar Versão</span>
                  </button>
                  <button
                    onClick={() => handleCompilePackToLesson('history-6-grecia-antiga')}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Gerar Aula Canônica</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500 space-y-3">
                <GitFork className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-400">Selecione um conteúdo</h3>
                <p className="text-xs max-w-xs mx-auto">
                  Selecione um conteúdo para ler sua descrição, conferir as fontes e ver os temas relacionados.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: MATRIZ CURRICULAR BNCC                                             */}
      {/* ========================================================================= */}
      {activeTab === 'curriculum' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-amber-700/50 bg-slate-900 p-5 space-y-3" aria-label="Cobertura curricular">
            <h2 className="text-base font-bold text-white">Cobertura real do acervo</h2>
            <p className="text-sm text-slate-300">{coverage.reduce((n, c) => n + c.skills, 0)} habilidades cadastradas; {coverage.reduce((n, c) => n + c.linked_skills, 0)} com conteúdo publicado vinculado. Cadastrar uma habilidade não significa que sua aula esteja pronta. Os vínculos também precisam de revisão pedagógica.</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {coverage.map(c => <p key={c.subject_code} className="text-sm text-slate-300">{label(c.subject_code)}: {c.linked_skills}/{c.skills} com conteúdo</p>)}
            </div>
          </section>
          <div className="flex flex-wrap items-center gap-3">
            <input aria-label="Buscar habilidade curricular" placeholder="Buscar por código ou descrição" value={curriculumSearch} onChange={e => { setCurriculumSearch(e.target.value); setCurriculumPage(0); }} className="bg-slate-800 text-white border border-slate-600 rounded-lg p-2 flex-1 min-w-48" />
            <button type="button" disabled={curriculumPage === 0} onClick={() => setCurriculumPage(p => p - 1)} className="text-slate-200 disabled:opacity-40">Anterior</button>
            <span className="text-slate-300 text-sm">Página {curriculumPage + 1} de {Math.max(1, Math.ceil(filteredCurriculum.length / curriculumPageSize))}</span>
            <button type="button" disabled={(curriculumPage + 1) * curriculumPageSize >= filteredCurriculum.length} onClick={() => setCurriculumPage(p => p + 1)} className="text-slate-200 disabled:opacity-40">Próxima</button>
          </div>


          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-indigo-400" />
              Matriz Curricular BNCC (Ensino Fundamental)
            </h2>
            <p className="text-xs text-slate-400">
              Consulte as habilidades da BNCC e sua relação com os conteúdos das aulas.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Código BNCC</th>
                    <th className="p-3">Unidade Temática</th>
                    <th className="p-3">Objeto de Conhecimento</th>
                    <th className="p-3">Descrição da Habilidade</th>
                    <th className="p-3">Série</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCurriculum.slice(curriculumPage * curriculumPageSize, (curriculumPage + 1) * curriculumPageSize).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-850">
                      <td className="p-3 font-mono font-bold text-indigo-400">{c.code}</td>
                      <td className="p-3 font-medium text-white">{c.thematic_unit}</td>
                      <td className="p-3 text-slate-300">{c.knowledge_object}</td>
                      <td className="p-3 text-slate-400 max-w-md">{c.description}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-semibold">
                          {gradeLabel(c.grade_level)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: FONTES FORMAIS & MATRIZ DE LICENÇAS                                */}
      {/* ========================================================================= */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          {/* Tabela de Fontes Formais */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Fontes Primárias e Acadêmicas Verificadas
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Acervo bibliográfico e documental que sustenta cada afirmação pedagógica gerada pelo sistema.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">ID / Provedor</th>
                    <th className="p-3">Título / Obra</th>
                    <th className="p-3">Autor</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sources.map((src) => (
                    <tr key={src.id} className="hover:bg-slate-850">
                      <td className="p-3 font-mono text-[11px] text-indigo-300">
                        {src.id}
                        <div className="text-[10px] text-slate-500">{src.provider}</div>
                      </td>
                      <td className="p-3 font-medium text-white max-w-xs">{src.title}</td>
                      <td className="p-3 text-slate-400">{src.author || 'Não informado'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                          {label(src.source_type)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-semibold">
                          {label(src.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela de Licenças Legais */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Matriz de Licenças e Conformidade Legal
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Políticas de redistribuição, obras derivadas e uso didático.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {licenses.map((lic) => (
                <div key={lic.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-400">{readableText(lic.code)}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{lic.id}</span>
                  </div>
                  <h4 className="font-bold text-white text-xs">{readableText(lic.name)}</h4>
                  <p className="text-[11px] text-slate-400">{readableText(lic.notes)}</p>
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 text-[10px]">
                    <span className={`px-2 py-0.5 rounded ${lic.derivatives_allowed ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
                      Derivadas: {lic.derivatives_allowed ? 'Sim' : 'Não'}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${lic.attribution_required ? 'bg-amber-950 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>
                      Atribuição: {lic.attribution_required ? 'Obrigatória' : 'Isento'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: INGESTÃO & STAGING                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'staging' && (
        <div className="space-y-6">
          {/* Lotes de Importação */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-cyan-400" />
                  Área de Staging & Pipeline de Ingestão Externa (banco de dados)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registros coletados de APIs externas aguardando conferência editorial e resolução de duplicatas.
                </p>
              </div>

              <button
                onClick={handleRunPipeline}
                disabled={pipelineLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${pipelineLoading ? 'animate-spin' : ''}`} />
                <span>Simular Importar da Wikidata</span>
              </button>
            </div>

            {/* Histórico de Lotes */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Últimos Lotes de Execução</span>
              <div className="space-y-2">
                {batches.map((batch) => (
                  <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 text-xs p-2 bg-slate-900/60 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400 font-semibold">{batch.id}</span>
                      <span className="text-slate-400">({batch.provider})</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Total: {batch.records_found}</span>
                      <span className="text-emerald-400">Importados: {batch.records_imported}</span>
                      <span className="text-amber-400">Duplicatas: {batch.records_duplicates}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 font-semibold">
                        {label(batch.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabela de Itens em Staging */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Título / Identificador</th>
                    <th className="p-3">Provedor / ID Ext.</th>
                    <th className="p-3">Resultado da revisão</th>
                    <th className="p-3">Notas de Curadoria</th>
                    <th className="p-3 text-right">Ação Editorial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {staging.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-850">
                      <td className="p-3">
                        <div className="font-bold text-white">{item.title}</div>
                        <div className="font-mono text-[10px] text-slate-400">{item.slug}</div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {item.source_provider} ({item.external_id || 'N/A'})
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.validation_status === 'DUPLICATE'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : item.validation_status === 'APPROVED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : item.validation_status === 'DISCARDED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                          }`}
                        >
                          {label(item.validation_status)}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs text-[11px]">{readableText(item.review_notes)}</td>
                      <td className="p-3 text-right">
                        {item.validation_status !== 'APPROVED' && item.validation_status !== 'DISCARDED' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApproveStaging(item.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all"
                            >
                              Aprovar para Core
                            </button>
                            <button
                              onClick={() => handleDiscardStaging(item.id)}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 text-[11px] transition-all"
                            >
                              Descartar
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Finalizado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: CONTENT PACKS & PONTE COM O MOTOR DE AULAS                         */}
      {/* ========================================================================= */}
      {activeTab === 'packs' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Conjuntos de conteúdos & Compilação Direta de Aulas (banco de dados)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Temas disponíveis para criar aulas sem internet. Confira o material antes de apresentar à turma; publicação técnica não substitui revisão docente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packs.map((pack) => (
              <div key={pack.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-lg">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                      {label(pack.subject_code)} • {gradeLabel(pack.grade_level)}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">v{pack.version || '1.0.0'}</span>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">{pack.title}</h3>
                  

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Conteúdos incluídos:</span>
                      <span className="text-white font-bold">Consultar conteúdo</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Modelos de apresentação:</span>
                      <span className="text-cyan-400 font-bold">Conceitos, exemplos e perguntas</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePublishPackSnapshot(pack.slug)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
                    title="Disponibilizar a versão atual dos conteúdos para criar aulas"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Publicar versão</span>
                  </button>
                  <button
                    onClick={() => handleCompilePackToLesson(pack.slug)}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/50 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-white" />
                    <span>Criar aula</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR NOVO NÓ DE CONHECIMENTO                                      */}
      {/* ========================================================================= */}
      {isCreateNodeOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                Registrar Nó Canônico no banco de dados
              </h3>
              <button onClick={() => setIsCreateNodeOpen(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNode} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 min-[1100px]:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Título do Conceito *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Democracia Direta"
                    value={newNodeForm.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      const slug = title.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
                      setNewNodeForm((prev) => ({ ...prev, title, slug }));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Identificador do conteúdo *</label>
                  <input
                    type="text"
                    required
                    placeholder="democracia-direta"
                    value={newNodeForm.slug}
                    onChange={(e) => setNewNodeForm((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 min-[1100px]:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Tipo de conteúdo</label>
                  <select
                    value={newNodeForm.type}
                    onChange={(e) => setNewNodeForm((prev) => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                  >
                    <option value="concept">Conceito</option>
                    <option value="place">Lugar</option>
                    <option value="person">Pessoa</option>
                    <option value="event">Evento</option>
                    <option value="period">Período</option>
                    <option value="theory">Teoria</option>
                    <option value="formula">Fórmula</option>
                    <option value="object">Objeto</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Disciplina</label>
                  <select
                    value={newNodeForm.subject_code}
                    onChange={(e) => setNewNodeForm((prev) => ({ ...prev, subject_code: e.target.value as any }))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                  >
                    <option value="history">História</option>
                    <option value="geography">Geografia</option>
                    <option value="science">Ciências</option>
                    <option value="math">Matemática</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Ano Escolar (EF)</label>
                  <select
                    value={newNodeForm.grade_level}
                    onChange={(e) => setNewNodeForm((prev) => ({ ...prev, grade_level: parseInt(e.target.value) as any }))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                  >
                    <option value={6}>6º Ano</option>
                    <option value={7}>7º Ano</option>
                    <option value={8}>8º Ano</option>
                    <option value={9}>9º Ano</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Descrição Curta *</label>
                <input
                  type="text"
                  required
                  placeholder="Escreva uma explicação curta para usar na aula..."
                  value={newNodeForm.short_description}
                  onChange={(e) => setNewNodeForm((prev) => ({ ...prev, short_description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Resumo Pedagógico Aprofundado</label>
                <textarea
                  rows={3}
                  placeholder="Fundamentação conceitual com contexto histórico ou científico..."
                  value={newNodeForm.summary}
                  onChange={(e) => setNewNodeForm((prev) => ({ ...prev, summary: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 min-[1100px]:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Fonte Acadêmica Vinculada</label>
                  <select
                    value={newNodeForm.source_id}
                    onChange={(e) => setNewNodeForm((prev) => ({ ...prev, source_id: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                  >
                    {sources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.title} ({src.provider})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Licença Legal</label>
                  <select
                    value={newNodeForm.license_id}
                    onChange={(e) => setNewNodeForm((prev) => ({ ...prev, license_id: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                  >
                    {licenses.map((lic) => (
                      <option key={lic.id} value={lic.id}>
                        {readableText(lic.name)} ({readableText(lic.code)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateNodeOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-950/50"
                >
                  Salvar conteúdo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR NÓ COM CONTROLE OTIMISTA DE VERSÃO (409)                      */}
      {/* ========================================================================= */}
      {isEditNodeOpen && selectedNode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  Editar conteúdo (v{selectedNode.version})
                </h3>
              </div>
              <button onClick={() => setIsEditNodeOpen(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateNode} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Versão esperada para gravação atômica:</span>
                <span className="font-mono font-bold text-indigo-400">v{selectedNode.version}</span>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Título *</label>
                <input
                  type="text"
                  required
                  value={editNodeForm.title}
                  onChange={(e) => setEditNodeForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Descrição Curta *</label>
                <input
                  type="text"
                  required
                  value={editNodeForm.short_description}
                  onChange={(e) => setEditNodeForm((prev) => ({ ...prev, short_description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Resumo Pedagógico</label>
                <textarea
                  rows={3}
                  value={editNodeForm.summary}
                  onChange={(e) => setEditNodeForm((prev) => ({ ...prev, summary: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Situação do conteúdo</label>
                <select
                  value={editNodeForm.status}
                  onChange={(e) => setEditNodeForm((prev) => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="REVIEW">Em revisão</option>
                  <option value="APPROVED">Aprovado</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="DEPRECATED">Substituído</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Motivo da Alteração (Obrigatório para Auditoria) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Atualização do resumo com fontes bibliográficas mais recentes"
                  value={editNodeForm.change_reason}
                  onChange={(e) => setEditNodeForm((prev) => ({ ...prev, change_reason: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditNodeOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-950/50"
                >
                  Gravar Nova Revisão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR NOVA RELAÇÃO ONTOLÓGICA                                      */}
      {/* ========================================================================= */}
      {isCreateRelationOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GitFork className="w-5 h-5 text-cyan-400" />
                Registrar Relação Ontológica no banco de dados
              </h3>
              <button onClick={() => setIsCreateRelationOpen(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRelation} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Conteúdo de origem (From Node) *</label>
                <select
                  required
                  value={newRelForm.from_node_id}
                  onChange={(e) => setNewRelForm((prev) => ({ ...prev, from_node_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                >
                  <option value="">Selecione o nó de origem...</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Tipo de Predicado Ontológico *</label>
                <select
                  value={newRelForm.relation_type}
                  onChange={(e) => setNewRelForm((prev) => ({ ...prev, relation_type: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 font-mono font-semibold focus:outline-none"
                >
                  <option value="part_of">part_of (faz parte de)</option>
                  <option value="contains">contains (contém)</option>
                  <option value="located_in">located_in (localizado em)</option>
                  <option value="example_of">example_of (é exemplo de)</option>
                  <option value="contrasts_with">contrasts_with (contrasta com)</option>
                  <option value="influenced">influenced (influenciou)</option>
                  <option value="occurred_in">occurred_in (ocorreu em)</option>
                  <option value="caused_by">caused_by (causado por)</option>
                  <option value="preceded_by">preceded_by (precedido por)</option>
                  <option value="followed_by">followed_by (seguido por)</option>
                  <option value="related_to">related_to (relacionado com)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Conteúdo de destino (To Node) *</label>
                <select
                  required
                  value={newRelForm.to_node_id}
                  onChange={(e) => setNewRelForm((prev) => ({ ...prev, to_node_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                >
                  <option value="">Selecione o nó de destino...</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400">
                Expressão: ({newRelForm.from_node_id || 'origem'}) --[{newRelForm.relation_type}]--&gt; ({newRelForm.to_node_id || 'destino'})
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateRelationOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-950/50"
                >
                  Conectar Relação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXPORTAR SCHEMA SQL DDL (CANÔNICO)                                 */}
      {/* ========================================================================= */}
      {isExportSqlOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-400" />
                banco de dados Relational DDL Canônico (v1.0)
              </h3>
              <button onClick={() => setIsExportSqlOpen(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              DDL completo emitido diretamente pelo servidor banco de dados com integridade referencial,
              chaves estrangeiras, restrições CHECK, tipos JSONB e índices otimizados.
            </p>

            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-96 overflow-y-auto leading-relaxed">
              {sqlContent}
            </pre>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[11px] text-slate-500">Origem: /api/knowledge/schema.sql</span>
              <a
                href="/api/knowledge/schema.sql"
                download="pemara-001_canonical_schema.sql"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar schema.sql</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
