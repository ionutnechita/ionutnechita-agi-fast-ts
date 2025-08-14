#!/usr/bin/env bun
import { Socket } from 'net';

// Quick test with single connection for debugging
class QuickAGITest {
  private host: string;
  private port: number;

  constructor(host = 'localhost', port = 8090) {
    this.host = host;
    this.port = port;
  }

  async testSingleConnection(): Promise<void> {
    console.log('🧪 Quick AGI test - single connection');
    console.log(`🎯 Target: ${this.host}:${this.port}`);
    console.log('');

    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const startTime = Date.now();
      let buffer = '';
      let commandCount = 0;

      const timeout = setTimeout(() => {
        socket.destroy();
        console.log('❌ Timeout - server not responding');
        reject(new Error('Connection timeout'));
      }, 10000);

      socket.connect(this.port, this.host, () => {
        console.log('✅ Connection established');

        // Send AGI variables
        const agiVars = [
          'agi_request: agi://localhost:8090',
          'agi_channel: SIP/quicktest-00000001',
          'agi_language: ro',
          'agi_type: SIP',
          'agi_uniqueid: 1234567890.1',
          'agi_version: 20.7.0',
          'agi_callerid: "Quick Test" <9999>',
          'agi_calleridname: Quick Test',
          'agi_callingpres: 0',
          'agi_context: default',
          'agi_extension: 1000',
          'agi_priority: 1',
          'agi_enhanced: 0.0',
          ''
        ].join('\n') + '\n';

        console.log('📤 Sending AGI variables...');
        socket.write(agiVars);
      });

      socket.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            console.log(`📥 Server says: ${line}`);

            // Auto-respond to commands
            if (line.startsWith('ANSWER')) {
              console.log('📤 Responding to ANSWER...');
              socket.write('200 result=0\n');
              commandCount++;
            } else if (line.startsWith('STREAM FILE')) {
              console.log('📤 Responding to STREAM FILE...');
              socket.write('200 result=0 endpos=12345\n');
              commandCount++;
            } else if (line.startsWith('GET DATA')) {
              console.log('📤 Simulating DTMF input: 12345...');
              socket.write('200 result=12345\n');
              commandCount++;
            } else if (line.startsWith('SET VARIABLE')) {
              console.log('📤 Responding to SET VARIABLE...');
              socket.write('200 result=1\n');
              commandCount++;
            } else if (line.startsWith('VERBOSE')) {
              console.log('📤 Responding to VERBOSE...');
              socket.write('200 result=1\n');
              commandCount++;
            } else if (line.startsWith('HANGUP')) {
              console.log('📤 Responding to HANGUP and closing...');
              socket.write('200 result=1\n');
              commandCount++;
              setTimeout(() => socket.end(), 100);
            }
          }
        }
      });

      socket.on('close', () => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        console.log('');
        console.log('✅ Test completed successfully!');
        console.log(`⏱️ Duration: ${duration}ms`);
        console.log(`📡 Commands processed: ${commandCount}`);
        resolve();
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Connection error:', error.message);

        if (error.message.includes('ECONNREFUSED')) {
          console.log('💡 Suggestions:');
          console.log('   - Check that AGI server is running');
          console.log('   - Check port (8090)');
        }
        reject(error);
      });
    });
  }
}

// Run quick test
const runQuickTest = async () => {
  try {
    const test = new QuickAGITest();
    await test.testSingleConnection();
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
};

runQuickTest();
