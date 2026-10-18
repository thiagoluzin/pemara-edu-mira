import express,{Router} from 'express';
import type pg from 'pg';
import {createHash} from 'node:crypto';
import {requireAuth} from '../auth/middleware';
import {extractInProcess} from '../materials/extractionProcess';
import {materialFromRow,storeMaterial} from '../materials/store';
export function createMaterialsRouter(pool:pg.Pool){
  const router=Router();let importing=false;
  router.use(requireAuth);
  router.get('/',async(req,res)=>{
    try{const rows=await pool.query('SELECT id,filename,sha256,byte_length,created_at FROM teacher_materials WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 200',[req.user!.id]);res.json({materials:rows.rows});}
    catch{res.status(500).json({error:'Não foi possível carregar os materiais.'});}
  });
  router.get('/:id/original',async(req,res)=>{
    try{
      const row=(await pool.query('SELECT filename,sha256,original_base64 FROM teacher_materials WHERE id=$1 AND owner_id=$2',[req.params.id,req.user!.id])).rows[0];
      if(!row)return res.status(404).json({error:'Material não encontrado.'});
      const bytes=Buffer.from(row.original_base64,'base64');
      if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)return res.status(409).json({error:'Integridade do original divergente. Restaure um backup verificado.'});
      res.set('Cache-Control','no-store').attachment(row.filename).send(bytes);
    }catch{res.status(500).json({error:'Não foi possível recuperar o original.'});}
  });
  router.get('/:id',async(req,res)=>{
    try{const row=(await pool.query('SELECT id,filename,sha256,byte_length,extraction_json,created_at FROM teacher_materials WHERE id=$1 AND owner_id=$2',[req.params.id,req.user!.id])).rows[0];
      if(!row)return res.status(404).json({error:'Material não encontrado.'});res.set('Cache-Control','no-store').json({material:materialFromRow(row)});
    }catch{res.status(500).json({error:'Não foi possível recuperar os trechos.'});}
  });
  router.post('/extract',(req,res,next)=>{
    const origin=req.headers.origin;
    if(origin){try{if(new URL(origin).host!==req.get('host'))return res.status(403).json({error:'Origem não autorizada.'});}catch{return res.status(403).json({error:'Origem inválida.'});}}
    if(req.headers['content-type']?.split(';')[0]?.trim()!=='application/octet-stream')return res.status(415).json({error:'Envie um arquivo binário.'});
    if(importing)return res.status(429).json({error:'Já existe uma importação em andamento. Aguarde ou cancele-a antes de tentar novamente.'});
    importing=true;
    res.once('close',()=>{if(!res.locals.extracting)importing=false;});next();
  },express.raw({type:'application/octet-stream',limit:'40mb'}),async(req,res)=>{
    const controller=new AbortController();
    const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
    try{
      const encoded=req.headers['x-filename'];
      if(typeof encoded!=='string'||encoded.length>2048)return res.status(400).json({error:'Nome do arquivo inválido.'});
      let filename:string;try{filename=decodeURIComponent(encoded).split(/[\\/]/).at(-1)!;}catch{return res.status(400).json({error:'Nome do arquivo inválido.'});}
      if(!filename||filename.length>512||/[\x00-\x1f]/.test(filename))return res.status(400).json({error:'Nome do arquivo inválido.'});
      if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Arquivo vazio.'});
      const start=req.headers['x-page-start'],end=req.headers['x-page-end'];
      const pageStart=start===undefined?undefined:Number(start),pageEnd=end===undefined?undefined:Number(end);
      if((pageStart!==undefined&&(!Number.isInteger(pageStart)||pageStart<1))||(pageEnd!==undefined&&(!Number.isInteger(pageEnd)||pageEnd<(pageStart??1))))return res.status(400).json({error:'Intervalo de páginas inválido.'});
      res.locals.extracting=true;
      const material=await extractInProcess(filename,req.body,{pageStart,pageEnd,toolsDir:process.env.PEMARA_OFFLINE_TOOLS_DIR},controller.signal);
      if(controller.signal.aborted)return;
      const stored=await storeMaterial(pool,req.user!.id,req.body,material);
      res.json({material:stored});
    }catch(error){if(!controller.signal.aborted)res.status(422).json({error:error instanceof Error?error.message:'Falha ao importar. O arquivo original continua no seu computador.'});}
    finally{res.off('close',close);importing=false;}
  });
  router.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    importing=false;res.status(error.type==='entity.too.large'?413:400).json({error:error.type==='entity.too.large'?'Arquivo maior que 40 MB.':'Não foi possível receber o documento.'});
  });
  return router;
}
