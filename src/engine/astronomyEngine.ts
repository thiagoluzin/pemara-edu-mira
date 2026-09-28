/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA MOTOR ASTRONÔMICO DIDÁTICO
 * Dados didáticos e cálculos de translação para os planetas do Sistema Solar.
 */

export interface PlanetData {
  id: string;
  name: string;
  color: string;
  glowColor: string;
  orbitalRadiusDidactic: number; // Raio em pixels para tela
  realDistanceAU: number;        // Distância média em Unidades Astronômicas
  orbitalPeriodDays: number;     // Período de translação em dias terrestres
  diameterKm: number;            // Diâmetro em km
  relativeSize: number;          // Tamanho proporcional didático
  rotationHours: number;         // Rotação em torno do próprio eixo
  moons: number;
  highlight: string;
  curiosity: string;
}

export const PLANETS_DATA: Record<string, PlanetData> = {
  Mercury: {
    id: 'Mercury',
    name: 'Mercúrio',
    color: '#a3a3a3',
    glowColor: 'rgba(163, 163, 163, 0.4)',
    orbitalRadiusDidactic: 50,
    realDistanceAU: 0.39,
    orbitalPeriodDays: 88,
    diameterKm: 4879,
    relativeSize: 7,
    rotationHours: 1407,
    moons: 0,
    highlight: 'Planeta mais próximo do Sol e com maior variação térmica.',
    curiosity: 'Um ano em Mercúrio dura apenas 88 dias terrestres!'
  },
  Venus: {
    id: 'Venus',
    name: 'Vênus',
    color: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.4)',
    orbitalRadiusDidactic: 85,
    realDistanceAU: 0.72,
    orbitalPeriodDays: 224.7,
    diameterKm: 12104,
    relativeSize: 11,
    rotationHours: -5832, // Rotação retrógrada
    moons: 0,
    highlight: 'Efeito estufa extremo com atmosfera densa de CO2.',
    curiosity: 'É o planeta mais quente do Sistema Solar, atingindo cerca de 465°C.'
  },
  Earth: {
    id: 'Earth',
    name: 'Terra',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.5)',
    orbitalRadiusDidactic: 125,
    realDistanceAU: 1.0,
    orbitalPeriodDays: 365.25,
    diameterKm: 12742,
    relativeSize: 12,
    rotationHours: 24,
    moons: 1,
    highlight: 'Nosso lar: água líquida, camada de ozônio e vida abundante.',
    curiosity: 'A inclinação do eixo terrestre (23.5°) é a responsável pelas 4 estações do ano.'
  },
  Mars: {
    id: 'Mars',
    name: 'Marte',
    color: '#f87171',
    glowColor: 'rgba(248, 113, 113, 0.4)',
    orbitalRadiusDidactic: 165,
    realDistanceAU: 1.52,
    orbitalPeriodDays: 687,
    diameterKm: 6779,
    relativeSize: 9,
    rotationHours: 24.6,
    moons: 2,
    highlight: 'O Planeta Vermelho, rico em óxido de ferro e com calotas polares.',
    curiosity: 'Abriga o Monte Olimpo, o maior vulcão do Sistema Solar com 22 km de altura!'
  },
  Jupiter: {
    id: 'Jupiter',
    name: 'Júpiter',
    color: '#fb923c',
    glowColor: 'rgba(251, 146, 60, 0.4)',
    orbitalRadiusDidactic: 220,
    realDistanceAU: 5.2,
    orbitalPeriodDays: 4333,
    diameterKm: 139820,
    relativeSize: 24,
    rotationHours: 9.9,
    moons: 95,
    highlight: 'Gigante gasoso com massa maior que todos os outros planetas juntos.',
    curiosity: 'Sua Grande Mancha Vermelha é uma tempestade anticiclônica maior que a Terra.'
  },
  Saturn: {
    id: 'Saturn',
    name: 'Saturno',
    color: '#fef08a',
    glowColor: 'rgba(254, 240, 138, 0.4)',
    orbitalRadiusDidactic: 275,
    realDistanceAU: 9.58,
    orbitalPeriodDays: 10759,
    diameterKm: 116460,
    relativeSize: 20,
    rotationHours: 10.7,
    moons: 146,
    highlight: 'Famoso pelo magnífico sistema de anéis formados por gelo e rocha.',
    curiosity: 'Saturno tem densidade menor que a da água; flutuaria em uma banheira cósmica!'
  },
  Uranus: {
    id: 'Uranus',
    name: 'Urano',
    color: '#67e8f9',
    glowColor: 'rgba(103, 232, 249, 0.4)',
    orbitalRadiusDidactic: 330,
    realDistanceAU: 19.2,
    orbitalPeriodDays: 30687,
    diameterKm: 50724,
    relativeSize: 15,
    rotationHours: -17.2,
    moons: 28,
    highlight: 'Gigante de gelo que gira "deitado", com eixo inclinado a 98°.',
    curiosity: 'Sua cor azul-esverdeada decorre da absorção de luz vermelha pelo gás metano.'
  },
  Neptune: {
    id: 'Neptune',
    name: 'Netuno',
    color: '#60a5fa',
    glowColor: 'rgba(96, 165, 250, 0.4)',
    orbitalRadiusDidactic: 380,
    realDistanceAU: 30.05,
    orbitalPeriodDays: 60190,
    diameterKm: 49244,
    relativeSize: 15,
    rotationHours: 16.1,
    moons: 16,
    highlight: 'Último planeta do Sistema Solar, com ventos supersônicos de até 2.000 km/h.',
    curiosity: 'Foi o primeiro planeta descoberto por predições matemáticas antes de ser visto por telescópio.'
  }
};

export const SUN_DATA = {
  name: 'Sol',
  diameterKm: 1392700,
  temperatureCelsius: 5500,
  type: 'Estrela anã amarela (classe G2V)',
  massPercentage: '99.86% de toda a massa do Sistema Solar'
};
