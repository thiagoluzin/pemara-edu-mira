import {functionModel,functionSvg} from './functionModel';
export const FUNCTION_OFFLINE_RUNTIME=`
const functionModel=${functionModel.toString()};
const functionSvg=${functionSvg.toString()};
function renderMathFunctionScene(scene){
 const p={...scene.params};let playing=false;
 const id='math-'+scene.id;
 const markup='<style>'+learningStyles+'</style><section class="learning-canvas" id="'+escapeHtml(id)+'" data-running="false" data-motion-allowed="true"><h2>'+escapeHtml(scene.title)+'</h2><div class="learning-art">'+functionSvg(p)+'</div><p data-analysis>'+escapeHtml(functionModel(p).analysis)+'</p><p class="learning-caption">O ponto percorre a curva para relacionar x e f(x). Velocidade didática; coeficientes fixos durante a reprodução. A escala vertical se ajusta aos valores.</p><div class="learning-actions"><button data-math-play>Reproduzir animação</button><button data-math-reset>Recomeçar</button></div><div class="learning-actions">'+['a','b','c'].filter(k=>p.function_type!=='linear'||k!=='a').map(k=>'<label>Coeficiente '+k+': <span data-value="'+k+'">'+p[k]+'</span><input type="range" aria-label="Coeficiente '+k+'" data-coefficient="'+k+'" min="'+(k==='a'?-5:k==='c'?-10:-8)+'" max="'+(k==='a'?5:k==='c'?10:8)+'" step="0.5" value="'+p[k]+'"></label>').join('')+'</div></section>';
 queueMicrotask(()=>{
  const root=document.getElementById(id);if(!root)return;
  const sync=()=>{root.dataset.running=String(playing);root.querySelector('[data-math-play]').textContent=playing?'Pausar animação':'Reproduzir animação';};
  const draw=()=>{playing=false;sync();root.querySelector('.learning-art').innerHTML=functionSvg(p);root.querySelector('[data-analysis]').textContent=functionModel(p).analysis;};
  root.querySelector('[data-math-play]').onclick=()=>{playing=!playing;sync();};
  root.querySelector('[data-math-reset]').onclick=draw;
  root.querySelectorAll('[data-coefficient]').forEach(input=>{input.oninput=()=>{p[input.dataset.coefficient]=Number(input.value);root.querySelector('[data-value='+input.dataset.coefficient+']').textContent=input.value;draw();};});
 });return markup;
}
`;
