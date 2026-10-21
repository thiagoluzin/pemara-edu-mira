import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {register} from 'tsx/esm/api';
register();
const {generatePrintDocumentHtml}=await import('../../src/components/ExportModal.tsx');
const require=createRequire('C:/Users/admin_remoto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=path.resolve('evidencias/real-e2e-20261019');
const spec=JSON.parse(fs.readFileSync(path.join(out,'lesson-edited.json'))).currentSpec;
fs.writeFileSync(path.join(out,'print-probe.html'),generatePrintDocumentHtml(spec,{includeTeacherNotes:true}));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await browser.newPage({offline:true});await page.goto(pathToFileURL(path.join(out,'print-probe.html')).href);await page.pdf({path:path.join(out,'print-probe.pdf'),format:'A4',printBackground:true});}finally{await browser.close();}
