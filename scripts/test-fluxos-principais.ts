import { CURRICULUM_CATALOG } from '../src/catalog/curriculumCatalog';
import { LessonComposer } from '../src/composer/lessonComposer';
import { generateStandaloneHtml } from '../src/components/ExportModal';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  console.log('--- TESTE DOS FLUXOS PRINCIPAIS NA PORTA 3000 ---');
  
  // 1. Login como professor/admin
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' })
  });
  if (loginRes.status !== 200) throw new Error('Falha no login');
  const cookie = loginRes.headers.get('set-cookie');
  console.log('[1/5] Login autenticado com sucesso (admin).');

  // 2. Coletar os 9 componentes da BNCC
  const components = [
    'portuguese', 'english', 'arts', 'physical_education', 
    'math', 'science', 'history', 'geography', 'religious_education'
  ];

  const samplesDir = path.resolve(process.cwd(), 'docs/evidencias/amostras-aulas');
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true });
  }

  const results: any[] = [];

  for (const subj of components) {
    const topic = CURRICULUM_CATALOG.find(t => t.subject === subj);
    if (!topic) throw new Error('Tópico não encontrado no catálogo para ' + subj);

    // 3. Buscar Content Pack publicado via API na porta 3000
    const packRes = await fetch(`http://127.0.0.1:3000/api/knowledge/packs/${topic.slug}/active`, {
      headers: { 'Cookie': cookie || '' }
    });
    if (packRes.status !== 200) {
      throw new Error(`Falha ao buscar pack ${topic.slug}: status ${packRes.status}`);
    }
    const packData = await packRes.json();
    const payload = packData.version.payload_json;
    if (!payload || !payload.nodes || payload.nodes.length === 0) {
      throw new Error(`Payload vazio para ${topic.slug}`);
    }

    // 4. Compor aula
    const composed = LessonComposer.compose({
      discipline: subj as any,
      grade: topic.gradeNum,
      topic: topic.title,
      duration: 50,
      teaching_method: 'complete'
    }, payload);

    // 5. Salvar aula no banco via API na porta 3000
    const saveRes = await fetch('http://127.0.0.1:3000/api/lessons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie || ''
      },
      body: JSON.stringify({
        title: composed.lesson.title,
        subjectCode: composed.lesson.subject,
        gradeLevel: composed.lesson.grade,
        topic: composed.lesson.topic,
        spec: composed
      })
    });
    if (saveRes.status !== 201) {
      const errBody = await saveRes.text();
      throw new Error(`Falha ao salvar aula de ${subj}: ${saveRes.status} ${errBody}`);
    }
    const savedData = await saveRes.json();

    // 6. Reabrir aula via API
    const reopenRes = await fetch(`http://127.0.0.1:3000/api/lessons/${savedData.lesson.id}`, {
      headers: { 'Cookie': cookie || '' }
    });
    if (reopenRes.status !== 200) {
      throw new Error(`Falha ao reabrir aula ${savedData.lesson.id}`);
    }
    const reopenedData = await reopenRes.json();

    // 7. Exportar para HTML autônomo
    const html = generateStandaloneHtml(composed);
    if (!html || !html.includes('<!DOCTYPE html>')) {
      throw new Error(`Exportação HTML falhou para ${subj}`);
    }

    const htmlPath = path.join(samplesDir, `aula-${subj}-${topic.gradeLevel}.html`);
    const jsonPath = path.join(samplesDir, `aula-${subj}-${topic.gradeLevel}.json`);
    fs.writeFileSync(htmlPath, html, 'utf8');
    fs.writeFileSync(jsonPath, JSON.stringify(composed, null, 2), 'utf8');

    results.push({
      subject: subj,
      grade: topic.gradeLevel,
      title: composed.lesson.title,
      bnccSkill: composed.lesson.bncc_skill,
      scenesCount: composed.scenes.length,
      savedId: savedData.lesson.id,
      htmlBytes: html.length,
      status: 'VERIFIED'
    });

    console.log(`  ✓ [${subj.padEnd(19)}] Pack: ${topic.slug.padEnd(35)} | Cenas: ${composed.scenes.length} | ID: ${savedData.lesson.id} | HTML: ${html.length} B`);
  }

  const summaryPath = path.resolve(process.cwd(), 'docs/evidencias/amostras-aulas/resultado-fluxos-principais.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2), 'utf8');

  console.log('\n[SUCESSO COMPLETO] Todos os 9 componentes BNCC foram compostos, salvos, reabertos e exportados para HTML!');
  console.log(`Evidências salvas em ${summaryPath}`);
}

run().catch(err => {
  console.error('[ERRO]', err);
  process.exit(1);
});
