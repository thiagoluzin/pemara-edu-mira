import React from 'react';
import {isPedagogicalTeam,type PedagogicalTeamResult} from '../education/teachingAgents';

export function PedagogicalReviewPanel({team,scenes=[]}:{team?:PedagogicalTeamResult;scenes?:{id:string;title:string}[]}) {
  if (!isPedagogicalTeam(team)) return null;
  return <section aria-label="Pareceres da equipe pedagógica" className="rounded-xl border border-cyan-800 bg-slate-900 p-4 space-y-3">
    <h2 className="font-semibold text-cyan-200">Equipe pedagógica · {team.teacher_name}</h2>
    <p className="text-sm text-slate-300">{team.reviews.length ? 'Pareceres sobre a versão gerada. Alterações posteriores precisam de nova revisão docente.' : 'Aula criada com perfil especialista. Revisão por outros agentes não foi solicitada.'} Revise antes de usar em turma.</p>
    {team.reviews.map(report=><details key={report.agent_id} className="border-t border-slate-700 pt-2" open={report.verdict==='attention'}>
      <summary className="cursor-pointer font-medium">{report.agent_name} — {report.verdict==='attention'?`${report.findings.length} ${report.findings.length===1?'apontamento':'apontamentos'}`:'Nenhum problema apontado'}</summary>
      <p className="text-xs text-slate-400 mt-2">Modelo: {report.model} · {new Date(report.reviewed_at).toLocaleString('pt-BR')}</p>
      <ul className="space-y-3 mt-2 text-sm">{report.findings.map((finding,index)=>{
        const position=scenes.findIndex(scene=>scene.id===finding.scene_id);
        const label=finding.scene_id==='lesson'?'Aula':position<0?`Cena ${finding.scene_id}`:`Cena ${position+1} — ${scenes[position].title}`;
        return <li key={index}><p><strong>{label}:</strong> {finding.problem}</p><p className="text-slate-300">Sugestão: {finding.suggestion}</p></li>;
      })}</ul>
    </details>)}
    <p className="text-xs text-slate-400">Os pareceres de IA podem conter erros e não substituem a conferência de conteúdo, fontes e adequação à turma pelo professor.</p>
  </section>;
}
