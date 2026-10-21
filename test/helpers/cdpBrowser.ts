/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PEMARA CHROME CDP AUTOMATION HARNESS
 * Fornece automação real em Chrome Headless nativo via CDP / WebSocket.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface CdpSession {
  ws: WebSocket;
  send(method: string, params?: any): Promise<any>;
  evaluate(expression: string): Promise<any>;
  navigate(url: string): Promise<void>;
  typeText(selector: string, text: string): Promise<void>;
  pressKey(key: string, code?: string): Promise<void>;
  screenshot(savePath?: string): Promise<string>;
  printToPdf(savePath?: string): Promise<string>;
  setViewport(width: number, height: number): Promise<void>;
  close(): Promise<void>;
}

export type CdpBrowser = CdpSession;

export async function launchHeadlessChrome(port = 9333): Promise<CdpSession> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pemara-chrome-'));
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = '';
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const pageTarget = list.find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (pageTarget) {
          wsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {}
  }

  if (!wsUrl) {
    proc.kill();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`Failed to connect to Chrome on port ${port}`);
  }

  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(e);
  });

  let msgId = 1;
  const pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void; timer: ReturnType<typeof setTimeout> }>();
  const rejectPending = () => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Chrome CDP connection closed before replying.'));
    }
    pending.clear();
  };
  ws.addEventListener('close', rejectPending);
  ws.addEventListener('error', rejectPending);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data.toString());
      if (data.id && pending.has(data.id)) {
        const { resolve, reject, timer } = pending.get(data.id)!;
        clearTimeout(timer);
        pending.delete(data.id);
        if (data.error) {
          reject(new Error(data.error.message || JSON.stringify(data.error)));
        } else {
          resolve(data.result);
        }
      }
    } catch (err) {
      console.error('Error parsing CDP message:', err);
    }
  };

  const send = (method: string, params?: any): Promise<any> => {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) return reject(new Error('Chrome CDP connection is not open.'));
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chrome CDP timed out: ${method}`));
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      try { ws.send(JSON.stringify({ id, method, params })); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  };

  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');

  const evaluate = async (expression: string): Promise<any> => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  };

  const navigate = async (url: string): Promise<void> => {
    await send('Page.navigate', { url });
    let loaded = false;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const readyState = await evaluate('document.readyState').catch(() => 'loading');
      if (readyState === 'complete') {
        loaded = true;
        break;
      }
    }
    if (!loaded) {
      console.warn(`Page navigate to ${url} did not reach complete state within 10s`);
    }
  };

  const typeText = async (selector: string, text: string): Promise<void> => {
    await evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el) {
          el.focus();
          const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) {
            setter.call(el, ${JSON.stringify(text)});
          } else {
            el.value = ${JSON.stringify(text)};
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
  };

  const screenshot = async (savePath?: string): Promise<string> => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const b64 = res.data;
    if (savePath) {
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(savePath, Buffer.from(b64, 'base64'));
    }
    return b64;
  };

  const setViewport = async (width: number, height: number): Promise<void> => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  };

  const pressKey = async (key: string, code?: string): Promise<void> => {
    await send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code: code || key,
      windowsVirtualKeyCode: key === 'ArrowRight' ? 39 : key === 'ArrowLeft' ? 37 : key === 'Escape' ? 27 : 0,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code: code || key,
      windowsVirtualKeyCode: key === 'ArrowRight' ? 39 : key === 'ArrowLeft' ? 37 : key === 'Escape' ? 27 : 0,
    });
  };

  const printToPdf = async (savePath?: string): Promise<string> => {
    const res = await send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
    });
    const b64 = res.data;
    if (savePath) {
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(savePath, Buffer.from(b64, 'base64'));
    }
    return b64;
  };

  const close = async (): Promise<void> => {
    rejectPending();
    try {
      ws.close();
    } catch {}
    try {
      proc.kill('SIGKILL');
    } catch {}
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  };

  return { ws, send, evaluate, navigate, typeText, pressKey, screenshot, printToPdf, setViewport, close };
}
