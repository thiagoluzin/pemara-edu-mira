/**
 * PEMARA EDU - importação local de materiais didáticos.
 * Conserva a origem (página / slide / parágrafo) e NÃO
 * interpreta, corrige ou inventa conteúdo curricular do documento.
 *
 * DOCX e PPTX: ZIP limitado + parser XML sem entidades externas.
 * PDF: PDF.js + Tesseract.js com idiomas locais, em processo sem rede.
 * DOC e PPT legados: conversão local por LibreOffice, se empacotado.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { inflateRawSync,crc32 } from 'node:zlib';
import {DOMParser} from '@xmldom/xmldom';
import {readPdf} from './pdfReader';

export type MaterialFormat = 'pdf' | 'docx' | 'doc' | 'pptx' | 'ppt' | 'txt' | 'md' | 'manual';
export type SourceUnit = 'pagina' | 'slide' | 'nota' | 'paragrafo' | 'texto';
export interface MaterialSection {
  sourceUnit: SourceUnit;
  sourceIndex: number;
  sourceLabel: string;
  heading?: string;
  text: string;
}
export interface ExtractedMaterial {
  filename: string;
  format: MaterialFormat;
  sections: MaterialSection[];
  text: string;
  warnings: string[];
  truncated: boolean;
  ocrUsed: boolean;
}
export interface ReaderOptions {
  pageStart?: number;
  pageEnd?: number;
  toolsDir?: string; // executáveis incluídos no instalador; NUNCA de parâmetro do usuário
  tessdataDir?: string;
  maxFileBytes?: number;
  maxTextChars?: number;
  maxPdfPages?: number;
  maxOcrPages?: number;
}
export class MaterialReadError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
const MAX_FILE = 40 * 1024 * 1024;
const MAX_ENTRY = 30 * 1024 * 1024;
const MAX_UNPACKED = 100 * 1024 * 1024;
const MAX_ENTRIES = 10000;

function cleanText(value: string): string {
  return value.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
}
function decodeXml(value: string): string {
  return value.replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|amp|lt|gt|quot|apos);/gi, (match, hex: string, dec: string) => {
    if (hex || dec) {
      const value = parseInt(hex || dec, hex ? 16 : 10);
      return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : '';
    }
    return ({'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'"} as Record<string, string>)[match.toLowerCase()] ?? match;
  });
}
function xmlDocument(xml:string){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new MaterialReadError('INVALID_XML','Declarações externas não são aceitas.');
  return new DOMParser({onError:(level,message)=>{if(level!=='warning')throw new MaterialReadError('INVALID_XML','Documento XML inválido.');}}).parseFromString(xml,'text/xml');
}
function paragraphs(xml:string,paragraphTag:'w:p'|'a:p',textTag:'w:t'|'a:t'):string[]{
  const ns=paragraphTag==='w:p'?'http://schemas.openxmlformats.org/wordprocessingml/2006/main':'http://schemas.openxmlformats.org/drawingml/2006/main';
  const doc=xmlDocument(xml);
  return Array.from(doc.getElementsByTagNameNS(ns,'p')).map(p=>{
    const walk=(node:any):string=>{
      if(node.namespaceURI===ns&&node.localName==='t')return node.textContent||'';
      if(node.namespaceURI===ns&&node.localName==='tab')return '\t';
      if(node.namespaceURI===ns&&['br','cr'].includes(node.localName))return '\n';
      return Array.from(node.childNodes||[]).map(walk).join('');
    };
    return cleanText(walk(p));
  }).filter(Boolean);
}

function hasSignature(data: Buffer, signature: Buffer): boolean {
  return data.length >= signature.length && data.subarray(0, signature.length).equals(signature);
}

/** Leitura seletiva de entradas ZIP - rejeita Zip64, entradas criptografadas e zip bombs. */
export function unzipXmlEntries(buffer: Buffer, paths: RegExp): Map<string, string> {
  if (!hasSignature(buffer, Buffer.from([0x50,0x4b]))) throw new MaterialReadError('INVALID_PACKAGE', 'Documento Office não é um arquivo ZIP válido.');
  let end = -1;
  for (let p = buffer.length - 22; p >= Math.max(0, buffer.length - 65557); p--) {
    if (buffer.readUInt32LE(p) === 0x06054b50) { end = p; break; }
  }
  if (end < 0) throw new MaterialReadError('ZIP_UNSUPPORTED', 'Diretório ZIP ausente ou incompleto.');
  const count = buffer.readUInt16LE(end + 10), offset = buffer.readUInt32LE(end + 16);
  const dirLength = buffer.readUInt32LE(end + 12);
  if (count > MAX_ENTRIES || count === 0xffff || offset === 0xffffffff || offset + dirLength > buffer.length) {
    throw new MaterialReadError('ZIP_LIMIT', 'Pacote Office inválido, Zip64 ou excessivamente grande.');
  }
  let pos = offset, total = 0;
  const result = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) throw new MaterialReadError('ZIP_CORRUPT', 'Pacote Office corrompido.');
    const flags = buffer.readUInt16LE(pos + 8), method = buffer.readUInt16LE(pos + 10);
    const checksum=buffer.readUInt32LE(pos+16);
    const compressed = buffer.readUInt32LE(pos + 20), expanded = buffer.readUInt32LE(pos + 24);
    const nlen = buffer.readUInt16LE(pos + 28), xlen = buffer.readUInt16LE(pos + 30), clen = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    if (pos + 46 + nlen + xlen + clen > buffer.length) throw new MaterialReadError('ZIP_CORRUPT', 'Nome ZIP fora dos limites.');
    const name = buffer.subarray(pos + 46, pos + 46 + nlen).toString('utf8');
    pos += 46 + nlen + xlen + clen;
    if (!paths.test(name)) continue;
    if ((flags & 1) || ![0, 8].includes(method)) throw new MaterialReadError('ZIP_UNSUPPORTED', 'Entrada Office criptografada ou com compressão não suportada.');
    if (expanded > MAX_ENTRY || compressed > MAX_ENTRY || total + expanded > MAX_UNPACKED) throw new MaterialReadError('ZIP_LIMIT', 'Entrada Office grande demais para processamento seguro.');
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new MaterialReadError('ZIP_CORRUPT', 'Entrada Office incompleta.');
    const localName = buffer.readUInt16LE(localOffset + 26), localExtra = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localName + localExtra;
    if (start + compressed > buffer.length) throw new MaterialReadError('ZIP_CORRUPT', 'Conteúdo Office fora dos limites.');
    const packed = buffer.subarray(start, start + compressed);
    let uncompressed: Buffer;
    try { uncompressed = method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: MAX_ENTRY }); }
    catch { throw new MaterialReadError('ZIP_CORRUPT', 'Falha na descompressão do documento.'); }
    if (uncompressed.length !== expanded) throw new MaterialReadError('ZIP_CORRUPT', 'Tamanho da entrada ZIP divergente.');
    if(crc32(uncompressed)!==checksum)throw new MaterialReadError('ZIP_CORRUPT','Integridade de uma entrada Office divergente. Recupere o arquivo original.');
    total += expanded;
    result.set(name, uncompressed.toString('utf8'));
  }
  return result;
}

function parseDocx(bytes: Buffer): MaterialSection[] {
  const entries = unzipXmlEntries(bytes, /^word\/(document|footnotes|endnotes)\.xml$/);
  const main = entries.get('word/document.xml');
  if (!main) throw new MaterialReadError('INVALID_DOCX', 'O Word não contém word/document.xml.');
  const raw = paragraphs(main, 'w:p', 'w:t');
  const sections = raw.map((text, index): MaterialSection => ({sourceUnit: 'paragrafo', sourceIndex: index + 1, sourceLabel: `Parágrafo ${index + 1}`, text}));
  // Os anexos são preservados como origem separada, não misturados silenciosamente.
  for (const [file, xml] of entries) {
    if (file === 'word/document.xml') continue;
    const label = file.includes('footnotes') ? 'Nota de rodapé' : 'Nota de fim';
    for (const text of paragraphs(xml, 'w:p', 'w:t')) sections.push({sourceUnit: 'nota', sourceIndex: sections.length + 1, sourceLabel: label, text});
  }
  return sections;
}
function parsePptx(bytes: Buffer): MaterialSection[] {
  const entries = unzipXmlEntries(bytes, /^ppt\/(?:presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide\d+\.xml|notesSlides\/notesSlide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels)$/);
  let slideNames = [...entries.keys()].filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+(?=\.xml)/)![0]) - Number(b.match(/\d+(?=\.xml)/)![0]));
  const presentation=entries.get('ppt/presentation.xml'), relationships=entries.get('ppt/_rels/presentation.xml.rels');
  if(presentation&&relationships){
    const rels=Array.from(xmlDocument(relationships).getElementsByTagName('Relationship'));
    slideNames=Array.from(xmlDocument(presentation).getElementsByTagNameNS('http://schemas.openxmlformats.org/presentationml/2006/main','sldId')).map(node=>{
      const id=node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
      const rel=rels.find(r=>r.getAttribute('Id')===id&&r.getAttribute('TargetMode')!=='External');
      return rel?path.posix.normalize('ppt/'+rel.getAttribute('Target')):'';
    });
    if(slideNames.some(n=>!entries.has(n)))throw new MaterialReadError('INVALID_PPTX','Ordem dos slides inválida.');
  }
  if (!slideNames.length) throw new MaterialReadError('INVALID_PPTX', 'O PowerPoint não contém slides reconhecíveis.');
  const sections: MaterialSection[] = [];
  for (const [slideOrder,slide] of slideNames.entries()) {
    const fileIndex = Number(slide.match(/\d+(?=\.xml)/)![0]);
    const index=slideOrder+1;
    const text = paragraphs(entries.get(slide)!, 'a:p', 'a:t').join('\n');
    if (text) sections.push({sourceUnit: 'slide', sourceIndex: index, sourceLabel: `Slide ${index}`, text});
    // A relação PPTX não garante que o número da nota seja igual ao número do slide.
    const rels=entries.get(`ppt/slides/_rels/slide${fileIndex}.xml.rels`)||'';
    const noteTarget=rels?Array.from(xmlDocument(rels).getElementsByTagName('Relationship')).find(r=>r.getAttribute('Type')?.endsWith('/notesSlide')&&r.getAttribute('TargetMode')!=='External')?.getAttribute('Target'):undefined;
    const noteName=noteTarget?.match(/notesSlide(\d+)\.xml/)?.[1];
    const notes = entries.get(`ppt/notesSlides/notesSlide${noteName||fileIndex}.xml`);
    if (notes) {
      const noteText = paragraphs(notes, 'a:p', 'a:t').join('\n');
      if (noteText) sections.push({sourceUnit: 'nota', sourceIndex: index, sourceLabel: `Notas do slide ${index}`, text: noteText});
    }
  }
  return sections;
}

async function command(executable: string, args: string[], timeoutMs = 60000, extraEnv: NodeJS.ProcessEnv = {}): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(executable, args, {shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, ...extraEnv}}); }
    catch {reject(new MaterialReadError('TOOL_UNAVAILABLE', `Ferramenta local indisponível: ${path.basename(executable)}.`));return;}
    const out: Buffer[] = [], err: Buffer[] = []; let size = 0, errorSize = 0, done = false;
    const timeout = setTimeout(() => {child.kill();finish(new MaterialReadError('TOOL_TIMEOUT', `Processamento demorado demais em ${path.basename(executable)}.`));}, timeoutMs);
    function finish(error?: Error, code?: number | null) {
      if (done) return; done = true; clearTimeout(timeout);
      if (error || code !== 0) reject(error || new MaterialReadError('TOOL_FAILED', `Ferramenta local falhou: ${path.basename(executable)}.`));
      else resolve({stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8').slice(0,2000)});
    }
    child.stdout?.on('data', (b: Buffer) => {size += b.length;if(size > 12 * 1024 * 1024){child.kill();finish(new MaterialReadError('TEXT_LIMIT', 'Documento excede o limite de extração de texto.'));}else out.push(b);});
    child.stderr?.on('data', (b: Buffer) => {errorSize += b.length;if(errorSize < 100000)err.push(b);});
    child.on('error', () => finish(new MaterialReadError('TOOL_UNAVAILABLE', `Ferramenta local indisponível: ${path.basename(executable)}.`)));
    child.on('close', c => finish(undefined, c));
  });
}
function executable(name: string, options: ReaderOptions): string {
  const base = options.toolsDir ? path.join(options.toolsDir, process.platform === 'win32' ? `${name}.exe` : name) : name;
  return base;
}
async function convertLegacy(bytes: Buffer, ext: 'doc' | 'ppt', options: ReaderOptions): Promise<MaterialSection[]> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pemara-legacy-'));
  try {
    const input = path.join(tmp, `documento.${ext}`);
    await fs.writeFile(input, bytes, {flag: 'wx'});
    const target = ext === 'doc' ? 'docx' : 'pptx';
    const profile = `file:///${path.join(tmp, 'profile').replace(/\\/g, '/')}`;
    await command(executable('soffice', options), [`-env:UserInstallation=${profile}`, '--headless', '--convert-to', target, '--outdir', tmp, input], 90000);
    let converted: Buffer;
    try {converted = await fs.readFile(path.join(tmp, `documento.${target}`));}
    catch {throw new MaterialReadError('CONVERT_FAILED', `Não foi possível converter o arquivo .${ext} offline.`);}
    return ext === 'doc' ? parseDocx(converted) : parsePptx(converted);
  } finally {await fs.rm(tmp, {recursive: true, force: true});}
}
async function parsePdf(bytes:Buffer,options:ReaderOptions){
  try{return await readPdf(bytes,options);}
  catch(error){throw new MaterialReadError('INVALID_PDF',error instanceof Error?error.message:'Falha na leitura local do PDF.');}
}

export function manualMaterial(text: string): ExtractedMaterial {
  const content = cleanText(text);
  if (!content) throw new MaterialReadError('EMPTY_TEXT', 'Escreva ou cole algum conteúdo primeiro.');
  const sections = content.split(/\n\s*\n/).filter(Boolean).map((s,i): MaterialSection => ({sourceUnit:'texto',sourceIndex:i+1,sourceLabel:`Texto próprio ${i+1}`,text:s}));
  return {filename:'Texto escrito pelo professor',format:'manual',sections,text:content,warnings:[],truncated:false,ocrUsed:false};
}
export async function extractOfflineMaterial(filename: string, bytes: Buffer, options: ReaderOptions = {}): Promise<ExtractedMaterial> {
  const ext = path.extname(filename).toLowerCase().slice(1) as MaterialFormat;
  if (!['pdf','docx','doc','pptx','ppt','txt','md'].includes(ext)) throw new MaterialReadError('UNSUPPORTED_FORMAT', 'Tipo de documento não suportado. Envie PDF, Word, PowerPoint, TXT ou Markdown.');
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > (options.maxFileBytes ?? MAX_FILE)) throw new MaterialReadError('FILE_SIZE', 'Documento vazio ou maior que o tamanho permitido.');
  const warnings: string[] = []; let sections: MaterialSection[] = [], ocrUsed = false,sourceTruncated=false;
  if (ext === 'docx' || ext === 'pptx') sections = ext === 'docx' ? parseDocx(bytes) : parsePptx(bytes);
  else if (ext === 'pdf') {
    if (!hasSignature(bytes, Buffer.from('%PDF-'))) throw new MaterialReadError('INVALID_PDF', 'Arquivo não possui assinatura PDF.');
    const result = await parsePdf(bytes, options);sections=result.sections;ocrUsed=result.ocrUsed;sourceTruncated=result.truncated;warnings.push(...result.warnings);
  } else if (ext === 'doc' || ext === 'ppt') {
    if(process.env.PEMARA_OFFLINE==='true')throw new MaterialReadError('LEGACY_CONVERSION_REQUIRED','Salve o documento antigo como DOCX ou PPTX no Word, PowerPoint ou LibreOffice e importe novamente. A edição offline não executa conversores externos.');
    if (!hasSignature(bytes, Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]))) throw new MaterialReadError('INVALID_LEGACY', 'Documento antigo Office inválido.');
    sections = await convertLegacy(bytes, ext, options);
  } else {
    const encoding=bytes[0]===0xff&&bytes[1]===0xfe?'utf-16le':bytes[0]===0xfe&&bytes[1]===0xff?'utf-16be':'utf-8';
    let text:string;
    try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{text=new TextDecoder('windows-1252').decode(bytes);warnings.push('Texto interpretado como Windows-1252. Confira os acentos.');}
    text=text.replace(/^\uFEFF/,'');
    sections = cleanText(text).split(/\n\s*\n/).filter(Boolean).map((s,i) => ({sourceUnit:'paragrafo',sourceIndex:i+1,sourceLabel:`Parágrafo ${i+1}`,text:s}));
  }
  if (!sections.length) throw new MaterialReadError('NO_TEXT', 'Nenhum texto foi encontrado. O material pode conter imagens que exigem OCR local ou estar protegido.');
  const maxText = options.maxTextChars ?? 700000;
  let used = 0, truncated = sourceTruncated;
  const limited: MaterialSection[] = [];
  for (const section of sections) {
    const remaining = maxText - used;
    if (remaining <= 0) {truncated = true; break;}
    if (section.text.length > remaining) {
      limited.push({...section,text:section.text.slice(0,remaining)}); used = maxText; truncated = true; break;
    }
    limited.push(section);used += section.text.length;
  }
  if (truncated) warnings.push('O conteúdo ultrapassou o limite local de texto; selecione um capítulo ou divida o documento.');
  return {filename: path.basename(filename),format:ext,sections:limited,text:limited.map(s=>`[${s.sourceLabel}] ${s.text}`).join('\n\n'),warnings,truncated,ocrUsed};
}
