export interface MaterialSection {
  sourceUnit: 'pagina' | 'slide' | 'nota' | 'paragrafo' | 'texto';
  sourceIndex: number;
  sourceLabel: string;
  text: string;
  heading?: string;
}
export interface ExtractedMaterial {
  filename: string;
  format: 'pdf' | 'docx' | 'pptx' | 'doc' | 'ppt' | 'txt' | 'md' | 'manual';
  sections: MaterialSection[];
  text: string;
  warnings: string[];
  truncated: boolean;
  ocrUsed: boolean;
}
export interface StoredMaterial extends ExtractedMaterial {
  id: string;
  sha256: string;
  byteLength: number;
  createdAt: string;
}
export interface MaterialSelection extends MaterialSection {
  lessonPart?: 'opening' | 'development' | 'assessment';
  materialId: string;
  filename: string;
  sha256?: string;
}
export interface MaterialSceneOptions {
  maxScenes: number;
  position: 'after-opening' | 'before-summary' | 'lesson-flow' | 'material-only';
}
export const MATERIAL_TEXT_LIMIT = 120000;
export const MATERIAL_SCENE_LIMIT = 24;
