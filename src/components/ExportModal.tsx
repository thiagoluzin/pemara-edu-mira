import {prepareMap,mapSvg,mapHtml} from '../engine/mapModel';
import {comparisonValue} from '../engine/comparisonModel';
import { label, gradeLabel } from '../ui/labels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA MOTOR DE EXPORTAÇÃO (Seção 25)
 * 1. Web / HTML Autossuficiente (Roda offline sem dependências)
 * 2. lesson.json Spec v1.0
 * 3. Impressão / PDF via Navegador
 */

import React, { useState } from 'react';
import { LessonSpec, Scene, QuizScene } from '../types/lesson';
import { BIOLOGY_CSS, BIOLOGY_STEPS, biologySvg } from '../engine/biologyModel';
import { createLearningPlan, learningDiagram, isLearningScene, LEARNING_CSS } from '../engine/learningVisual';
import { LEARNING_OFFLINE_RUNTIME } from '../engine/learningOffline';
import { FUNCTION_OFFLINE_RUNTIME } from '../engine/functionOffline';
import { PLANETS_DATA } from '../engine/astronomyEngine';
import { Download, Code, Globe, Printer, X, Check, Copy } from 'lucide-react';

interface Props {
  lesson: LessonSpec;
  isOpen: boolean;
  onClose: () => void;
}

// Funções de escape para segurança de exportação (A08)
export const escapeHtml = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const safeJsonForScript = (obj: unknown): string => {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
};

export const renderAllScenesForPrint = (lesson: LessonSpec, forceIncludeNotes = false): string => {
  const safeSubject = escapeHtml(label(lesson.lesson.subject));
  const safeGrade = escapeHtml(gradeLabel(lesson.lesson.grade));
  const total = lesson.scenes.length;

  return lesson.scenes.map((scene: Scene, idx: number) => {
    let typeName = 'Conteúdo Didático';
    switch (scene.type) {
      case 'title': typeName = 'Abertura e Metas da Aula'; break;
      case 'text': typeName = 'Fundamentação Conceitual'; break;
      case 'map': typeName = 'Recurso Cartográfico'; break;
      case 'comparison': typeName = 'Quadro Comparativo'; break;
      case 'timeline': typeName = 'Linha do Tempo Cronológica'; break;
      case 'physics_projectile': typeName = 'Simulação Newtoniana de Trajetória'; break;
      case 'solar_system': typeName = 'Astronomia e Sistema Solar'; break;
      case 'math_function': typeName = 'Estudo da Função Quadrática'; break;
      case 'quiz': typeName = 'Questionário Formativo'; break;
      case 'summary': typeName = 'Síntese Pedagógica'; break;
    }

    let bodyHtml = '';

    if (scene.type === 'title') {
      bodyHtml = `
        <div style="text-align: center; padding: 36px 10px;">
          ${scene.badge ? `<span style="display:inline-block; padding:4px 12px; background:#e0e7ff; color:#3730a3; border-radius:9999px; font-size:12px; font-weight:700; text-transform:uppercase; margin-bottom:12px;">${escapeHtml(scene.badge)}</span>` : ''}
          <h1 style="font-size:24px; font-weight:800; color:#0f172a; margin: 10px 0;">${escapeHtml(scene.title)}</h1>
          ${scene.subtitle ? `<p style="font-size:15px; color:#475569; max-width:650px; margin:0 auto 16px;">${escapeHtml(scene.subtitle)}</p>` : ''}
        </div>
      `;
    } else if (scene.type === 'text') {
      const textSub = (scene as any).subtitle;
      bodyHtml = `
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:8px;">${escapeHtml(scene.title)}</h2>
        ${textSub ? `<p style="font-size:14px; color:#475569; margin-bottom:12px;">${escapeHtml(textSub)}</p>` : ''}
        <div style="font-size:14px; line-height:1.6; color:#1e293b;">
          ${Array.isArray(scene.content) ? scene.content.map((p: string) => `<p style="margin-bottom:10px;">${escapeHtml(p)}</p>`).join('') : `<p style="margin-bottom:10px;">${escapeHtml(scene.content || '')}</p>`}
        </div>
        ${scene.bullets && scene.bullets.length > 0 ? `<ul style="margin: 10px 0 14px 20px; color:#1e293b;">${scene.bullets.map((b: string) => `<li style="margin-bottom:6px;">${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
        ${scene.callout ? `<div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:10px 14px; border-radius:6px; margin:14px 0; color:#92400e; font-size:13px;"><strong>Destaque:</strong> ${escapeHtml(scene.callout)}</div>` : ''}
      `;
    } else if (scene.type === 'biology_model') {
      bodyHtml = `<style>${BIOLOGY_CSS}</style><section class="bio-model"><h2>${escapeHtml(scene.title)}</h2>
        ${biologySvg(scene.params.model,0,scene.params.cell_type==='plant')}
        <p>Representação estática do modelo animado. Esquema didático sem escala real.</p>
        ${BIOLOGY_STEPS[scene.params.model].map(step=>`<p><strong>${escapeHtml(step.title)}:</strong> ${escapeHtml(step.text)}</p>`).join('')}
        </section>`;
    } else if (scene.type === 'map') {
      const map=prepareMap(scene);
      bodyHtml='<h2>'+escapeHtml(map.title)+'</h2>'+mapSvg(map)+'<ol>'+map.params.focus_points.map(p=>'<li><strong>'+escapeHtml(p.name)+'</strong>: '+escapeHtml(p.role)+'</li>').join('')+'</ol><p>'+escapeHtml(map.params.historical_notes||'Base de localização contemporânea, sem limites temáticos.')+'</p>';
    } else if (scene.type === 'comparison') {
      const p = scene.params || {};
      const cols = p.columns || ['Critério', 'Coluna 1', 'Coluna 2'];
      const rows = p.rows || [];
      const colKeys = cols.map((c: string) => (c || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());

      bodyHtml = `
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:12px;">${escapeHtml(scene.title)}</h2>
        <table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              ${cols.map((col: string, cIdx: number) => `<th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:left; color:#1e293b; ${cIdx === 0 ? 'width:28%;' : ''}">${escapeHtml(col)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((r: any, rIdx: number) => `
              <tr style="${rIdx % 2 === 1 ? 'background:#f8fafc;' : ''}">
                ${cols.map((_: any, cIdx: number) => {
                  if (cIdx === 0) return `<td style="border:1px solid #cbd5e1; padding:8px 10px; font-weight:700; color:#b45309;">${escapeHtml(r.criteria || '-')}</td>`;
                  const key = colKeys[cIdx] || '';
                  const val = comparisonValue(r,cols[cIdx],cIdx);
                  return `<td style="border:1px solid #cbd5e1; padding:8px 10px; color:#334155;">${escapeHtml(val)}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${p.conclusion ? `<div style="background:#f0fdf4; border-left:4px solid #16a34a; padding:10px 14px; border-radius:6px; margin-top:12px; font-size:13px; color:#166534;"><strong>Conclusão Pedagógica:</strong> ${escapeHtml(p.conclusion)}</div>` : ''}
      `;
    } else if (scene.type === 'timeline') {
      const p = scene.params || {};
      const evts = p.events || (scene as any).events || [];
      bodyHtml = `
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:12px;">${escapeHtml(scene.title)}</h2>
        <div style="display:flex; flex-direction:column; gap:12px; margin-top:12px;">
          ${evts.map((e: any) => `
            <div style="border-left:3px solid #6366f1; padding:8px 14px; background:#f8fafc; border-radius:0 8px 8px 0;">
              <span style="display:inline-block; padding:2px 8px; background:#e0e7ff; color:#4338ca; border-radius:4px; font-size:11px; font-weight:700; margin-bottom:4px;">${escapeHtml(e.year)}</span>
              <h4 style="font-size:14px; font-weight:700; color:#0f172a; margin:2px 0;">${escapeHtml(e.title)}</h4>
              <p style="font-size:13px; color:#475569; margin:0;">${escapeHtml(e.description)}</p>
            </div>
          `).join('')}
        </div>
      `;
    } else if (scene.type === 'physics_projectile') {
      const p = scene.params || {};
      const v0 = typeof p.velocity === 'number' ? p.velocity : 20;
      const deg = typeof p.angle === 'number' ? p.angle : 45;
      const g = typeof p.gravity === 'number' && p.gravity > 0 ? p.gravity : 9.81;
      const y0 = typeof p.initial_height === 'number' ? p.initial_height : 0;
      const rad = (deg * Math.PI) / 180;
      const vx = v0 * Math.cos(rad);
      const vy = v0 * Math.sin(rad);
      const tFlight = (vy + Math.sqrt(vy * vy + 2 * g * y0)) / g;
      const rangeVal = vx * tFlight;
      const hMaxVal = y0 + (vy * vy) / (2 * g);

      let pathD = '';
      for (let t = 0; t <= tFlight; t += tFlight / 30) {
        const x = vx * t;
        const y = y0 + vy * t - 0.5 * g * t * t;
        const sx = 40 + (x / (rangeVal || 1)) * 460;
        const sy = 160 - (y / (hMaxVal || 1)) * 130;
        pathD += (pathD === '' ? 'M ' : ' L ') + sx.toFixed(1) + ' ' + sy.toFixed(1);
      }

      bodyHtml = `
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:6px;">${escapeHtml(scene.title)}</h2>
        <p style="color:#0284c7; font-size:12px; font-weight:700; text-transform:uppercase; margin-bottom:12px;">Simulação Newtoniana e Análise de Balística</p>
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:12px;">
          <svg viewBox="0 0 540 180" style="width:100%; max-height:200px; display:block; margin:0 auto;">
            <line x1="30" y1="160" x2="520" y2="160" stroke="#475569" stroke-width="2" />
            <line x1="40" y1="170" x2="40" y2="15" stroke="#475569" stroke-width="2" />
            <text x="515" y="155" fill="#475569" font-size="10" font-weight="bold">X (m)</text>
            <text x="45" y="25" fill="#475569" font-size="10" font-weight="bold">Y (m)</text>
            <path d="${pathD}" fill="none" stroke="#2563eb" stroke-width="2.5" />
            <circle cx="${(40 + (rangeVal / (rangeVal || 1)) * 460).toFixed(1)}" cy="160" r="4" fill="#dc2626" />
            <text x="${(40 + (rangeVal / (rangeVal || 1)) * 460).toFixed(1)}" y="174" fill="#dc2626" font-size="10" font-weight="bold" text-anchor="middle">R = ${rangeVal.toFixed(1)}m</text>
            <line x1="${(40 + 0.5 * 460).toFixed(1)}" y1="160" x2="${(40 + 0.5 * 460).toFixed(1)}" y2="${(160 - 130).toFixed(1)}" stroke="#16a34a" stroke-width="1" stroke-dasharray="3 3" />
            <text x="${(40 + 0.5 * 460).toFixed(1)}" y="${(160 - 135).toFixed(1)}" fill="#16a34a" font-size="10" font-weight="bold" text-anchor="middle">H_max = ${hMaxVal.toFixed(1)}m</text>
          </svg>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:12px;">
          <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:10px;">
            <strong style="color:#0f172a;">Equações Teóricas:</strong>
            <p style="margin:4px 0;">• Alcance Horizontal: R = (v₀² · sen(2θ)) / g</p>
            <p style="margin:4px 0;">• Altura Máxima: H_max = y₀ + (v₀² · sen²(θ)) / (2g)</p>
            <p style="margin:4px 0;">• Tempo Total de Voo: t_voo = 2 · v₀ · sen(θ) / g</p>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #cbd5e1; padding:4px 8px;">Grandeza</th><th style="border:1px solid #cbd5e1; padding:4px 8px;">Valor Teórico</th></tr></thead>
            <tbody>
              <tr><td style="border:1px solid #cbd5e1; padding:4px 8px;">Velocidade Inicial (v₀)</td><td style="border:1px solid #cbd5e1; padding:4px 8px; font-weight:700;">${v0} m/s</td></tr>
              <tr><td style="border:1px solid #cbd5e1; padding:4px 8px;">Ângulo de Disparo (θ)</td><td style="border:1px solid #cbd5e1; padding:4px 8px; font-weight:700;">${deg}°</td></tr>
              <tr><td style="border:1px solid #cbd5e1; padding:4px 8px;">Gravidade Local (g)</td><td style="border:1px solid #cbd5e1; padding:4px 8px;">${g} m/s²</td></tr>
              <tr><td style="border:1px solid #cbd5e1; padding:4px 8px;">Alcance Total (R)</td><td style="border:1px solid #cbd5e1; padding:4px 8px; font-weight:700; color:#dc2626;">${rangeVal.toFixed(2)} m</td></tr>
              <tr><td style="border:1px solid #cbd5e1; padding:4px 8px;">Altura Máxima (H_max)</td><td style="border:1px solid #cbd5e1; padding:4px 8px; font-weight:700; color:#16a34a;">${hMaxVal.toFixed(2)} m</td></tr>
              <tr><td style="border:1px solid #cbd5e1; padding:4px 8px;">Tempo de Voo (t_voo)</td><td style="border:1px solid #cbd5e1; padding:4px 8px; font-weight:700;">${tFlight.toFixed(2)} s</td></tr>
            </tbody>
          </table>
        </div>
      `;
    } else if (scene.type === 'solar_system') {
      const p = scene.params || {};
      const focusedId = (p.focused_planet && p.focused_planet !== 'all') ? p.focused_planet.toLowerCase() : 'earth';
      const showOrbits = p.show_orbits !== false;
      const showLabels = p.show_labels !== false;

      const planets = [
        { id: 'mercury', name: 'Mercúrio', r: 35, dist: '0.39 UA', period: '88 dias', temp: '167°C', cur: 'Ano dura apenas 88 dias terrestres.' },
        { id: 'venus', name: 'Vênus', r: 55, dist: '0.72 UA', period: '225 dias', temp: '464°C', cur: 'Planeta mais quente devido ao efeito estufa extremo.' },
        { id: 'earth', name: 'Terra', r: 80, dist: '1.00 UA', period: '365.25 dias', temp: '15°C', cur: 'Inclinação de 23.5° gera as quatro estações do ano.' },
        { id: 'mars', name: 'Marte', r: 105, dist: '1.52 UA', period: '687 dias', temp: '-65°C', cur: 'Possui o Monte Olimpo com 22 km de altura.' },
        { id: 'jupiter', name: 'Júpiter', r: 140, dist: '5.20 UA', period: '11.86 anos', temp: '-110°C', cur: 'Maior planeta; cabem mais de 1.300 Terras em seu volume.' },
        { id: 'saturn', name: 'Saturno', r: 175, dist: '9.58 UA', period: '29.4 anos', temp: '-140°C', cur: 'Magnífico sistema de anéis de gelo e rocha.' },
        { id: 'uranus', name: 'Urano', r: 210, dist: '19.2 UA', period: '84 anos', temp: '-195°C', cur: 'Eixo inclinado a 98°, gira quase deitado em sua órbita.' },
        { id: 'neptune', name: 'Netuno', r: 240, dist: '30.0 UA', period: '164.8 anos', temp: '-200°C', cur: 'Ventos supersônicos atmosféricos de até 2.000 km/h.' }
      ];

      bodyHtml = `
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:4px;">${escapeHtml(scene.title)}</h2>
        <p style="color:#d97706; font-size:12px; font-weight:700; text-transform:uppercase; margin-bottom:6px;">Astronomia Didática • Modelo Heliocêntrico e Órbitas</p>
        <div style="font-size:11px; color:#64748b; font-style:italic; margin-bottom:10px;">
          Nota didática: Representação esquemática com velocidades relativas simplificadas para fins pedagógicos (raios orbitais em tela não proporcionais às distâncias astronômicas reais em UA).
        </div>
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center; margin-bottom:12px;">
          <svg viewBox="0 0 540 240" style="width:100%; max-height:200px; display:block; margin:0 auto;">
            <circle cx="270" cy="120" r="14" fill="#fbbf24" stroke="#d97706" stroke-width="2" />
            <text x="270" y="124" fill="#78350f" font-size="8" font-weight="900" text-anchor="middle">SOL</text>
            ${planets.map((pl: any, idx: number) => {
              const rx = (idx + 1) * 28 + 10;
              const isFoc = pl.id === focusedId;
              const angle = (idx * 0.78);
              const px = 270 + Math.cos(angle) * rx;
              const py = 120 + Math.sin(angle) * (rx * 0.42);
              return `
                ${showOrbits ? `<ellipse class="orbit-path" cx="270" cy="120" rx="${rx}" ry="${rx * 0.42}" fill="none" stroke="${isFoc ? '#0284c7' : '#cbd5e1'}" stroke-width="${isFoc ? 2 : 1}" stroke-dasharray="${isFoc ? 'none' : '2 2'}" />` : ''}
                <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${isFoc ? 6 : 4}" fill="${isFoc ? '#0284c7' : '#64748b'}" stroke="#ffffff" stroke-width="1.5" />
                ${showLabels ? `<text x="${px.toFixed(1)}" y="${(py + 10).toFixed(1)}" fill="${isFoc ? '#0284c7' : '#475569'}" font-size="8" font-weight="${isFoc ? 'bold' : 'normal'}" text-anchor="middle">${pl.name}</text>` : ''}
              `;
            }).join('')}
          </svg>
        </div>
        ${p.show_data_cards !== false ? `
        <table class="planet-data-card" style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #cbd5e1; padding:4px 6px;">Planeta</th>
              <th style="border:1px solid #cbd5e1; padding:4px 6px;">Distância Média (UA)</th>
              <th style="border:1px solid #cbd5e1; padding:4px 6px;">Período de Translação</th>
              <th style="border:1px solid #cbd5e1; padding:4px 6px;">Temp. Média</th>
              <th style="border:1px solid #cbd5e1; padding:4px 6px;">Destaque Científico</th>
            </tr>
          </thead>
          <tbody>
            ${planets.map((pl: any) => {
              const isFoc = pl.id === focusedId;
              return `
                <tr style="${isFoc ? 'background:#e0f2fe; font-weight:bold;' : ''}">
                  <td style="border:1px solid #cbd5e1; padding:4px 6px; color:${isFoc ? '#0369a1' : '#1e293b'};">${pl.name} ${isFoc ? '<span style="font-size:9px; background:#0284c7; color:#fff; padding:1px 4px; border-radius:3px;">★ Foco da Aula</span>' : ''}</td>
                  <td style="border:1px solid #cbd5e1; padding:4px 6px;">${pl.dist}</td>
                  <td style="border:1px solid #cbd5e1; padding:4px 6px;">${pl.period}</td>
                  <td style="border:1px solid #cbd5e1; padding:4px 6px;">${pl.temp}</td>
                  <td style="border:1px solid #cbd5e1; padding:4px 6px; color:#475569;">${escapeHtml(pl.cur)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ` : ''}
      `;
    } else if (scene.type === 'math_function') {
      const p = scene.params || {};
      const a = typeof p.a === 'number' ? p.a : 1;
      const b = typeof p.b === 'number' ? p.b : -2;
      const c = typeof p.c === 'number' ? p.c : -3;
      const delta = b * b - 4 * a * c;
      const xv = a !== 0 ? -b / (2 * a) : 0;
      const yv = a !== 0 ? -delta / (4 * a) : c;
      let rootsText = 'Sem raízes reais (Δ < 0)';
      if (delta > 0 && a !== 0) {
        const x1 = (-b + Math.sqrt(delta)) / (2 * a);
        const x2 = (-b - Math.sqrt(delta)) / (2 * a);
        rootsText = `x₁ = ${x1.toFixed(2)}, x₂ = ${x2.toFixed(2)}`;
      } else if (delta === 0 && a !== 0) {
        rootsText = `Raiz única x = ${xv.toFixed(2)}`;
      }

      let parabolaD = '';
      for (let x = -8; x <= 8; x += 0.25) {
        const y = a * x * x + b * x + c;
        const sx = 200 + x * 20;
        const sy = 120 - y * 14;
        parabolaD += (parabolaD === '' ? 'M ' : ' L ') + sx.toFixed(1) + ' ' + Math.max(10, Math.min(230, sy)).toFixed(1);
      }

      bodyHtml = `
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:4px;">${escapeHtml(scene.title)}</h2>
        <p style="color:#059669; font-size:12px; font-weight:700; text-transform:uppercase; margin-bottom:12px;">Estudo Analítico da Parábola e Propriedades Quadráticas</p>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:12px;">
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
            <svg viewBox="0 0 400 240" style="width:100%; max-height:200px; display:block; margin:0 auto;">
              <g stroke="#e2e8f0" stroke-width="1">
                ${Array.from({length: 17}, (_, i) => `<line x1="${i * 25}" y1="0" x2="${i * 25}" y2="240" />`).join('')}
                ${Array.from({length: 11}, (_, i) => `<line x1="0" y1="${i * 24}" x2="400" y2="${i * 24}" />`).join('')}
              </g>
              <line x1="0" y1="120" x2="400" y2="120" stroke="#475569" stroke-width="2" />
              <line x1="200" y1="0" x2="200" y2="240" stroke="#475569" stroke-width="2" />
              <text x="390" y="115" fill="#475569" font-size="10" font-weight="bold">X</text>
              <text x="206" y="16" fill="#475569" font-size="10" font-weight="bold">Y</text>
              <path d="${parabolaD}" fill="none" stroke="#059669" stroke-width="2.5" />
              <circle cx="${(200 + xv * 20).toFixed(1)}" cy="${(120 - yv * 14).toFixed(1)}" r="5" fill="#d97706" stroke="#ffffff" stroke-width="1.5" />
            </svg>
          </div>
          <div style="display:flex; flex-direction:column; justify-content:space-between; font-size:12px;">
            <div style="padding:8px 12px; background:#f1f5f9; border-radius:6px; border:1px solid #cbd5e1; font-family:monospace; font-size:15px; font-weight:700; color:#047857;">
              f(x) = ${a !== 1 ? (a === -1 ? '-' : a) : ''}x² ${b > 0 ? '+ ' + (b === 1 ? '' : b) : b < 0 ? '- ' + Math.abs(b) : ''}x ${c > 0 ? '+ ' + c : c < 0 ? '- ' + Math.abs(c) : ''}
            </div>
            <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:12px;">
              <tr><td style="border:1px solid #cbd5e1; padding:5px 8px; font-weight:700;">Coeficientes:</td><td style="border:1px solid #cbd5e1; padding:5px 8px;">a = ${a}, b = ${b}, c = ${c}</td></tr>
              <tr><td style="border:1px solid #cbd5e1; padding:5px 8px; font-weight:700;">Concavidade:</td><td style="border:1px solid #cbd5e1; padding:5px 8px;">${a > 0 ? 'Voltada para cima (ponto de mínimo)' : 'Voltada para baixo (ponto de máximo)'}</td></tr>
              <tr><td style="border:1px solid #cbd5e1; padding:5px 8px; font-weight:700;">Discriminante (Δ):</td><td style="border:1px solid #cbd5e1; padding:5px 8px;">Δ = b² - 4ac = ${delta.toFixed(2)}</td></tr>
              <tr><td style="border:1px solid #cbd5e1; padding:5px 8px; font-weight:700;">Raízes Reais:</td><td style="border:1px solid #cbd5e1; padding:5px 8px; color:#0284c7; font-weight:bold;">${rootsText}</td></tr>
              <tr><td style="border:1px solid #cbd5e1; padding:5px 8px; font-weight:700;">Vértice V(x_v, y_v):</td><td style="border:1px solid #cbd5e1; padding:5px 8px; color:#d97706; font-weight:bold;">V(${xv.toFixed(2)}, ${yv.toFixed(2)})</td></tr>
            </table>
          </div>
        </div>
      `;
    } else if (scene.type === 'quiz') {
      const quiz = scene as QuizScene;
      const answers: string[] = Array.isArray(quiz.answers) ? quiz.answers : ((quiz as any).options || []);
      const corrIdx = typeof quiz.correct_index === 'number' ? quiz.correct_index : 0;
      const isTeacherVersion = forceIncludeNotes;

      bodyHtml = `
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:6px;">${escapeHtml(quiz.title)}</h2>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <p style="color:#7c3aed; font-size:12px; font-weight:700; text-transform:uppercase; margin:0;">Questionário Formativo de Verificação</p>
          <span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; ${isTeacherVersion ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' : 'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;'}">
            ${isTeacherVersion ? 'Versão do Professor (Com Gabarito)' : 'Versão do Aluno'}
          </span>
        </div>
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:14px; margin-bottom:12px;">
          <h3 style="font-size:15px; font-weight:700; color:#0f172a; margin-bottom:12px;">${escapeHtml(quiz.question || '')}</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${answers.map((opt: string, oIdx: number) => {
              const isCorr = oIdx === corrIdx;
              const showCorrectHighlight = isTeacherVersion && isCorr;
              return `
                <div style="padding:10px 12px; border:1px solid ${showCorrectHighlight ? '#16a34a' : '#cbd5e1'}; background:${showCorrectHighlight ? '#f0fdf4' : '#ffffff'}; border-radius:6px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-block; width:20px; height:20px; border:1.5px solid ${showCorrectHighlight ? '#16a34a' : '#94a3b8'}; border-radius:50%; text-align:center; line-height:18px; font-size:11px; font-weight:700; flex-shrink:0; ${showCorrectHighlight ? 'background:#16a34a; color:#ffffff;' : 'color:#475569;'}">${String.fromCharCode(65 + oIdx)}</span>
                    <span>${escapeHtml(opt)}</span>
                  </span>
                  ${showCorrectHighlight ? '<span style="font-size:11px; font-weight:bold; color:#15803d; background:#dcfce7; padding:2px 8px; border-radius:4px; flex-shrink:0;">Gabarito Correto</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ${quiz.explanation ? `
          <div class="print-teacher-notes ${isTeacherVersion ? 'include-notes' : ''}" style="background:#f0fdf4; border-left:4px solid #16a34a; padding:10px 14px; border-radius:6px; font-size:13px; color:#166534; margin-top:10px;">
            <strong>Gabarito e Justificativa Pedagógica:</strong> Alternativa ${String.fromCharCode(65 + corrIdx)}) — ${escapeHtml(quiz.explanation)}
          </div>
        ` : ''}
      `;
    } else if (scene.type === 'summary') {
      const tks = scene.takeaways || [];
      bodyHtml = `
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:6px;">${escapeHtml(scene.title)}</h2>
        <p style="color:#059669; font-size:12px; font-weight:700; text-transform:uppercase; margin-bottom:14px;">Síntese de Conclusão e Consolidação dos Aprendizados</p>
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px; margin-bottom:14px;">
          <h4 style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:10px;">Pontos-Chave Aprendidos:</h4>
          <ul style="margin:0 0 0 20px; color:#1e293b; font-size:13px; line-height:1.6;">
            ${tks.map((t: string) => `<li style="margin-bottom:8px;">${escapeHtml(t)}</li>`).join('')}
          </ul>
        </div>
        ${scene.next_steps ? `<div style="background:#eff6ff; border-left:4px solid #2563eb; padding:10px 14px; border-radius:6px; font-size:13px; color:#1e40af;"><strong>Próximos Passos Recomendados:</strong> ${escapeHtml(scene.next_steps)}</div>` : ''}
      `;
    }

    if (isLearningScene(scene)) {
      const plan=createLearningPlan(scene,lesson.lesson);
      bodyHtml=`<div style="background:#0b1224;border-radius:12px;padding:10px;margin-bottom:14px"><div style="max-width:460px;margin:auto">${learningDiagram(plan,0,plan.initialVariant)}</div><p style="color:#cbd5e1;font-size:11px">${escapeHtml(plan.caption)}</p></div>`+bodyHtml;
      if(scene.learning_progress?.notes) bodyHtml+=`<p><strong>Registro da turma:</strong> ${escapeHtml(scene.learning_progress.notes)}</p>`;
    }
    return `
      <div class="print-slide-page">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin-bottom:14px;">
          <span style="font-size:11px; font-weight:700; color:#4f46e5; text-transform:uppercase;">${safeSubject} • ${safeGrade} • Cena ${idx + 1} de ${total}</span>
          <span style="font-size:11px; color:#64748b; font-weight:600;">${typeName}</span>
        </div>
        ${bodyHtml}
          ${scene.source_citation ? `<p>Fonte: ${escapeHtml(scene.source_citation)}</p>` : ''}
        ${scene.teacher_notes ? `
          <div class="print-teacher-notes ${forceIncludeNotes ? 'include-notes' : ''}">
            <strong>Nota Pedagógica do Professor:</strong> ${escapeHtml(scene.teacher_notes)}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
};

export const generatePrintDocumentHtml = (
  lesson: LessonSpec,
  options?: { includeTeacherNotes?: boolean }
): string => {
  const includeNotes = options?.includeTeacherNotes ?? false;
  const safeTitle = escapeHtml(lesson.lesson.title);
  const safeSubject = escapeHtml(label(lesson.lesson.subject));
  const safeGrade = escapeHtml(gradeLabel(lesson.lesson.grade));

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle} — Documento de Impressão</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: #0f172a;
      line-height: 1.5;
    }
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 12mm 15mm;
    }
    .print-slide-page {
      page-break-after: always;
      break-after: page;
      padding: 16px 0;
      min-height: 90vh;
      border-bottom: 1px dashed #cbd5e1;
    }
    .print-slide-page:last-child {
      page-break-after: avoid;
      break-after: avoid;
      border-bottom: none;
    }
    .print-teacher-notes {
      margin-top: 14px;
      padding: 10px 14px;
      background: #f8fafc;
      border-left: 3px solid #6366f1;
      border-radius: 4px;
      font-size: 12px;
      color: #334155;
    }
    @media print {
      .no-print { display: none !important; }
      .print-slide-page { border-bottom: none !important; }
      ${!includeNotes ? '.print-teacher-notes { display: none !important; }' : ''}
    }
  </style>
</head>
<body>
  <div class="no-print" style="background: #0f172a; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100;">
    <div>
      <strong>Documento de Impressão • PEMARA EDU</strong>
      <span style="font-size: 12px; color: #94a3b8; margin-left: 10px;">${safeTitle} (${lesson.scenes.length} cenas)</span>
      ${includeNotes ? '<span style="background: #4f46e5; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">Notas Pedagógicas Incluídas</span>' : '<span style="background: #334155; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">Notas Pedagógicas Ocultas</span>'}
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="padding: 6px 14px; background: #4f46e5; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Imprimir / Salvar PDF</button>
      <button onclick="window.close()" style="padding: 6px 14px; background: #334155; color: white; border: none; border-radius: 6px; cursor: pointer;">Fechar</button>
    </div>
  </div>
  <div style="max-width: 900px; margin: 0 auto; padding: 20px;">
    ${renderAllScenesForPrint(lesson, includeNotes)}
  </div>
</body>
</html>`;
};

export const generateStandaloneHtml = (lesson: LessonSpec): string => {
  const learningPlans=Object.fromEntries(lesson.scenes.filter(isLearningScene).map(scene=>{
    const plan=createLearningPlan(scene,lesson.lesson);
    return [scene.id,{plan,frames:Array.from({length:Math.max(1,plan.variants.length)},(_,v)=>plan.steps.map((_,s)=>learningDiagram(plan,s,v)))}];
  }));
  const biologyFrames = Object.fromEntries(lesson.scenes.filter((scene)=>scene.type==='biology_model').map(scene=>[
    scene.id, [false,true].map(plant=>BIOLOGY_STEPS[scene.params.model].map((step,i)=>({
      label: step.title,
      html: `<div class="bio-body"><div>${biologySvg(scene.params.model,i,plant)}</div><aside class="bio-detail"><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.text)}</p></aside></div>`,
    })))
  ]));
  const mapFrames=Object.fromEntries(lesson.scenes.filter(s=>s.type==='map').map(s=>[s.id,Array.from({length:Math.max(1,prepareMap(s).params.focus_points.length)},(_,i)=>mapHtml(s,i))]));
  const comparisonValues=Object.fromEntries(lesson.scenes.filter(s=>s.type==='comparison').map(s=>[s.id,s.params.rows.map(r=>s.params.columns.map((c,i)=>comparisonValue(r,c,i)))]));
  const scenesJson = safeJsonForScript(lesson.scenes);
  const safeTitle = escapeHtml(lesson.lesson.title);
  const safeSubject = escapeHtml(label(lesson.lesson.subject));
  const safeGrade = escapeHtml(gradeLabel(lesson.lesson.grade));

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} — PEMARA EDU</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg-dark: #030712;
      --card-bg: #0f172a;
      --card-border: #1e293b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent-indigo: #6366f1;
      --accent-cyan: #38bdf8;
      --accent-amber: #f59e0b;
      --accent-emerald: #10b981;
      --accent-rose: #f43f5e;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 16px;
      overflow-x: hidden;
    }
    .container {
      width: 100%;
      max-width: 1080px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 24px 28px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      margin-top: 12px;
      margin-bottom: 24px;
    }
    .header {
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: #1e1b4b;
      color: #818cf8;
      border: 1px solid #4338ca;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-toggle-notes {
      padding: 6px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-toggle-notes:hover {
      background: #334155;
      color: #fff;
    }
    .btn-toggle-notes.active {
      background: #312e81;
      color: #c7d2fe;
      border-color: #6366f1;
    }
    h1 { font-size: 24px; font-weight: 800; color: #fff; margin-top: 6px; }
    h2 { font-size: 20px; font-weight: 700; color: #f1f5f9; margin-bottom: 10px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 12px; }
    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--card-border);
    }
    button.nav-btn {
      padding: 10px 20px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 14px;
      border: none;
      cursor: pointer;
      background: #4f46e5;
      color: white;
      transition: background 0.2s;
    }
    button.nav-btn:hover { background: #4338ca; }
    button.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .slide-counter { font-size: 13px; color: #94a3b8; font-family: monospace; font-weight: 600; }
    .teacher-notes-panel {
      position: fixed;
      top: 80px;
      right: 16px;
      z-index: 100;
      width: min(440px, calc(100vw - 32px));
      max-height: calc(100dvh - 112px);
      overflow-y: auto;
      box-sizing: border-box;
      box-shadow: 0 18px 55px #0009;
      padding: 14px 18px;
      background: #1e1b4b;
      border: 1px solid #4338ca;
      border-radius: 12px;
      font-size: 13px;
      color: #c7d2fe;
      line-height: 1.5;
    }
    .teacher-notes-panel.hidden { display: none; }
    .notes-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
    .notes-heading button { color:#fff; background:#37306b; border:1px solid #818cf8; border-radius:8px; padding:8px 12px; cursor:pointer; }
    #teacher-notes-text { white-space:pre-wrap; }

    /* Estilos das Cenas Interativas */
    .scene-box { width: 100%; }
    .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 800px) { .grid-2col { grid-template-columns: 1fr; } }

    /* Map */
    .map-container { display: flex; flex-direction: column; gap: 14px; }
    .map-svg-wrap {
      background: #081426;
      border: 1px solid #162e4a;
      border-radius: 14px;
      overflow: hidden;
      position: relative;
    }
    .map-points-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .map-pill {
      padding: 6px 12px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      font-size: 12px;
      color: #cbd5e1;
      cursor: pointer;
      font-weight: 600;
    }
    .map-pill.active { background: #0284c7; color: #fff; border-color: #38bdf8; }
    .map-detail-card {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 13px;
    }

    /* Comparison */
    .comp-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      background: #020617;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #1e293b;
      font-size: 13px;
    }
    .comp-table th {
      background: #0f172a;
      padding: 12px 14px;
      text-align: left;
      color: #f59e0b;
      font-weight: 700;
      border-bottom: 1px solid #1e293b;
    }
    .comp-table td {
      padding: 10px 14px;
      border-bottom: 1px solid #1e293b;
      color: #cbd5e1;
      line-height: 1.5;
    }
    .comp-table tr:hover td { background: #1e1b4b20; }
    .comp-conclusion {
      padding: 12px 16px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid #f59e0b40;
      border-radius: 10px;
      color: #fde68a;
      font-size: 13px;
    }

    /* Timeline */
    .timeline-nav { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; }
    .timeline-btn {
      padding: 8px 14px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      color: #cbd5e1;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
    }
    .timeline-btn.active {
      background: #f59e0b;
      color: #020617;
      border-color: #fbbf24;
    }
    .timeline-card {
      background: #020617;
      border: 1px solid #f59e0b50;
      border-radius: 14px;
      padding: 18px 20px;
      margin-top: 10px;
    }

    /* Physics & Sim */
    .sim-wrap {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 16px;
      margin-top: 8px;
    }
    .telemetry-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .telemetry-item {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 8px 12px;
      text-align: center;
    }
    .telemetry-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
    .telemetry-val { font-size: 16px; font-weight: 800; color: #38bdf8; font-family: monospace; }
    .sim-controls {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    .sim-btn {
      padding: 6px 14px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .sim-btn:hover { background: #334155; }

    /* Solar */
    .planet-pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .planet-pill {
      padding: 5px 10px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      font-size: 12px;
      color: #cbd5e1;
      cursor: pointer;
    }
    .planet-pill.active { background: #f59e0b; color: #020617; font-weight: 700; border-color: #fbbf24; }

    /* Math */
    .math-controls { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
    .slider-row { display: flex; align-items: center; gap: 12px; font-size: 13px; }
    .slider-row label { width: 40px; font-weight: 700; color: #10b981; }
    .slider-row input[type="range"] { flex: 1; accent-color: #10b981; }
    .slider-row span { width: 35px; text-align: right; font-family: monospace; font-weight: 700; }

    /* Quiz */
    .quiz-options { display: flex; flex-direction: column; gap: 8px; margin: 14px 0; }
    .quiz-opt {
      padding: 12px 16px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      color: #cbd5e1;
      font-size: 14px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    }
    .quiz-opt:hover { background: #1e293b; border-color: #475569; }
    .quiz-opt.correct { background: #064e3b; border-color: #10b981; color: #a7f3d0; font-weight: 700; }
    .quiz-opt.incorrect { background: #881337; border-color: #f43f5e; color: #fecdd3; }
    .quiz-feedback {
      padding: 14px 16px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.5;
      margin-top: 10px;
    }

    /* Print styling */
    #print-all-slides {
      display: none;
    }
    .print-slide-page {
      page-break-after: always;
      break-after: page;
      padding: 16px 0;
      min-height: 90vh;
      border-bottom: 1px dashed #cbd5e1;
    }
    .print-slide-page:last-child {
      page-break-after: avoid;
      break-after: avoid;
      border-bottom: none;
    }
    .print-teacher-notes {
      display: none !important;
      margin-top: 14px;
      padding: 10px 14px;
      background: #f8fafc;
      border-left: 3px solid #6366f1;
      border-radius: 4px;
      font-size: 12px;
      color: #334155;
    }
    body.include-notes-print .print-teacher-notes {
      display: block !important;
    }

    @media print {
      body { background: white !important; color: black !important; padding: 0 !important; }
      .container { display: none !important; }
      #print-all-slides { display: block !important; }
      .no-print { display: none !important; }
      .controls, .header-actions, .sim-controls, button { display: none !important; }
      .teacher-notes-panel { display: none !important; }
      .print-slide-page { border-bottom: none !important; }
      .print-teacher-notes { display: none !important; }
      body.include-notes-print .print-teacher-notes {
        display: block !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <span class="badge">${safeSubject} • ${safeGrade}</span>
        <h1>${safeTitle}</h1>
      </div>
      <div class="header-actions">
        <button id="btn-notes-toggle" class="btn-toggle-notes" aria-controls="teacher-notes-container" aria-expanded="false" onclick="toggleTeacherNotes()">
          Notas do Professor
        </button>
        <span style="font-size: 11px; color: #64748b; font-weight: 600;">PEMARA OFFLINE</span>
      </div>
    </div>

    <div id="slide-content" class="scene-box"></div>

    <aside id="teacher-notes-container" class="teacher-notes-panel hidden" aria-labelledby="teacher-notes-title">
      <div class="notes-heading"><strong id="teacher-notes-title">Notas do Professor</strong><button aria-label="Fechar notas do professor" onclick="toggleTeacherNotes()">Fechar</button></div>
      <div id="teacher-notes-text"></div>
    </aside>

    <div class="controls">
      <button id="btn-prev" class="nav-btn" onclick="prevSlide()">Anterior</button>
      <span class="slide-counter" id="slide-num">Slide 1 de ${lesson.scenes.length}</span>
      <button id="btn-next" class="nav-btn" onclick="nextSlide()">Próximo</button>
    </div>
  </div>

  <div id="print-all-slides" class="print-doc-container">
    ${renderAllScenesForPrint(lesson, false)}
  </div>

  <script>
    function escapeHtml(str) {
      if (typeof str !== 'string') return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const scenes = ${scenesJson};
    const biologyFrames = ${safeJsonForScript(biologyFrames)};
    const biologyStyles = ${safeJsonForScript(BIOLOGY_CSS)};
    const learningPlans = ${safeJsonForScript(learningPlans)};
    const mapFrames = ${safeJsonForScript(mapFrames)};
    const comparisonValues = ${safeJsonForScript(comparisonValues)};
    const learningStyles = ${safeJsonForScript(LEARNING_CSS)};
    const learningLessonId = ${safeJsonForScript(lesson.lesson.id)};
    let currentIdx = 0;
    let showNotes = false;
    let activeAnimFrame = null;
    let activeInterval = null;
    let currentStep=0,activeStepMove=null;
    let cleanupModelMotion=()=>{};
    function pageStepCount(index){const scene=scenes[index];return learningPlans[scene.id]?.plan.steps.length || biologyFrames[scene.id]?.[0].length || 1;}
    function updateNavigation(){
      document.getElementById("btn-prev").disabled=currentIdx===0&&currentStep===0;
      document.getElementById("btn-next").disabled=currentIdx===scenes.length-1&&currentStep===pageStepCount(currentIdx)-1;
      document.getElementById("slide-num").innerText="Página "+(currentIdx+1)+" de "+scenes.length+(pageStepCount(currentIdx)>1?" · Etapa "+(currentStep+1)+"/"+pageStepCount(currentIdx):"");
    }

    function cleanupActiveAnimations() {
      cleanupModelMotion();cleanupModelMotion=()=>{};
      cleanupLearningMotion();
      if (activeAnimFrame) {
        cancelAnimationFrame(activeAnimFrame);
        activeAnimFrame = null;
      }
      if (activeInterval) {
        clearInterval(activeInterval);
        activeInterval = null;
      }
    }

    function toggleTeacherNotes() {
      showNotes = !showNotes;
      const notesBtn = document.getElementById('btn-notes-toggle');
      const notesPanel = document.getElementById('teacher-notes-container');
      notesBtn.setAttribute('aria-expanded', String(showNotes));
      if (showNotes) {
        notesBtn.classList.add('active');
        notesPanel.classList.remove('hidden');
        document.body.classList.add('include-notes-print');
      } else {
        notesBtn.classList.remove('active');
        notesPanel.classList.add('hidden');
        document.body.classList.remove('include-notes-print');
      }
    }

    function initFromHash() {
      try {
        const hash = window.location.hash ? window.location.hash.substring(1) : '';
        const params = new URLSearchParams(hash);
        const s = parseInt(params.get('slide') || '', 10);
        if (!isNaN(s) && s >= 1 && s <= scenes.length) {
          currentIdx = s - 1;
        }
        if (params.get('notes') === '1' || params.get('notes') === 'true') {
          showNotes = true;
          document.body.classList.add('include-notes-print');
        }
      } catch (e) {}
    }

    // Renderizadores por tipo de cena
    function renderTitleScene(scene) {
      let h = '<div style="text-align: center; padding: 30px 10px;">';
      if (scene.badge) {
        h += '<span class="badge" style="margin-bottom: 16px;">' + escapeHtml(scene.badge) + '</span>';
      }
      h += '<h2 style="font-size: 32px; font-weight: 900; color: #fff; margin: 12px 0;">' + escapeHtml(scene.title) + '</h2>';
      if (scene.subtitle) {
        h += '<p style="font-size: 18px; color: #94a3b8; max-width: 650px; margin: 0 auto 20px;">' + escapeHtml(scene.subtitle) + '</p>';
      }
      h += '</div>';
      return h;
    }

    function renderTextScene(scene) {
      let h = '<h2>' + escapeHtml(scene.title) + '</h2>';
      if (scene.subtitle) h += '<p style="color: #94a3b8; font-size: 16px;">' + escapeHtml(scene.subtitle) + '</p>';
      if (scene.content) {
        if (Array.isArray(scene.content)) {
          scene.content.forEach(p => { h += '<p>' + escapeHtml(p) + '</p>'; });
        } else {
          h += '<p>' + escapeHtml(scene.content) + '</p>';
        }
      }
      if (scene.bullets && Array.isArray(scene.bullets)) {
        h += '<ul style="margin: 12px 0 16px 20px; color: #cbd5e1;">';
        scene.bullets.forEach(b => { h += '<li style="margin-bottom: 6px;">' + escapeHtml(b) + '</li>'; });
        h += '</ul>';
      }
      if (scene.callout) {
        h += '<div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #fde68a;"><strong>Atenção:</strong> ' + escapeHtml(scene.callout) + '</div>';
      }
      return h;
    }

    function renderMapScene(scene) {
      const frames=mapFrames[scene.id]||[];
      window.selectMapPoint=function(index){const el=document.getElementById('map-content');if(el&&frames[index])el.innerHTML=frames[index];};
      return '<section id="map-content" onclick="var p=event.target.closest(\\'[data-map-point]\\');if(p)selectMapPoint(Number(p.dataset.mapPoint))" onkeydown="event.stopPropagation();if(event.key===\\'Enter\\'||event.key===\\' \\'){var p=event.target.closest(\\'[data-map-point]\\');if(p){event.preventDefault();selectMapPoint(Number(p.dataset.mapPoint));}}">'+(frames[0]||'')+'</section>';
    }

    function renderComparisonScene(scene) {
      const p = scene.params || {};
      const cols = p.columns || ['Critério', 'Coluna 1', 'Coluna 2'];
      const rows = p.rows || [];

      let h = '<h2>' + escapeHtml(scene.title) + '</h2>';
      h += '<div style="overflow-x: auto;">';
      h += '<table id="comparison-table" class="comp-table"><thead><tr>';
      cols.forEach((col, idx) => {
        h += '<th style="' + (idx === 0 ? 'width: 25%;' : '') + '">' + escapeHtml(col) + '</th>';
      });
      h += '</tr></thead><tbody>';

      const colKeys = cols.map(c => (c || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim());

      rows.forEach((r,rowIndex) => {
        h += '<tr>';
        cols.forEach((_, cIdx) => {
          if (cIdx === 0) {
            h += '<td style="font-weight: 700; color: #f59e0b;">' + escapeHtml(r.criteria || '-') + '</td>';
          } else {
            const key = colKeys[cIdx] || '';
            const val = comparisonValues[scene.id]?.[rowIndex]?.[cIdx] ?? '—';
            h += '<td>' + escapeHtml(val) + '</td>';
          }
        });
        h += '</tr>';
      });

      h += '</tbody></table></div>';
      if (p.conclusion) {
        h += '<div class="comp-conclusion"><strong>Conclusão Didática:</strong> ' + escapeHtml(p.conclusion) + '</div>';
      }
      return h;
    }

    function renderTimelineScene(scene) {
      const p = scene.params || {};
      const events = p.events || [];

      let h = '<h2>' + escapeHtml(scene.title) + '</h2>';
      if (p.timeframe_label) {
        h += '<p style="color: #f59e0b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Período: ' + escapeHtml(p.timeframe_label) + '</p>';
      }

      h += '<div class="timeline-nav">';
      events.forEach((ev, i) => {
        h += '<button id="tl-btn-' + i + '" class="timeline-btn ' + (i === 0 ? 'active' : '') + '" onclick="selectTimelineEvent(' + i + ')">' + escapeHtml(ev.year || String(i + 1)) + '</button>';
      });
      h += '</div>';

      const first = events[0] || {};
      h += '<div id="timeline-card" class="timeline-card">';
      h += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
      h += '<span id="tl-card-year" style="font-size: 22px; font-weight: 900; color: #f59e0b; font-family: monospace;">' + escapeHtml(first.year || '') + '</span>';
      h += '<span id="tl-card-tag" class="badge">' + escapeHtml(first.tag || 'Marco Histórico') + '</span>';
      h += '</div>';
      h += '<h4 id="tl-card-title" style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 8px;">' + escapeHtml(first.title || '') + '</h4>';
      h += '<p id="tl-card-desc" style="color: #cbd5e1; font-size: 14px; margin: 0;">' + escapeHtml(first.description || '') + '</p>';
      h += '</div>';

      window.timelineEventsData = events;
      window.selectTimelineEvent = function(idx) {
        const evs = window.timelineEventsData || [];
        evs.forEach((_, i) => {
          const btn = document.getElementById('tl-btn-' + i);
          if (btn) btn.classList.toggle('active', i === idx);
        });
        const ev = evs[idx];
        if (ev) {
          const yEl = document.getElementById('tl-card-year');
          const tEl = document.getElementById('tl-card-tag');
          const titEl = document.getElementById('tl-card-title');
          const dEl = document.getElementById('tl-card-desc');
          if (yEl) yEl.innerText = ev.year || '';
          if (tEl) tEl.innerText = ev.tag || 'Marco';
          if (titEl) titEl.innerText = ev.title || '';
          if (dEl) dEl.innerText = ev.description || '';
        }
      };

      return h;
    }

    function renderProjectileScene(scene) {
      const p = scene.params || {};
      const v0 = typeof p.velocity === 'number' ? p.velocity : 25;
      const angle = typeof p.angle === 'number' ? p.angle : 45;
      const g = typeof p.gravity === 'number' ? p.gravity : 9.81;
      const y0 = typeof p.initial_height === 'number' ? p.initial_height : 0;

      const rad = (angle * Math.PI) / 180;
      const v0x = v0 * Math.cos(rad);
      const v0y = v0 * Math.sin(rad);
      const delta = v0y * v0y + 2 * g * y0;
      const flightTime = g > 0 ? (v0y + Math.sqrt(Math.max(0, delta))) / g : 10;
      const hMax = g > 0 ? y0 + (v0y * v0y) / (2 * g) : y0;
      const xMax = v0x * flightTime;

      let h = '<h2>' + escapeHtml(scene.title) + '</h2>';
      if (scene.pedagogical_focus) {
        h += '<p style="color: #38bdf8; font-size: 13px;">' + escapeHtml(scene.pedagogical_focus) + '</p>';
      }

      h += '<div class="sim-wrap">';
      h += '<svg id="projectile-svg" viewBox="0 0 800 380" style="width: 100%; height: auto; display: block; background: #070d18; border-radius: 10px;">';
      // Eixos
      h += '<line x1="50" y1="330" x2="770" y2="330" stroke="#475569" stroke-width="2" />';
      h += '<line x1="50" y1="30" x2="50" y2="330" stroke="#475569" stroke-width="2" />';
      h += '<text x="760" y="322" fill="#94a3b8" font-size="12" font-weight="bold">X (m)</text>';
      h += '<text x="58" y="45" fill="#94a3b8" font-size="12" font-weight="bold">Y (m)</text>';

      // Escala gráfica
      const scaleXMax = Math.max(20, xMax * 1.15);
      const scaleYMax = Math.max(10, hMax * 1.3);
      const plotW = 700;
      const plotH = 280;

      function toX(x) { return 50 + (x / scaleXMax) * plotW; }
      function toY(y) { return 330 - (y / scaleYMax) * plotH; }

      // Trajetória teórica pontilhada
      let pathD = '';
      const samples = 100;
      for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * flightTime;
        const x = v0x * t;
        const y = Math.max(0, y0 + v0y * t - 0.5 * g * t * t);
        const sx = toX(x);
        const sy = toY(y);
        pathD += (i === 0 ? 'M ' : ' L ') + sx.toFixed(1) + ' ' + sy.toFixed(1);
      }
      h += '<path d="' + pathD + '" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="5 5" opacity="0.6" />';

      // Marcador de altura máxima
      const tApex = g > 0 ? v0y / g : 0;
      const xApex = v0x * tApex;
      h += '<circle cx="' + toX(xApex) + '" cy="' + toY(hMax) + '" r="4" fill="#f59e0b" />';
      h += '<text x="' + toX(xApex) + '" y="' + (toY(hMax) - 8) + '" fill="#f59e0b" font-size="11" text-anchor="middle" font-family="monospace">Hmax = ' + hMax.toFixed(1) + 'm</text>';

      // Marcador de alcance máximo
      h += '<circle cx="' + toX(xMax) + '" cy="' + toY(0) + '" r="4" fill="#10b981" />';
      h += '<text x="' + toX(xMax) + '" y="' + (toY(0) + 18) + '" fill="#10b981" font-size="11" text-anchor="middle" font-family="monospace">Xmax = ' + xMax.toFixed(1) + 'm</text>';

      // Vetores de velocidade e projétil animado
      h += '<line id="vec-vx" x1="' + toX(0) + '" y1="' + toY(y0) + '" x2="' + (toX(0) + v0x * 2) + '" y2="' + toY(y0) + '" stroke="#10b981" stroke-width="2" stroke-linecap="round" />';
      h += '<line id="vec-vy" x1="' + toX(0) + '" y1="' + toY(y0) + '" x2="' + toX(0) + '" y2="' + (toY(y0) - v0y * 2) + '" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />';
      h += '<circle id="proj-ball" cx="' + toX(0) + '" cy="' + toY(y0) + '" r="7" fill="#f43f5e" stroke="#fff" stroke-width="1.5" />';
      h += '</svg>';

      // Controles
      h += '<div class="sim-controls">';
      h += '<button id="proj-btn-play" class="sim-btn" onclick="toggleProjectilePlay()">Iniciar Simulação</button>';
      h += '<button class="sim-btn" onclick="resetProjectile()">Reiniciar</button>';
      h += '<span style="font-size: 12px; color: #94a3b8;">v0 = ' + v0 + ' m/s | θ = ' + angle + '° | g = ' + g + ' m/s²</span>';
      h += '</div>';

      // Telemetria
      h += '<div class="telemetry-grid">';
      h += '<div class="telemetry-item"><div class="telemetry-label">Tempo (s)</div><div id="telem-t" class="telemetry-val">0.00</div></div>';
      h += '<div class="telemetry-item"><div class="telemetry-label">Distância X (m)</div><div id="telem-x" class="telemetry-val">0.00</div></div>';
      h += '<div class="telemetry-item"><div class="telemetry-label">Altura Y (m)</div><div id="telem-y" class="telemetry-val">' + y0.toFixed(2) + '</div></div>';
      h += '<div class="telemetry-item"><div class="telemetry-label">Vx (m/s)</div><div id="telem-vx" class="telemetry-val">' + v0x.toFixed(1) + '</div></div>';
      h += '<div class="telemetry-item"><div class="telemetry-label">Vy (m/s)</div><div id="telem-vy" class="telemetry-val">' + v0y.toFixed(1) + '</div></div>';
      h += '</div>';
      h += '</div>';

      // Variáveis da simulação no escopo window
      window.projectileSim = {
        v0, angle, g, y0, v0x, v0y, flightTime, scaleXMax, scaleYMax, plotW, plotH,
        t: 0, isPlaying: false, lastTime: 0
      };

      window.updateProjSim = function(timestamp) {
        const sim = window.projectileSim;
        if (!sim || !sim.isPlaying) return;
        if (!sim.lastTime) sim.lastTime = timestamp;
        const dt = (timestamp - sim.lastTime) / 1000;
        sim.lastTime = timestamp;
        sim.t += dt;

        if (sim.t >= sim.flightTime) {
          sim.t = sim.flightTime;
          sim.isPlaying = false;
          const playBtn = document.getElementById('proj-btn-play');
          if (playBtn) playBtn.innerText = 'Repetir';
        }

        const curX = sim.v0x * sim.t;
        const curY = Math.max(0, sim.y0 + sim.v0y * sim.t - 0.5 * sim.g * sim.t * sim.t);
        const curVy = sim.v0y - sim.g * sim.t;

        const sx = 50 + (curX / sim.scaleXMax) * sim.plotW;
        const sy = 330 - (curY / sim.scaleYMax) * sim.plotH;

        const ball = document.getElementById('proj-ball');
        const vecVx = document.getElementById('vec-vx');
        const vecVy = document.getElementById('vec-vy');
        if (ball) { ball.setAttribute('cx', sx); ball.setAttribute('cy', sy); }
        if (vecVx) {
          vecVx.setAttribute('x1', sx); vecVx.setAttribute('y1', sy);
          vecVx.setAttribute('x2', sx + sim.v0x * 2); vecVx.setAttribute('y2', sy);
        }
        if (vecVy) {
          vecVy.setAttribute('x1', sx); vecVy.setAttribute('y1', sy);
          vecVy.setAttribute('x2', sx); vecVy.setAttribute('y2', sy - curVy * 2);
        }

        const elT = document.getElementById('telem-t');
        const elX = document.getElementById('telem-x');
        const elY = document.getElementById('telem-y');
        const elVy = document.getElementById('telem-vy');
        if (elT) elT.innerText = sim.t.toFixed(2);
        if (elX) elX.innerText = curX.toFixed(2);
        if (elY) elY.innerText = curY.toFixed(2);
        if (elVy) elVy.innerText = curVy.toFixed(1);

        if (sim.isPlaying) {
          activeAnimFrame = requestAnimationFrame(window.updateProjSim);
        }
      };

      window.toggleProjectilePlay = function() {
        const sim = window.projectileSim;
        if (!sim) return;
        if (sim.t >= sim.flightTime) sim.t = 0;
        sim.isPlaying = !sim.isPlaying;
        if(activeAnimFrame){cancelAnimationFrame(activeAnimFrame);activeAnimFrame=null;}
        sim.lastTime = 0;
        const playBtn = document.getElementById('proj-btn-play');
        if (playBtn) playBtn.innerText = sim.isPlaying ? 'Pausar' : 'Iniciar Simulação';
        if (sim.isPlaying) {
          activeAnimFrame = requestAnimationFrame(window.updateProjSim);
        }
      };

      window.resetProjectile = function() {
        const sim = window.projectileSim;
        if (!sim) return;
        sim.isPlaying = false;
        if(activeAnimFrame){cancelAnimationFrame(activeAnimFrame);activeAnimFrame=null;}
        sim.t = 0;
        sim.lastTime = 0;
        const playBtn = document.getElementById('proj-btn-play');
        if (playBtn) playBtn.innerText = 'Iniciar Simulação';
        const sx = 50;
        const sy = 330 - (sim.y0 / sim.scaleYMax) * sim.plotH;
        const ball = document.getElementById('proj-ball');
        const vecVx = document.getElementById('vec-vx');
        const vecVy = document.getElementById('vec-vy');
        if (ball) { ball.setAttribute('cx', sx); ball.setAttribute('cy', sy); }
        if (vecVx) {
          vecVx.setAttribute('x1', sx); vecVx.setAttribute('y1', sy);
          vecVx.setAttribute('x2', sx + sim.v0x * 2); vecVx.setAttribute('y2', sy);
        }
        if (vecVy) {
          vecVy.setAttribute('x1', sx); vecVy.setAttribute('y1', sy);
          vecVy.setAttribute('x2', sx); vecVy.setAttribute('y2', sy - sim.v0y * 2);
        }
        const elT = document.getElementById('telem-t');
        const elX = document.getElementById('telem-x');
        const elY = document.getElementById('telem-y');
        const elVy = document.getElementById('telem-vy');
        if (elT) elT.innerText = '0.00';
        if (elX) elX.innerText = '0.00';
        if (elY) elY.innerText = sim.y0.toFixed(2);
        if (elVy) elVy.innerText = sim.v0y.toFixed(1);
      };

      return h;
    }

    function renderSolarSystemScene(scene) {
      const p = scene.params || {};
      const focusedPlanet = (p.focused_planet && p.focused_planet !== 'all') ? p.focused_planet : 'Earth';
      const speedMult = (typeof p.speed_multiplier === 'number' && p.speed_multiplier > 0) ? p.speed_multiplier : 1.0;
      const showOrbits = p.show_orbits !== false;
      const showLabels = p.show_labels !== false;
      const showDataCards = p.show_data_cards !== false;
      const scaleMode = p.scale_mode || 'didactic';

      const planets = ${JSON.stringify(Object.values(PLANETS_DATA).map(p=>({id:p.id,name:p.name,r:p.orbitalRadiusDidactic*.8,size:p.relativeSize*.8,period:p.orbitalPeriodDays,color:p.color,dist:p.realDistanceAU+' UA',moons:p.moons,cur:p.curiosity}))).replace(/</g,'\\u003c')};

      let initialIdx = planets.findIndex(pl => pl.id.toLowerCase() === (focusedPlanet || '').toLowerCase());
      if (initialIdx < 0) initialIdx = 2; // Default to Earth

      let h = '<h2>' + escapeHtml(scene.title) + '</h2>';
      h += '<p style="color: #f59e0b; font-size: 13px; font-weight: 700; text-transform: uppercase;">Modelo Heliocêntrico e Órbitas Planetárias</p>';

      // Nota didática explícita sobre a escala
      h += '<div style="background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #fde68a; margin-bottom: 12px;">';
      h += '<strong>Nota didática sobre escala:</strong> Distâncias e tamanhos são adaptados para visualização; este desenho não está em escala proporcional. As fichas apresentam valores de referência de distância e período orbital.';
      h += '</div>';

      h += '<div class="sim-wrap" style="position: relative;">';

      // Barra de telemetria e parâmetros da cena
      h += '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; font-size:12px; color:#94a3b8;">';
      h += '<span>Foco inicial: <strong style="color:#38bdf8;">' + escapeHtml(planets[initialIdx].name) + '</strong> | Velocidade: <strong id="solar-speed-value" style="color:#f59e0b;">' + speedMult + 'x</strong></span>';
      h += '<div style="display:flex; gap:6px;">';
      h += '<button id="btn-solar-pause" class="sim-btn" onclick="toggleSolarPlay()" style="padding:4px 10px; font-size:11px;">'+(matchMedia('(prefers-reduced-motion: reduce)').matches?'Retomar':'Pausar')+'</button>';
      h += '<button class="sim-btn" onclick="resetSolarTime()" style="padding:4px 10px; font-size:11px;">Reiniciar Órbitas</button>';
      h += '</div>';
      h += '</div>';

      {
        h += '<div class="planet-pills">';
        planets.forEach((p, idx) => {
          h += '<button id="solar-pill-' + idx + '" class="planet-pill ' + (idx === initialIdx ? 'active' : '') + '" onclick="selectSolarPlanet(' + idx + ')">';
          h += '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + p.color + '; margin-right:4px;"></span>' + p.name;
          h += '</button>';
        });
        h += '</div>';
      }

      h += '<svg id="solar-svg" viewBox="0 0 700 700" style="width: 100%; max-height: 440px; display: block; margin: 0 auto; background: #030712; border-radius: 12px;">';
      // Sol central
      h += '<circle cx="350" cy="350" r="18" fill="#fbbf24" filter="drop-shadow(0 0 12px #f59e0b)" />';
      h += '<text x="350" y="354" fill="#020617" font-size="9" font-weight="900" text-anchor="middle">SOL</text>';

      // Órbitas e planetas
      planets.forEach((p, idx) => {
        const isFoc = idx === initialIdx;
        {
          h += '<circle class="orbit-path" style="display:'+(showOrbits?'':'none')+'" cx="350" cy="350" r="' + p.r + '" fill="none" stroke="' + (isFoc ? '#38bdf8' : '#1e293b') + '" stroke-width="' + (isFoc ? '1.5' : '1') + '" stroke-dasharray="' + (isFoc ? 'none' : '3 3') + '" />';
        }
        h += '<circle id="solar-planet-' + idx + '" cx="' + (350 + p.r) + '" cy="350" r="' + p.size + '" fill="' + p.color + '" style="cursor:pointer;" onclick="selectSolarPlanet(' + idx + ')" />';
        {
          h += '<text style="display:'+(showLabels?'':'none')+'" id="solar-label-' + idx + '" x="' + (350 + p.r) + '" y="' + (350 + p.size + 10) + '" fill="' + (isFoc ? '#38bdf8' : '#64748b') + '" font-size="9" text-anchor="middle" font-weight="' + (isFoc ? 'bold' : 'normal') + '">' + p.name + '</text>';
        }
      });
      h += '</svg>';

      // Detalhe do planeta
      const activePlanet = planets[initialIdx];
      {
        h += '<div id="solar-card" class="map-detail-card planet-data-card" style="margin-top: 10px;display:'+(showDataCards?'':'none')+'">';
        h += '<h4 id="solar-name" style="font-size: 16px; font-weight: 800; color: ' + activePlanet.color + ';">' + activePlanet.name + '</h4>';
        h += '<p id="solar-info" style="margin: 4px 0; font-size: 13px; color: #cbd5e1;">Distância: ' + activePlanet.dist + ' | Período: ' + activePlanet.period + ' dias | Luas: ' + activePlanet.moons + ' (ref. NASA, out/2026)</p>';
        h += '<p id="solar-curiosity" style="margin: 4px 0; font-size: 12px; color: #fde68a;"><strong>Curiosidade:</strong> ' + activePlanet.cur + '</p>';
        h += '</div>';
      }
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">Velocidade: ';
      [0.5,1,2,5].forEach(speed=>{h+='<button class="sim-btn" data-solar-speed="'+speed+'" aria-pressed="'+(speed===speedMult)+'" onclick="setSolarSpeed('+speed+')">'+speed+'x</button>';});
      [['orbits','Mostrar Órbitas',showOrbits],['labels','Mostrar Rótulos',showLabels],['cards','Mostrar Ficha',showDataCards]].forEach(item=>{h+='<label><input id="solar-toggle-'+item[0]+'" type="checkbox" '+(item[2]?'checked':'')+' onchange="toggleSolarVisibility(this)"> '+item[1]+'</label>';});
      h += '</div></div>';

      window.setSolarSpeed=function(speed){window.solarSpeedMultiplier=speed;document.getElementById('solar-speed-value').textContent=speed+'x';document.querySelectorAll('[data-solar-speed]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.solarSpeed)===speed)));};
      window.toggleSolarVisibility=function(input){const selector=input.id.endsWith('orbits')?'#solar-svg .orbit-path':input.id.endsWith('labels')?'[id^="solar-label-"]':'#solar-card';document.querySelectorAll(selector).forEach(el=>{el.style.display=input.checked?'':'none';});};
      window.solarPlanetsData = planets;
      window.solarElapsedDays = 0;
      window.solarSpeedMultiplier = speedMult;
      window.solarIsPlaying = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      let lastSolarTick=performance.now();
      const solarPreference=matchMedia('(prefers-reduced-motion: reduce)');
      const solarChanged=()=>{if(solarPreference.matches){window.solarIsPlaying=false;const btn=document.getElementById('btn-solar-pause');if(btn)btn.innerText='Retomar';}};
      solarPreference.addEventListener('change',solarChanged);cleanupModelMotion=()=>solarPreference.removeEventListener('change',solarChanged);

      window.selectSolarPlanet = function(idx) {
        const ps = window.solarPlanetsData || [];
        ps.forEach((_, i) => {
          const pill = document.getElementById('solar-pill-' + i);
          if (pill) pill.classList.toggle('active', i === idx);
          const lbl = document.getElementById('solar-label-' + i);
          if (lbl) {
            lbl.setAttribute('fill', i === idx ? '#38bdf8' : '#64748b');
            lbl.setAttribute('font-weight', i === idx ? 'bold' : 'normal');
          }
        });
        const p = ps[idx];
        if (p) {
          const nEl = document.getElementById('solar-name');
          const iEl = document.getElementById('solar-info');
          const cEl = document.getElementById('solar-curiosity');
          if (nEl) { nEl.innerText = p.name; nEl.style.color = p.color; }
          if (iEl) iEl.innerText = 'Distância: ' + p.dist + ' | Período Orbital: ' + p.period + ' dias | Luas: ' + p.moons + ' (ref. NASA, out/2026)';
          if (cEl) cEl.innerHTML = '<strong>Curiosidade:</strong> ' + escapeHtml(p.cur);
        }
      };

      window.toggleSolarPlay = function() {
        lastSolarTick=performance.now();
        window.solarIsPlaying = !window.solarIsPlaying;
        const btn = document.getElementById('btn-solar-pause');
        if (btn) btn.innerText = window.solarIsPlaying ? 'Pausar' : 'Retomar';
      };

      window.resetSolarTime = function() {
        window.solarIsPlaying=false;
        const btn=document.getElementById('btn-solar-pause');if(btn)btn.innerText='Retomar';
        window.solarElapsedDays = 0;
        updateSolarOrbits();
      };

      function updateSolarOrbits() {
        const now=performance.now(),dt=Math.min(100,now-lastSolarTick)/1000;lastSolarTick=now;
        if (window.solarIsPlaying) {
          window.solarElapsedDays += dt * 15 * window.solarSpeedMultiplier;
        }
        const ps = window.solarPlanetsData || [];
        ps.forEach((p, idx) => {
          const el = document.getElementById('solar-planet-' + idx);
          const lbl = document.getElementById('solar-label-' + idx);
          if (!el) return;
          const angle = (window.solarElapsedDays / p.period) * 2 * Math.PI;
          const cx = 350 + Math.cos(angle) * p.r;
          const cy = 350 + Math.sin(angle) * p.r;
          el.setAttribute('cx', cx.toFixed(1));
          el.setAttribute('cy', cy.toFixed(1));
          if (lbl) {
            lbl.setAttribute('x', cx.toFixed(1));
            lbl.setAttribute('y', (cy + p.size + 10).toFixed(1));
          }
        });
      }

      activeInterval = setInterval(updateSolarOrbits, 40);
      return h;
    }

    ${FUNCTION_OFFLINE_RUNTIME}

    function renderQuizScene(scene) {
      let h = '<h2>' + escapeHtml(scene.title) + '</h2>';
      h += '<div style="background: #020617; padding: 20px; border-radius: 14px; border: 1px solid #1e293b; margin: 16px 0;">';
      h += '<p style="font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 16px;">' + escapeHtml(scene.question) + '</p>';

      h += '<div class="quiz-options">';
      const answers = Array.isArray(scene.answers) ? scene.answers : (scene.options || []);
      answers.forEach((ans, i) => {
        h += '<button id="quiz-opt-' + i + '" class="quiz-opt" onclick="checkQuizAnswer(' + i + ')">';
        h += '<strong>' + String.fromCharCode(65 + i) + ')</strong> ' + escapeHtml(ans);
        h += '</button>';
      });
      h += '</div>';

      h += '<div id="quiz-feedback" class="quiz-feedback" style="display: none;"></div>';
      h += '</div>';

      window.quizSceneData = scene;
      window.checkQuizAnswer = function(selectedIdx) {
        const sc = window.quizSceneData;
        const scAnswers = sc && (Array.isArray(sc.answers) ? sc.answers : (sc.options || []));
        if (!scAnswers || !scAnswers.length) return;
        const correctIdx = typeof sc.correct_index === 'number' ? sc.correct_index : 0;

        scAnswers.forEach((_, i) => {
          const btn = document.getElementById('quiz-opt-' + i);
          if (!btn) return;
          btn.disabled = true;
          if (i === correctIdx) {
            btn.classList.add('correct');
          } else if (i === selectedIdx) {
            btn.classList.add('incorrect');
          }
        });

        const fb = document.getElementById('quiz-feedback');
        if (fb) {
          fb.style.display = 'block';
          if (selectedIdx === correctIdx) {
            fb.style.background = '#064e3b';
            fb.style.border = '1px solid #10b981';
            fb.style.color = '#a7f3d0';
            fb.innerHTML = '<strong>Correto!</strong> ' + escapeHtml(sc.explanation || '');
          } else {
            fb.style.background = '#881337';
            fb.style.border = '1px solid #f43f5e';
            fb.style.color = '#fecdd3';
            fb.innerHTML = '<strong>Incorreto.</strong> Resposta correta: Opção ' + String.fromCharCode(65 + correctIdx) + '.<br>' + escapeHtml(sc.explanation || '');
          }
        }
      };

      return h;
    }

    function renderSummaryScene(scene) {
      let h = '<h2>' + escapeHtml(scene.title) + '</h2>';
      if (scene.takeaways && Array.isArray(scene.takeaways)) {
        h += '<div style="display: flex; flex-direction: column; gap: 10px; margin: 16px 0;">';
        scene.takeaways.forEach((t, i) => {
          h += '<div style="background: #020617; border: 1px solid #1e293b; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 8px; color: #cbd5e1;">';
          h += '<strong>Conclusão ' + (i + 1) + ':</strong> ' + escapeHtml(t);
          h += '</div>';
        });
        h += '</div>';
      }
      if (scene.next_steps) {
        h += '<div style="background: rgba(99, 102, 241, 0.1); border: 1px solid #6366f1; border-radius: 10px; padding: 14px 16px; color: #c7d2fe; font-size: 13px;">';
        h += '<strong>Próximos Passos Didáticos:</strong> ' + escapeHtml(scene.next_steps);
        h += '</div>';
      }
      return h;
    }

    function renderBiologyScene(scene, el) {
      let step=currentStep,plant=scene.params.cell_type==='plant',playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
      let allowed=false;
      el.innerHTML='<style>'+biologyStyles+'</style><section class="bio-model"><h2>'+escapeHtml(scene.title)+'</h2><div class="bio-controls"><button data-action="play"></button><button data-action="next">Próxima etapa</button><button data-action="reset">Recomeçar</button>'+(scene.params.model==='cell_structure'?'<button data-action="animal">Célula animal</button><button data-action="plant">Célula vegetal</button>':'')+'</div><div data-frame></div><div class="bio-steps"></div><p class="bio-note">Modelo didático simplificado, sem escala real. Os níveis de organização não representam transformação de uma célula em um organismo.</p></section>';
      const root=el.querySelector('.bio-model');
      const steps=biologyFrames[scene.id][0];
      steps.forEach(function(item,i){const button=document.createElement('button');button.textContent=(i+1)+'. '+item.label;button.onclick=function(){step=i;draw();};root.querySelector('.bio-steps').appendChild(button);});
      function draw(){
        currentStep=step;updateNavigation();
        updatePlayback();
        root.querySelector('[data-frame]').innerHTML=biologyFrames[scene.id][plant?1:0][step].html;
        root.querySelector('[data-action=play]').textContent=playing?'Pausar animação':'Iniciar animação';
        root.querySelectorAll('.bio-steps button').forEach(function(button,i){button.setAttribute('aria-pressed',String(i===step));});
        ['animal','plant'].forEach(function(kind){const button=root.querySelector('[data-action='+kind+']');if(button)button.setAttribute('aria-pressed',String(plant===(kind==='plant')));});
      }
      function updatePlayback(){root.dataset.bioRunning=String(playing);root.dataset.motionAllowed=String(allowed);root.querySelector('[data-action=play]').textContent=playing?'Pausar animação':'Iniciar animação';}
      root.querySelector('[data-action=play]').onclick=function(){allowed=true;playing=!playing;updatePlayback();};
      const bioPreference=matchMedia('(prefers-reduced-motion: reduce)');
      const bioChanged=()=>{if(bioPreference.matches){playing=false;allowed=false;updatePlayback();}};
      bioPreference.addEventListener('change',bioChanged);cleanupModelMotion=()=>bioPreference.removeEventListener('change',bioChanged);
      root.querySelector('[data-action=next]').onclick=function(){step=(step+1)%steps.length;draw();};
      root.querySelector('[data-action=reset]').onclick=function(){playing=false;step=0;draw();};
      ['animal','plant'].forEach(function(kind){const button=root.querySelector('[data-action='+kind+']');if(button)button.onclick=function(){plant=kind==='plant';draw();};});
      activeStepMove=direction=>{const next=step+direction;if(next<0||next>=steps.length)return false;step=next;draw();return true;};
      draw();
    }

    ${LEARNING_OFFLINE_RUNTIME}

    function render() {
      cleanupActiveAnimations();
      activeStepMove=null;
      const scene = scenes[currentIdx];
      const el = document.getElementById('slide-content');
      updateNavigation();
      let html = '';
      switch (scene.type) {
        case 'biology_model':
          break;
        case 'title':
          html = renderTitleScene(scene);
          break;
        case 'text':
          break;
        case 'map':
          html = renderMapScene(scene);
          break;
        case 'comparison':
          html = renderComparisonScene(scene);
          break;
        case 'timeline':
          html = renderTimelineScene(scene);
          break;
        case 'physics_projectile':
          html = renderProjectileScene(scene);
          break;
        case 'solar_system':
          html = renderSolarSystemScene(scene);
          break;
        case 'math_function':
          html = renderMathFunctionScene(scene);
          break;
        case 'quiz':
          html = renderQuizScene(scene);
          break;
        case 'summary':
          break;
        default:
          html = renderTextScene(scene);
          break;
      }
      el.innerHTML = html;
      if (scene.type === 'biology_model') renderBiologyScene(scene, el);
      if (scene.type === 'text' || scene.type === 'summary') renderLearningScene(scene, el);

      // Atualiza o painel de notas do professor
      const notesBtn = document.getElementById('btn-notes-toggle');
      const notesPanel = document.getElementById('teacher-notes-container');
      if (notesBtn && notesPanel) {
        notesBtn.setAttribute('aria-expanded', String(showNotes));
        document.getElementById('teacher-notes-title').textContent = 'Notas do Professor · Página ' + (currentIdx + 1);
        if (showNotes) {
          notesBtn.classList.add('active');
          notesPanel.classList.remove('hidden');
        } else {
          notesBtn.classList.remove('active');
          notesPanel.classList.add('hidden');
        }
        if (scene.teacher_notes) {
          document.getElementById('teacher-notes-text').textContent = scene.teacher_notes;
        } else {
          document.getElementById('teacher-notes-text').textContent = 'Nenhuma nota do professor para esta página.';
        }
      }
    }

    function nextSlide() { if(activeStepMove?.(1))return;if (currentIdx < scenes.length - 1) { currentIdx++;currentStep=0; render(); } }
    function prevSlide() { if(activeStepMove?.(-1))return;if (currentIdx > 0) { currentIdx--;currentStep=pageStepCount(currentIdx)-1; render(); } }

    window.goToSlide = function(idx) {
      if (idx >= 0 && idx < scenes.length) {
        currentIdx = idx;
        render();
      }
    };
    window.toggleTeacherNotes = toggleTeacherNotes;
    window.nextSlide = nextSlide;
    window.prevSlide = prevSlide;

    window.addEventListener('keydown', (e) => {
      if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.target instanceof Element&&(e.target.closest('input,textarea,select,[contenteditable="true"]')||(e.key===' '&&e.target.closest('button,[role="button"]'))))return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') nextSlide();
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') prevSlide();
      if (e.key === 'Home') { currentIdx = 0; currentStep=0; render(); }
      if (e.key === 'End') { currentIdx = scenes.length - 1; currentStep=0; render(); }
      if (e.key === 'n' || e.key === 'N') toggleTeacherNotes();
    });

    initFromHash();
    render();
  </script>
</body>
</html>`;
};

export const ExportModal: React.FC<Props> = ({ lesson, isOpen, onClose }) => {
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [includeTeacherNotes, setIncludeTeacherNotes] = useState<boolean>(false);

  if (!isOpen) return null;

  // 1. Exportação JSON Lesson Spec v1.0
  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(lesson, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pemara-aula-${lesson.lesson.topic.toLowerCase().replace(/\s+/g, '-')}-v${lesson.lesson_version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(lesson, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // 2. Exportação Web Standalone HTML Autossuficiente
  const handleDownloadStandaloneHtml = () => {
    const htmlContent = generateStandaloneHtml(lesson);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pemara-apresentacao-${lesson.lesson.topic.toLowerCase().replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 3. Impressão / Salvar PDF pelo Navegador
  const handlePrint = () => {
    const printHtml = generatePrintDocumentHtml(lesson, { includeTeacherNotes });
    const printBlob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(printBlob);
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        try {
          printWindow.print();
        } catch (e) {
          console.error('Error invoking print dialog', e);
        }
      };
    } else {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `pemara-impressao-${lesson.lesson.topic.toLowerCase().replace(/\s+/g, '-')}.html`;
      a.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-400" />
            <h3 className="text-xl font-bold text-white">Exportar Aula PEMARA</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Opção 1: Apresentação para abrir sem internet */}
          <div
            onClick={handleDownloadStandaloneHtml}
            className="p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-950 border border-indigo-500/30 text-indigo-400 group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Apresentação para abrir sem internet</h4>
                <p className="text-xs text-slate-400">
                  Arquivo único pronto para projetar ou usar em qualquer computador, mesmo sem conexão.
                </p>
              </div>
            </div>
            <Download className="w-4 h-4 text-indigo-400" />
          </div>

          {/* Opção 2: Cópia da aula para importar */}
          <div
            onClick={handleDownloadJson}
            className="p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400 group-hover:scale-110 transition-transform">
                <Code className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Cópia da aula para importar</h4>
                <p className="text-xs text-slate-400">
                  Arquivo com os dados da aula para fazer backup ou compartilhar com outros professores.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyJson();
                }}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200"
                title="Copiar dados da aula"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <Download className="w-4 h-4 text-cyan-400" />
            </div>
          </div>

          {/* Opção 3: Imprimir ou salvar em PDF */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 transition-all flex flex-col gap-3">
            <div
              onClick={handlePrint}
              className="cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-950 border border-amber-500/30 text-amber-400 group-hover:scale-110 transition-transform">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Imprimir ou salvar em PDF</h4>
                  <p className="text-xs text-slate-400">
                    Gera a aula completa com todas as {lesson.scenes.length} cenas diagramadas para folha de papel ou documento PDF.
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-amber-400" />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                id="checkbox-teacher-notes"
                checked={includeTeacherNotes}
                onChange={(e) => setIncludeTeacherNotes(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-400 focus:ring-offset-slate-900 cursor-pointer"
              />
              <label htmlFor="checkbox-teacher-notes" className="text-xs text-slate-300 cursor-pointer select-none">
                Incluir notas pedagógicas do professor na impressão
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
