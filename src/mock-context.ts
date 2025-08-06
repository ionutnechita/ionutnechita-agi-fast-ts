import { EventEmitter } from 'events';
import { AGIContext as IAGIContext, AGIVariables, AGIResponse } from './types';
import { AGIMockResponses } from './dev-utils';

/**
 * Mock AGI Context that simulates AGI functionality without real connections
 * Used for clean development testing without socket connections
 */
export class MockAGIContext extends EventEmitter implements IAGIContext {
  public variables: AGIVariables = {
    agi_channel: 'SIP/mock-channel-001',
    agi_uniqueid: 'mock-' + Date.now(),
    agi_callerid: '1234567890',
    agi_context: 'default',
    agi_extension: '1000',
    agi_priority: '1',
    agi_language: 'en',
    agi_type: 'SIP',
    agi_accountcode: '',
    agi_enhanced: '0.0',
    agi_version: '20.3.0'
  };

  public debug: boolean = false;

  constructor() {
    super();

    // Emit variables immediately to simulate AGI initialization
    setTimeout(() => {
      this.emit('variables', this.variables);
    }, 10);
  }

  public async sendCommand(command: string): Promise<AGIResponse> {
    // Always use mock responses
    const mockResponse = AGIMockResponses.getMockResponse(command);

    if (mockResponse) {
      // Simulate realistic delay
      if (mockResponse.delay) {
        await new Promise(resolve => setTimeout(resolve, mockResponse.delay));
      }

      const response: AGIResponse = {
        code: mockResponse.code,
        result: mockResponse.result,
        value: mockResponse.value,
        timestamp: Date.now(),
        command: command
      };

      return response;
    }

    // Default mock response
    return {
      code: 200,
      result: '0',
      timestamp: Date.now(),
      command: command
    };
  }

  public async onEvent(event: string, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const eventTimeout = timeout || 30000;

      const timeoutId = setTimeout(() => {
        reject(new Error(`Mock event '${event}' timeout after ${eventTimeout}ms`));
      }, eventTimeout);

      const eventHandler = (data: any) => {
        clearTimeout(timeoutId);
        resolve(data);
      };

      this.once(event, eventHandler);
    });
  }

  public async close(): Promise<void> {
    // Mock close - no actual connection to close
    return Promise.resolve();
  }

  // All AGI command implementations - these will return mock responses
  public async answer(): Promise<AGIResponse> {
    return this.sendCommand('ANSWER');
  }

  public async hangup(): Promise<AGIResponse> {
    return this.sendCommand('HANGUP');
  }

  public async noop(): Promise<AGIResponse> {
    return this.sendCommand('NOOP');
  }

  public async getVariable(name: string): Promise<AGIResponse> {
    return this.sendCommand(`GET VARIABLE ${name}`);
  }

  public async getFullVariable(name: string, channel?: string): Promise<AGIResponse> {
    const cmd = channel ? `GET FULL VARIABLE ${name} ${channel}` : `GET FULL VARIABLE ${name}`;
    return this.sendCommand(cmd);
  }

  public async setVariable(name: string, value: string): Promise<AGIResponse> {
    return this.sendCommand(`SET VARIABLE ${name} "${value}"`);
  }

  public async streamFile(filename: string, escapeDigits?: string): Promise<AGIResponse> {
    const cmd = escapeDigits ? `STREAM FILE ${filename} "${escapeDigits}"` : `STREAM FILE ${filename} ""`;
    return this.sendCommand(cmd);
  }

  public async controlStreamFile(filename: string, escapeDigits?: string, skipms?: number, ffchar?: string, rewchr?: string, pausechr?: string, offsetms?: number): Promise<AGIResponse> {
    return this.sendCommand(`CONTROL STREAM FILE ${filename}`);
  }

  public async recordFile(filename: string, format?: string, escapeDigits?: string, timeout?: number, offsetSamples?: number, beep?: boolean, silence?: number): Promise<AGIResponse> {
    return this.sendCommand(`RECORD FILE ${filename} ${format || 'wav'}`);
  }

  public async sayNumber(number: number, escapeDigits?: string): Promise<AGIResponse> {
    return this.sendCommand(`SAY NUMBER ${number} "${escapeDigits || ''}"`);
  }

  public async sayAlpha(text: string, escapeDigits?: string): Promise<AGIResponse> {
    return this.sendCommand(`SAY ALPHA ${text} "${escapeDigits || ''}"`);
  }

  public async sayDate(date: number, escapeDigits?: string): Promise<AGIResponse> {
    return this.sendCommand(`SAY DATE ${date} "${escapeDigits || ''}"`);
  }

  public async sayTime(time: number, escapeDigits?: string): Promise<AGIResponse> {
    return this.sendCommand(`SAY TIME ${time} "${escapeDigits || ''}"`);
  }

  public async sayDateTime(datetime: number, escapeDigits?: string, format?: string, timezone?: string): Promise<AGIResponse> {
    return this.sendCommand(`SAY DATETIME ${datetime}`);
  }

  public async sayDigits(digits: string, escapeDigits?: string): Promise<AGIResponse> {
    return this.sendCommand(`SAY DIGITS ${digits} "${escapeDigits || ''}"`);
  }

  public async sayPhonetic(text: string, escapeDigits?: string): Promise<AGIResponse> {
    return this.sendCommand(`SAY PHONETIC ${text} "${escapeDigits || ''}"`);
  }

  public async getData(filename: string, timeout?: number, maxDigits?: number): Promise<AGIResponse> {
    return this.sendCommand(`GET DATA ${filename} ${timeout || 5000} ${maxDigits || 4}`);
  }

  public async getOption(filename: string, escapeDigits?: string, timeout?: number): Promise<AGIResponse> {
    return this.sendCommand(`GET OPTION ${filename}`);
  }

  public async waitForDigit(timeout: number): Promise<AGIResponse> {
    return this.sendCommand(`WAIT FOR DIGIT ${timeout}`);
  }

  public async receiveChar(timeout: number): Promise<AGIResponse> {
    return this.sendCommand(`RECEIVE CHAR ${timeout}`);
  }

  public async receiveText(timeout: number): Promise<AGIResponse> {
    return this.sendCommand(`RECEIVE TEXT ${timeout}`);
  }

  public async channelStatus(channel?: string): Promise<AGIResponse> {
    return this.sendCommand(`CHANNEL STATUS ${channel || ''}`);
  }

  public async setAutoHangup(time: number): Promise<AGIResponse> {
    return this.sendCommand(`SET AUTOHANGUP ${time}`);
  }

  public async setCallerID(callerid: string): Promise<AGIResponse> {
    return this.sendCommand(`SET CALLERID ${callerid}`);
  }

  public async setContext(context: string): Promise<AGIResponse> {
    return this.sendCommand(`SET CONTEXT ${context}`);
  }

  public async setExtension(extension: string): Promise<AGIResponse> {
    return this.sendCommand(`SET EXTENSION ${extension}`);
  }

  public async setPriority(priority: number): Promise<AGIResponse> {
    return this.sendCommand(`SET PRIORITY ${priority}`);
  }

  public async setMusic(on: boolean): Promise<AGIResponse> {
    return this.sendCommand(`SET MUSIC ${on ? 'ON' : 'OFF'}`);
  }

  public async databaseGet(family: string, key: string): Promise<AGIResponse> {
    return this.sendCommand(`DATABASE GET ${family} ${key}`);
  }

  public async databasePut(family: string, key: string, value: string): Promise<AGIResponse> {
    return this.sendCommand(`DATABASE PUT ${family} ${key} ${value}`);
  }

  public async databaseDel(family: string, key: string): Promise<AGIResponse> {
    return this.sendCommand(`DATABASE DEL ${family} ${key}`);
  }

  public async databaseDelTree(family: string, keyTree?: string): Promise<AGIResponse> {
    return this.sendCommand(`DATABASE DELTREE ${family} ${keyTree || ''}`);
  }

  public async speechCreate(engine: string): Promise<AGIResponse> {
    return this.sendCommand(`SPEECH CREATE ${engine}`);
  }

  public async speechDestroy(): Promise<AGIResponse> {
    return this.sendCommand('SPEECH DESTROY');
  }

  public async speechLoadGrammar(grammar: string, path: string): Promise<AGIResponse> {
    return this.sendCommand(`SPEECH LOAD GRAMMAR ${grammar} ${path}`);
  }

  public async speechUnloadGrammar(grammar: string): Promise<AGIResponse> {
    return this.sendCommand(`SPEECH UNLOAD GRAMMAR ${grammar}`);
  }

  public async speechActivateGrammar(grammar: string): Promise<AGIResponse> {
    return this.sendCommand(`SPEECH ACTIVATE GRAMMAR ${grammar}`);
  }

  public async speechDeactivateGrammar(grammar: string): Promise<AGIResponse> {
    return this.sendCommand(`SPEECH DEACTIVATE GRAMMAR ${grammar}`);
  }

  public async speechSet(name: string, value: string): Promise<AGIResponse> {
    return this.sendCommand(`SPEECH SET ${name} ${value}`);
  }

  public async speechRecognize(prompt: string, timeout: number, offset?: number): Promise<AGIResponse> {
    return this.sendCommand(`SPEECH RECOGNIZE ${prompt} ${timeout}`);
  }

  public async exec(application: string, ...args: string[]): Promise<AGIResponse> {
    return this.sendCommand(`EXEC ${application} ${args.join(',')}`);
  }

  public async sendImage(image: string): Promise<AGIResponse> {
    return this.sendCommand(`SEND IMAGE ${image}`);
  }

  public async sendText(text: string): Promise<AGIResponse> {
    return this.sendCommand(`SEND TEXT ${text}`);
  }

  public async verbose(message: string, level?: number): Promise<AGIResponse> {
    return this.sendCommand(`VERBOSE "${message}" ${level || 1}`);
  }

  public async tddMode(on: boolean): Promise<AGIResponse> {
    return this.sendCommand(`TDD MODE ${on ? 'ON' : 'OFF'}`);
  }

  public async gosub(context: string, extension: string, priority: number, args?: string): Promise<AGIResponse> {
    return this.sendCommand(`GOSUB ${context},${extension},${priority}${args ? ',' + args : ''}`);
  }

  public async asyncAGIBreak(): Promise<AGIResponse> {
    return this.sendCommand('ASYNCAGI BREAK');
  }

  public async dial(target: string, timeout: number, params: string): Promise<AGIResponse> {
    return this.exec('Dial', target + ',' + timeout + ',' + params);
  }

  // Enhanced methods for error recovery
  public async healthCheck(): Promise<boolean> {
    // Mock always healthy
    return Promise.resolve(true);
  }

  public resetConnection(): void {
    // Mock - nothing to reset
  }
}