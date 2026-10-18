import type pg from 'pg';
import {createHash,randomUUID} from 'node:crypto';
import type {ExtractedMaterial,StoredMaterial} from '../../src/types/material';
export const materialFromRow=(row:any):StoredMaterial=>({...row.extraction_json,id:row.id,sha256:row.sha256,filename:row.filename,byteLength:row.byte_length,createdAt:new Date(row.created_at).toISOString()});
export async function storeMaterial(pool:pg.Pool,owner:string,bytes:Buffer,material:ExtractedMaterial){
  const id=randomUUID(),sha=createHash('sha256').update(bytes).digest('hex');
  const result=await pool.query('INSERT INTO teacher_materials (id,owner_id,filename,sha256,byte_length,original_base64,extraction_json) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,filename,sha256,byte_length,extraction_json,created_at',
    [id,owner,material.filename,sha,bytes.length,bytes.toString('base64'),JSON.stringify(material)]);
  return materialFromRow(result.rows[0]);
}
