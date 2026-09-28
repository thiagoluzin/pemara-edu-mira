import land from '../data/world-land.json';
import type {MapScene,MapFocusPoint} from '../types/lesson';
const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const validMapPoint=(p:MapFocusPoint)=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
export function coordinate(value:number,axis:'lat'|'lon') {return `${Math.abs(value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}°${value===0?'':axis==='lat'?(value<0?'S':'N'):(value<0?'O':'L')}`;}
const climates:MapFocusPoint[]=[
 {name:'Manaus • Equatorial',lat:-3.12,lon:-60.02,region:'Amazonas',role:'Temperaturas elevadas e chuvas abundantes ao longo do ano, com variação sazonal.'},
 {name:'Goiânia • Tropical',lat:-16.68,lon:-49.25,region:'Goiás',role:'Verão chuvoso e inverno mais seco. A sazonalidade das chuvas é uma característica importante.'},
 {name:'Petrolina • Semiárido',lat:-9.39,lon:-40.50,region:'Pernambuco',role:'Chuvas escassas e irregulares; temperaturas elevadas e evaporação intensa.'},
 {name:'Recife • Tropical atlântico',lat:-8.05,lon:-34.88,region:'Pernambuco',role:'Influência da umidade oceânica; no litoral oriental do Nordeste as chuvas se concentram no outono e inverno.'},
 {name:'Campos do Jordão • Tropical de altitude',lat:-22.74,lon:-45.59,region:'São Paulo',role:'A altitude reduz as temperaturas. Verões mais chuvosos e invernos frios e mais secos.'},
 {name:'Porto Alegre • Subtropical',lat:-30.03,lon:-51.23,region:'Rio Grande do Sul',role:'Maior variação anual de temperatura e chuvas distribuídas ao longo do ano.'},
];
export function prepareMap(scene:MapScene):MapScene {
 const params=scene.params||{region_name:scene.title,focus_points:[]};
 const raw=Array.isArray(params.focus_points)?params.focus_points:[];
 const fake=raw.length===1&&raw[0].role==='Ponto focal'&&raw[0].lat===-15.78&&raw[0].lon===-47.92;
 const climate=/clima/.test(clean(scene.title+' '+params.region_name))&&/brasil/.test(clean(scene.title+' '+params.region_name));
 if(climate&&(!raw.length||fake))return {...scene,title:'Climas do Brasil: localidades de referência',params:{region_name:'Brasil',focus_points:climates,historical_notes:'Exemplos didáticos de tipos climáticos. Os pontos não delimitam zonas climáticas nem biomas; há transições e diferentes classificações. Referência conceitual: Atlas Geográfico Escolar do IBGE.'}};
 return {...scene,params:{...params,region_name:params.region_name||'Localização geográfica',focus_points:fake?[]:raw.filter(validMapPoint)}};
}
export function mapGeometry(input:MapScene){
 const scene=prepareMap(input),points=scene.params.focus_points;
 const scope=clean(scene.params.region_name+' '+scene.title);
 const brazil=/brasil/.test(scope),greece=/grecia|egeu|balcan|atenas|esparta/.test(scope);
 let west=-180,east=180,south=-85,north=85;
 if(brazil){west=-76;east=-32;south=-35;north=7;}
 else if(greece){west=19;east=29;south=34;north=43;}
 else if(points.length){west=Math.min(...points.map(p=>p.lon))-4;east=Math.max(...points.map(p=>p.lon))+4;south=Math.max(-90,Math.min(...points.map(p=>p.lat))-4);north=Math.min(90,Math.max(...points.map(p=>p.lat))+4);}
 if(points.length){west=Math.max(-180,Math.min(west,...points.map(p=>p.lon-1)));east=Math.min(180,Math.max(east,...points.map(p=>p.lon+1)));south=Math.max(-90,Math.min(south,...points.map(p=>p.lat-1)));north=Math.min(90,Math.max(north,...points.map(p=>p.lat+1)));}
 const aspect=Math.max(.2,Math.cos((north+south)/2*Math.PI/180));
 const scale=Math.min(720/((east-west)*aspect),380/(north-south));
 const x=(lon:number)=>420+(lon-(east+west)/2)*aspect*scale;
 const y=(lat:number)=>230- (lat-(north+south)/2)*scale;
 const paths=land.map(f=>{const rings=f.rings.filter(r=>Math.max(...r.map(p=>p[0]))>=west&&Math.min(...r.map(p=>p[0]))<=east&&Math.max(...r.map(p=>p[1]))>=south&&Math.min(...r.map(p=>p[1]))<=north);return {code:f.code,d:rings.map(r=>r.map((p,i)=>`${i?'L':'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')+'Z').join(' ')};}).filter(f=>f.d);
 return {scene,points,paths,positions:points.map(p=>({x:x(p.lon),y:y(p.lat)})),highlight:brazil?'BRA':greece?'GRC':''};
}
export function mapSvg(input:MapScene,selected=0){
 const m=mapGeometry(input);
 return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa de localização: ${esc(m.scene.params.region_name)}" viewBox="0 0 840 460" style="display:block;width:100%;max-height:440px;background:#081426;border-radius:12px;overflow:hidden"><rect width="840" height="460" fill="#081426"/>${m.paths.map(p=>`<path d="${p.d}" fill="${p.code===m.highlight?'#155e75':'#26364a'}" stroke="#64748b" stroke-width="1" fill-rule="evenodd"/>`).join('')}<text x="24" y="30" fill="#67e8f9" font-size="17">↑ N</text>${m.positions.map((p,i)=>`<g role="button" tabindex="0" data-map-point="${i}" aria-label="${esc(m.points[i].name)}" style="cursor:pointer"><circle cx="${p.x}" cy="${p.y}" r="${i===selected?14:11}" fill="${i===selected?'#fbbf24':'#22d3ee'}" stroke="#fff" stroke-width="2"/><text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="12" font-weight="bold" fill="#020617">${i+1}</text></g>`).join('')}<text x="20" y="446" font-size="12" fill="#cbd5e1">Natural Earth • base generalizada • norte para cima</text></svg>`;
}
export function mapHtml(input:MapScene,selected=0){const s=prepareMap(input),p=s.params.focus_points[selected];return `<h2>${esc(s.title)}</h2>${mapSvg(s,selected)}<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">${s.params.focus_points.map((p,i)=>`<button data-map-point="${i}" aria-pressed="${i===selected}" onclick="selectMapPoint(${i})">${i+1}. ${esc(p.name)}</button>`).join('')}</div>${p?`<h3>${esc(p.name)}</h3><p>${esc(p.region)} • ${coordinate(p.lat,'lat')} / ${coordinate(p.lon,'lon')}</p><p>${esc(p.role)}</p>`:'<p>Este recurso não contém localidades com coordenadas válidas. Nenhum ponto foi inventado.</p>'}<p>${esc(s.params.historical_notes||'Base de localização contemporânea. Não representa fronteiras históricas ou áreas temáticas.')}</p>`;}
