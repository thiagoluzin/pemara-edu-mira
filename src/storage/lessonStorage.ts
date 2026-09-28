/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA GERENCIADOR SEGURO DE ARMAZENAMENTO E QUARENTENA (R1)
 * Protege integralmente o trabalho do professor:
 * 1. Preservação durável antes de qualquer mutação (staging & rollback atômico).
 * 2. Se a gravação da quarentena falhar, a chave principal NÃO é sobrescrita.
 * 3. Migração transparente apenas para formatos puramente estruturais (content string -> array).
 * 4. Proibido inventar gabaritos de quiz (correct_index) ou sintetizar conteúdo didático inexistente.
 * 5. Manutenção de backup bruto sincronizado do trabalho autoral do professor.
 */

import { LessonSpec } from '../types/lesson';
import { validateLessonSpec } from '../schemas/lessonValidator';

export const LOCAL_STORAGE_KEY = 'pemara_saved_lessons_v2';
export const QUARANTINE_STORAGE_KEY = 'pemara_quarantine_lessons_v1';
export const BACKUP_RAW_STORAGE_KEY = 'pemara_lessons_backup_raw';

export interface QuarantinedItem {
  id: string;
  raw: any;
  errors: string[];
  quarantinedAt: string;
}

export interface StorageLoadResult {
  validLessons: LessonSpec[];
  quarantinedItems: QuarantinedItem[];
  rawQuarantine?: string;
  recoveredCount: number;
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

/**
 * Tenta migrar automaticamente formatos legados estritamente estruturais.
 * PROIBIDO: alterar conteúdo pedagógico, inventar parágrafos ou assumir respostas de quiz.
 */
export function migrateLegacyLesson(raw: any): LessonSpec | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  try {
    const cloned = JSON.parse(JSON.stringify(raw));

    // 1. Schema version
    if (!cloned.schema_version) {
      cloned.schema_version = '1.0';
    }

    // 2. Metadados de aula: somente se já existem
    if (!cloned.lesson || typeof cloned.lesson !== 'object' || Array.isArray(cloned.lesson)) {
      return null;
    }

    // 3. Cenas: apenas normalização não-semântica
    if (!Array.isArray(cloned.scenes) || cloned.scenes.length === 0) {
      return null;
    }

    for (let i = 0; i < cloned.scenes.length; i++) {
      const scene = cloned.scenes[i];
      if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
        // Proibido inventar cenas para itens inválidos
        return null;
      }

      // Migração de content escalar textual: string -> string[] (transformação puramente estrutural)
      if (scene.type === 'text') {
        if (typeof scene.content === 'string') {
          if (scene.content.trim().length === 0) return null;
          scene.content = [scene.content];
        }
      }

      // Proibido inventar resposta correta de quiz! Se correct_index for fracionário, ausente ou fora do limite, enviar para quarentena
      if (scene.type === 'quiz') {
        if (
          typeof scene.correct_index !== 'number' ||
          !Number.isFinite(scene.correct_index) ||
          !Number.isInteger(scene.correct_index) ||
          scene.correct_index < 0 ||
          (Array.isArray(scene.answers) && scene.correct_index >= scene.answers.length)
        ) {
          return null; // Não alterar o gabarito do professor
        }
      }
    }

    // Validar se cumpre o contrato canônico
    const check = validateLessonSpec(cloned);
    if (check.isValid) {
      return cloned as LessonSpec;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Carrega aulas do LocalStorage com preservação total de dados e quarentena segura
 */
export function loadLessonsFromStorage(storage: Storage): StorageLoadResult {
  const validLessons: LessonSpec[] = [];
  const quarantinedItems: QuarantinedItem[] = [];
  let rawQuarantine: string | undefined;
  let recoveredCount = 0;

  // Carregar quarentena pré-existente
  try {
    const existingQuarantine = storage.getItem(QUARANTINE_STORAGE_KEY);
    if (existingQuarantine) {
      const parsedQuarantine = JSON.parse(existingQuarantine);
      if (Array.isArray(parsedQuarantine)) {
        quarantinedItems.push(...parsedQuarantine);
      }
    }
  } catch {
    // Quarentena mantida
  }

  const stored = storage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) {
    return { validLessons, quarantinedItems, recoveredCount };
  }

  // Backup bruto durável: sincronizar com o conteúdo atual antes de qualquer alteração
  try {
    storage.setItem(BACKUP_RAW_STORAGE_KEY, stored);
  } catch {
    // Quota excedida
  }

  let parsed: any;
  try {
    parsed = JSON.parse(stored);
  } catch {
    rawQuarantine = stored;
    quarantinedItems.push({
      id: `corrupted-raw-${Date.now()}`,
      raw: stored,
      errors: ['Erro crítico de sintaxe JSON ao ler armazenamento local.'],
      quarantinedAt: new Date().toISOString()
    });
    return { validLessons, quarantinedItems, rawQuarantine, recoveredCount };
  }

  if (!Array.isArray(parsed)) {
    quarantinedItems.push({
      id: `invalid-type-${Date.now()}`,
      raw: parsed,
      errors: ['Estrutura armazenada no localStorage não é uma lista (array) de aulas.'],
      quarantinedAt: new Date().toISOString()
    });
    return { validLessons, quarantinedItems, recoveredCount };
  }

  for (const item of parsed) {
    // 1. Se já for estritamente válido
    const directCheck = validateLessonSpec(item);
    if (directCheck.isValid) {
      validLessons.push(item as LessonSpec);
      continue;
    }

    // 2. Tentar migração puramente estrutural sem alteração semântica
    const migrated = migrateLegacyLesson(item);
    if (migrated) {
      validLessons.push(migrated);
      recoveredCount++;
      continue;
    }

    // 3. Conteúdo inválido ou ambíguo: isolar em Quarentena sem apagar o original
    const itemId = item?.lesson?.id || item?.id || `unrecovered-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    if (!quarantinedItems.some((q) => q.id === itemId)) {
      quarantinedItems.push({
        id: itemId,
        raw: item,
        errors: directCheck.errors,
        quarantinedAt: new Date().toISOString()
      });
    }
  }

  return { validLessons, quarantinedItems, rawQuarantine, recoveredCount };
}

/**
 * Salva aulas com estratégia de commit em estágios e rollback atômico.
 * A chave principal NUNCA é substituída se a gravação da quarentena falhar.
 */
export function saveLessonsToStorage(
  storage: Storage,
  lessons: LessonSpec[],
  quarantinedItems: QuarantinedItem[]
): SaveResult {
  const previousMain = storage.getItem(LOCAL_STORAGE_KEY);
  const previousQuarantine = storage.getItem(QUARANTINE_STORAGE_KEY);
  const previousBackup = storage.getItem(BACKUP_RAW_STORAGE_KEY);

  try {
    // 1. Sincronizar backup de segurança antes de mutar
    if (previousMain && previousMain !== previousBackup) {
      storage.setItem(BACKUP_RAW_STORAGE_KEY, previousMain);
    }

    // 2. Gravar Quarentena PRIMEIRO. Se falhar, interrompe sem tocar na chave principal
    if (quarantinedItems.length > 0) {
      storage.setItem(QUARANTINE_STORAGE_KEY, JSON.stringify(quarantinedItems));
    }

    // 3. Gravar chave principal somente com quarentena assegurada
    storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lessons));

    return { success: true };
  } catch (err: any) {
    // ROLLBACK: Qualquer falha restaura o acervo original intacto
    try {
      if (previousMain !== null) {
        storage.setItem(LOCAL_STORAGE_KEY, previousMain);
      }
      if (previousQuarantine !== null) {
        storage.setItem(QUARANTINE_STORAGE_KEY, previousQuarantine);
      } else {
        storage.removeItem(QUARANTINE_STORAGE_KEY);
      }
    } catch {
      // Silencioso em caso de falha no rollback
    }

    const errorMsg = err?.message || 'Falha ao persistir no armazenamento local (Storage).';
    console.error('Falha atômica ao persistir no localStorage:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
