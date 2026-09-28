import {validateTeachingVisual} from '../engine/teachingVisual';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA VALIDADOR DE SCHEMA v1.0
 * Garante que o renderer nunca receba um JSON corrompido ou inválido.
 */

import { LessonSpec, Scene } from '../types/lesson';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateLessonSpec(spec: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!spec || typeof spec !== 'object') {
    return { isValid: false, errors: ['O documento deve ser um objeto JSON válido.'], warnings: [] };
  }

  // 1. Verificação de versão do schema
  if (!spec.schema_version) {
    errors.push('Campo obrigatório ausente: "schema_version".');
  } else if (spec.schema_version !== '1.0') {
    errors.push(`Versão de schema "${spec.schema_version}" incompatível com o renderizador (requer "1.0").`);
  }

  // 2. Metadados da Aula
  if (!spec.lesson || typeof spec.lesson !== 'object') {
    errors.push('Campo obrigatório ausente ou inválido: "lesson".');
  } else {
    const { id, subject, title, duration_minutes, grade, generation_mode } = spec.lesson;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      errors.push('lesson.id é obrigatório e deve ser uma string não-vazia.');
    }
    const validSubjects = [
      'portuguese',
      'english',
      'arts',
      'physical_education',
      'math',
      'science',
      'history',
      'geography',
      'religious_education',
      'physics',
      'biology',
      'chemistry',
    ];
    if (!subject || typeof subject !== 'string') {
      errors.push('lesson.subject é obrigatório.');
    } else if (!validSubjects.includes(subject)) {
      errors.push(`lesson.subject inválido: "${subject}". Deve ser uma das disciplinas permitidas: ${validSubjects.join(', ')}.`);
    }

    if (!grade || typeof grade !== 'string' || grade.trim().length === 0) {
      errors.push('lesson.grade é obrigatório e deve ser uma string não-vazia.');
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      errors.push('lesson.title não pode estar vazio.');
    }

    if (typeof duration_minutes !== 'number' || !Number.isFinite(duration_minutes) || duration_minutes <= 0 || duration_minutes > 300) {
      errors.push('lesson.duration_minutes deve ser um número finito entre 1 e 300 minutos.');
    }

    const validModes = ['MODE_A_NO_AI', 'MODE_B_LOCAL_AI', 'MODE_C_API', 'MODE_D_AGENTS'];
    if (generation_mode && !validModes.includes(generation_mode)) {
      errors.push(`lesson.generation_mode inválido: "${generation_mode}". Deve ser um dos modos suportados: ${validModes.join(', ')}.`);
    }
  }

  // 3. Objetivos pedagógicos
  if (!Array.isArray(spec.objectives)) {
    warnings.push('"objectives" deveria ser uma lista de objetivos de aprendizagem.');
  } else if (spec.objectives.length === 0) {
    warnings.push('Nenhum objetivo pedagógico listado na aula.');
  } else if (spec.objectives.some((o: any) => typeof o !== 'string' || o.trim().length === 0)) {
    errors.push('Todos os itens de "objectives" devem ser strings não-vazias.');
  }

  // 4. Validação das Cenas
  if (!Array.isArray(spec.scenes)) {
    errors.push('"scenes" deve ser uma lista (array) de cenas.');
  } else if (spec.scenes.length === 0) {
    errors.push('A aula deve conter pelo menos 1 cena.');
  } else {
    const sceneIds = new Set<string>();

    spec.scenes.forEach((scene: any, index: number) => {
      const prefix = `Cena [${index + 1}]`;

      if (!scene || typeof scene !== 'object') {
        errors.push(`${prefix}: Estrutura de cena inválida.`);
        return;
      }

      if (!scene.id || typeof scene.id !== 'string' || scene.id.trim().length === 0) {
        errors.push(`${prefix}: Campo "id" é obrigatório e deve ser uma string não-vazia.`);
      } else if (sceneIds.has(scene.id)) {
        errors.push(`${prefix}: ID duplicado "${scene.id}". IDs de cenas devem ser únicos.`);
      } else {
        sceneIds.add(scene.id);
      }

      if (!scene.type) {
        errors.push(`${prefix}: Campo "type" é obrigatório.`);
        return;
      }

      // Validação por tipo de cena
      if (scene.learning_progress !== undefined) {
        const p=scene.learning_progress;
        if (!p || !Array.isArray(p.completed) || p.completed.some((n:any)=>!Number.isInteger(n)||n<0)
          || typeof p.notes !== 'string' || p.notes.length>20000) errors.push(`${prefix}: Registro da atividade inválido.`);
      }
      if(scene.visual!==undefined){
        if(!['text','summary'].includes(scene.type))errors.push(`${prefix}: visual só é permitido em texto e síntese.`);
        const count=scene.type==='text'?(Array.isArray(scene.content)?scene.content.length:0)+(Array.isArray(scene.bullets)?scene.bullets.length:0)+(scene.callout?1:0):(Array.isArray(scene.takeaways)?scene.takeaways.length:0)+(scene.next_steps?1:0);
        errors.push(...validateTeachingVisual(scene.visual,count).map(e=>`${prefix}: ${e}`));
      }
      switch ((scene as any).type) {
        case 'biology_model':
          if (!scene.title || typeof scene.title !== 'string') errors.push(`${prefix}: Título do modelo é obrigatório.`);
          if (!scene.params || !['cell_structure','organization'].includes(scene.params.model)
            || !['animal','plant'].includes(scene.params.cell_type)) {
            errors.push(`${prefix}: Modelo biológico ou tipo de célula inválido.`);
          }
          break;
        case 'title':
          if (!scene.title || typeof scene.title !== 'string' || scene.title.trim().length === 0) {
            errors.push(`${prefix} (title): Título não pode estar vazio.`);
          }
          break;

        case 'text':
          if (!scene.title || typeof scene.title !== 'string' || scene.title.trim().length === 0) {
            errors.push(`${prefix} (text): Título é obrigatório.`);
          }
          if (!Array.isArray(scene.content)) {
            errors.push(`${prefix} (text): "content" deve ser um array de strings.`);
          } else if (scene.content.length === 0) {
            errors.push(`${prefix} (text): "content" deve conter ao menos um parágrafo.`);
          } else if (scene.content.some((p: any) => typeof p !== 'string')) {
            errors.push(`${prefix} (text): Todos os parágrafos em "content" devem ser strings.`);
          }
          if (scene.bullets !== undefined) {
            if (!Array.isArray(scene.bullets)) {
              errors.push(`${prefix} (text): "bullets" deve ser um array de strings.`);
            } else if (scene.bullets.some((b: any) => typeof b !== 'string')) {
              errors.push(`${prefix} (text): Todos os itens em "bullets" devem ser strings.`);
            }
          }
          break;

        case 'map':
          if (!scene.title || typeof scene.title !== 'string' || scene.title.trim().length === 0) {
            errors.push(`${prefix} (map): Título é obrigatório.`);
          }
          if (!scene.params || typeof scene.params !== 'object' || !Array.isArray(scene.params.focus_points) || scene.params.focus_points.length === 0) {
            errors.push(`${prefix} (map): "params.focus_points" deve ser uma lista não-vazia de marcos cartográficos.`);
          } else {
            scene.params.focus_points.forEach((fp: any, idx: number) => {
              if (!fp || typeof fp !== 'object' || typeof fp.name !== 'string' || fp.name.trim().length === 0 ||
                  typeof fp.lat !== 'number' || typeof fp.lon !== 'number' ||
                  !Number.isFinite(fp.lat) || !Number.isFinite(fp.lon) || Math.abs(fp.lat)>90 || Math.abs(fp.lon)>180) {
                errors.push(`${prefix} (map): Ponto de foco [${idx + 1}] possui coordenadas ou nome inválidos.`);
              }
            });
          }
          break;

        case 'comparison':
          if (!scene.title || typeof scene.title !== 'string' || scene.title.trim().length === 0) {
            errors.push(`${prefix} (comparison): Título é obrigatório.`);
          }
          if (!scene.params || typeof scene.params !== 'object') {
            errors.push(`${prefix} (comparison): "params" é obrigatório e deve ser um objeto.`);
          } else {
            if (!Array.isArray(scene.params.columns) || scene.params.columns.length < 2) {
              errors.push(`${prefix} (comparison): "params.columns" deve conter ao menos 2 colunas.`);
            } else if (scene.params.columns.some((c: any) => typeof c !== 'string' || c.trim().length === 0)) {
              errors.push(`${prefix} (comparison): Todas as colunas em "params.columns" devem ser strings não-vazias (sem valores nulos).`);
            }

            if (!Array.isArray(scene.params.rows) || scene.params.rows.length === 0) {
              errors.push(`${prefix} (comparison): "params.rows" deve conter ao menos 1 linha.`);
            } else if (scene.params.rows.some((r: any) => !r || typeof r !== 'object' || Array.isArray(r))) {
              errors.push(`${prefix} (comparison): Todos os itens em "params.rows" devem ser objetos válidos não-nulos.`);
            } else if (scene.params.rows.some((r: any) => typeof r.criteria !== 'string' || r.criteria.trim().length === 0)) {
              errors.push(`${prefix} (comparison): Todas as linhas devem possuir campo "criteria" como string não-vazia.`);
            }

            if (scene.params.conclusion !== undefined && typeof scene.params.conclusion !== 'string') {
              errors.push(`${prefix} (comparison): "params.conclusion" deve ser uma string quando fornecida.`);
            }
          }
          break;

        case 'summary':
          if (!scene.title || typeof scene.title !== 'string' || scene.title.trim().length === 0) {
            errors.push(`${prefix} (summary): Título é obrigatório.`);
          }
          if (!Array.isArray(scene.takeaways) || scene.takeaways.length === 0) {
            errors.push(`${prefix} (summary): "takeaways" deve conter ao menos 1 ponto de síntese.`);
          } else if (scene.takeaways.some((t: any) => typeof t !== 'string' || t.trim().length === 0)) {
            errors.push(`${prefix} (summary): Todos os itens em "takeaways" devem ser strings não-vazias.`);
          }
          break;

        case 'physics_projectile': {
          const params = scene.params;
          if (!params || typeof params !== 'object') {
            errors.push(`${prefix} (physics_projectile): "params" é obrigatório.`);
          } else {
            if (typeof params.velocity !== 'number' || !Number.isFinite(params.velocity) || params.velocity <= 0 || params.velocity > 500) {
              errors.push(`${prefix}: Velocidade deve ser um número finito entre 1 e 500 m/s.`);
            }
            if (typeof params.angle !== 'number' || !Number.isFinite(params.angle) || params.angle < 0 || params.angle > 90) {
              errors.push(`${prefix}: Ângulo deve ser um número finito entre 0° e 90°.`);
            }
            if (typeof params.gravity !== 'number' || !Number.isFinite(params.gravity) || params.gravity < 0 || params.gravity > 100) {
              errors.push(`${prefix}: Gravidade deve ser um número finito >= 0 e <= 100 m/s².`);
            }
          }
          break;
        }

        case 'solar_system': {
          const params = scene.params;
          if (!params || typeof params !== 'object') {
            errors.push(`${prefix} (solar_system): "params" é obrigatório.`);
          }
          break;
        }

        case 'math_function': {
          if (!scene.title || typeof scene.title !== 'string' || scene.title.trim().length === 0) {
            errors.push(`${prefix} (math_function): Título é obrigatório.`);
          }
          const params = scene.params;
          if (!params || typeof params !== 'object') {
            errors.push(`${prefix} (math_function): "params" é obrigatório.`);
          } else {
            if (typeof params.a !== 'number' || !Number.isFinite(params.a)) {
              errors.push(`${prefix}: Coeficiente "a" é obrigatório e deve ser um número finito.`);
            }
            if (typeof params.b !== 'number' || !Number.isFinite(params.b)) {
              errors.push(`${prefix}: Coeficiente "b" é obrigatório e deve ser um número finito.`);
            }
            if (typeof params.c !== 'number' || !Number.isFinite(params.c)) {
              errors.push(`${prefix}: Coeficiente "c" é obrigatório e deve ser um número finito.`);
            }
            if (params.function_type && params.function_type !== 'parabola' && params.function_type !== 'linear') {
              errors.push(`${prefix}: Tipo de função "${params.function_type}" ainda não suportado no piloto (requer "parabola").`);
            }
          }
          break;
        }

        case 'timeline': {
          if (!scene.title || typeof scene.title !== 'string' || scene.title.trim().length === 0) {
            errors.push(`${prefix} (timeline): Título é obrigatório.`);
          }
          const params = scene.params;
          if (!params || typeof params !== 'object') {
            errors.push(`${prefix} (timeline): "params" é obrigatório e deve ser um objeto.`);
          } else if (!Array.isArray(params.events) || params.events.length === 0) {
            errors.push(`${prefix} (timeline): Deve conter uma lista não-vazia de eventos em "params.events".`);
          } else {
            params.events.forEach((ev: any, evIdx: number) => {
              if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
                errors.push(`${prefix} (timeline): Evento [${evIdx + 1}] deve ser um objeto válido não-nulo.`);
              } else {
                if (ev.year === undefined || ev.year === null || (typeof ev.year !== 'string' && typeof ev.year !== 'number')) {
                  errors.push(`${prefix} (timeline): Evento [${evIdx + 1}] deve possuir campo "year" como string ou número.`);
                }
                if (!ev.title || typeof ev.title !== 'string' || ev.title.trim().length === 0) {
                  errors.push(`${prefix} (timeline): Evento [${evIdx + 1}] deve possuir "title" como string não-vazia.`);
                }
              }
            });
          }
          break;
        }

        case 'quiz': {
          if (!scene.question || typeof scene.question !== 'string') {
            errors.push(`${prefix} (quiz): "question" é obrigatória e deve ser uma string.`);
          }
          if (!Array.isArray(scene.answers) || scene.answers.length < 2) {
            errors.push(`${prefix} (quiz): "answers" deve conter pelo menos 2 alternativas.`);
          } else if (scene.answers.some((a: any) => typeof a !== 'string')) {
            errors.push(`${prefix} (quiz): Todas as alternativas de "answers" devem ser strings.`);
          }
          if (
            typeof scene.correct_index !== 'number' ||
            !Number.isFinite(scene.correct_index) ||
            !Number.isInteger(scene.correct_index) ||
            scene.correct_index < 0 ||
            (Array.isArray(scene.answers) && scene.correct_index >= scene.answers.length)
          ) {
            errors.push(`${prefix} (quiz): "correct_index" deve ser um número inteiro finito válido dentro do intervalo de alternativas.`);
          }
          break;
        }

        case 'wave': {
          errors.push(`${prefix}: Tipo de componente não implementado no renderizador: "wave".`);
          break;
        }

        default:
          errors.push(`${prefix}: Tipo de componente não suportado: "${(scene as any).type}".`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
