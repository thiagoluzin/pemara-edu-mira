import type { BiologyScene } from '../types/lesson';

// Conteúdo didático explícito, compartilhado pela apresentação e exportação offline.
export const BIOLOGY_STEPS = {
  cell_structure: [
    { title: 'Membrana plasmática', text: 'Delimita a célula e regula as trocas com o ambiente. Os pontos em movimento representam substâncias atravessando a membrana; tamanho e velocidade são ilustrativos.' },
    { title: 'Citoplasma', text: 'Região onde se encontram estruturas celulares e ocorrem muitas reações necessárias à vida. Não é um espaço vazio.' },
    { title: 'Núcleo e material genético', text: 'Nas células eucarióticas mostradas, o núcleo abriga a maior parte do material genético. Bactérias também são células, mas não têm núcleo delimitado por membrana.' },
    { title: 'Estruturas e funções', text: 'Mitocôndrias participam da respiração celular. Células vegetais também têm mitocôndrias; células de partes fotossintéticas possuem cloroplastos. Compare os dois modelos.' },
  ],
  organization: [
    { title: 'Célula muscular cardíaca', text: 'Uma célula especializada pode se contrair. Ela continua tendo membrana, citoplasma e material genético.' },
    { title: 'Tecido muscular cardíaco', text: 'Células organizadas trabalham em conjunto e formam tecidos. No coração, o tecido muscular permite a contração.' },
    { title: 'Órgão: coração', text: 'Diferentes tecidos compõem o coração, órgão que bombeia o sangue. Um órgão não é formado por um único tipo de tecido.' },
    { title: 'Sistema cardiovascular', text: 'Coração e vasos sanguíneos trabalham em conjunto na circulação. O sangue transporta substâncias pelo corpo.' },
    { title: 'Organismo', text: 'No ser humano, um animal multicelular, vários sistemas trabalham de maneira integrada. Há seres unicelulares: esta organização não se aplica a todos os seres vivos.' },
  ],
} as const;

export const BIOLOGY_CSS = `
.bio-model{color:#e2e8f0;background:#020617;border:1px solid #334155;border-radius:18px;padding:18px;box-sizing:border-box;width:100%}
.bio-model h2{font-size:clamp(20px,2.2vw,30px);margin:0 0 10px;line-height:1.2}
.bio-controls,.bio-steps{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.bio-model button{font:inherit;font-size:14px;border:1px solid #475569;border-radius:8px;padding:8px 12px;background:#1e293b;color:#f8fafc;cursor:pointer}
.bio-model button[aria-pressed=true]{background:#0e7490;border-color:#67e8f9}
.bio-model button:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}
.bio-body{display:grid;grid-template-columns:minmax(0,2fr) minmax(220px,1fr);gap:16px;align-items:center}
.bio-drawing{width:100%;min-width:0;display:block;max-height:440px}
.bio-detail{background:#0f172a;border-left:4px solid #22d3ee;padding:16px;border-radius:10px;line-height:1.5;font-size:16px}
.bio-detail h3{font-size:20px;color:#67e8f9;margin:0 0 10px}
.bio-detail p{margin:0}
.bio-note{font-size:13px;line-height:1.4;color:#94a3b8;margin:8px 0 0}
.bio-molecule{animation:bio-exchange 3s linear infinite;animation-play-state:paused;transform-box:fill-box;transform-origin:center}
.bio-heart{animation:bio-beat 1.6s ease-in-out infinite;animation-play-state:paused;transform-box:fill-box;transform-origin:center}
[data-bio-running=true] .bio-molecule,[data-bio-running=true] .bio-heart{animation-play-state:running}
@keyframes bio-exchange{0%{transform:translateX(0);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(115px);opacity:0}}
@keyframes bio-beat{0%,100%{transform:scale(1)}25%{transform:scale(1.06)}45%{transform:scale(1)}}
@media(max-width:850px){.bio-body{grid-template-columns:1fr}.bio-drawing{max-height:300px}.bio-detail{padding:10px;font-size:15px}.bio-detail h3{font-size:18px}}
@media(prefers-reduced-motion:reduce){.bio-molecule,.bio-heart{animation:none!important}}
@media print{.bio-controls,.bio-steps{display:none}.bio-model{break-inside:avoid}.bio-body{grid-template-columns:2fr 1fr}.bio-molecule,.bio-heart{animation:none!important}}
`;

export function biologySvg(model: BiologyScene['params']['model'], step: number, plant = false): string {
  const highlight = (n: number) => step === n ? '#fbbf24' : '#38bdf8';
  const stroke = (n: number) => step === n ? 7 : 3;
  const nucleusX = plant ? 315 : 395;
  const cell = `<g>
    ${plant ? '<rect x="157" y="48" width="480" height="325" rx="45" fill="#14532d" stroke="#86efac" stroke-width="13"/>' : ''}
    ${plant ? `<rect x="172" y="63" width="450" height="295" rx="37"` : '<ellipse cx="395" cy="211" rx="224" ry="153"'} fill="${step===1?'#155e75':'#164e63'}" stroke="${highlight(0)}" stroke-width="${stroke(0)}"/>
    ${plant ? '<rect x="438" y="113" width="136" height="190" rx="40" fill="#0c4a6e" stroke="#7dd3fc" stroke-width="3"/><text x="506" y="220" text-anchor="middle" fill="#e0f2fe" font-size="18">Vacúolo</text>' : ''}
    <circle cx="${nucleusX}" cy="212" r="63" fill="#581c87" stroke="${highlight(2)}" stroke-width="${stroke(2)}"/>
    <path d="M${nucleusX-28} 177 q56 17 0 34 q56 17 0 34 M${nucleusX+27} 177 q-56 17 0 34 q-56 17 0 34" fill="none" stroke="#e9d5ff" stroke-width="4"/>
    ${[ [270,125], [285,303], ...(plant?[]:[[514,260],[490,118]]) ].map(([x,y])=>`<g transform="translate(${x} ${y}) rotate(-20)"><ellipse rx="36" ry="18" fill="#9a3412" stroke="${step===3?'#fbbf24':'#fdba74'}" stroke-width="3"/><path d="M-22 0 l10 -8 9 16 9 -16 10 8" fill="none" stroke="#fed7aa" stroke-width="3"/></g>`).join('')}
    ${plant ? [[220,165],[215,272],[542,88]].map(([x,y])=>`<g transform="translate(${x} ${y})"><ellipse rx="26" ry="16" fill="#15803d" stroke="#bef264" stroke-width="3"/><path d="M-12 -7 v14 M-3 -7 v14 M6 -7 v14" stroke="#bef264" stroke-width="3"/></g>`).join('') : ''}
    ${[0,1,2,3].map(i=>`<circle class="bio-molecule" cx="112" cy="${174+i*23}" r="5" fill="#fbbf24" style="animation-delay:-${i*.7}s"/>`).join('')}
    <path d="M175 145 L105 90" stroke="#67e8f9" stroke-width="2"/><text x="12" y="75" fill="#e2e8f0" font-size="21">Membrana</text>
    <path d="M${nucleusX} 275 L${nucleusX} 395" stroke="#d8b4fe" stroke-width="2"/><text x="${nucleusX}" y="420" text-anchor="middle" fill="#e9d5ff" font-size="21">Núcleo com DNA</text>
    <text x="395" y="30" text-anchor="middle" fill="#e2e8f0" font-size="23">${plant?'Célula vegetal fotossintética':'Célula animal'}</text>
    <text x="${plant?688:667}" y="326" text-anchor="middle" fill="#67e8f9" font-size="19">Citoplasma</text>
    <path d="M580 314 L${plant?641:628} 319" stroke="#67e8f9" stroke-width="2"/>
    ${plant?'<text x="674" y="70" fill="#bbf7d0" font-size="18">Parede</text><text x="674" y="91" fill="#bbf7d0" font-size="18">celular</text><path d="M637 76 L667 76" stroke="#bbf7d0" stroke-width="2"/>':''}
  </g>`;
  const heart = '<path class="bio-heart" d="M-2 35 C-70 -12 -39 -61 -5 -31 C26 -71 76 -22 -2 35Z" fill="#be123c" stroke="#fda4af" stroke-width="3"/>';
  const icons = [
    '<ellipse rx="58" ry="22" fill="#9f1239" stroke="#fda4af" stroke-width="3"/><ellipse rx="10" ry="8" fill="#d8b4fe"/>',
    [-28,0,28].map(y=>`<g transform="translate(0 ${y})"><rect x="-55" y="-10" width="110" height="22" rx="10" fill="#9f1239" stroke="#fda4af"/><ellipse rx="9" ry="6" fill="#d8b4fe"/></g>`).join(''),
    heart,
    '<path d="M0 -56 V70 M0 -30 L-45 5 V55 M0 -30 L45 5 V55 M0 15 L-25 65 M0 15 L25 65" fill="none" stroke="#f87171" stroke-width="7"/><path d="M10 -56 V70 M10 -20 L-35 10 V55 M10 -20 L55 10 V55" fill="none" stroke="#60a5fa" stroke-width="4"/><g transform="translate(2 -29) scale(.38)">'+heart+'</g>',
    '<circle cy="-55" r="18" fill="#fcd34d"/><path d="M0 -28 V27 M-45 5 L0 -23 45 5 M0 27 L-28 77 M0 27 L28 77" fill="none" stroke="#fcd34d" stroke-width="16" stroke-linecap="round"/>',
  ];
  const levels = ['Célula','Tecido','Órgão','Sistema','Organismo'];
  const organization = levels.map((label,i)=>`<g transform="translate(${88+i*154} 210)"><rect x="-71" y="-114" width="142" height="260" rx="20" fill="${step===i?'#164e63':'#0f172a'}" stroke="${step===i?'#fbbf24':'#334155'}" stroke-width="${step===i?4:2}"/>${icons[i]}<text y="119" text-anchor="middle" font-size="20" fill="#f8fafc">${label}</text></g>`).join('');
  return `<svg class="bio-drawing" viewBox="0 0 800 440" role="img" aria-label="${model==='cell_structure'?(plant?'Modelo de célula vegetal':'Modelo de célula animal'):'Células, tecidos, órgãos, sistemas e organismo'}" xmlns="http://www.w3.org/2000/svg">${model==='cell_structure'?cell:organization}</svg>`;
}

export function biologyScenesForSkills(subject: string, skills: string): BiologyScene[] {
  if (subject !== 'science' && subject !== 'biology') return [];
  const codes = new Set(skills.match(/EF\d{2}CI\d{2}/g) || []);
  const models: BiologyScene['params']['model'][] = [];
  if (codes.has('EF06CI05')) models.push('cell_structure');
  if (codes.has('EF06CI06')) models.push('organization');
  return models.map(model => ({ id: `visual-${model}`, type:'biology_model', layout_id:'09_simulation',
    title: model==='cell_structure'?'Explore a célula animal e a vegetal':'Da célula ao organismo',
    params:{model,cell_type:'animal'}, teacher_notes: model==='cell_structure'
      ? 'Peça que a turma compare os modelos. Pause e identifique membrana, citoplasma e núcleo. Explique que o desenho não mostra todas as estruturas nem suas proporções reais.'
      : 'Use o coração como exemplo. Avance por cada nível e explique que a sequência representa organização, não uma célula se transformando em um organismo.' }));
}
