/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA MOTOR DE FÍSICA DETERMINÍSTICO
 * Implementa equações reais de cinemática Newtoniana
 * Nenhuma IA decide trajetória.
 */

import { ProjectileParams } from '../types/lesson';

export interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vTotal: number;
}

export interface ProjectileTelemetry {
  flightTime: number;      // Tempo total de voo (s)
  maxHeight: number;       // Altura máxima Hmax (m)
  maxRange: number;        // Alcance horizontal total Xmax (m)
  timeToPeak: number;      // Tempo para atingir ápice (s)
  v0x: number;             // Velocidade horizontal constante (m/s)
  v0y: number;             // Velocidade vertical inicial (m/s)
  trajectoryPoints: TrajectoryPoint[];
}

/**
 * Calcula a telemetria física exata do lançamento oblíquo
 */
export function calculateProjectileTelemetry(params: ProjectileParams, samples = 150): ProjectileTelemetry {
  const { velocity: v0, angle, gravity: g, initial_height = 0 } = params;
  
  const rad = (angle * Math.PI) / 180;
  const v0x = v0 * Math.cos(rad);
  const v0y = v0 * Math.sin(rad);

  // Tempo para o ponto mais alto: Vy = 0 => v0y - g*t = 0
  const timeToPeak = g > 0 ? v0y / g : 0;
  
  // Altura máxima: H = y0 + (v0y^2) / (2g)
  const maxHeight = g > 0 ? initial_height + (v0y * v0y) / (2 * g) : initial_height;

  // Tempo de voo até o solo (y = 0):
  // 0 = initial_height + v0y*t - 0.5*g*t^2
  // 0.5*g*t^2 - v0y*t - initial_height = 0
  let flightTime = 0;
  if (g > 0) {
    const delta = v0y * v0y + 2 * g * initial_height;
    flightTime = (v0y + Math.sqrt(Math.max(0, delta))) / g;
  } else {
    flightTime = 10;
  }

  // Alcance horizontal total
  const maxRange = v0x * flightTime;

  // Gerar pontos da trajetória para rastro e renderização vetorial
  const trajectoryPoints: TrajectoryPoint[] = [];
  const dt = flightTime / Math.max(1, samples);

  for (let i = 0; i <= samples; i++) {
    const t = Math.min(flightTime, i * dt);
    const x = v0x * t;
    const y = Math.max(0, initial_height + v0y * t - 0.5 * g * t * t);
    const vx = v0x;
    const vy = v0y - g * t;
    const vTotal = Math.sqrt(vx * vx + vy * vy);

    trajectoryPoints.push({ t, x, y, vx, vy, vTotal });
  }

  return {
    flightTime,
    maxHeight,
    maxRange,
    timeToPeak,
    v0x,
    v0y,
    trajectoryPoints
  };
}

/**
 * Posição e velocidades exatas em um dado instante t
 */
export function getProjectileStateAt(params: ProjectileParams, t: number) {
  const { velocity: v0, angle, gravity: g, initial_height = 0 } = params;
  const rad = (angle * Math.PI) / 180;
  const v0x = v0 * Math.cos(rad);
  const v0y = v0 * Math.sin(rad);

  const delta = v0y * v0y + 2 * g * initial_height;
  const flightTime = g > 0 ? (v0y + Math.sqrt(Math.max(0, delta))) / g : 10;
  const clampedT = Math.max(0, Math.min(flightTime, t));

  const x = v0x * clampedT;
  const y = Math.max(0, initial_height + v0y * clampedT - 0.5 * g * clampedT * clampedT);
  const vx = v0x;
  const vy = v0y - g * clampedT;
  const vTotal = Math.sqrt(vx * vx + vy * vy);

  return {
    t: clampedT,
    x,
    y,
    vx,
    vy,
    vTotal,
    isLanded: clampedT >= flightTime,
    flightTime
  };
}
