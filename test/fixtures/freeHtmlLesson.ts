export const freeHtmlFixture=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Viagens e encontros</title>
<style>html,body{margin:0;font:22px system-ui;background:#10253b;color:white}section{display:none;padding:32px;box-sizing:border-box;min-height:80vh}section.active{display:block}svg{width:260px;height:160px}.boat{animation:sail 2s infinite alternate}@keyframes sail{to{transform:translateX(60px)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}button{font:inherit;padding:12px}</style>
<script type="application/json" id="pemara-metadata">{"title":"Viagens e encontros","objectives":["Reconhecer que as Américas já eram habitadas."],"teacher_notes":"Pergunte quem já vivia nas Américas. Gabarito: muitos povos indígenas. Exemplo sintético de teste, sem certificação curricular."}</script>
</head><body><main>
<section data-slide class="active"><h1>Quem já vivia aqui?</h1><p>Muitos povos indígenas já viviam nas Américas.</p><svg viewBox="0 0 260 160"><path fill="#4fc8d1" d="M0 120H260V160H0Z"/><g class="boat"><path fill="#db905b" d="M20 95H120L105 120H35Z"/><path fill="#fff" d="M60 90V20L110 90Z"/></g></svg></section>
<section data-slide><h2>Vamos conversar</h2><p>As Américas estavam vazias quando Colombo chegou?</p><div class="answers"><button>Sim</button><button>Não</button></div><p data-answer hidden>Muitos povos indígenas já viviam aqui.</p><p data-teacher-notes>Escute as explicações das crianças.</p></section>
</main><nav><button id="previous">Anterior</button><button id="next">Próximo</button></nav><script>
const slides=[...document.querySelectorAll('[data-slide]')];let current=0;function show(n){current=(n+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle('active',i===current))}
document.getElementById('next').onclick=()=>show(current+1);document.getElementById('previous').onclick=()=>show(current-1);
document.onkeydown=e=>{if(e.key==='ArrowRight')show(current+1);if(e.key==='ArrowLeft')show(current-1)};
document.querySelectorAll('.answers button').forEach(b=>b.onclick=()=>document.querySelector('[data-answer]').hidden=false);
</script></body></html>`;
