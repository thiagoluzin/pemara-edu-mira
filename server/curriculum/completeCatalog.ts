import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type pg from 'pg';
import { getOfficialBnccSkills } from '../../scripts/compilar-acervo-bncc';
import { PemaraMaestro } from '../../src/maestro/pemaraMaestro';
import type { Subject } from '../../src/types/lesson';

export interface CurriculumPack {
  slug: string; title: string; subjectCode: Subject; gradeLevel: number;
  skillCodes: string[]; keywords: string[]; objectives: string[]; prerequisites: string[];
  nodes: {slug:string;title:string;shortDescription:string;deepDescription:string;keyPoints:string[];example:string;activity:string;teacherNotes:string}[];
  quiz: {question:string;options:string[];correctIndex:number;explanation:string}[];
  references: {title:string;url:string}[];
}
const digest = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const idFor = (prefix: string, value: string) => `${prefix}-${digest(value).slice(0,32)}`;
export function readCompleteCatalog(directory = path.resolve('server/curriculum/complete')): CurriculumPack[] {
  return ['languages.json','stem.json','humanities.json'].flatMap(file => {
    const content = JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
    if (!Array.isArray(content)) throw new Error(`O arquivo ${file} deve conter uma lista de temas.`);
    return content;
  });
}
export function makePayload(pack: CurriculumPack, version = '1') {
  const sourceId = idFor('src-original',pack.slug);
  return {packId: idFor('pack-ef2',pack.slug), slug:pack.slug, version, title:pack.title, subjectCode:pack.subjectCode, gradeLevel:pack.gradeLevel,
    skillCodes:pack.skillCodes, bnccSkill:pack.skillCodes.join('; '), keywords:pack.keywords, objectives:pack.objectives, prerequisites:pack.prerequisites,
    editorialStatus:'pending_teacher_review', authorship:'Material didático original produzido com assistência de IA; revisão docente independente pendente.',
    nodes:pack.nodes.map(n=>({id:idFor('node-ef2',pack.slug+':'+n.slug+':'+digest(pack)+':'+version),slug:`${(pack.slug+'-'+n.slug).slice(0,92)}-${digest([pack,version]).slice(0,16)}-${digest(n.slug).slice(0,12)}`,title:n.title,type:'concept',short_definition:n.shortDescription,deep_description:n.deepDescription,key_points:n.keyPoints,example:n.example,activity:n.activity,teacherNotes:n.teacherNotes,version:1,source_id:sourceId,license_id:'lic-pemara-original-ef2'})),
    quizzes:pack.quiz.map((q,i)=>({id:`quiz-${i+1}`,question:q.question,options:q.options,correct_index:q.correctIndex,explanation:q.explanation})),
    references:pack.references,
    resources:[{id:idFor('res-ef2',pack.slug+':'+digest(pack)+':'+version),type:'comparison_table',title:'Quadro de conceitos e exemplos',storagePath:`inline://${pack.slug}/concepts`,mimeType:'application/json',metadata_json:{columns:['Conceito','Explicação','Exemplo'],rows:pack.nodes.slice(0,2).map(n=>({criteria:n.title,explicacao:n.shortDescription,exemplo:n.example})),conclusion:'Explique a relação entre cada conceito e seu exemplo.'}}],
    relations:[],
    sources:[{id:sourceId,provider:'PEMARA',title:`Material original: ${pack.title}`,url:null}],
    licenses:[{id:'lic-pemara-original-ef2',code:'Internal',name:'Material original — uso educacional interno'}]
  };
}
export async function validateCompleteCatalog(packs: CurriculumPack[], requireAll = true) {
  const skills = getOfficialBnccSkills();
  const byCode = new Map(skills.map(s=>[s.code,s]));
  const seen = new Set<string>(); const covered = new Set<string>(); const errors: string[] = [];
  for (const p of packs) {
    if (!p || typeof p !== 'object') { errors.push('Tema inválido: objeto ausente.'); continue; }
    const fail = (message:string) => errors.push(`${p.slug}: ${message}`);
    if (!p.slug || p.slug.length>100 || seen.has(p.slug)) fail('Identificador ausente, longo ou duplicado.');
    seen.add(p.slug);
    if (!p.title || !Array.isArray(p.skillCodes) || !p.skillCodes.length) {fail('Título ou habilidades ausentes.');continue;}
    for (const code of p.skillCodes) {
      const skill=byCode.get(code);
      if (!skill || skill.subject_code!==p.subjectCode || skill.grade_level!==p.gradeLevel) fail(`Habilidade incompatível: ${code}`);
      else covered.add(code);
    }
    if (!p.keywords?.length || !p.objectives?.length || !Array.isArray(p.prerequisites)) fail('Metadados pedagógicos incompletos.');
    if (!Array.isArray(p.nodes) || p.nodes.length<3 || p.nodes.some(n=>!n || typeof n!=='object')) {fail('Ao menos três conceitos válidos são necessários.');continue;}
    if (new Set(p.nodes.map(n=>n.slug)).size!==p.nodes.length) fail('Conceitos duplicados.');
    for (const n of p.nodes) if (!n.title || !n.slug || n.deepDescription?.length<100 || !n.keyPoints?.length || !n.example || !n.activity || !n.teacherNotes) fail(`Conceito incompleto: ${n.slug}`);
    if (!Array.isArray(p.quiz) || p.quiz.length<3) {fail('Ao menos três questões são necessárias.');continue;}
    for(const q of p.quiz) if(!q || !q.question || !q.explanation || !Array.isArray(q.options) || q.options.length<3 || new Set(q.options).size!==q.options.length || !Number.isInteger(q.correctIndex) || q.correctIndex<0 || q.correctIndex>=q.options.length) fail('Questão inválida.');
    if (!Array.isArray(p.references) || !p.references.length || p.references.some(r=>!r || !r.title || !/^https?:\/\//.test(r.url))) fail('Referências de apoio ausentes ou inválidas.');
    try {
      await PemaraMaestro.generateLesson({subject:p.subjectCode,grade:`${String(p.gradeLevel)[0]}EF`,topic:p.title,duration_minutes:45,didactic_style:'complete',generation_mode:'MODE_A_NO_AI'},makePayload(p));
    } catch(error) {fail(`Composição rejeitada: ${String(error)}`);}
  }
  const missing = skills.filter(s=>!covered.has(s.code)).map(s=>s.code);
  if(requireAll && missing.length) errors.push(`Sem conteúdo: ${missing.join(', ')}`);
  return {totalSkills:skills.length,linkedSkills:covered.size,topics:packs.length,missing,errors};
}

/** Carga incremental. Não reescreve versões publicadas nem aulas existentes. */
export async function publishCompleteCatalog(pool:pg.Pool,packs:CurriculumPack[], options: {onlyMissing?: boolean;bundledBootstrap?:boolean;onlySlugs?:string[]} = {}) {
  const validation=await validateCompleteCatalog(packs);
  if(validation.errors.length) throw new Error(validation.errors.join('\n'));
  const client=await pool.connect(); let published=0, unchanged=0;
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(7302026)");
    const actor=(await client.query("SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1")).rows[0]?.id ?? null;
    if(!actor&&!options.bundledBootstrap) throw new Error('Administrador responsável não encontrado.');
    await client.query(`INSERT INTO licenses(id,name,code,commercial_use,derivatives_allowed,attribution_required,redistribution_allowed,verified,notes) VALUES('lic-pemara-original-ef2','Material original — uso educacional interno','Internal',false,true,true,false,true,'Redação original assistida; referências são sugestões de consulta, sem reprodução integral de obras externas.') ON CONFLICT(id) DO NOTHING`);
    await client.query(`INSERT INTO sources(id,provider,title,url,language,source_type,status) VALUES('src-bncc-local-reference','MEC — referência curricular','BNCC — habilidades conferidas com o PDF oficial do MEC','https://cdn.mec.gov.br/basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf','pt-BR','official','verified') ON CONFLICT(id) DO NOTHING`);
    for(const skill of getOfficialBnccSkills()) await client.query(`
      INSERT INTO curriculum_skills(id,code,thematic_unit,knowledge_object,description,grade_level,subject_code,source_id,status,version,locator,locator_pdf,verified_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'src-bncc-local-reference','OFFICIAL_BNCC','2018.3',$8,$9,$10)
      ON CONFLICT(code) DO UPDATE SET
        locator=COALESCE(curriculum_skills.locator,EXCLUDED.locator),
        locator_pdf=COALESCE(curriculum_skills.locator_pdf,EXCLUDED.locator_pdf),
        verified_at=COALESCE(curriculum_skills.verified_at,EXCLUDED.verified_at)
      WHERE curriculum_skills.description=EXCLUDED.description
        AND curriculum_skills.grade_level=EXCLUDED.grade_level
        AND curriculum_skills.subject_code=EXCLUDED.subject_code
        AND curriculum_skills.status='OFFICIAL_BNCC'
        AND (curriculum_skills.locator IS NULL OR curriculum_skills.locator_pdf IS NULL OR curriculum_skills.verified_at IS NULL)
    `,[idFor('skill-bncc',skill.code),skill.code,skill.thematic_unit,skill.knowledge_object,skill.description,skill.grade_level,skill.subject_code,skill.locator||null,skill.locator_pdf||null,skill.verified_at||null]);
    for(const pack of packs) {
      if(options.onlySlugs&&!options.onlySlugs.includes(pack.slug))continue;
      const hash=digest(pack);
      const registered=(await client.query('SELECT id,status FROM content_packs WHERE slug=$1',[pack.slug])).rows[0];
      if(registered && (options.onlyMissing || !['ACTIVE','PUBLISHED'].includes(registered.status))) {unchanged++;continue;}
      const current=(await client.query(`SELECT cpv.id,cpv.content_hash,cpv.manifest_json FROM content_pack_versions cpv JOIN content_packs cp ON cp.id=cpv.pack_id WHERE cp.slug=$1 AND cpv.status='PUBLISHED' ORDER BY cpv.published_at DESC NULLS LAST LIMIT 1`,[pack.slug])).rows[0];
      if(current?.content_hash===hash) {unchanged++;continue;}
      // Uma publicação manual ou retirada de publicação não é desfeita pela carga distribuída.
      if(registered && (!current || current.manifest_json?.origin!=='bundled_curriculum')) {unchanged++;continue;}
      if(current && (await client.query(`SELECT 1 FROM content_pack_entity_links el JOIN knowledge_nodes n ON n.id=el.entity_id WHERE el.pack_version_id=$1 AND el.entity_type='knowledge_node' AND n.version<>el.entity_version LIMIT 1`,[current.id])).rowCount) {unchanged++;continue;}

      const packId=registered?.id || idFor('pack-ef2',pack.slug);
      const previous=(await client.query('SELECT version FROM content_pack_versions WHERE pack_id=$1',[packId])).rows;
      const version=String(previous.reduce((max,row)=>Math.max(max,parseInt(row.version,10)||0),0)+1);
      const base=makePayload(pack,version);base.packId=packId;const source=base.sources[0];
      await client.query(`INSERT INTO sources(id,provider,title,language,source_type,status) VALUES($1,'PEMARA',$2,'pt-BR','internal','under_review') ON CONFLICT(id) DO NOTHING`,[source.id,source.title]);
      const nodeVersions:number[]=[];
      for(const [index,node] of base.nodes.entries()) {
        const data={deep_description:node.deep_description,key_points:node.key_points,example:node.example,activity:node.activity,teacherNotes:node.teacherNotes,sequence:index,quizzes:index===0?base.quizzes:[],editorial_status:base.editorialStatus,reference_links:pack.references};
        const result=await client.query(`INSERT INTO knowledge_nodes(id,slug,type,title,short_description,subject_code,grade_level,data_json,language,source_id,license_id,status,version) VALUES($1,$2,'concept',$3,$4,$5,$6,$7::jsonb,'pt-BR',$8,$9,'PUBLISHED',1) ON CONFLICT(id) DO NOTHING RETURNING version`,[node.id,node.slug,node.title,node.short_definition,pack.subjectCode,pack.gradeLevel,JSON.stringify(data),source.id,node.license_id]);
        if(!result.rowCount) throw new Error(`Conteúdo existente preservado: colisão de identificador ${node.id}.`);
        nodeVersions.push(result.rows[0].version);
        for(const code of pack.skillCodes) {
          const link=await client.query(`INSERT INTO curriculum_knowledge_links(id,curriculum_skill_id,knowledge_node_id,priority,required) SELECT $1,id,$2,1,true FROM curriculum_skills WHERE code=$3 ON CONFLICT(curriculum_skill_id,knowledge_node_id) DO NOTHING RETURNING id`,[idFor('link-ef2',code+node.id),node.id,code]);
          if(!link.rowCount && !(await client.query('SELECT 1 FROM curriculum_skills WHERE code=$1',[code])).rowCount) throw new Error(`Habilidade não cadastrada no banco: ${code}`);
        }
        if(index) await client.query(`INSERT INTO knowledge_relations(id,from_node_id,relation_type,to_node_id,status) VALUES($1,$2,'related_to',$3,'ACTIVE') ON CONFLICT DO NOTHING`,[idFor('rel-ef2',base.nodes[0].id+node.id),base.nodes[0].id,node.id]);
      }
      for(const resource of base.resources) {
        await client.query(`INSERT INTO resources(id,type,title,storage_path,mime_type,source_id,license_id,status,metadata_json) VALUES($1,'comparison_table',$2,$3,'application/json',$4,'lic-pemara-original-ef2','ACTIVE',$5::jsonb) ON CONFLICT(id) DO NOTHING`,[resource.id,resource.title,resource.storagePath,source.id,JSON.stringify(resource.metadata_json)]);
        await client.query(`INSERT INTO resource_links(id,resource_id,knowledge_node_id,role) VALUES($1,$2,$3,'comparison') ON CONFLICT DO NOTHING`,[idFor('resource-link',resource.id),resource.id,base.nodes[0].id]);
      }
      await client.query(`INSERT INTO content_packs(id,slug,subject_code,grade_level,topic_node_id,title,status) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE') ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,topic_node_id=EXCLUDED.topic_node_id,status='ACTIVE'`,[packId,pack.slug,pack.subjectCode,pack.gradeLevel,base.nodes[0].id,pack.title]);

      const payload=makePayload(pack,version);payload.packId=packId;payload.nodes.forEach((n,i)=>n.version=nodeVersions[i]);
      const versionId=idFor('version-ef2',pack.slug+':'+version);
      await client.query("UPDATE content_pack_versions SET status='ARCHIVED' WHERE pack_id=$1 AND status='PUBLISHED'",[packId]);
      await client.query(`INSERT INTO content_pack_versions(id,pack_id,version,schema_version,content_hash,manifest_json,payload_json,status,published_at) VALUES($1,$2,$3,'1.0',$4,$5::jsonb,$6::jsonb,'PUBLISHED',CURRENT_TIMESTAMP)`,[versionId,packId,version,hash,JSON.stringify({slug:pack.slug,version,contentHash:hash,hashScope:'authored-curriculum-pack',origin:'bundled_curriculum',nodesCount:payload.nodes.length,editorialStatus:payload.editorialStatus,skillCodes:pack.skillCodes,createdBy:actor}),JSON.stringify(payload)]);
      for(const node of payload.nodes) await client.query("INSERT INTO content_pack_entity_links(id,pack_version_id,entity_type,entity_id,entity_version) VALUES($1,$2,'knowledge_node',$3,$4)",[crypto.randomUUID(),versionId,node.id,node.version]);
      await client.query(`INSERT INTO activity_history(id,entity_type,entity_id,action,actor_id,details_json) VALUES($1,'pack',$2,'PACK_VERSION_PUBLISHED',$3,$4::jsonb)`,[crypto.randomUUID(),packId,actor,JSON.stringify({version,contentHash:hash,editorialStatus:payload.editorialStatus,source:'complete-curriculum'})]);
      published++;
    }
    await client.query('COMMIT');return {...validation,published,unchanged};
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
