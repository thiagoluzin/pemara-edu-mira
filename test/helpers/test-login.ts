import { launchHeadlessChrome } from './cdpBrowser';

async function main() {
  const b = await launchHeadlessChrome(9777);
  await b.navigate('http://127.0.0.1:3000');
  await new Promise((r) => setTimeout(r, 1000));
  
  // Click Entrar in Navbar
  await b.evaluate(`
    const navBtn = Array.from(document.querySelectorAll('header button')).find(b => b.innerText.includes('Entrar'));
    navBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 500));

  // Inspect form inputs
  const inputsBefore = await b.evaluate(`
    Array.from(document.querySelectorAll('form input')).map(i => ({ type: i.type, ph: i.placeholder, filled: Boolean(i.value) }))
  `);
  console.log('Inputs before:', inputsBefore);

  // Set values using the standard React value setter
  await b.evaluate(`
    (() => {
      const idEl = document.querySelector('form input[type="text"]');
      const pwEl = document.querySelector('form input[type="password"]');

      function setVal(el, val) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setVal(idEl, 'prof.carlos');
      setVal(pwEl, 'carlos123');
    })()
  `);

  const inputsAfter = await b.evaluate(`
    Array.from(document.querySelectorAll('form input')).map(i => ({ type: i.type, ph: i.placeholder, filled: Boolean(i.value) }))
  `);
  console.log('Inputs after:', inputsAfter);

  // Submit form
  await b.evaluate(`
    const submitBtn = document.querySelector('form button[type="submit"]');
    submitBtn.click();
  `);

  await new Promise((r) => setTimeout(r, 1000));

  const afterSubmitText = await b.evaluate('document.body.innerText');
  if (!afterSubmitText.includes('Carlos') && !afterSubmitText.includes('prof.carlos')) {
    await b.close();
    throw new Error('O login do usuário de teste não foi confirmado.');
  }
  console.log('Login do usuário de teste confirmado.');
  console.log('Text snippet:', afterSubmitText.slice(0, 300));

  await b.close();
}

main().catch(error=>{console.error(error);process.exitCode=1;});
