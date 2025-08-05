import { EventEmitter } from 'events';
import { Socket } from 'net';
import { Readable } from 'stream';
import { 
  AGIContext as IAGIContext, 
  AGIVariables, 
  AGIResponse, 
  AGIState, 
  ContextOptions, 
  LoggerFunction,
  AGIResponseCode,
  AGICommandResult
} from './types';
import { agiCommands } from './commands';
import { AGIError, AGITimeoutError, AGICommandError, AGIConnectionError } from './agi-errors';
import { AGILogger, LogLevel } from './logger';
import { DevModeManager, AGIMockResponses } from './dev-utils';

export class AGIContext extends EventEmitter implements IAGIContext {
  public variables: AGIVariables = {};
  public debug: boolean;
  
  private log: LoggerFunction;
  private logger: AGILogger;
  private conn: Socket;
  private stream: Readable;
  private state: AGIState = AGIState.INIT;
  private msg: string = '';
  private pending: ((err: Error | null, result?: AGIResponse) => void) | null = null;
  private commandTimeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private isConnected: boolean = true;
  private connectionId: string;

  constructor(conn: Socket, options: ContextOptions = {}) {
    super();

    this.debug = options.debug ?? DevModeManager.isDevMode;
    this.conn = conn;
    this.commandTimeout = options.commandTimeout ?? DevModeManager.getRecommendedTimeout();
    this.maxRetries = options.maxRetries ?? (DevModeManager.isDevMode ? 1 : 3); // Fewer retries in dev
    this.retryDelay = options.retryDelay ?? (DevModeManager.isDevMode ? 500 : 1000);
    this.connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Initialize enhanced logger
    const logLevel = this.debug ? LogLevel.DEBUG : LogLevel.INFO;
    this.logger = new AGILogger(logLevel, this.connectionId);

    const consoleDecorator: LoggerFunction = (arrow: string, data: any) => {
      if (this.debug) {
        console.log(arrow, JSON.stringify(data));
      }
    };

    this.log = (typeof options.logger === 'function') 
      ? options.logger 
      : consoleDecorator;

    this.stream = new Readable();
    this.stream.setEncoding('utf8');
    this.stream.wrap(this.conn);

    this.stream.on('readable', () => {
      this.msg = this.read();
    });

    this.stream.on('error', (err: Error) => {
      this.logger.connectionEvent('error', { error: err.message });
      this.emit('error', err);
    });

    this.stream.on('close', () => {
      this.isConnected = false;
      this.logger.connectionEvent('close');
      this.emit('close');
    });

    this.initializeCommands();
  }

  private read(): string {
    const buffer = this.stream.read();
    if (!buffer) return this.msg;

    this.msg += buffer;

    if (this.state === AGIState.INIT) {
      if (this.msg.indexOf('\n\n') < 0) return this.msg;
      this.readVariables(this.msg);
    } else if (this.state === AGIState.WAITING) {
      if (this.msg.indexOf('\n') < 0) return this.msg;
      this.readResponse(this.msg);
    }

    return '';
  }

  private readVariables(msg: string): void {
    const lines = msg.split('\n');

    lines.forEach((line: string) => {
      const split = line.split(':');
      const name = split[0];
      const value = split[1];
      this.variables[name] = (value || '').trim();
    });

    this.logger.connectionEvent('variables', { 
      count: Object.keys(this.variables).length,
      channel: this.variables.agi_channel,
      uniqueid: this.variables.agi_uniqueid 
    });
    
    this.emit('variables', this.variables);
    this.setState(AGIState.WAITING);
  }

  private readResponse(msg: string): void {
    const lines = msg.split('\n');
    lines.forEach((line: string) => {
      this.readResponseLine(line);
    });
  }

  private readResponseLine(line: string): void {
    if (!line) return;

    const parsed = /^(\d{3})(?: result=)([^(]*)(?:\((.*)\))?/.exec(line);

    if (!parsed) {
      this.logger.connectionEvent('hangup', { line });
      this.emit('hangup');
      return;
    }

    const response: AGIResponse = {
      code: parseInt(parsed[1]),
      result: parsed[2].trim(),
    };

    if (parsed[3]) {
      response.value = parsed[3];
    }

    if (this.pending) {
      const pending = this.pending;
      this.pending = null;
      pending(null, response);
    }

    this.emit('response', response);
  }

  private setState(state: AGIState): void {
    this.state = state;
  }

  private send(msg: string, cb?: (err: Error | null, result?: AGIResponse) => void): void {
    if (cb) {
      this.pending = cb;
    }
    this.conn.write(msg);
  }

  public async close(): Promise<void> {
    this.conn.destroy();
    return Promise.resolve();
  }

  public async sendCommand(command: string, retries = 0): Promise<AGIResponse> {
    if (!this.isConnected && !DevModeManager.isMockMode) {
      const error = new AGIConnectionError('Connection is closed');
      if (!DevModeManager.shouldSuppressTimeouts()) {
        this.logger.commandError(command, error, retries + 1);
      }
      throw error;
    }

    // Handle mock mode
    if (DevModeManager.isMockMode) {
      return this.handleMockCommand(command);
    }

    // Log command being sent (only in debug mode to reduce noise)
    if (this.debug) {
      this.logger.commandSent(command, retries + 1);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pending) {
          this.pending = null;
          
          // Only log timeouts in debug mode or if explicitly requested
          if (!DevModeManager.shouldSuppressTimeouts()) {
            this.logger.commandTimeout(command, this.commandTimeout, retries + 1);
          }
          
          const error = new AGITimeoutError(command, this.commandTimeout);
          
          if (retries < this.maxRetries) {
            if (!DevModeManager.shouldSuppressTimeouts()) {
              this.logger.debug(`Retrying command in ${this.retryDelay}ms`, { 
                command, 
                attempt: retries + 2,
                maxRetries: this.maxRetries 
              });
            }
            
            setTimeout(() => {
              this.sendCommand(command, retries + 1)
                .then(resolve)
                .catch(reject);
            }, this.retryDelay);
          } else {
            // In dev mode, provide a more user-friendly error
            if (DevModeManager.isDevMode && DevModeManager.shouldSuppressTimeouts()) {
              // Silently fail with a special error that can be caught
              const devError = new AGITimeoutError(command, this.commandTimeout);
              devError.isDevelopmentTimeout = true;
              reject(devError);
            } else {
              this.logger.error('Command failed after all retries', { 
                command,
                totalAttempts: retries + 1,
                error: error.toString()
              });
              reject(error);
            }
          }
        }
      }, this.commandTimeout);

      this.send(command + '\n', (err: Error | null, result?: AGIResponse) => {
        clearTimeout(timeoutId);
        
        if (err) {
          this.logger.commandError(command, err, retries + 1);
          
          if (retries < this.maxRetries) {
            this.logger.debug(`Retrying command due to error in ${this.retryDelay}ms`, { 
              command, 
              error: err.message,
              attempt: retries + 2 
            });
            
            setTimeout(() => {
              this.sendCommand(command, retries + 1)
                .then(resolve)
                .catch(reject);
            }, this.retryDelay);
          } else {
            reject(err);
          }
        } else if (result) {
          // Add metadata to response
          result.timestamp = Date.now();
          result.command = command;

          this.logger.commandReceived(result, retries + 1);

          // Check for AGI error codes
          if (result.code >= 500) {
            const error = new AGICommandError(
              result.result || 'Unknown AGI error',
              result.code,
              command,
              { response: result, attempt: retries + 1 }
            );
            
            if (retries < this.maxRetries && result.code !== AGIResponseCode.COMMAND_NOT_PERMITTED) {
              this.logger.debug(`Retrying command due to error code in ${this.retryDelay}ms`, { 
                command, 
                code: result.code,
                attempt: retries + 2 
              });
              
              setTimeout(() => {
                this.sendCommand(command, retries + 1)
                  .then(resolve)
                  .catch(reject);
              }, this.retryDelay);
            } else {
              this.logger.commandError(command, error, retries + 1);
              reject(error);
            }
          } else {
            // Success!
            resolve(result);
          }
        } else {
          const error = new AGIError('No result received', undefined, command, { attempt: retries + 1 });
          this.logger.commandError(command, error, retries + 1);
          reject(error);
        }
      });
    });
  }

  private async handleMockCommand(command: string): Promise<AGIResponse> {
    const mockResponse = AGIMockResponses.getMockResponse(command);
    
    if (mockResponse) {
      // Simulate delay
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
      
      // Log mock response if debug is enabled
      if (this.debug) {
        this.logger.debug('🎭 Mock response', { command, response });
      }
      
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

  public async onEvent(event: string): Promise<any> {
    return new Promise((resolve) => {
      this.on(event, (data: any) => {
        resolve(data);
      });
    });
  }

  private initializeCommands(): void {
    agiCommands.forEach((command) => {
      (this as any)[command.name] = (...args: any[]) => {
        let commandStr: string;
        if (command.params > 0) {
          const preparedArgs = this.prepareArgs(args, command.paramRules, command.params);
          commandStr = command.command + ' ' + preparedArgs.join(' ');
        } else {
          commandStr = command.command;
        }
        return this.sendCommand(commandStr);
      };
    });
  }

  private prepareArgs(
    args: any[], 
    argsRules?: Array<{ default?: string; prepare?: (value: string) => string } | null>,
    count?: number
  ): string[] {
    if (!argsRules || !count) {
      return args.map(arg => String(arg));
    }

    return new Array(count).fill(null).map((_, i) => {
      let arg = args[i] !== undefined && args[i] !== null 
        ? args[i] 
        : (argsRules[i]?.default || '');
      
      const prepare = argsRules[i]?.prepare || ((x: string) => x);
      return prepare(String(arg));
    });
  }

  // Sugar command
  public async dial(target: string, timeout: number, params: string): Promise<AGIResponse> {
    return this.exec('Dial', target + ',' + timeout + ',' + params);
  }

  // Placeholder implementations for all AGI commands - these will be overridden by initializeCommands()
  public async answer(): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async hangup(): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async noop(): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async getVariable(name: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async getFullVariable(name: string, channel?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async setVariable(name: string, value: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async streamFile(filename: string, escapeDigits?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async controlStreamFile(filename: string, escapeDigits?: string, skipms?: number, ffchar?: string, rewchr?: string, pausechr?: string, offsetms?: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async recordFile(filename: string, format?: string, escapeDigits?: string, timeout?: number, offsetSamples?: number, beep?: boolean, silence?: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async sayNumber(number: number, escapeDigits?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async sayAlpha(text: string, escapeDigits?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async sayDate(date: number, escapeDigits?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async sayTime(time: number, escapeDigits?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async sayDateTime(datetime: number, escapeDigits?: string, format?: string, timezone?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async sayDigits(digits: string, escapeDigits?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async sayPhonetic(text: string, escapeDigits?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async getData(filename: string, timeout?: number, maxDigits?: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async getOption(filename: string, escapeDigits?: string, timeout?: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async waitForDigit(timeout: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async receiveChar(timeout: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async receiveText(timeout: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async channelStatus(channel?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async setAutoHangup(time: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async setCallerID(callerid: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async setContext(context: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async setExtension(extension: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async setPriority(priority: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async setMusic(on: boolean): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async databaseGet(family: string, key: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async databasePut(family: string, key: string, value: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async databaseDel(family: string, key: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async databaseDelTree(family: string, keyTree?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async speechCreate(engine: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async speechDestroy(): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async speechLoadGrammar(grammar: string, path: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async speechUnloadGrammar(grammar: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async speechActivateGrammar(grammar: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async speechDeactivateGrammar(grammar: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async speechSet(name: string, value: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async speechRecognize(prompt: string, timeout: number, offset?: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async exec(application: string, ...args: string[]): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async sendImage(image: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async sendText(text: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async verbose(message: string, level?: number): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async tddMode(on: boolean): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async gosub(context: string, extension: string, priority: number, args?: string): Promise<AGIResponse> { throw new Error('Not implemented'); }
  public async asyncAGIBreak(): Promise<AGIResponse> { throw new Error('Not implemented'); }
}