import { connect, close } from './test-installed.mjs';
await close(await connect());
console.log('Janela e backend encerrados.');
