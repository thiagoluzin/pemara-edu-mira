import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const version = '2.4.0-pemara.18';
export const stage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../build/openchamber', version);
export const cleanDistribution = { edition: 'clean-test', profileDirectory: 'PEMARAEduTesteLimpo', documentsDirectory: 'PEMARA Aulas - Teste Limpo' };
