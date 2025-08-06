import { AGIServer, AGIHandler } from './src/index';
import { createWriteStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Import gTTS fără tipuri oficiale - evit augmentarea modulului
const gTTS = require('gtts') as any;

const execAsync = promisify(exec);

const AUDIO_DIR = '/var/lib/asterisk/sounds';

// Funcție pentru ștergerea fișierelor temporare
async function cleanupTempFiles(fileNames: string[]): Promise<void> {
  for (const fileName of fileNames) {
    try {
      const extensions = ['.mp3', '.wav', '.gsm'];
      for (const ext of extensions) {
        const filePath = join(AUDIO_DIR, `${fileName}${ext}`);
        try {
          await unlink(filePath);
          console.log(`🗑️ Șters fișier temporar: ${fileName}${ext}`);
        } catch (error) {
          // Fișierul probabil nu există, continuă
        }
      }
    } catch (error) {
      console.error(`⚠️ Nu pot șterge fișierul temporar ${fileName}:`, error);
    }
  }
}

async function generateTTSAudio(text: string, language = 'ro', fileName = 'welcome-tts'): Promise<string> {
  console.log(`🎤 Generez audio TTS pentru: "${text}"`);

  try {
    await mkdir(AUDIO_DIR, { recursive: true });

    // Folosesc numele custom pentru fișier
    const mp3Path = join(AUDIO_DIR, `${fileName}.mp3`);
    const wavPath = join(AUDIO_DIR, `${fileName}.wav`);

    const gtts = new gTTS(text, language);

    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(mp3Path);

      stream.on('finish', () => {
        console.log(`✅ Audio MP3 generat: ${mp3Path}`);
        resolve();
      });

      stream.on('error', (error) => {
        console.error('❌ Eroare la generarea MP3:', error);
        reject(error);
      });

      gtts.stream().pipe(stream);
    });

    console.log('🔄 Convertesc MP3 în format GSM pentru Asterisk...');

    try {
      const gsmPath = wavPath.replace('.wav', '.gsm');
      // Conversie optimizată pentru Asterisk cu normalizare audio
      await execAsync(`sox "${mp3Path}" -r 8000 -c 1 -b 16 "${gsmPath}" norm -1`);
      console.log('✅ Audio convertit în GSM cu sox (optimizat)');
      return fileName;
    } catch (soxError) {
      console.log('⚠️ Sox nu e disponibil, încerc cu ffmpeg...');

      try {
        await execAsync(`ffmpeg -i "${mp3Path}" -ar 8000 -ac 1 -acodec pcm_s16le "${wavPath}" -y`);
        console.log('✅ Audio convertit în WAV cu ffmpeg');
        return fileName;
      } catch (ffmpegError) {
        console.log('⚠️ Ffmpeg nu e disponibil, folosesc MP3 direct...');

        await execAsync(`cp "${mp3Path}" "${wavPath}"`);
        console.log('⚠️ Folosesc MP3 ca fallback (poate să nu funcționeze)');
        return fileName;
      }
    }

  } catch (error) {
    console.error('❌ Eroare gTTS:', error);
    throw error;
  }
}

const ttsHandler: AGIHandler = async (context) => {
  const tempFiles: string[] = []; // Lista fișierelor temporare de șters

  try {
    console.log('📞 Conexiune AGI primită pentru TTS demo');

    const vars = await context.onEvent('variables');
    console.log('📊 Variabile AGI:', {
      channel: vars.agi_channel,
      uniqueid: vars.agi_uniqueid,
      callerid: vars.agi_callerid,
      extension: vars.agi_extension
    });

    await context.answer();
    console.log('✅ Apel răspuns');

    // 1. Redă mesajul TTS pentru cerere cod
    const message = "Bună ziua! Vă mulțumim că ați sunat la centrul nostru de asistență. Pentru a vă ajuta mai eficient, vă rugăm să introduceți codul dvs. personal urmat de tasta diez.";

    console.log('🎵 Redau mesajul TTS...');
    const audioFileName = await generateTTSAudio(message, 'ro', 'welcome-dtmf');
    console.log('🎵 Cale audio returnată:', audioFileName);

    const result = await context.streamFile(audioFileName);
    console.log('🎵 Mesaj TTS redat:', result);

    // 2. Așteaptă input DTMF - max 20 de cifre, timeout 5 secunde între taste, se termină la #
    console.log('👂 Aștept cod DTMF...');
    const dtmfResult = await context.getData('beep', 5000, 20);
    const digits = dtmfResult.result;

    if (digits && digits.length > 0) {
      console.log(`🔢 Cod primit: ${digits}`);

      // Verifică dacă codul e numeric
      if (/^\d+$/.test(digits)) {
        console.log('✅ Cod valid');

        // 3. Spune înapoi codul introdus (TTS)
        const echoMessage = `Codul introdus este: ${digits.replace(/./g, '$& ').trim()}. Mulțumim.`;
        const echoFileName = await generateTTSAudio(echoMessage, 'ro', `echo-${Date.now()}`);
        tempFiles.push(echoFileName); // Marchează pentru ștergere
        await context.streamFile(echoFileName);
        console.log('🎵 Cod confirmat prin TTS');

        await context.setVariable('DTMF_CODE', digits);
        await context.setVariable('TTS_DEMO_STATUS', 'SUCCESS');
        console.log(`📝 Cod salvat: ${digits}`);
      } else {
        console.log('❌ Cod invalid (conține caractere non-numerice)');
        const invalidMessage = "Codul introdus nu este valid. Vă rugăm să folosiți doar cifre. La revedere.";
        const invalidFileName = await generateTTSAudio(invalidMessage, 'ro', `invalid-${Date.now()}`);
        tempFiles.push(invalidFileName); // Marchează pentru ștergere
        await context.streamFile(invalidFileName);

        await context.setVariable('DTMF_CODE', 'INVALID');
        await context.setVariable('TTS_DEMO_STATUS', 'INVALID_INPUT');
      }
    } else {
      console.log('❌ Niciun cod introdus');
      const noInputMessage = "Nu a fost introdus niciun cod. La revedere.";
      const noInputFileName = await generateTTSAudio(noInputMessage, 'ro', `noinput-${Date.now()}`);
      tempFiles.push(noInputFileName); // Marchează pentru ștergere
      await context.streamFile(noInputFileName);

      await context.setVariable('DTMF_CODE', 'NONE');
      await context.setVariable('TTS_DEMO_STATUS', 'NO_INPUT');
    }

    await context.verbose(`DTMF Code received: ${digits || 'NONE'}`, 1);
    console.log('📝 Log verbose trimis');

    await context.hangup();
    console.log('📞 Apel închis');

  } catch (error: any) {
    console.error('❌ Eroare în handler TTS:', error);

    try {
      await context.setVariable('TTS_DEMO_STATUS', 'ERROR');
      await context.verbose(`TTS Demo failed: ${error.message}`, 1);
    } catch (setError) {
      console.error('❌ Nu pot seta variabila de eroare:', setError);
    }
  } finally {
    try {
      // Șterge fișierele temporare generate în timpul conversației
      if (tempFiles.length > 0) {
        console.log('🧹 Curăț fișierele temporare...');
        await cleanupTempFiles(tempFiles);
        console.log('✅ Curățare completă');
      }

      await context.close();
      console.log('🚪 Conexiune AGI închisă');
    } catch (closeError) {
      console.error('❌ Eroare la închiderea conexiunii:', closeError);
    }
  }
};

const agiServer = new AGIServer(ttsHandler, {
  port: 8090,
  debug: false,
  host: '::'
});

agiServer.on('error', (error) => {
  console.error('🚨 Eroare server AGI:', error.message);
});

agiServer.on('close', () => {
  console.log('🚪 Server AGI închis');
});

const shutdown = async () => {
  console.log('\\n👋 Închid serverul TTS...');

  try {
    await agiServer.close();
    console.log('✅ Server TTS închis cu succes');
    process.exit(0);
  } catch (error) {
    console.error('❌ Eroare la închiderea serverului:', error);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const preGenerateTTS = async () => {
  try {
    console.log('🚀 Pre-generez fișierul TTS...');
    await generateTTSAudio("Bună ziua! Vă mulțumim că ați sunat la centrul nostru de asistență. Pentru a vă ajuta mai eficient, vă rugăm să introduceți codul dvs. personal urmat de tasta diez.", 'ro', 'welcome-dtmf');
    console.log('✅ Fișier TTS pre-generat cu succes');
  } catch (error) {
    console.error('⚠️ Nu pot pre-genera TTS, va fi generat la primul apel:', error);
  }
};

const startServer = async () => {
  try {
    await preGenerateTTS();

    agiServer.init();

    console.log('🚀 Server AGI cu TTS și DTMF pornit pe portul 8090');
    console.log('');
    console.log('✨ Funcționalități:');
    console.log('  - Google Text-to-Speech (română)');
    console.log('  - Citire input DTMF (coduri numerice)');
    console.log('  - Generare automată fișiere audio');
    console.log('  - Validare și confirmare coduri introduse');
    console.log('  - Directorul audio: /var/lib/asterisk/sounds/');
    console.log('');
    console.log('📞 Configurație Asterisk extensions.conf:');
    console.log('[default]');
    console.log('exten => 1000,1,AGI(agi://localhost:8090)');
    console.log('exten => 1000,n,Hangup()');
    console.log('');
    console.log('🎭 Pentru a testa:');
    console.log('  1. Adaugă configurația în extensions.conf');
    console.log('  2. Reîncarcă Asterisk: asterisk -rx "dialplan reload"');
    console.log('  3. Sună la extensia 1000');
    console.log('  4. Ascultă mesajul TTS');
    console.log('  5. Introdu un cod numeric (ex: 23313) urmat de #');
    console.log('  6. Ascultă confirmarea');
    console.log('');

  } catch (error) {
    console.error('❌ Eroare la pornirea serverului:', error);
    process.exit(1);
  }
};

// Configurez timeout-uri mai mari pentru operațiuni TTS
process.env.NODE_ENV = 'production'; // 5000ms default

startServer();

setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(`📊 Memorie: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB | Uptime: ${Math.round(process.uptime())}s`);
}, 60000);