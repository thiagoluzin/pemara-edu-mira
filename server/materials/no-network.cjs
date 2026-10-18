// Document extraction must never contact a network, including OCR worker threads.
const deny = () => { throw new Error('A extração de documentos funciona somente offline.'); };
require('node:net').Socket.prototype.connect = deny;
require('node:http').request = deny;
require('node:http').get = deny;
require('node:https').request = deny;
require('node:https').get = deny;
require('node:tls').connect = deny;
globalThis.fetch = deny;
require('node:module').syncBuiltinESMExports();
