import { EventEmitter } from 'events';
import { Socket } from 'net';
import { Readable } from 'stream';
import {
  AGIContext as IAGIContext,
  AGIVariables,
  AGIResponse,
  AGIState,
  ContextOptions,
  AGIResponseCode,
  AGIParameterRule
} from './types';
import { agiCommands } from './commands';
import { AGIError, AGITimeoutError, AGICommandError, AGIConnectionError } from './agi-errors';
import { AGILogger, LogLevel } from './logger';
import { DevModeManager, AGIMockResponses } from './dev-utils';

export class AGIContext extends EventEmitter implements IAGIContext {
  public variables: AGIVariables = {};
  public debug: boolean;

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
  private reconnectionAttempts: number = 0;
  private maxReconnectionAttempts: number = 3;
  private reconnectionDelay: number = 1000;
  private isReconnecting: boolean = false;

  constructor(conn: Socket, options: ContextOptions = {}) {
    super();

    this.debug = options.debug ?? DevModeManager.isDevMode;
    this.conn = conn;
    this.commandTimeout = options.commandTimeout ?? DevModeManager.getRecommendedTimeout();
    this.maxRetries = options.maxRetries ?? (DevModeManager.isDevMode ? 1 : 3); // Fewer retries in dev
    this.retryDelay = options.retryDelay ?? (DevModeManager.isDevMode ? 500 : 1000);
    this.maxReconnectionAttempts = (options as any).maxReconnectionAttempts ?? 3;
    this.reconnectionDelay = (options as any).reconnectionDelay ?? 1000;
    this.connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Initialize enhanced logger
    const logLevel = this.debug ? LogLevel.DEBUG : LogLevel.INFO;
    this.logger = new AGILogger(logLevel, this.connectionId);

    this.stream = new Readable();
    this.stream.setEncoding('utf8');
    this.stream.wrap(this.conn);

    this.stream.on('readable', () => {
      this.msg = this.read();
    });

    this.stream.on('error', (err: Error) => {
      const streamError = new AGIConnectionError(
        `Stream error: ${err.message}`
      );
      streamError.details = {
        originalError: err.message,
        connectionId: this.connectionId,
        isConnected: this.isConnected,
        state: this.state
      };

      this.logger.connectionEvent('error', streamError.details);
      this.isConnected = false;

      // Cancel any pending command
      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        pending(streamError);
      }

      this.emit('error', streamError);
    });

    this.stream.on('close', () => {
      this.isConnected = false;
      this.logger.connectionEvent('close', { connectionId: this.connectionId });

      // Cancel any pending command
      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        const closeError = new AGIConnectionError('Connection closed unexpectedly');
        pending(closeError);
      }

      this.emit('close');

      // Attempt reconnection if not manually closed and not in dev mode
      if (!DevModeManager.isDevMode && this.reconnectionAttempts < this.maxReconnectionAttempts && !this.isReconnecting) {
        this.attemptReconnection();
      }
    });

    this.initializeCommands();
  }

  private read(): string {
    try {
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
    } catch (error) {
      const readError = new AGIError(
        'Failed to read from stream',
        undefined,
        undefined,
        {
          originalError: error instanceof Error ? error.message : String(error),
          state: this.state,
          messageLength: this.msg?.length || 0,
          connectionId: this.connectionId
        }
      );
      this.logger.error('Stream read error', readError.details);
      this.emit('error', readError);
      return this.msg;
    }
  }

  private readVariables(msg: string): void {
    try {
      const lines = msg.split('\n');

      if (lines.length === 0) {
        throw new AGIError('No variables received in initialization', undefined, undefined, {
          messageContent: msg,
          connectionId: this.connectionId
        });
      }

      lines.forEach((line: string) => {
        if (!line.trim()) return;

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
          this.logger.debug('Skipping malformed variable line', { line, connectionId: this.connectionId });
          return;
        }

        const name = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        if (name) {
          this.variables[name] = value;
        }
      });

      const variableCount = Object.keys(this.variables).length;
      if (variableCount === 0) {
        this.logger.warn('No valid AGI variables found during initialization', {
          rawMessage: msg,
          connectionId: this.connectionId
        });
      }

      this.logger.connectionEvent('variables', {
        count: variableCount,
        channel: this.variables.agi_channel,
        uniqueid: this.variables.agi_uniqueid
      });

      this.emit('variables', this.variables);
      this.setState(AGIState.WAITING);
    } catch (error) {
      const variableError = error instanceof AGIError ? error : new AGIError(
        'Failed to parse AGI variables',
        undefined,
        undefined,
        {
          originalError: error instanceof Error ? error.message : String(error),
          messageContent: msg,
          connectionId: this.connectionId
        }
      );

      this.logger.error('Variable parsing error', variableError.details);
      this.emit('error', variableError);
    }
  }

  private readResponse(msg: string): void {
    const lines = msg.split('\n');
    lines.forEach((line: string) => {
      this.readResponseLine(line);
    });
  }

  private readResponseLine(line: string): void {
    if (!line || !line.trim()) return;

    try {
      // Handle both "200 result=0" and "511 Command Not Permitted..." formats
      const parsed = /^(\d{3})(?:\s+(?:result=)?(.*))?$/.exec(line);

      if (!parsed) {
        if (line.toLowerCase().includes('hangup') || line.toLowerCase().includes('sighup')) {
          this.logger.connectionEvent('hangup', { line, connectionId: this.connectionId });
          this.emit('hangup');
          return;
        }

        // Check for other known patterns that aren't errors
        if (line.startsWith('ASYNCAGI BREAK') || line.includes('Channel was hung up')) {
          this.logger.connectionEvent('channel_event', { line, type: 'hangup', connectionId: this.connectionId });
          this.emit('hangup');
          return;
        }

        // Handle special AGI response patterns that don't match standard format
        if (line.includes('TIMEOUT') || line.includes('Connection timed out')) {
          this.logger.connectionEvent('timeout', { line, connectionId: this.connectionId });
          const timeoutError = new AGITimeoutError('AGI command timeout', 5000);
          if (this.pending) {
            const pending = this.pending;
            this.pending = null;
            pending(timeoutError);
          }
          return;
        }

        // Unknown response format
        const parseError = new AGIError(
          'Failed to parse AGI response',
          undefined,
          this.pending ? 'unknown' : undefined,
          {
            responseLine: line,
            connectionId: this.connectionId,
            hasPendingCommand: !!this.pending
          }
        );

        this.logger.warn('Unparseable response line', parseError.details);

        if (this.pending) {
          const pending = this.pending;
          this.pending = null;
          pending(parseError);
        }

        this.emit('error', parseError);
        return;
      }

      const code = parseInt(parsed[1]);
      if (isNaN(code) || code < 100 || code > 999) {
        const invalidCodeError = new AGIError(
          `Invalid AGI response code: ${parsed[1]}`,
          code,
          this.pending ? 'unknown' : undefined,
          {
            responseLine: line,
            parsedCode: parsed[1],
            connectionId: this.connectionId
          }
        );

        this.logger.error('Invalid response code', invalidCodeError.details);

        if (this.pending) {
          const pending = this.pending;
          this.pending = null;
          pending(invalidCodeError);
        }

        this.emit('error', invalidCodeError);
        return;
      }

      // Parse the content after the code
      const content = (parsed[2] || '').trim();
      let result = '';
      let value: string | undefined;

      // Check if it's in "result=value(extra)" format
      const resultMatch = /^result=([^(]*)(?:\((.*)\))?/.exec(content);
      if (resultMatch) {
        result = resultMatch[1].trim();
        value = resultMatch[2];
      } else if (content.includes('(') && content.includes(')') && !content.startsWith('result=')) {
        // Handle cases like "1(timeout)" when not prefixed with result=
        const directMatch = /^([^(]*)(?:\((.*)\))?/.exec(content);
        if (directMatch) {
          result = directMatch[1].trim();
          value = directMatch[2];
        } else {
          result = content;
        }
      } else {
        // It's a direct message format like "Command Not Permitted on a dead channel"
        result = content;
      }

      const response: AGIResponse = {
        code,
        result,
      };

      if (value) {
        response.value = value;
      }

      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        pending(null, response);
      }

      this.emit('response', response);

    } catch (error) {
      const processingError = new AGIError(
        'Error processing AGI response line',
        undefined,
        this.pending ? 'unknown' : undefined,
        {
          originalError: error instanceof Error ? error.message : String(error),
          responseLine: line,
          connectionId: this.connectionId
        }
      );

      this.logger.error('Response processing error', processingError.details);

      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        pending(processingError);
      }

      this.emit('error', processingError);
    }
  }

  private setState(state: AGIState): void {
    this.state = state;
  }

  private send(msg: string, cb?: (err: Error | null, result?: AGIResponse) => void): void {
    try {
      if (!this.isConnected) {
        const connectionError = new AGIConnectionError('Cannot send command: connection is closed');
        if (cb) {
          cb(connectionError);
        } else {
          this.emit('error', connectionError);
        }
        return;
      }

      if (cb) {
        this.pending = cb;
      }

      this.conn.write(msg, (error) => {
        if (error) {
          const writeError = new AGIConnectionError(`Failed to write to connection: ${error.message}`);
          this.logger.error('Write error', {
            error: error.message,
            message: msg,
            connectionId: this.connectionId
          });

          if (this.pending && cb) {
            this.pending = null;
            cb(writeError);
          } else {
            this.emit('error', writeError);
          }
        }
      });
    } catch (error) {
      const sendError = new AGIConnectionError(
        `Unexpected error sending command: ${error instanceof Error ? error.message : String(error)}`
      );

      this.logger.error('Send error', {
        error: sendError.message,
        message: msg,
        connectionId: this.connectionId
      });

      if (cb) {
        cb(sendError);
      } else {
        this.emit('error', sendError);
      }
    }
  }


  public async close(): Promise<void> {
    try {
      this.isConnected = false;

      // Cancel any pending operations
      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        const closeError = new AGIConnectionError('Connection closed during pending operation');
        pending(closeError);
      }

      // Clean up listeners
      this.removeAllListeners();

      // Close the connection
      if (!this.conn.destroyed) {
        this.conn.destroy();
      }

      this.logger.connectionEvent('close', { connectionId: this.connectionId });
    } catch (error) {
      const closeError = new AGIError(
        'Error during connection close',
        undefined,
        undefined,
        {
          originalError: error instanceof Error ? error.message : String(error),
          connectionId: this.connectionId
        }
      );
      this.logger.error('Close error', closeError.details);
      throw closeError;
    }
  }

  public async sendCommand(command: string, retries = 0): Promise<AGIResponse> {
    if (!this.isConnected && !DevModeManager.isMockMode) {
      const error = new AGIConnectionError('Connection is closed');
      if (!DevModeManager.shouldSuppressTimeouts()) {
        this.logger.commandError(command, error, retries + 1);
      }
      throw error;
    }

    // Check if we've detected a dead channel (common after hangup)
    if (this.variables.agi_channel && this.state === AGIState.WAITING &&
      command !== 'NOOP' && retries === 0) {
      // Allow health check commands but warn about others after hangup events
      this.logger.debug('Sending command after potential hangup', {
        command,
        channel: this.variables.agi_channel,
        connectionId: this.connectionId
      });
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
          if (result.code >= 400) {
            // Handle dead channel scenario gracefully (511)
            if (result.code === 511 && result.result.toLowerCase().includes('dead channel')) {
              this.logger.info('Command attempted on dead channel', {
                command,
                code: result.code,
                message: result.result,
                connectionId: this.connectionId
              });

              // For dead channel, return the response instead of throwing error
              result.isDeadChannel = true;
              resolve(result);
              return;
            }

            // Handle other 511 Command Not Permitted cases
            if (result.code === 511) {
              this.logger.warn('Command not permitted', {
                command,
                code: result.code,
                message: result.result,
                connectionId: this.connectionId
              });
            }

            // Handle syntax errors (510)
            if (result.code === 510) {
              this.logger.error('Invalid command syntax', {
                command,
                code: result.code,
                message: result.result,
                connectionId: this.connectionId
              });
            }

            // Handle unknown command errors (520)
            if (result.code === 520) {
              this.logger.warn('Unknown or invalid command', {
                command,
                code: result.code,
                message: result.result,
                connectionId: this.connectionId
              });
            }

            // Handle client errors (4xx) - usually don't retry
            const shouldRetry = result.code < 500 && result.code !== 410;

            const error = new AGICommandError(
              result.result || 'Unknown AGI error',
              result.code,
              command,
              { response: result, attempt: retries + 1 }
            );

            if (retries < this.maxRetries && shouldRetry && result.code !== AGIResponseCode.COMMAND_NOT_PERMITTED) {
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

  public async onEvent(event: string, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const eventTimeout = timeout || 30000; // 30 second default timeout

      const timeoutId = setTimeout(() => {
        const timeoutError = new AGITimeoutError(`Event '${event}' timeout`, eventTimeout);
        reject(timeoutError);
      }, eventTimeout);

      const eventHandler = (data: any) => {
        clearTimeout(timeoutId);
        resolve(data);
      };

      this.once(event, eventHandler);

      // Clean up on error
      this.once('error', (error) => {
        clearTimeout(timeoutId);
        this.off(event, eventHandler);
        reject(error);
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
    argsRules?: Array<AGIParameterRule | null>,
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

  // Sugar command with error recovery
  public async dial(target: string, timeout: number, params: string): Promise<AGIResponse> {
    try {
      return await this.exec('Dial', target + ',' + timeout + ',' + params);
    } catch (error) {
      // Add context for dial-specific errors
      if (error instanceof AGIError) {
        error.details = {
          ...error.details,
          dialTarget: target,
          dialTimeout: timeout,
          dialParams: params
        };
      }
      throw error;
    }
  }

  // Error recovery method
  private async attemptReconnection(): Promise<void> {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.reconnectionAttempts++;

    this.logger.info('Attempting reconnection', {
      attempt: this.reconnectionAttempts,
      maxAttempts: this.maxReconnectionAttempts,
      delay: this.reconnectionDelay,
      connectionId: this.connectionId
    });

    try {
      await new Promise(resolve => setTimeout(resolve, this.reconnectionDelay));

      // Emit reconnection attempt event
      this.emit('reconnecting', {
        attempt: this.reconnectionAttempts,
        maxAttempts: this.maxReconnectionAttempts
      });

      // Note: Actual reconnection logic would need to be implemented
      // by the server that creates AGIContext instances
      this.emit('reconnection-needed', {
        connectionId: this.connectionId,
        attempt: this.reconnectionAttempts
      });

    } catch (error) {
      this.logger.error('Reconnection attempt failed', {
        attempt: this.reconnectionAttempts,
        error: error instanceof Error ? error.message : String(error),
        connectionId: this.connectionId
      });

      if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
        this.logger.error('Max reconnection attempts reached', {
          maxAttempts: this.maxReconnectionAttempts,
          connectionId: this.connectionId
        });

        const finalError = new AGIConnectionError(
          'Connection lost and reconnection failed after maximum attempts'
        );
        finalError.details = {
          reconnectionAttempts: this.reconnectionAttempts,
          maxAttempts: this.maxReconnectionAttempts,
          connectionId: this.connectionId
        };

        this.emit('connection-failed', finalError);
      } else {
        // Try again after a longer delay
        setTimeout(() => {
          this.attemptReconnection();
        }, this.reconnectionDelay * this.reconnectionAttempts);
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  // Method to reset connection state
  public resetConnection(): void {
    this.reconnectionAttempts = 0;
    this.isReconnecting = false;
    this.isConnected = true;

    this.logger.info('Connection state reset', {
      connectionId: this.connectionId
    });
  }

  // Health check method
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      // Send a no-op command to verify connection
      await this.noop();
      return true;

    } catch (error) {
      this.logger.warn('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
        connectionId: this.connectionId
      });
      return false;
    }
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