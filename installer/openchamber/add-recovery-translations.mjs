import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('pilotos/openchamber/source/packages/ui/src/lib/i18n/messages');
const translations = {
  en: 'Your conversation and saved files are still here. When the connection returns, send a message in this conversation to continue.',
  'pt-BR': 'Sua conversa e os arquivos salvos continuam aqui. Quando a conexão voltar, envie uma mensagem nesta conversa para continuar.',
  es: 'Tu conversación y los archivos guardados siguen aquí. Cuando vuelva la conexión, envía un mensaje en esta conversación para continuar.',
  fr: 'Votre conversation et les fichiers enregistrés sont toujours là. Lorsque la connexion revient, envoyez un message dans cette conversation pour continuer.',
  de: 'Dein Gespräch und die gespeicherten Dateien sind weiterhin vorhanden. Sobald die Verbindung wiederhergestellt ist, sende eine Nachricht in diesem Gespräch, um fortzufahren.',
  nl: 'Je gesprek en opgeslagen bestanden zijn er nog. Stuur een bericht in dit gesprek om verder te gaan zodra de verbinding terug is.',
  ja: '会話と保存済みのファイルは残っています。接続が復旧したら、この会話にメッセージを送信して続けてください。',
  ko: '대화와 저장된 파일은 그대로 있습니다. 연결이 복구되면 이 대화에 메시지를 보내 계속하세요.',
  pl: 'Rozmowa i zapisane pliki nadal tu są. Gdy połączenie wróci, wyślij wiadomość w tej rozmowie, aby kontynuować.',
  tr: 'Konuşmanız ve kaydedilen dosyalarınız burada duruyor. Bağlantı geri geldiğinde devam etmek için bu konuşmaya bir mesaj gönderin.',
  uk: 'Ваша розмова та збережені файли залишилися тут. Коли з’єднання відновиться, надішліть повідомлення в цій розмові, щоб продовжити.',
  'zh-CN': '您的对话和已保存的文件仍在这里。连接恢复后，请在此对话中发送消息以继续。',
  'zh-TW': '您的對話和已儲存的檔案仍在這裡。連線恢復後，請在此對話中傳送訊息以繼續。',
  ar: 'محادثتك وملفاتك المحفوظة ما زالت هنا. عندما يعود الاتصال، أرسل رسالة في هذه المحادثة للمتابعة.',
  he: 'השיחה והקבצים השמורים שלך עדיין כאן. כשהחיבור יחזור, אפשר לשלוח הודעה בשיחה הזו כדי להמשיך.',
};
for (const [locale, translation] of Object.entries(translations)) {
  const file = path.join(root, `${locale}.ts`);
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('chat.sessionError.continueConversation')) continue;
  const anchor = /^.*['"]chat\.sessionError\.interrupted['"].*$/m;
  if (!anchor.test(text)) throw new Error(`Translation anchor missing: ${locale}`);
  fs.writeFileSync(file, text.replace(anchor, line => `${line}\n  'chat.sessionError.continueConversation': ${JSON.stringify(translation)},`));
}
