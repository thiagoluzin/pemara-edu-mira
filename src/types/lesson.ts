import type {TeachingVisual} from '../engine/teachingVisual';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA EDU — CONTRATO PRINCIPAL DO LESSON SPEC v1.0
 */

import { ApprovedLayoutId } from '../design-system/tokens';

export type GenerationMode = 
  | 'MODE_A_NO_AI'       // Templates determinísticos / Knowledge Core
  | 'MODE_B_LOCAL_AI'    // Motor Heurístico Estruturado
  | 'MODE_C_API'         // API Gemini / Provider Externo
  | 'MODE_D_AGENTS';      // Agentes Especializados Maestro

export type Subject = 
  | 'portuguese'
  | 'english'
  | 'arts'
  | 'physical_education'
  | 'math'
  | 'science'
  | 'history'
  | 'geography'
  | 'religious_education'
  | 'physics' 
  | 'biology' 
  | 'chemistry';

export interface LessonMeta {
  id: string;
  subject: Subject;
  grade: string;
  topic: string;
  title: string;
  duration_minutes: number;
  language: 'pt-BR' | 'en-US' | 'es-ES';
  author?: string;
  createdAt: string;
  updatedAt: string;
  generation_mode: GenerationMode;
  didactic_style?: 'visual' | 'summary' | 'review' | 'exercises' | 'complete';
  bncc_skill?: string;
  source_id?: string;
  visual_status?: 'READY' | 'NEEDS_REVIEW';
  content_pack_version?: number;
  content_pack_hash?: string;
  ai_provenance?:{provider:string;model:string;generated_at:string;attempt_id:string;visual_version:string};
  pedagogical_team?: import('../education/teachingAgents').PedagogicalTeamResult;
}

export type SceneType = 
  | 'biology_model'
  | 'title'
  | 'text'
  | 'map'
  | 'comparison'
  | 'physics_projectile'
  | 'solar_system'
  | 'math_function'
  | 'timeline'
  | 'quiz'
  | 'summary';

export interface BaseScene {
  atlas_parameters?: {breathingRate?:number;energy?:number;values?:number[];speed?:number;tempo?:number;angle?:number;index?:number;x?:number;y?:number;event?:string;subject?:string;predicate?:string};
  atlas_model?: import('../animations/atlas').AtlasKind | 'none';
  material_source?: {materialId:string;sha256?:string;filename:string;sourceUnit:string;sourceIndex:number};
  visual?:TeachingVisual;
  learning_progress?: { completed:number[]; notes:string };
  id: string;
  type: SceneType;
  title: string;
  layout_id?: ApprovedLayoutId;
  teacher_notes?: string;
  source_citation?: string;
}

export interface TitleScene extends BaseScene {
  type: 'title';
  subtitle?: string;
  badge?: string;
}

export interface TextScene extends BaseScene {
  type: 'text';
  content: string[];
  callout?: string;
  bullets?: string[];
}

export interface MapFocusPoint {
  name: string;
  lat: number;
  lon: number;
  region: string;
  role: string;
}

export interface MapScene extends BaseScene {
  type: 'map';
  resource_id?: string;
  params: {
    region_name: string;
    focus_points: MapFocusPoint[];
    historical_notes?: string;
  };
}

export interface ComparisonRow {
  criteria: string;
  [key: string]: string;
}

export interface ComparisonScene extends BaseScene {
  type: 'comparison';
  resource_id?: string;
  params: {
    columns: string[];
    rows: ComparisonRow[];
    conclusion?: string;
  };
}

export interface SummaryScene extends BaseScene {
  type: 'summary';
  takeaways: string[];
  next_steps?: string;
}

export interface ProjectileParams {
  velocity: number;        // v0 em m/s (ex: 20)
  angle: number;           // ângulo em graus (ex: 45)
  gravity: number;         // gravidade em m/s² (ex: 9.81)
  initial_height?: number; // y0 em m (default: 0)
  show_vectors?: boolean;  // mostrar Vx, Vy e V
  show_graphs?: boolean;   // gráficos de altura e velocidade
  show_trajectory?: boolean;
  time_scale?: number;     // 1.0 = tempo real
}

export interface ProjectileScene extends BaseScene {
  type: 'physics_projectile';
  params: ProjectileParams;
  pedagogical_focus?: string;
}

export interface SolarSystemParams {
  central_body: 'Sun';
  focused_planet: 'all' | 'Mercury' | 'Venus' | 'Earth' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune';
  speed_multiplier: number;
  show_orbits: boolean;
  show_labels: boolean;
  show_data_cards: boolean;
  scale_mode?: 'didactic' | 'proportional';
}

export interface SolarSystemScene extends BaseScene {
  type: 'solar_system';
  params: SolarSystemParams;
}

export interface MathFunctionParams {
  function_type: 'parabola' | 'sine' | 'linear';
  a: number; // coeficiente a
  b: number; // coeficiente b
  c: number; // termo constante c
  x_min?: number;
  x_max?: number;
  show_roots?: boolean;
  show_vertex?: boolean;
  show_grid?: boolean;
}

export interface MathFunctionScene extends BaseScene {
  type: 'math_function';
  params: MathFunctionParams;
}

export interface TimelineEvent {
  year: string;
  title: string;
  description: string;
  tag?: string;
  impact?: string;
}

export interface TimelineScene extends BaseScene {
  type: 'timeline';
  params: {
    events: TimelineEvent[];
    timeframe_label?: string;
  };
}

export interface QuizScene extends BaseScene {
  type: 'quiz';
  question: string;
  answers: string[];
  correct_index: number;
  explanation: string;
  hint?: string;
}


export type Scene =
  | BiologyScene
  | TitleScene
  | TextScene
  | MapScene
  | ComparisonScene
  | SummaryScene
  | ProjectileScene
  | SolarSystemScene
  | MathFunctionScene
  | TimelineScene
  | QuizScene;

export interface BiologyScene extends BaseScene {
  type: 'biology_model';
  params: { model: 'cell_structure' | 'organization'; cell_type: 'animal' | 'plant' };
}

export interface AgentLogEntry {
  agent: 'Planner' | 'Pedagogy' | 'VisualDirector' | 'FactCheck' | 'QA' | 'Maestro';
  action: string;
  timestamp: string;
  status: 'info' | 'success' | 'warning' | 'alert';
  details: string;
}

export interface LessonReference {
  title: string;
  url?: string;
  kind?: 'curriculum' | 'content' | 'authorship';
  locator?: string;
  license?: string;
}
export interface LessonSpec {
  presentation?: {
    format: 'html';
    content_kind: 'animation';
    html: string;
    atlas_models: import('../animations/atlas').AtlasKind[];
  };
  schema_version: '1.0';
  lesson_version: number;
  renderer_version: '0.3.0';
  lesson: LessonMeta;
  objectives: string[];
  prerequisites?: string[];
  references?: LessonReference[];
  scenes: Scene[];
  agent_logs?: AgentLogEntry[];
}
