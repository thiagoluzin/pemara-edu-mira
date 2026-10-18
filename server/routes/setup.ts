import {Router} from 'express';
import type pg from 'pg';

export function createSetupRouter(_pool: pg.Pool, enabled = process.env.PEMARA_SINGLE_TEACHER === 'true') {
  const router = Router();
  router.get('/', (_req,res) => res.json({required:false,personal:enabled}));
  router.post('/', (_req,res) => res.status(404).json({error:'O acervo local abre diretamente. Não é necessário criar conta.'}));
  return router;
}
