/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA DESIGN SYSTEM — DESIGN TOKENS
 * Especificações 1920x1080 com Safe Areas, Zonas e Limites
 */

export const DESIGN_TOKENS = {
  // Resolução canônica de referência
  slide_width: 1920,
  slide_height: 1080,

  // Margens de Safe Area
  safe_margin_top: 80,
  safe_margin_right: 100,
  safe_margin_bottom: 80,
  safe_margin_left: 100,

  // Área útil segura dentro de 1920x1080
  get safe_area() {
    return {
      left: this.safe_margin_left,
      top: this.safe_margin_top,
      right: this.slide_width - this.safe_margin_right,
      bottom: this.slide_height - this.safe_margin_bottom,
      width: this.slide_width - this.safe_margin_left - this.safe_margin_right, // 1720px
      height: this.slide_height - this.safe_margin_top - this.safe_margin_bottom, // 920px
    };
  },

  // Limites tipográficos em pixels (escala 1920x1080)
  title_font_min: 40,
  title_font_max: 72,

  body_font_min: 24,
  body_font_max: 42,

  caption_font_min: 18,
  caption_font_max: 24,

  // Espaçamentos
  spacing_xs: 8,
  spacing_sm: 16,
  spacing_md: 24,
  spacing_lg: 32,
  spacing_xl: 48,

  // Limites estruturais
  max_text_width: 1500,
  max_lines_title: 3,
  max_lines_body: 8,
  max_items_per_list: 6,
  max_cards_per_slide: 4,
  max_comparison_columns: 3,
} as const;

export type ApprovedLayoutId =
  | '01_title'
  | '02_title_body'
  | '03_title_image'
  | '04_two_columns'
  | '05_comparison'
  | '06_timeline'
  | '07_map'
  | '08_chart'
  | '09_simulation'
  | '10_quiz'
  | '11_summary';
