import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {ATLAS} from '../src/animations/atlas';
import {generateStandaloneHtml} from '../src/components/ExportModal';
import {TEMPLATE_SOLAR_SYSTEM} from '../src/templates/deterministicTemplates';
import {launchHeadlessChrome,type CdpSession} from './helpers/cdpBrowser';

const delay=()=>new Promise(r=>setTimeout(r,220));
test('Playback exportado: movimento visível, pausa sem reinício, retomada e controles honestos em 93 variantes', {timeout:300000},async()=>{
  const docs=ATLAS.map(p=>{
    const spec=structuredClone(TEMPLATE_SOLAR_SYSTEM);
    spec.lesson.subject=p.subjects[0] as any;
    spec.scenes=[{id:'motion',type:'text',title:p.name,content:['Primeira ideia. Segunda ideia.'],atlas_model:p.id}];
    return generateStandaloneHtml(spec);
  });
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy',"connect-src 'none'; img-src data:; font-src 'none'; media-src 'none'");
    res.end(docs[Number(req.url?.slice(1))]||docs[0]);
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  let browser:CdpSession|undefined,animated=0,stationary=0;
  try{
    browser=await launchHeadlessChrome(9572);await browser.setViewport(1024,768);
    await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    const read=()=>browser!.evaluate(`(()=>{const lab=document.querySelector('.atlas-lab');if(lab&&lab.dataset.controller!=='native')return [{time:Number(lab.dataset.time)*1000,state:lab.closest('.learning-canvas').dataset.running==='true'?'running':'paused',transform:lab.querySelector('svg').innerHTML}];return Array.from(document.querySelector('.learning-art').getAnimations({subtree:true})).map(a=>({time:a.currentTime,state:a.playState,transform:getComputedStyle(a.effect.target).transform,dash:getComputedStyle(a.effect.target).strokeDashoffset,opacity:getComputedStyle(a.effect.target).opacity,stroke:getComputedStyle(a.effect.target).strokeOpacity,offset:getComputedStyle(a.effect.target).offsetDistance,fill:getComputedStyle(a.effect.target).fill}));})()`);
    for(const [index,profile] of ATLAS.entries()){
      await browser.navigate(`http://127.0.0.1:${(server.address() as any).port}/${index}`);
      for(let variant=0;variant<profile.variants.length;variant++){
        const context=profile.id+' / '+profile.variants[variant];
        await browser.evaluate(`document.querySelectorAll('.learning-variants button')[${variant}].click()`);
        const hasMotion=(await read()).length>0;
        assert.ok(hasMotion,context+' tem animação implementada');
        assert.equal(await browser.evaluate(`document.querySelector('[data-action=play]').getBoundingClientRect().width>0`),hasMotion,context);
        if(!hasMotion){stationary++;assert.ok(await browser.evaluate(`document.body.innerText.includes('Desenho estático')`),context);continue;}
        animated++;
        await browser.evaluate(`if(document.querySelector('.learning-canvas').dataset.running!=='true')document.querySelector('[data-action=play]').click();window.originalMotion=document.querySelector('.learning-art svg')`);
        const before=await read();await delay();let moving=await read();
        const visible=(a:any)=>JSON.stringify([a.transform,a.dash,a.opacity,a.stroke,a.offset,a.fill]);
        for(let retry=0;retry<6&&!moving.some((a:any,i:number)=>visible(a)!==visible(before[i]));retry++){await delay();moving=await read();}
        assert.ok(moving.some((a:any,i:number)=>a.time>before[i].time+50),context+' avança no tempo');
        assert.ok(moving.some((a:any,i:number)=>JSON.stringify([a.transform,a.dash,a.opacity,a.stroke,a.offset,a.fill])!==JSON.stringify([before[i].transform,before[i].dash,before[i].opacity,before[i].stroke,before[i].offset,before[i].fill])),context+' muda o desenho');
        await browser.evaluate(`document.querySelector('[data-action=play]').click()`);await delay();
        assert.equal(await browser.evaluate(`window.originalMotion===document.querySelector('.learning-art svg')`),true,context+' preserva o desenho ao pausar');
        const paused=await read();await delay();assert.deepEqual(await read(),paused,context+' permanece imóvel');
        assert.ok(paused.every((a:any)=>a.state==='paused'),context);
        if(profile.id==='separation'){
          const shot=await browser.screenshot();await delay();assert.equal(await browser.screenshot(),shot,context+' pixels imóveis durante pausa');
        }
        await browser.evaluate(`document.querySelector('[data-action=play]').click()`);await delay();
        assert.equal(await browser.evaluate(`window.originalMotion===document.querySelector('.learning-art svg')`),true,context+' retoma o mesmo desenho');
        const resumed=await read();assert.ok(resumed.some((a:any,i:number)=>a.time>paused[i].time+50),context+' retoma de onde parou');
      }
    }
    // A preference change must not leave an enabled no-op control on screen.
    const separation=ATLAS.findIndex(p=>p.id==='separation');
    await browser.navigate(`http://127.0.0.1:${(server.address() as any).port}/${separation}`);
    await browser.evaluate(`document.querySelectorAll('.learning-variants button')[3].click()`);
    await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await delay();
    assert.equal(await browser.evaluate(`document.querySelector('[data-action=play]').hidden`),false);
    const preferencePaused=await read();await delay();assert.deepEqual(await read(),preferencePaused,'Preferência congela também a geometria controlada por JavaScript');
    assert.ok(await browser.evaluate(`document.body.innerText.includes('Movimento reduzido neste dispositivo')`));
    await browser.evaluate(`document.querySelector('[data-action=play]').click()`);await delay();
    const explicit=await read();assert.ok(explicit.length>0);await delay();
    assert.ok((await read()).some((a:any,i:number)=>a.time>explicit[i].time+50),'O clique explícito funciona mesmo com movimento reduzido');
    await browser.evaluate(`document.querySelector('[data-action=play]').click()`);await delay();
    const reducedPaused=await read();await delay();assert.deepEqual(await read(),reducedPaused);
    await browser.evaluate(`document.querySelectorAll('.learning-variants button')[1].click()`);
    const otherPaused=await read();await delay();assert.deepEqual(await read(),otherPaused,'Outro desenho volta à preferência de movimento reduzido');assert.ok(otherPaused.every((a:any)=>a.state==='paused'));
    await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await delay();
    assert.equal(await browser.evaluate(`document.querySelector('[data-action=play]').hidden`),false);
    assert.equal(await browser.evaluate(`document.querySelector('[data-action=play]').textContent`),'Reproduzir animação');
    console.log(JSON.stringify({animated,stationary,total:animated+stationary}));
  }finally{await browser?.close();await new Promise<void>(r=>server.close(()=>r()));}
});
