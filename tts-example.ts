import { AGIServer, AGIHandler } from './src/index';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Import gTTS fără tipuri oficiale - evit augmentarea modulului
const gTTS = require('gtts') as any;

const execAsync = promisify(exec);

const AUDIO_DIR = '/var/lib/asterisk/sounds';

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
    
    // Testez cu un mesaj mai scurt pentru a evita problemele
    const message = "Bună ziua! Vă mulțumim că ați sunat la centrul nostru de asistență. Pentru a vă ajuta mai eficient, vă rugăm să menționați motivul apelului dvs. Sunteți client înregistrat sau aveți o întrebare generală? Vă stăm la dispoziție cu plăcere.";
    
    console.log('🎵 Redau mesajul TTS...');
    const audioFileName = await generateTTSAudio(message, 'ro', 'welcome-simple');
    console.log('🎵 Cale audio returnată:', audioFileName);
    
    const result = await context.streamFile(audioFileName);
    console.log('🎵 Mesaj TTS redat:', result);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await context.verbose(`TTS Demo completed for ${vars.agi_callerid}`, 1);
    console.log('📝 Log verbose trimis');
    
    await context.setVariable('TTS_DEMO_STATUS', 'SUCCESS');
    console.log('📝 Variabilă setată: TTS_DEMO_STATUS=SUCCESS');
    
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
      await context.close();
      console.log('🚪 Conexiune AGI închisă');
    } catch (closeError) {
      console.error('❌ Eroare la închiderea conexiunii:', closeError);
    }
  }
};

const agiServer = new AGIServer(ttsHandler, {
  port: 3000,
  debug: true,
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
    await generateTTSAudio("Bună ziua! Vă mulțumim că ați sunat la centrul nostru de asistență. Pentru a vă ajuta mai eficient, vă rugăm să menționați motivul apelului dvs. Sunteți client înregistrat sau aveți o întrebare generală? Vă stăm la dispoziție cu plăcere.", 'ro');
    console.log('✅ Fișier TTS pre-generat cu succes');
  } catch (error) {
    console.error('⚠️ Nu pot pre-genera TTS, va fi generat la primul apel:', error);
  }
};

const startServer = async () => {
  try {
    await preGenerateTTS();
    
    agiServer.init();
    
    console.log('🚀 Server AGI cu TTS pornit pe portul 3000');
    console.log('');
    console.log('✨ Funcționalități:');
    console.log('  - Google Text-to-Speech (română)');
    console.log('  - Generare automată fișiere audio');
    console.log('  - Mesaj: "Bună ziua! Vă mulțumim că ați sunat la centrul nostru de asistență. Pentru a vă ajuta mai eficient, vă rugăm să menționați motivul apelului dvs. Sunteți client înregistrat sau aveți o întrebare generală? Vă stăm la dispoziție cu plăcere."');
    console.log('  - Directorul audio: /var/lib/asterisk/sounds/');
    console.log('');
    console.log('📞 Configurație Asterisk extensions.conf:');
    console.log('[default]');
    console.log('exten => 1000,1,AGI(agi://localhost:3000)');
    console.log('exten => 1000,n,Hangup()');
    console.log('');
    console.log('🎭 Pentru a testa:');
    console.log('  1. Adaugă configurația în extensions.conf');
    console.log('  2. Reîncarcă Asterisk: asterisk -rx "dialplan reload"');
    console.log('  3. Sună la extensia 1000');
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