import {Router} from 'express';
import {requireAuth,requireRole} from '../auth/middleware';
import {AIError} from '../ai/providers';
import {AISettingsStore,aiSettings} from '../ai/settings';
export function createAISettingsRouter(store:AISettingsStore=aiSettings){
 const router=Router();router.use(requireAuth,requireRole('admin'));
 router.use((req,res,next)=>{
  if(req.method!=='GET'&&req.headers.origin){
   try{if(new URL(req.headers.origin).host!==req.get('host'))return res.status(403).json({error:'Origem da solicitação não permitida.'});}catch{return res.status(403).json({error:'Origem inválida.'});}
  }next();
 });
 const fail=(res:any,error:unknown)=>res.status(error instanceof AIError?error.status:500).json({error:error instanceof AIError?error.message:'Não foi possível salvar as configurações de IA.'});
 router.get('/',(_req,res)=>{try{res.json(store.describe());}catch(e){fail(res,e);}});
 router.put('/',(req,res)=>{try{res.json(store.save(req.body));}catch(e){fail(res,e);}});
 router.post('/test',async(req,res)=>{try{res.json(await store.test(req.body));}catch(e){fail(res,e);}});
 router.post('/models',async(req,res)=>{try{res.json(await store.models(req.body));}catch(e){fail(res,e);}});
 router.delete('/:provider/key',(req,res)=>{try{res.json(store.removeKey(req.params.provider));}catch(e){fail(res,e);}});
 return router;
}
