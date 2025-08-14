import { describe, it, expect, beforeEach } from 'bun:test';
import { MemoryStream } from './memory-stream';
import { AGIServer } from '../src/agi-server';
import { AGIContext } from '../src/agi-context';
import { AGIState } from '../src/types';

// Test helpers
const writeVars = (stream: MemoryStream): void => {
  stream.write('agi_network: yes\n');
  stream.write('agi_uniqueid: 13507138.14\n');
  stream.write('agi_arg_1: test\n');
  stream.write('\n\n');
};

const createContext = (cb: (ctx: TestAGIContext) => void): void => {
  const stream = new MemoryStream();
  const ctx = new AGIContext(stream as any, { debug: false }) as TestAGIContext;

  // Mock the send method to capture sent commands
  ctx.sent = [];
  (ctx as any).send = function (msg: string, callback?: Function) {
    ctx.sent.push(msg);
    if (callback) {
      (ctx as any).pending = callback;
    }
  };

  // Expose stream for testing
  (ctx as any).testStream = stream;

  ctx.once('variables', () => {
    cb(ctx);
  });

  writeVars(stream);
};

interface TestAGIContext extends AGIContext {
  sent: string[];
}

describe('Context', () => {
  let context: TestAGIContext;

  beforeEach((done) => {
    createContext((ctx) => {
      context = ctx;
      done();
    });
  });

  describe('parsing variables', () => {
    it('works', (done) => {
      const vars = context.variables;
      expect(vars['agi_network']).toBeTruthy();
      expect(vars['agi_network']).toBe('yes');
      expect(vars['agi_uniqueid']).toBe('13507138.14');
      expect(vars['agi_arg_1']).toBe('test');
      done();
    });

    it('puts context into waiting state', () => {
      expect((context as any).state).toBe(AGIState.WAITING);
    });
  });

  describe('sending command', () => {
    it('writes out', () => {
      (context as any).send('EXEC test');
      expect(context.sent.length).toBe(1);
      expect(context.sent.join('')).toBe('EXEC test');
    });
  });

  describe('context.exec', () => {
    it('sends exec command', () => {
      context.exec('test', 'bang', 'another');
      expect(context.sent.join('')).toBe('EXEC test bang another\n');
    });
  });

  describe('command flow', () => {
    describe('success', () => {
      it('emits proper response', (done) => {
        process.nextTick(() => {
          context.exec('test', 'bang', 'another');
          (context as any).testStream.write('200');
          (context as any).testStream.write(' result=0\n\n');
        });

        context.on('response', (msg: any) => {
          expect(msg.code).toBe(200);
          expect(msg.result).toBe('0');
          done();
        });
      });

      it('invokes callback with response', async () => {
        process.nextTick(() => {
          (context as any).testStream.write('200 result=0\n');
        });

        await context.exec('test', 'boom');
      });

      it('includes the response value', (done) => {
        process.nextTick(() => {
          context.exec('test', 'bang', 'another');
          (context as any).testStream.write('200');
          (context as any).testStream.write(' result=0 (a value)\n\n');
        });

        context.on('response', (msg: any) => {
          expect(msg.code).toBe(200);
          expect(msg.result).toBe('0');
          expect(msg.value).toBe('a value');
          done();
        });
      });
    });

    describe('two commands', () => {
      it('invokes two callbacks', async () => {
        process.nextTick(() => {
          (context as any).testStream.write('200 result=0\n');
        });

        const res1 = await context.exec('test');
        expect(res1.result).toBe('0');

        process.nextTick(() => {
          (context as any).testStream.write('200 result=1\n');
        });

        const res2 = await context.exec('test 2');
        expect(res2.result).toBe('1');
      });
    });
  });

  describe('hangup', () => {
    it('raises hangup on context', (done) => {
      context.on('hangup', done);
      (context as any).testStream.write('HANGUP\n');
    });
  });

  // Database commands
  describe('databaseDel', () => {
    it('sends correct command', () => {
      context.databaseDel('family', 'test');
      expect(context.sent.join('')).toBe('DATABASE DEL family test\n');
    });
  });

  describe('databaseDelTree', () => {
    it('sends correct command', () => {
      context.databaseDelTree('family', 'test');
      expect(context.sent.join('')).toBe('DATABASE DELTREE family test\n');
    });
  });

  describe('databaseGet', () => {
    it('sends correct command', () => {
      context.databaseGet('family', 'test');
      expect(context.sent.join('')).toBe('DATABASE GET family test\n');
    });
  });

  describe('databasePut', () => {
    it('sends correct command', () => {
      context.databasePut('family', 'test', 'value');
      expect(context.sent.join('')).toBe('DATABASE PUT family test value\n');
    });
  });

  // Speech commands
  describe('speechCreate', () => {
    it('sends correct command', () => {
      context.speechCreate('engine');
      expect(context.sent.join('')).toBe('SPEECH CREATE engine\n');
    });
  });

  describe('speechDestroy', () => {
    it('sends correct command', () => {
      context.speechDestroy();
      expect(context.sent.join('')).toBe('SPEECH DESTROY\n');
    });
  });

  describe('speechActivateGrammar', () => {
    it('sends correct command', () => {
      context.speechActivateGrammar('name');
      expect(context.sent.join('')).toBe('SPEECH ACTIVATE GRAMMAR name\n');
    });
  });

  describe('speechDeactivateGrammar', () => {
    it('sends correct command', () => {
      context.speechDeactivateGrammar('name');
      expect(context.sent.join('')).toBe('SPEECH DEACTIVATE GRAMMAR name\n');
    });
  });

  describe('speechLoadGrammar', () => {
    it('sends correct command', () => {
      context.speechLoadGrammar('name', 'path');
      expect(context.sent.join('')).toBe('SPEECH LOAD GRAMMAR name path\n');
    });
  });

  describe('speechUnloadGrammar', () => {
    it('sends correct command', () => {
      context.speechUnloadGrammar('name');
      expect(context.sent.join('')).toBe('SPEECH UNLOAD GRAMMAR name\n');
    });
  });

  describe('speechSet', () => {
    it('sends correct command', () => {
      context.speechSet('name', 'value');
      expect(context.sent.join('')).toBe('SPEECH SET name value\n');
    });
  });

  describe('speechRecognize', () => {
    it('sends correct command', () => {
      context.speechRecognize('prompt', 123, 456);
      expect(context.sent.join('')).toBe('SPEECH RECOGNIZE prompt 123 456\n');
    });
  });

  // Variable commands
  describe('setVariable', () => {
    it('sends correct command', () => {
      context.setVariable('test', 'test test test');
      expect(context.sent.join('')).toBe('SET VARIABLE test "test test test"\n');
    });
  });

  describe('getVariable', () => {
    it('sends correct command', () => {
      context.getVariable('test');
      expect(context.sent.join('')).toBe('GET VARIABLE test\n');
    });
  });

  describe('getFullVariable', () => {
    it('sends correct command', () => {
      context.getFullVariable('test', 'channel');
      expect(context.sent.join('')).toBe('GET FULL VARIABLE test channel\n');
    });
  });

  // Channel control commands
  describe('setAutoHangup', () => {
    it('sends correct command', () => {
      context.setAutoHangup(10);
      expect(context.sent.join('')).toBe('SET AUTOHANGUP 10\n');
    });
  });

  describe('setCallerID', () => {
    it('sends correct command', () => {
      context.setCallerID('246');
      expect(context.sent.join('')).toBe('SET CALLERID 246\n');
    });
  });

  describe('setContext', () => {
    it('sends correct command', () => {
      context.setContext('outbound');
      expect(context.sent.join('')).toBe('SET CONTEXT outbound\n');
    });
  });

  describe('setExtension', () => {
    it('sends correct command', () => {
      context.setExtension('245');
      expect(context.sent.join('')).toBe('SET EXTENSION 245\n');
    });
  });

  describe('setPriority', () => {
    it('sends correct command', () => {
      context.setPriority(2);
      expect(context.sent.join('')).toBe('SET PRIORITY 2\n');
    });
  });

  describe('setMusic', () => {
    it('sends correct command', () => {
      context.setMusic(true);
      expect(context.sent.join('')).toBe('SET MUSIC true\n');
    });
  });

  describe('channelStatus', () => {
    it('sends correct command', () => {
      context.channelStatus('test');
      expect(context.sent.join('')).toBe('CHANNEL STATUS test\n');
    });
  });

  // Input/Output commands
  describe('getData', () => {
    it('sends correct command', () => {
      context.getData('test', 10, 5);
      expect(context.sent.join('')).toBe('GET DATA test 10 5\n');
    });
  });

  describe('getOption', () => {
    it('sends correct command', () => {
      context.getOption('test', '#', 5);
      expect(context.sent.join('')).toBe('GET OPTION test "#" 5\n');
    });
  });

  describe('receiveChar', () => {
    it('sends correct command', () => {
      context.receiveChar(5);
      expect(context.sent.join('')).toBe('RECEIVE CHAR 5\n');
    });
  });

  describe('receiveText', () => {
    it('sends correct command', () => {
      context.receiveText(5);
      expect(context.sent.join('')).toBe('RECEIVE TEXT 5\n');
    });
  });

  // Audio/Media commands
  describe('stream file', () => {
    it('sends', () => {
      context.streamFile('test', '1234567890#*');
      expect(context.sent.join('')).toBe('STREAM FILE "test" "1234567890#*"\n');
    });
  });

  describe('record file', () => {
    it('record', () => {
      context.recordFile('test', 'wav', '#', 10, 0, true, 2);
      expect(context.sent.join('')).toBe('RECORD FILE test wav "#" 10 0 true 2000\n');
    });
  });

  // Say commands
  describe('say number', () => {
    it('say number', () => {
      context.sayNumber(1234, '#');
      expect(context.sent.join('')).toBe('SAY NUMBER 1234 "#"\n');
    });
  });

  describe('say alpha', () => {
    it('say alpha', () => {
      context.sayAlpha('1234', '#');
      expect(context.sent.join('')).toBe('SAY ALPHA 1234 "#"\n');
    });
  });

  describe('say date', () => {
    it('say date', () => {
      context.sayDate(1234, '#');
      expect(context.sent.join('')).toBe('SAY DATE 1234 "#"\n');
    });
  });

  describe('say time', () => {
    it('say time', () => {
      context.sayTime(1234, '#');
      expect(context.sent.join('')).toBe('SAY TIME 1234 "#"\n');
    });
  });

  describe('say datetime', () => {
    it('say datetime', () => {
      context.sayDateTime(1234, '#', 'Y', 'DST');
      expect(context.sent.join('')).toBe('SAY DATETIME 1234 "#" Y DST\n');
    });
  });

  describe('say phonetic', () => {
    it('say phonetic', () => {
      context.sayPhonetic('1234ABCD', '#');
      expect(context.sent.join('')).toBe('SAY PHONETIC 1234ABCD "#"\n');
    });
  });

  describe('say digits', () => {
    it('say digits', () => {
      context.sayDigits('1234', '#');
      expect(context.sent.join('')).toBe('SAY DIGITS 1234 "#"\n');
    });
  });

  // Misc commands
  describe('context dial', () => {
    it('context dial', () => {
      context.dial('123', 10, 'A');
      expect(context.sent.join('')).toBe('EXEC Dial 123,10,A\n');
    });
  });

  describe('send image', () => {
    it('send image', () => {
      context.sendImage('1234');
      expect(context.sent.join('')).toBe('SEND IMAGE 1234\n');
    });
  });

  describe('send text', () => {
    it('send text', () => {
      context.sendText('1234');
      expect(context.sent.join('')).toBe('SEND TEXT "1234"\n');
    });
  });

  describe('waitForDigit', () => {
    it('sends with default timeout', () => {
      context.waitForDigit(5000);
      expect(context.sent.join('')).toBe('WAIT FOR DIGIT 5000\n');
    });

    it('sends with specified timeout', () => {
      context.waitForDigit(-1);
      expect(context.sent.join('')).toBe('WAIT FOR DIGIT -1\n');
    });
  });

  describe('hangup', () => {
    it('sends "HANGUP\\n"', () => {
      context.hangup();
      expect(context.sent.join('')).toBe('HANGUP\n');
    });
  });

  describe('asyncAGIBreak', () => {
    it('sends "ASYNCAGI BREAK\\n"', () => {
      context.asyncAGIBreak();
      expect(context.sent.join('')).toBe('ASYNCAGI BREAK\n');
    });
  });

  describe('answer', () => {
    it('sends "ANSWER\\n"', () => {
      context.answer();
      expect(context.sent.join('')).toBe('ANSWER\n');
    });
  });

  describe('verbose', () => {
    it('sends correct command', () => {
      context.verbose('good', 2);
      expect(context.sent.join('')).toBe('VERBOSE "good" 2\n');
    });
  });

  describe('tddMode', () => {
    it('sends correct command', () => {
      context.tddMode(true);
      expect(context.sent.join('')).toBe('TDD MODE true\n');
    });
  });

  describe('noop', () => {
    it('sends correct command', () => {
      context.noop();
      expect(context.sent.join('')).toBe('NOOP\n');
    });
  });

  describe('gosub', () => {
    it('sends correct command', () => {
      context.gosub('out', '241', 6, 'do');
      expect(context.sent.join('')).toBe('GOSUB out 241 6 do\n');
    });
  });

  describe('dead channel handling', () => {
    it('handles 511 dead channel response gracefully', async () => {
      // Mock sending a command that will get a dead channel response
      const commandPromise = context.hangup();

      // Simulate the dead channel response from Asterisk
      process.nextTick(() => {
        (context as any).testStream.write('511 Command Not Permitted on a dead channel or intercept routine\n');
      });

      const result = await commandPromise;
      expect(result.code).toBe(511);
      expect(result.result).toContain('Command Not Permitted on a dead channel');
      expect(result.isDeadChannel).toBe(true);
    });

    it('handles regular 511 errors as errors', async () => {
      const commandPromise = context.hangup();

      process.nextTick(() => {
        (context as any).testStream.write('511 Command Not Permitted\n');
      });

      try {
        await commandPromise;
        expect(false).toBe(true); // Should not reach here
      } catch (error: any) {
        expect(error.name).toBe('AGICommandError');
        expect(error.code).toBe(511);
      }
    });

    it('handles other error codes properly', async () => {
      const commandPromise = context.hangup();

      process.nextTick(() => {
        (context as any).testStream.write('520 Unknown command\n');
      });

      try {
        await commandPromise;
        expect(false).toBe(true); // Should not reach here
      } catch (error: any) {
        expect(error.name).toBe('AGICommandError');
        expect(error.code).toBe(520);
      }
    });
  });

  describe('response parsing', () => {
    it('parses standard responses correctly', (done) => {
      context.on('response', (response: any) => {
        expect(response.code).toBe(200);
        expect(response.result).toBe('1');
        expect(response.value).toBe('timeout');
        done();
      });

      process.nextTick(() => {
        (context as any).testStream.write('200 result=1(timeout)\n');
      });

      context.noop();
    });

    it('parses non-result format responses', (done) => {
      context.on('response', (response: any) => {
        expect(response.code).toBe(511);
        expect(response.result).toBe('Command Not Permitted on a dead channel');
        done();
      });

      process.nextTick(() => {
        (context as any).testStream.write('511 Command Not Permitted on a dead channel\n');
      });

      context.noop();
    });

    it('parses responses with value in parentheses', (done) => {
      context.on('response', (response: any) => {
        expect(response.code).toBe(200);
        expect(response.result).toBe('0');
        expect(response.value).toBe('beep');
        done();
      });

      process.nextTick(() => {
        (context as any).testStream.write('200 result=0(beep)\n');
      });

      context.noop();
    });

    it('parses responses with direct format like "1(timeout)"', (done) => {
      context.on('response', (response: any) => {
        expect(response.code).toBe(200);
        expect(response.result).toBe('1');
        expect(response.value).toBe('timeout');
        done();
      });

      process.nextTick(() => {
        (context as any).testStream.write('200 1(timeout)\n');
      });

      context.noop();
    });
  });

  describe('timeout and retry logic', () => {
    it('handles command timeout in development mode', async () => {
      // Create context with short timeout for testing
      const stream = new MemoryStream();
      const testContext = new AGIContext(stream as any, {
        debug: false,
        commandTimeout: 100,  // Very short timeout
        maxRetries: 0  // No retries for faster test
      }) as TestAGIContext;

      // Mock the send method
      testContext.sent = [];
      (testContext as any).send = function (msg: string, callback?: Function) {
        testContext.sent.push(msg);
        if (callback) {
          (testContext as any).pending = callback;
        }
      };

      // Initialize variables
      writeVars(stream);

      // Wait for variables to be processed
      await new Promise<void>((resolve) => {
        testContext.once('variables', () => resolve());
      });

      try {
        // This should timeout since we never send a response
        await testContext.noop();
        expect(false).toBe(true); // Should not reach here
      } catch (error: any) {
        expect(error.name).toBe('AGITimeoutError');
        expect(error.timeout).toBe(100);
      }
    });
  });

  describe('events', () => {
    describe('error', () => {
      it('is emitted when socket emits error', (done) => {
        context.on('error', (err: any) => {
          expect(err.name).toBe('AGIConnectionError');
          expect(err.message).toContain('Stream error');
          expect(err.details).toBeDefined();
          expect(err.details.connectionId).toBeDefined();
          done();
        });
        (context as any).testStream.emit('error', new Error('test error'));
      });
    });

    describe('close', () => {
      it('is emitted when socket emits close', (done) => {
        context.on('close', () => {
          done();
        });
        (context as any).testStream.emit('close');
      });
    });
  });

  describe('parameter preparation', () => {
    it('applies default values and preparation functions for streamFile', () => {
      context.streamFile('test-audio');
      // Should send: STREAM FILE "test-audio" "#"
      const sent = context.sent.join('');
      expect(sent).toBe('STREAM FILE "test-audio" "#"\n');
    });

    it('properly quotes escape digits in streamFile', () => {
      context.streamFile('test-audio', '0123');
      // Should send: STREAM FILE "test-audio" "0123"
      const sent = context.sent.join('');
      expect(sent).toBe('STREAM FILE "test-audio" "0123"\n');
    });

    it('handles commands without parameter rules', () => {
      context.noop();
      // Should send: NOOP
      const sent = context.sent.join('');
      expect(sent).toBe('NOOP\n');
    });
  });
});

describe('AGIServer configuration options', () => {
  it('accepts host configuration option', () => {
    const agiServer = new AGIServer(() => { }, { host: '0.0.0.0', port: 3001 });
    expect((agiServer as any).options.host).toBe('0.0.0.0');
    expect((agiServer as any).options.port).toBe(3001);
  });

  it('uses default host and port when not specified', () => {
    const agiServer = new AGIServer(() => { });
    expect((agiServer as any).options.host).toBe('localhost');
    expect((agiServer as any).options.port).toBe(8090);
  });
});

describe('AGIServer#createServer', () => {
  it('returns instance of net.Server', () => {
    const agiServer = new AGIServer(() => { });
    expect((agiServer as any).server).toBeDefined();
  });

  it('invokes callback when a new connection is established', () => {
    let callbackInvoked = false;
    const agiServer = new AGIServer((context) => {
      expect(context).toBeDefined();
      callbackInvoked = true;
    }, {
      port: 3002,
    });

    // Create a mock socket and invoke the handler directly
    const mockSocket = new MemoryStream();
    const handler = (agiServer as any).handler;
    const context = new AGIContext(mockSocket as any);

    handler(context);
    expect(callbackInvoked).toBe(true);
  });
});