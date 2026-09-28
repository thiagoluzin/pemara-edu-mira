import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import vm from 'node:vm';
import {prepareMap,mapGeometry,mapSvg,coordinate} from '../src/engine/mapModel';
import {comparisonValue} from '../src/engine/comparisonModel';
import {PemaraRenderer} from '../src/renderer/PemaraRenderer';
import {generateStandaloneHtml,renderAllScenesForPrint} from '../src/components/ExportModal';
import {TEMPLATE_GREECE_6EF} from '../src/templates/deterministicTemplates';
import {validateLessonSpec} from '../src/schemas/lessonValidator';
import type {MapScene,ComparisonScene} from '../src/types/lesson';

const climate:MapScene={id:'climate',type:'map',title:'Mapa dos Tipos Climáticos do Brasil',params:{region_name:'Climas do Brasil, zonas térmicas e biomas',focus_points:[{name:'Zonas Térmicas da Terra',lat:-15.78,lon:-47.92,region:'Brasil',role:'Ponto focal'}]}};
test('Mapa legado de clima: remove falso ponto, usa Brasil e seis localidades, hemisférios e pontos dentro da figura',()=>{
 const fixed=prepareMap(climate);assert.equal(fixed.params.focus_points.length,6);
 const m=mapGeometry(climate);assert.equal(m.highlight,'BRA');assert.ok(m.paths.some(p=>p.code==='BRA'));
 for(const p of m.positions){assert.ok(p.x>0&&p.x<840&&p.y>0&&p.y<460);}
 const html=renderToStaticMarkup(React.createElement(PemaraRenderer,{scene:climate}));
 assert.ok(!/MAR EGEU|Pólis|Papel Histórico|Ponto focal/.test(html));assert.ok(html.includes('Manaus'));
 assert.equal(coordinate(-15.78,'lat'),'15,78°S');assert.equal(coordinate(-47.92,'lon'),'47,92°O');assert.equal(coordinate(0,'lat'),'0,00°');
});
test('Mapas de outras regiões não herdam Grécia e entradas inválidas não produzem NaN nem pontos fora da área',()=>{
 for(const point of [{name:'Tóquio',lat:35.68,lon:139.69},{name:'Sydney',lat:-33.87,lon:151.21},{name:'Atenas',lat:37.98,lon:23.72}]){
 const s:MapScene={id:point.name,type:'map',title:point.name,params:{region_name:point.name,focus_points:[{...point,region:point.name,role:'Localidade'}]}};
 const m=mapGeometry(s);assert.ok(m.positions[0].x>0&&m.positions[0].x<840);assert.ok(m.paths.length>0);assert.ok(!mapSvg(s).includes('NaN'));
 }
 const bad={...climate,params:{...climate.params,focus_points:[{name:'Inválido',lat:120,lon:200,region:'',role:''}]}};
 assert.equal(prepareMap(bad).params.focus_points.length,0);
 const lesson=structuredClone(TEMPLATE_GREECE_6EF);lesson.scenes=[bad];assert.equal(validateLessonSpec(lesson).isValid,false);
});
test('Comparações respeitam todas as colunas e não copiam Esparta para campos desconhecidos',()=>{
 const scene:ComparisonScene={id:'table',type:'comparison',title:'Ciências',params:{columns:['Critério','Água líquida','Gás','Sólido'],rows:[{criteria:'Forma',agua_liquida:'Recipiente',gas:'Ocupa o recipiente',solido:'Definida',esparta:'NÃO COPIAR'}]}};
 const row=scene.params.rows[0];assert.equal(comparisonValue(row,'Água líquida',1),'Recipiente');assert.equal(comparisonValue(row,'Ausente',4),'—');
 const html=renderToStaticMarkup(React.createElement(PemaraRenderer,{scene}));assert.equal((html.match(/<td/g)||[]).length,4);assert.ok(html.includes('Definida'));assert.ok(!html.includes('NÃO COPIAR'));
 const lesson=structuredClone(TEMPLATE_GREECE_6EF);lesson.scenes=[climate,scene];
 const printed=renderAllScenesForPrint(lesson);assert.ok(!printed.includes('NÃO COPIAR'));assert.ok(printed.includes('Manaus'));assert.ok(printed.includes('Definida'));
 const matrix=generateStandaloneHtml(lesson).match(/const comparisonValues = (.*);/)![1];assert.ok(!matrix.includes('NÃO COPIAR'));assert.ok(matrix.includes('Definida'));
 const exported=generateStandaloneHtml(lesson);for(const script of exported.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
});
