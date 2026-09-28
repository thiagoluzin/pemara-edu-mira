export type GenerationProvider={id:string;configured:boolean};
export function aiGenerationProblem(providers:GenerationProvider[],selected:string,loadError=''):string|null {
 if(loadError)return 'Não foi possível consultar a configuração da IA. Tente novamente ou gere a aula sem IA.';
 if(!providers.some(p=>p.configured))return 'Nenhuma IA está configurada. Para gerar com IA, configure um modelo local (Ollama ou LM Studio) ou um serviço com modelo e chave de API. Você pode gerar esta aula sem IA agora.';
 if(!providers.some(p=>p.id===selected&&p.configured))return 'Selecione um serviço de IA configurado ou gere a aula sem IA.';
 return null;
}
