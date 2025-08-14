export interface AGIServerOptions {
  port?: number;
  debug?: boolean;
  logger?: LoggerFunction | boolean;
  host?: string; // Host address to bind server to (default: 'localhost')
}

export interface LoggerFunction {
  (arrow: string, data: any): void;
}

export interface AGIResponse {
  code: number;
  result: string;
  value?: string;
  timestamp?: number;
  command?: string;
  isDeadChannel?: boolean; // Indicates if the response was from a dead channel (code 511)
}

export enum AGIResponseCode {
  // Success codes
  SUCCESS = 200,

  // Client error codes (4xx)
  INVALID_OR_UNKNOWN_COMMAND = 410,

  // Server error codes (5xx)
  INVALID_COMMAND_SYNTAX = 510,
  COMMAND_NOT_PERMITTED = 511,
  COMMAND_NOT_PERMITTED_ON_DEAD_CHANNEL = 511,
  INVALID_COMMAND = 520,
  UNKNOWN_COMMAND = 520,
  USAGE_ERROR = 520,
}

export interface AGICommandResult {
  success: boolean;
  response: AGIResponse;
  error?: Error;
}

export interface AGIVariables {
  [key: string]: string;
}

export enum AGIState {
  INIT = 0,
  WAITING = 2,
}

export interface AGIParameterRule {
  default?: string;
  prepare?: (value: string) => string;
}

export interface AGICommand {
  name: string;
  command: string;
  params: number;
  paramRules?: Array<AGIParameterRule | null>;
}

export interface ContextOptions {
  debug?: boolean;
  logger?: LoggerFunction | boolean;
  commandTimeout?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  maxReconnectionAttempts?: number;
  reconnectionDelay?: number; // milliseconds
}

export type AGIHandler = (context: AGIContext) => void;

export interface AGIContext {
  // Properties
  variables: AGIVariables;
  debug: boolean;

  // EventEmitter methods
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;

  // Core methods
  onEvent(event: string, timeout?: number): Promise<any>;
  close(): Promise<void>;
  sendCommand(command: string): Promise<AGIResponse>;
  dial(target: string, timeout: number, params: string): Promise<AGIResponse>;

  // Enhanced methods
  healthCheck(): Promise<boolean>;
  resetConnection(): void;

  // AGI Commands - Basic
  answer(): Promise<AGIResponse>;
  hangup(): Promise<AGIResponse>;
  noop(): Promise<AGIResponse>;

  // AGI Commands - Variables
  getVariable(name: string): Promise<AGIResponse>;
  getFullVariable(name: string, channel?: string): Promise<AGIResponse>;
  setVariable(name: string, value: string): Promise<AGIResponse>;

  // AGI Commands - Audio/Speech
  streamFile(filename: string, escapeDigits?: string): Promise<AGIResponse>;
  controlStreamFile(filename: string, escapeDigits?: string, skipms?: number,
    ffchar?: string, rewchr?: string, pausechr?: string, offsetms?: number): Promise<AGIResponse>;
  recordFile(filename: string, format?: string, escapeDigits?: string, timeout?: number,
    offsetSamples?: number, beep?: boolean, silence?: number): Promise<AGIResponse>;

  // AGI Commands - Say
  sayNumber(number: number, escapeDigits?: string): Promise<AGIResponse>;
  sayAlpha(text: string, escapeDigits?: string): Promise<AGIResponse>;
  sayDate(date: number, escapeDigits?: string): Promise<AGIResponse>;
  sayTime(time: number, escapeDigits?: string): Promise<AGIResponse>;
  sayDateTime(datetime: number, escapeDigits?: string, format?: string, timezone?: string): Promise<AGIResponse>;
  sayDigits(digits: string, escapeDigits?: string): Promise<AGIResponse>;
  sayPhonetic(text: string, escapeDigits?: string): Promise<AGIResponse>;

  // AGI Commands - Input
  getData(filename: string, timeout?: number, maxDigits?: number): Promise<AGIResponse>;
  getOption(filename: string, escapeDigits?: string, timeout?: number): Promise<AGIResponse>;
  waitForDigit(timeout: number): Promise<AGIResponse>;
  receiveChar(timeout: number): Promise<AGIResponse>;
  receiveText(timeout: number): Promise<AGIResponse>;

  // AGI Commands - Channel Control
  channelStatus(channel?: string): Promise<AGIResponse>;
  setAutoHangup(time: number): Promise<AGIResponse>;
  setCallerID(callerid: string): Promise<AGIResponse>;
  setContext(context: string): Promise<AGIResponse>;
  setExtension(extension: string): Promise<AGIResponse>;
  setPriority(priority: number): Promise<AGIResponse>;
  setMusic(on: boolean): Promise<AGIResponse>;

  // AGI Commands - Database
  databaseGet(family: string, key: string): Promise<AGIResponse>;
  databasePut(family: string, key: string, value: string): Promise<AGIResponse>;
  databaseDel(family: string, key: string): Promise<AGIResponse>;
  databaseDelTree(family: string, keyTree?: string): Promise<AGIResponse>;

  // AGI Commands - Speech Recognition
  speechCreate(engine: string): Promise<AGIResponse>;
  speechDestroy(): Promise<AGIResponse>;
  speechLoadGrammar(grammar: string, path: string): Promise<AGIResponse>;
  speechUnloadGrammar(grammar: string): Promise<AGIResponse>;
  speechActivateGrammar(grammar: string): Promise<AGIResponse>;
  speechDeactivateGrammar(grammar: string): Promise<AGIResponse>;
  speechSet(name: string, value: string): Promise<AGIResponse>;
  speechRecognize(prompt: string, timeout: number, offset?: number): Promise<AGIResponse>;

  // AGI Commands - Misc
  exec(application: string, ...args: string[]): Promise<AGIResponse>;
  sendImage(image: string): Promise<AGIResponse>;
  sendText(text: string): Promise<AGIResponse>;
  verbose(message: string, level?: number): Promise<AGIResponse>;
  tddMode(on: boolean): Promise<AGIResponse>;
  gosub(context: string, extension: string, priority: number, args?: string): Promise<AGIResponse>;
  asyncAGIBreak(): Promise<AGIResponse>;
}