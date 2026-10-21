import {prepareMap} from '../engine/mapModel';
import {contextFromPack} from '../education/lessonContext';
import { gradeLabel } from '../ui/labels';
import { biologyScenesForSkills } from '../engine/biologyModel';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA LESSON COMPOSER DETERMINÍSTICO (Sem IA)
 * Converte Content Packs + Método Pedagógico em sequência de lesson.json estruturada.
 * Suporta todos os 9 componentes da BNCC do Ensino Fundamental II a partir
 * de pacotes publicados no banco de dados relacional ou das fixtures canônicas.
 */

import { LessonSpec, Scene, Subject } from '../types/lesson';
import { CONTENT_PACK_GRECIA_ANTIGA } from '../knowledge/packs/history6Greece';
import { VisualValidator } from '../validator/visualValidator';
import { ApprovedLayoutId } from '../design-system/tokens';
import { matchPilotCatalog } from '../catalog/pilotCatalog';
import { isGradeCompatible, resolvePackSlugForInput } from '../catalog/curriculumCatalog';

export interface ComposerInput {
  discipline: Subject;
  grade: number | string;
  topic: string;
  duration: number;
  teaching_method: 'visual' | 'summary' | 'review' | 'exercises' | 'complete';
}

export class LessonComposer {
  /**
   * Compõe a aula a partir do Knowledge Core determinístico
   */
  public static compose(input: ComposerInput, dynamicPack?: any): LessonSpec {
    if (dynamicPack) {
      const requestedGrade = /EF|EM$/i.test(String(input.grade)) ? String(input.grade) : `${input.grade}EF`;
      const packGrade = /EF|EM$/i.test(String(dynamicPack.gradeLevel)) ? String(dynamicPack.gradeLevel) : `${dynamicPack.gradeLevel}EF`;
      if (dynamicPack.subjectCode !== input.discipline || !isGradeCompatible(requestedGrade, packGrade)) {
        throw new Error('O conteúdo selecionado não corresponde à disciplina e ao ano solicitados.');
      }
      const matchedSlug = resolvePackSlugForInput(input.discipline, requestedGrade, input.topic, [{
        id: dynamicPack.slug, slug: dynamicPack.slug, subject: dynamicPack.subjectCode,
        subjectLabel: '', gradeLevel: packGrade, gradeNum: Number(dynamicPack.gradeLevel),
        title: dynamicPack.title, bnccSkill: dynamicPack.bnccSkill || '', isPublished: true, statusLabel: 'Publicado'
      }]);
      if (!matchedSlug) throw new Error('O assunto solicitado não corresponde ao conteúdo selecionado.');
      if (!Array.isArray(dynamicPack.nodes) || !dynamicPack.nodes.length || dynamicPack.nodes.some((n: any) => !n.title || !(n.deep_description || n.short_definition))) {
        throw new Error('O conteúdo selecionado está incompleto. Revise os conceitos antes de gerar a aula.');
      }
      const pilot = matchPilotCatalog(input.discipline, input.topic, requestedGrade);
      if (dynamicPack.slug === 'history-6-grecia-antiga' && pilot.demo?.id === dynamicPack.slug) {
        return this.composeGreecePilot(input, dynamicPack);
      }
      if (!Array.isArray(dynamicPack.quizzes) || !dynamicPack.quizzes.length || dynamicPack.quizzes.some((q: any) => {
        const options = q.options || q.answers;
        const index = q.correct_index ?? q.correctIndex;
        return !q.question || !q.explanation || !Array.isArray(options) || options.length < 2 || options.some((o: any) => typeof o !== 'string' || !o.trim()) || !Number.isInteger(index) || index < 0 || index >= options.length;
      })) {
        throw new Error('O conteúdo precisa de perguntas completas, com alternativas, resposta correta e explicação.');
      }
      return this.composeFromDynamicPack(input, dynamicPack);
    }
    const grade = /EF|EM$/i.test(String(input.grade)) ? String(input.grade) : `${input.grade}EF`;
    const match = matchPilotCatalog(input.discipline, input.topic, grade);
    if (!match.isSupported || match.demo?.id !== 'history-6-grecia-antiga') {
      throw new Error(match.error || 'Não há conteúdo publicado para o tema e ano solicitados.');
    }
    return this.composeGreecePilot(input);
  }

  /**
   * Compõe a aula dinamicamente para QUALQUER um dos 9 componentes a partir do Content Pack publicado
   */
  private static composeFromDynamicPack(input: ComposerInput, pack: any): LessonSpec {
    const packVersion = pack.version || 1;
    const packHash = pack.contentHash || pack.content_hash || undefined;
    const packBnccSkill = pack.bnccSkill || pack.bncc_skill || 'BNCC-EF';
    const bnccCode = packBnccSkill.split(/[:;]/)[0];
    const gradeNum = String(input.grade).replace(/EF|EM$/i, '');
    const versionSuffix = pack.version ? ` (Conteúdo v${pack.version})` : '';

    const nodes = pack.nodes || [];
    const primaryNode = nodes[0] || {
      title: pack.title,
      short_definition: 'Conceito estruturante do currículo.',
      deep_description: 'Explicação detalhada dos fundamentos pedagógicos do tema.',
      key_points: ['Fundamentos conceituais', 'Aplicações práticas no cotidiano', 'Conexões interdisciplinares']
    };
    const secondaryNode = nodes[1] || null;
    const tertiaryNode = nodes[2] || null;

    const scenes: Scene[] = [];

    // 1. Título (Layout: 01_title)
    scenes.push({
      id: 'scene-01-title',
      type: 'title',
      layout_id: '01_title',
      title: pack.title,
      subtitle: primaryNode.short_definition || 'Fundamentação Conceitual e Prática',
      badge: `${this.getSubjectLabel(pack.subjectCode || input.discipline)} • ${gradeLabel(/EF|EM$/i.test(String(input.grade)) ? String(input.grade) : `${gradeNum}EF`)} • BNCC ${bnccCode}${pack.skillCodes?.length > 1 ? ' e outras habilidades' : ''}${versionSuffix}`,
      teacher_notes: `Iniciar a aula apresentando os objetivos da unidade temática: ${pack.title}. Provocar reflexão inicial a partir dos pré-requisitos dos estudantes.`
    });

    // 2. Contextualização / Conceito Primário (Layout: 02_title_body)
    const contextContent: string[] = [];
    if (primaryNode.deep_description) {
      contextContent.push(primaryNode.deep_description);
    } else {
      contextContent.push(primaryNode.short_definition || 'Definição e alcance pedagógico do tema.');
    }
    if (Array.isArray(primaryNode.key_points) && primaryNode.key_points.length > 0) {
      contextContent.push(`Conceito fundamental: ${primaryNode.key_points[0]}`);
    }

    scenes.push({
      id: 'scene-02-contexto',
      type: 'text',
      layout_id: '02_title_body',
      title: primaryNode.title || 'Contextualização Conceitual',
      content: contextContent,
      callout: primaryNode.short_definition || undefined,
      teacher_notes: 'Explorar a conexão entre a teoria e situações práticas do cotidiano dos alunos.'
    });

    // Modelos curriculares reais: independem do texto digitado ou de um piloto específico.
    scenes.push(...biologyScenesForSkills(pack.subjectCode || input.discipline,
      [...(pack.skillCodes || []), packBnccSkill].join(' ')));

    // 3. Recurso Visual / Mapa / Comparação / Segundo Conceito
    const resource = Array.isArray(pack.resources) && pack.resources.length > 0 ? pack.resources[0] : null;

    const preparedMap = resource?.type==='map' ? prepareMap({id:'scene-03-mapa',type:'map',title:resource.title||pack.title,params:resource.metadata_json||{region_name:pack.title,focus_points:[]}}) : null;
    if (preparedMap && preparedMap.params.focus_points.length) {
      scenes.push({
        id: 'scene-03-mapa',
        type: 'map',
        layout_id: '07_map',
        title: preparedMap.title,
        resource_id: resource.id || 'res-map-001',
        source_citation: `Material autoral: ${pack.title}`,
        params: preparedMap.params,
        teacher_notes: 'Estimular os estudantes a interpretarem a espacialização dos dados e legendas do mapa.'
      });
    } else if (resource && resource.type === 'comparison_table') {
      scenes.push({
        id: 'scene-03-comparacao',
        type: 'comparison',
        layout_id: '05_comparison',
        title: resource.title || 'Quadro Comparativo Estruturado',
        source_citation: `Material autoral: ${pack.title}`,
        params: resource.metadata_json || {
          columns: ['Critério', primaryNode.title, secondaryNode?.title || 'Aplicação'],
          rows: [{ criteria: 'Definição', [primaryNode.title]: primaryNode.deep_description || primaryNode.short_definition, [secondaryNode?.title || 'Aplicação']: secondaryNode?.deep_description || primaryNode.example || 'Consulte os exemplos da aula.' }]
        },
        teacher_notes: 'Percorrer as linhas do comparativo destacando contrastes conceituais e históricos.'
      });
    } else if (secondaryNode) {
      const secContent = [secondaryNode.deep_description || secondaryNode.short_definition];
      if (Array.isArray(secondaryNode.key_points) && secondaryNode.key_points.length > 0) {
        secContent.push(...secondaryNode.key_points);
      }
      scenes.push({
        id: 'scene-03-desdobramento',
        type: 'text',
        layout_id: '02_title_body',
        title: secondaryNode.title,
        content: secContent,
        callout: secondaryNode.short_definition || undefined,
        teacher_notes: 'Aprofundar os aspectos específicos e aprofundamento técnico do tópico.'
      });
    }

    // 4. Aprofundamento Teórico / Terceiro Conceito (para durações >= 45 min ou método complete/visual)
    if (tertiaryNode && (input.duration >= 45 || input.teaching_method === 'complete' || input.teaching_method === 'visual')) {
      scenes.push({
        id: 'scene-04-aprofundamento',
        type: 'text',
        layout_id: '02_title_body',
        title: tertiaryNode.title,
        content: [
          tertiaryNode.deep_description || tertiaryNode.short_definition,
          ...(tertiaryNode.key_points || [])
        ],
        callout: tertiaryNode.short_definition || undefined,
        teacher_notes: 'Conectar o terceiro nó conceitual aos temas anteriores antes da checagem de compreensão.'
      });
    }

    for (const [index, node] of nodes.entries()) {
      if (index === 0 || (index === 1 && resource?.type !== 'map' && resource?.type !== 'comparison_table') || (index === 2 && (input.duration >= 45 || input.teaching_method === 'complete' || input.teaching_method === 'visual'))) continue;
      scenes.push({ id: `scene-concept-${index}`, type: 'text', layout_id: '02_title_body', title: node.title,
        content: [node.deep_description || node.short_definition, ...(node.key_points || [])],
        teacher_notes: 'Relacionar este conceito aos anteriores e verificar a compreensão da turma.' });
    }

    // Exemplos e atividades pertencem ao conteúdo publicado, não são inventados pelo compositor.
    for (const [index, node] of nodes.entries()) {
      if (node.example) scenes.push({ id: `example-${index}`, type: 'text', layout_id: '02_title_body', title: `Exemplo: ${node.title}`, content: [node.example], teacher_notes: node.teacherNotes || node.teacher_notes || 'Discutir o exemplo com a turma e pedir que expliquem o raciocínio.' });
      if (node.activity) scenes.push({ id: `activity-${index}`, type: 'text', layout_id: '02_title_body', title: `Atividade: ${node.title}`, content: [node.activity], teacher_notes: node.teacherNotes || node.teacher_notes || 'Acompanhar as respostas e retomar as dúvidas antes de prosseguir.' });
    }

    // 5. Quiz de Fixação Formativa (Layout: 10_quiz)
    for (const [quizIndex, quizData] of pack.quizzes.entries()) {

    scenes.push({
      id: `scene-05-quiz-${quizIndex}`,
      type: 'quiz',
      layout_id: '10_quiz',
      title: 'Verificação Formativa de Aprendizagem',
      question: quizData.question,
      answers: quizData.options || quizData.answers,
      correct_index: typeof quizData.correct_index === 'number' ? quizData.correct_index : (quizData.correctIndex ?? 0),
      explanation: quizData.explanation || 'Excelente! Alternativa correta fundamentada nos conceitos da aula.',
      teacher_notes: 'Pedir que um estudante leia a pergunta e oriente a turma a justificar por que as outras opções estão incorretas.'
    });

    }

    // 6. Resumo e Síntese (Layout: 11_summary)
    const summaryTakeaways: string[] = [];
    for (const n of nodes) {
      if (Array.isArray(n.key_points) && n.key_points.length > 0) {
        summaryTakeaways.push(`${n.title}: ${n.key_points[0]}`);
      } else {
        summaryTakeaways.push(`${n.title}: ${n.short_definition || 'Conceito consolidado.'}`);
      }
    }
    if (summaryTakeaways.length === 0) {
      summaryTakeaways.push(`Compreensão dos fundamentos de ${pack.title}.`);
      summaryTakeaways.push(`Aplicação prática dos conceitos segundo a BNCC (${bnccCode}).`);
    }

    scenes.push({
      id: 'scene-06-resumo',
      type: 'summary',
      layout_id: '11_summary',
      title: 'Síntese da Aula e Próximos Passos',
      takeaways: summaryTakeaways.slice(0, 5),
      next_steps: `Atividades práticas e consolidação dos objetivos previstos na habilidade ${bnccCode}.`,
      teacher_notes: 'Revisar os tópicos sintetizados e indicar leituras e exercícios complementares.'
    });

    // Passagem pelo VisualValidator para garantia estrita de conformidade visual
    const validatedScenes: Scene[] = [];
    for (const sc of scenes) {
      const layoutId = sc.layout_id || '02_title_body';
      const check = VisualValidator.validateScene(sc, layoutId);
      if (check.status === 'FAIL') {
        const { correctedScene, newScenes } = VisualValidator.autoCorrectScene(sc, layoutId);
        validatedScenes.push(correctedScene);
        if (newScenes) validatedScenes.push(...newScenes);
      } else {
        validatedScenes.push(sc);
      }
    }

    return {
      schema_version: '1.0',
      lesson_version: 1,
      renderer_version: '0.3.0',
      lesson: {
        id: `pemara-${pack.slug || 'aula'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        subject: (pack.subjectCode || input.discipline) as any,
        grade: /EF|EM$/i.test(String(input.grade)) ? String(input.grade) : `${gradeNum}EF`,
        topic: pack.slug || input.topic,
        title: pack.title,
        duration_minutes: input.duration || 45,
        language: 'pt-BR',
        author: `Acervo PEMARA (Conteúdo v${pack.version || 1})${pack.editorialStatus === 'pending_teacher_review' ? ' — revisão docente pendente' : ''}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        generation_mode: 'MODE_A_NO_AI',
        didactic_style: input.teaching_method,
        bncc_skill: packBnccSkill,
        source_id: pack.sources?.[0]?.id || 'src-bncc-mec-2018',
        visual_status: 'READY',
        content_pack_version: packVersion,
        content_pack_hash: packHash
      },
      objectives: Array.isArray(pack.objectives) && pack.objectives.length ? pack.objectives : [`Compreender os conceitos de ${pack.title}`],
      ...contextFromPack(pack),
      scenes: validatedScenes
    };
  }

  /**
   * Compõe a aula do piloto de Grécia Antiga a partir da fixture local canônica
   */
  private static composeGreecePilot(input: ComposerInput, dynamicPack?: any): LessonSpec {
    const pack = CONTENT_PACK_GRECIA_ANTIGA;

    const findNode = (prefix: string) => {
      if (!dynamicPack?.nodes || !Array.isArray(dynamicPack.nodes)) return null;
      return dynamicPack.nodes.find((n: any) => {
        const s = (n.slug || '').toLowerCase();
        const t = (n.title || '').toLowerCase();
        const nm = (n.name || '').toLowerCase();
        const id = (n.id || '').toLowerCase();
        return s.includes(prefix) || t.includes(prefix) || nm.includes(prefix) || id.includes(prefix);
      });
    };

    const atenasNode = findNode('atena');
    const espartaNode = findNode('espart');

    const scenes: Scene[] = [
      {
        id: 'scene-01-title',
        type: 'title',
        layout_id: '01_title',
        title: dynamicPack?.title || pack.title,
        subtitle: 'Cidadania, Pólis e as Raízes da Democracia Ocidental',
        badge: `História • ${dynamicPack?.gradeLevel || pack.grade}º Ano • BNCC ${(dynamicPack?.bnccSkill ? dynamicPack.bnccSkill.split(':')[0] : pack.bncc_skill.split(':')[0])}${dynamicPack?.version ? ` (Conteúdo v${dynamicPack.version})` : ''}`,
        teacher_notes: 'Iniciar provocando a turma: o que significa ser cidadão hoje versus há 2500 anos atrás na Grécia?'
      },
      {
        id: 'scene-02-contexto',
        type: 'text',
        layout_id: '02_title_body',
        title: 'O Território Montanhoso e o Mar',
        content: [
          'A Grécia Antiga não era um país unificado, mas centenas de comunidades espalhadas pela Península Balcânica, ilhas do Mar Egeu e litoral da Ásia Menor.',
          'O relevo acidentado e montanhoso dificultava a comunicação por terra, incentivando a navegação marítima e a independência de cada cidade.',
          'Apesar da fragmentação territorial, os gregos compartilhavam a mesma língua, a mitologia dos deuses olímpicos e os Jogos Pan-Helênicos.'
        ],
        callout: 'Importante: A geografia montanhosa favoreceu diretamente o isolamento e o surgimento das cidades-estado autônomas (pólis).',
        teacher_notes: 'Chame a atenção dos alunos para o relevo: montanhas funcionavam como barreiras naturais entre as cidades.'
      },
      {
        id: 'scene-03-mapa',
        type: 'map',
        layout_id: '07_map',
        title: 'Mapa do Mar Egeu e Principais Pólis',
        resource_id: 'map-greece-001',
        source_citation: 'Material autoral PEMARA — referências no roteiro docente',
        params: {
          region_name: 'Península Balcânica e Mar Egeu',
          focus_points: [
            { name: 'Atenas', lat: 37.98, lon: 23.72, region: 'Ática', role: 'Comércio marítimo, filosofia e nascimento da Democracia.' },
            { name: 'Esparta', lat: 37.07, lon: 22.42, region: 'Peloponeso', role: 'Sociedade militar agrária e poder oligárquico dos gerontes.' }
          ],
          historical_notes: 'Observe a proximidade com o mar: Atenas utilizava o porto do Pireu para dominar as rotas de comércio marítimo.'
        },
        teacher_notes: 'Peça para um aluno localizar Atenas e Esparta e notar a distância geográfica e de relevo entre a Ática e a Lacônia.'
      },
      {
        id: 'scene-04-polis',
        type: 'text',
        layout_id: '02_title_body',
        title: 'A Pólis: A Cidade-Estado Soberana',
        content: [
          'A pólis era uma comunidade política autônoma com suas próprias leis, moeda, exército e sistema de governo.',
          'Espaço Cívico: A Ágora (praça pública central) era o coração da vida social e dos debates políticos.',
          'Acrópole: Parte mais alta da cidade fortificada, onde se erguiam os templos religiosos e servia de refúgio militar.',
          'O termo grego "politeia" deu origem às nossas palavras contemporâneas "política" e "polícia".'
        ],
        callout: 'Definição central: Pólis não era apenas o espaço físico urbano, mas a comunidade dos cidadãos que compartilhavam direitos civis.',
        teacher_notes: 'Explique que cidadão na Grécia era quem participava diretamente da vida da cidade, e não apenas quem morava nela.'
      },
      {
        id: 'scene-05-atenas',
        type: 'text',
        layout_id: '02_title_body',
        title: atenasNode?.title || atenasNode?.name || 'Atenas: O Berço da Democracia Direta',
        content: atenasNode?.deep_description
          ? [
              atenasNode.deep_description,
              'Após reformas de Sólon e Clístenes (508 a.C.), instaurou a Democracia: o poder de decisão residia na Eclésia (assembleia popular).',
              'Qualquer cidadão ateniense podia discursar e votar diretamente, sem deputados ou intermediários.'
            ]
          : [
              'Localizada na planície da Ática, Atenas construiu sua força no comércio marítimo e naval.',
              'Após reformas de Sólon e Clístenes (508 a.C.), instaurou a Democracia: o poder de decisão residia na Eclésia (assembleia popular).',
              'Qualquer cidadão ateniense podia discursar e votar diretamente, sem deputados ou intermediários.'
            ],
        callout: 'Limite crucial da cidadania ateniense: Somente homens livres, maiores de idade e filhos de pais atenienses votavam. Mulheres, estrangeiros (metecos) e escravizados não tinham direitos políticos.',
        teacher_notes: 'Enfatize: a democracia ateniense era DIRETA, mas altamente EXCLUDENTE (apenas ~10% da população participava).'
      },
      {
        id: 'scene-06-esparta',
        type: 'text',
        layout_id: '02_title_body',
        title: espartaNode?.title || espartaNode?.name || 'Esparta: Disciplina Militar e Oligarquia',
        content: espartaNode?.deep_description
          ? [
              espartaNode.deep_description,
              'Os esparciatas (homens de armas) dedicavam a vida exclusivamente ao exército e ao Estado desde os 7 anos de idade na Agogê.',
              'A produção de alimentos dependia dos Hilotas: servos agrícolas que pertenciam ao Estado espartano.'
            ]
          : [
              'Fundada no fértil vale do rio Eurotas (Peloponeso), Esparta era governada por uma Oligarquia (governo de poucos).',
              'Os esparciatas (homens de armas) dedicavam a vida exclusivamente ao exército e ao Estado desde os 7 anos de idade na Agogê.',
              'A produção de alimentos dependia dos Hilotas: servos agrícolas que pertenciam ao Estado espartano.'
            ],
        callout: 'Diferença estrutural: Ao contrário de Atenas, Esparta não valorizava o debate público ou a oratória, priorizando a disciplina marcial e a subordinação total ao Estado.',
        teacher_notes: 'Destaque a vida dos hilotas: eram a maioria da população da Lacônia e sofriam violências rituais (Criptia) dos jovens guerreiros.'
      },
      {
        id: 'scene-07-comparacao',
        type: 'comparison',
        layout_id: '05_comparison',
        title: 'Quadro Comparativo: Atenas vs Esparta',
        source_citation: 'Material autoral PEMARA — referências no roteiro docente',
        params: {
          columns: ['Critério', 'Atenas', 'Esparta'],
          rows: [
            { criteria: 'Forma de Governo', atenas: 'Democracia Direta (Eclésia)', esparta: 'Oligarquia Militar (Gerúsia)' },
            { criteria: 'Base Econômica', atenas: 'Comércio marítimo e manufaturas', esparta: 'Agricultura servil de subsistência' },
            { criteria: 'Educação (Paideia)', atenas: 'Filosofia, oratória, artes e corpo', esparta: 'Agogê: disciplina guerreira rigorosa' },
            { criteria: 'Papel da Mulher', atenas: 'Restrita ao espaço doméstico (Gineceu)', esparta: 'Treino físico, autonomia e gestão' },
            { criteria: 'Mão de Obra', atenas: 'Escravizados e artesãos livres', esparta: 'Hilotas (servos públicos do Estado)' }
          ],
          conclusion: 'Enquanto Atenas investiu na retórica e no comércio, Esparta priorizou a coesão militar e o controle das terras.'
        },
        teacher_notes: 'Percorra cada linha do quadro e peça para os alunos apontarem as principais diferenças filosóficas entre as cidades.'
      },
      {
        id: 'scene-08-quiz',
        type: 'quiz',
        layout_id: '10_quiz',
        title: 'Verificação Formativa de Aprendizagem',
        question: 'Qual das seguintes afirmações representa com rigor histórico a democracia na Atenas Antiga?',
        answers: [
          'Todos os homens e mulheres votavam por meio de representantes eleitos',
          'Era uma democracia direta exercida apenas por homens livres e atenienses',
          'Era uma monarquia militar onde os hilotas elegiam os generais anualmente',
          'Apenas os comerciantes marítimos estrangeiros tinham direito à palavra na assembleia'
        ],
        correct_index: 1,
        explanation: 'Exato! A democracia ateniense era direta (o cidadão votava sem intermediários), mas restrita aos politai (homens livres, adultos e atenienses). Mulheres, metecos e escravizados estavam excluídos.'
      },
      {
        id: 'scene-09-resumo',
        type: 'summary',
        layout_id: '11_summary',
        title: 'Síntese da Aula e Próximos Passos',
        takeaways: [
          'A pólis era a cidade-estado independente com leis e moeda próprias.',
          'O relevo montanhoso estimulou a fragmentação política e o comércio no Mar Egeu.',
          'Atenas desenvolveu a democracia direta, oratória e navegação comercial.',
          'Esparta estruturou-se em torno do militarismo austero e da oligarquia.'
        ],
        next_steps: 'As Guerras Médicas (conflito contra o Império Persa) e a Guerra do Peloponeso.'
      }
    ];

    const validatedScenes: Scene[] = [];
    for (const sc of scenes) {
      const layoutId = sc.layout_id || '02_title_body';
      const check = VisualValidator.validateScene(sc, layoutId);
      if (check.status === 'FAIL') {
        const { correctedScene, newScenes } = VisualValidator.autoCorrectScene(sc, layoutId);
        validatedScenes.push(correctedScene);
        if (newScenes) validatedScenes.push(...newScenes);
      } else {
        validatedScenes.push(sc);
      }
    }

    return {
      schema_version: '1.0',
      lesson_version: 1,
      renderer_version: '0.3.0',
      lesson: {
        id: `pemara-grecia-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        subject: 'history',
        grade: '6EF',
        topic: 'grecia_antiga',
        title: pack.title,
        duration_minutes: input.duration || 45,
        language: 'pt-BR',
        author: 'Acervo PEMARA v1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        generation_mode: 'MODE_A_NO_AI',
        didactic_style: input.teaching_method,
        bncc_skill: pack.bncc_skill,
        source_id: 'src-curriculum-bncc',
        visual_status: 'READY',
        content_pack_version: 1
      },
      objectives: [
        'Compreender o conceito de Pólis e a organização territorial da Grécia Antiga',
        'Comparar as estruturas sociais, políticas e educacionais de Atenas e Esparta',
        'Analisar criticamente o alcance e as exclusões da democracia direta ateniense'
      ],
      ...contextFromPack(dynamicPack||pack),
      scenes: validatedScenes
    };
  }

  private static getSubjectLabel(subject: string): string {
    const labels: Record<string, string> = {
      history: 'História',
      geography: 'Geografia',
      science: 'Ciências',
      math: 'Matemática',
      portuguese: 'Língua Portuguesa',
      english: 'Língua Inglesa',
      arts: 'Arte',
      physical_education: 'Educação Física',
      religious_education: 'Ensino Religioso',
      physics: 'Física',
      biology: 'Biologia',
      chemistry: 'Química'
    };
    return labels[subject] || subject;
  }
}
