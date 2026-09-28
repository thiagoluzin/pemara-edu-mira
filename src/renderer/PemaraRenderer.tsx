import type {PresentationStep} from '../engine/presentationNavigation';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA RENDER ENGINE — O MOTOR PRINCIPAL DE RENDERIZAÇÃO
 * Recebe o `lesson.json` validado e renderiza qualquer tipo de cena com 60 FPS
 * Conforme Layouts Aprovados V1 (01_title a 11_summary)
 */

import React from 'react';
import { Scene, LessonMeta } from '../types/lesson';
import { PemaraLearning } from './components/PemaraLearning';
import { PemaraTitle } from './components/PemaraTitle';
import { PemaraMap } from './components/PemaraMap';
import { PemaraComparison } from './components/PemaraComparison';
import { PemaraProjectile } from './components/PemaraProjectile';
import { PemaraOrbit } from './components/PemaraOrbit';
import { PemaraFunctionGraph } from './components/PemaraFunctionGraph';
import { PemaraTimeline } from './components/PemaraTimeline';
import { PemaraQuiz } from './components/PemaraQuiz';
import { PemaraBiology } from './components/PemaraBiology';

interface Props {
  presentationStep?:PresentationStep;
  lesson?: LessonMeta;
  scene: Scene;
  onSceneParamChange?: (updatedScene: Scene) => void;
}

export const PemaraRenderer: React.FC<Props> = ({ scene, lesson, onSceneParamChange, presentationStep }) => {
  if (!scene) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
        Nenhuma cena carregada no renderizador.
      </div>
    );
  }

  switch (scene.type) {
    case 'biology_model':
      return <PemaraBiology presentationStep={presentationStep} key={scene.id} scene={scene} />;
    case 'title':
      return <PemaraTitle scene={scene} />;

    case 'text':
      return <PemaraLearning presentationStep={presentationStep} key={scene.id} scene={scene} lesson={lesson} onChange={onSceneParamChange} />;

    case 'map':
      return <PemaraMap key={scene.id} scene={scene} />;

    case 'comparison':
      return <PemaraComparison key={scene.id} scene={scene} />;

    case 'summary':
      return <PemaraLearning presentationStep={presentationStep} key={scene.id} scene={scene} lesson={lesson} onChange={onSceneParamChange} />;

    case 'physics_projectile':
      return (
        <PemaraProjectile key={scene.id}
          scene={scene}
          onParamsChange={(newParams) => {
            if (onSceneParamChange) {
              onSceneParamChange({ ...scene, params: newParams });
            }
          }}
        />
      );

    case 'solar_system':
      return (
        <PemaraOrbit key={scene.id}
          scene={scene}
          onParamsChange={(newParams) => {
            if (onSceneParamChange) {
              onSceneParamChange({ ...scene, params: newParams });
            }
          }}
        />
      );

    case 'math_function':
      return (
        <PemaraFunctionGraph key={scene.id}
          scene={scene}
          onParamsChange={(newParams) => {
            if (onSceneParamChange) {
              onSceneParamChange({ ...scene, params: newParams });
            }
          }}
        />
      );

    case 'timeline':
      return <PemaraTimeline key={scene.id} scene={scene} />;

    case 'quiz':
      return <PemaraQuiz key={scene.id} scene={scene} />;

    default:
      return (
        <div className="p-8 text-center text-amber-400 bg-slate-900 rounded-2xl border border-amber-500/30">
          Tipo de cena não suportado: {(scene as any).type}
        </div>
      );
  }
};
