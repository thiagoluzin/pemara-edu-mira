import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PemaraRenderer} from '../../src/renderer/PemaraRenderer';
import {PresentationMode} from '../../src/components/PresentationMode';
import {animationCases} from './animation-cases';
import '../../src/index.css';
const selected=animationCases[Number(new URLSearchParams(location.search).get('case'))||0];
function AuditHarness(){
 const [spec,setSpec]=useState(selected.spec);
 useEffect(()=>{const replace=(e:Event)=>setSpec({...selected.spec,scenes:[(e as CustomEvent).detail]});window.addEventListener('audit:scene',replace);return()=>window.removeEventListener('audit:scene',replace);},[]);
 return <main style={{padding:16}} data-audit-ready={selected.id}>{new URLSearchParams(location.search).has('presentation')?<PresentationMode lesson={spec} onClose={()=>{}}/>:<PemaraRenderer scene={spec.scenes[0]} lesson={spec.lesson}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<AuditHarness/>);
