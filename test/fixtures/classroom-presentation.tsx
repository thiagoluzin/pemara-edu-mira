import React from 'react';
import {createRoot} from 'react-dom/client';
import {PresentationMode} from '../../src/components/PresentationMode';
import type {LessonSpec} from '../../src/types/lesson';
import spec from './mixtures-classroom.json';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(<PresentationMode lesson={spec as LessonSpec} initialSceneIndex={1} onClose={()=>{}}/>);
