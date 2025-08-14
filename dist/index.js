// src/agi-server.ts
import { EventEmitter as EventEmitter2 } from "events";
import { createServer } from "net";

// src/agi-context.ts
import { EventEmitter } from "events";
import { Readable } from "stream";

// src/types.ts
var AGIResponseCode;
((AGIResponseCode2) => {
  AGIResponseCode2[AGIResponseCode2["SUCCESS"] = 200] = "SUCCESS";
  AGIResponseCode2[AGIResponseCode2["INVALID_OR_UNKNOWN_COMMAND"] = 410] = "INVALID_OR_UNKNOWN_COMMAND";
  AGIResponseCode2[AGIResponseCode2["INVALID_COMMAND_SYNTAX"] = 510] = "INVALID_COMMAND_SYNTAX";
  AGIResponseCode2[AGIResponseCode2["COMMAND_NOT_PERMITTED"] = 511] = "COMMAND_NOT_PERMITTED";
  AGIResponseCode2[AGIResponseCode2["COMMAND_NOT_PERMITTED_ON_DEAD_CHANNEL"] = 511] = "COMMAND_NOT_PERMITTED_ON_DEAD_CHANNEL";
  AGIResponseCode2[AGIResponseCode2["INVALID_COMMAND"] = 520] = "INVALID_COMMAND";
  AGIResponseCode2[AGIResponseCode2["UNKNOWN_COMMAND"] = 520] = "UNKNOWN_COMMAND";
  AGIResponseCode2[AGIResponseCode2["USAGE_ERROR"] = 520] = "USAGE_ERROR";
})(AGIResponseCode ||= {});
var AGIState;
((AGIState2) => {
  AGIState2[AGIState2["INIT"] = 0] = "INIT";
  AGIState2[AGIState2["WAITING"] = 2] = "WAITING";
})(AGIState ||= {});

// src/commands.ts
var agiCommands = [
  {
    name: "exec",
    command: "EXEC",
    params: 10
  },
  {
    name: "databaseDel",
    command: "DATABASE DEL",
    params: 2
  },
  {
    name: "databaseDelTree",
    command: "DATABASE DELTREE",
    params: 2
  },
  {
    name: "databaseGet",
    command: "DATABASE GET",
    params: 2
  },
  {
    name: "databasePut",
    command: "DATABASE PUT",
    params: 3
  },
  {
    name: "speechCreate",
    command: "SPEECH CREATE",
    params: 1
  },
  {
    name: "speechDestroy",
    command: "SPEECH DESTROY",
    params: 0
  },
  {
    name: "speechActivateGrammar",
    command: "SPEECH ACTIVATE GRAMMAR",
    params: 1
  },
  {
    name: "speechDeactivateGrammar",
    command: "SPEECH DEACTIVATE GRAMMAR",
    params: 1
  },
  {
    name: "speechLoadGrammar",
    command: "SPEECH LOAD GRAMMAR",
    params: 2
  },
  {
    name: "speechUnloadGrammar",
    command: "SPEECH UNLOAD GRAMMAR",
    params: 1
  },
  {
    name: "speechSet",
    command: "SPEECH SET",
    params: 2
  },
  {
    name: "speechRecognize",
    command: "SPEECH RECOGNIZE",
    params: 3
  },
  {
    name: "getVariable",
    command: "GET VARIABLE",
    params: 1
  },
  {
    name: "getFullVariable",
    command: "GET FULL VARIABLE",
    params: 2
  },
  {
    name: "getData",
    command: "GET DATA",
    params: 3
  },
  {
    name: "getOption",
    command: "GET OPTION",
    params: 3,
    paramRules: [
      null,
      {
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "receiveChar",
    command: "RECEIVE CHAR",
    params: 1
  },
  {
    name: "receiveText",
    command: "RECEIVE TEXT",
    params: 1
  },
  {
    name: "setAutoHangup",
    command: "SET AUTOHANGUP",
    params: 1
  },
  {
    name: "setCallerID",
    command: "SET CALLERID",
    params: 1
  },
  {
    name: "setContext",
    command: "SET CONTEXT",
    params: 1
  },
  {
    name: "setExtension",
    command: "SET EXTENSION",
    params: 1
  },
  {
    name: "setPriority",
    command: "SET PRIORITY",
    params: 1
  },
  {
    name: "setMusic",
    command: "SET MUSIC",
    params: 1
  },
  {
    name: "setVariable",
    command: "SET VARIABLE",
    params: 2,
    paramRules: [
      null,
      {
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "sendImage",
    command: "SEND IMAGE",
    params: 1
  },
  {
    name: "sendText",
    command: "SEND TEXT",
    params: 1,
    paramRules: [
      {
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "channelStatus",
    command: "CHANNEL STATUS",
    params: 1
  },
  {
    name: "answer",
    command: "ANSWER",
    params: 0
  },
  {
    name: "verbose",
    command: "VERBOSE",
    params: 2,
    paramRules: [
      {
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "tddMode",
    command: "TDD MODE",
    params: 1
  },
  {
    name: "noop",
    command: "NOOP",
    params: 0
  },
  {
    name: "gosub",
    command: "GOSUB",
    params: 4
  },
  {
    name: "recordFile",
    command: "RECORD FILE",
    params: 7,
    paramRules: [
      null,
      null,
      {
        default: "#",
        prepare: (value) => `"${value}"`
      },
      null,
      null,
      null,
      {
        prepare: (value) => String(Number(value) * 1000)
      }
    ]
  },
  {
    name: "sayNumber",
    command: "SAY NUMBER",
    params: 2,
    paramRules: [
      null,
      {
        default: "#",
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "sayAlpha",
    command: "SAY ALPHA",
    params: 2,
    paramRules: [
      null,
      {
        default: "#",
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "sayDate",
    command: "SAY DATE",
    params: 2,
    paramRules: [
      null,
      {
        default: "#",
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "sayTime",
    command: "SAY TIME",
    params: 2,
    paramRules: [
      null,
      {
        default: "#",
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "sayDateTime",
    command: "SAY DATETIME",
    params: 4,
    paramRules: [
      null,
      {
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "sayDigits",
    command: "SAY DIGITS",
    params: 2,
    paramRules: [
      null,
      {
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "sayPhonetic",
    command: "SAY PHONETIC",
    params: 2,
    paramRules: [
      null,
      {
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "controlStreamFile",
    command: "CONTROL STREAM FILE",
    params: 7
  },
  {
    name: "streamFile",
    command: "STREAM FILE",
    params: 2,
    paramRules: [
      {
        prepare: (value) => `"${value}"`
      },
      {
        default: "#",
        prepare: (value) => `"${value}"`
      }
    ]
  },
  {
    name: "waitForDigit",
    command: "WAIT FOR DIGIT",
    params: 1
  },
  {
    name: "hangup",
    command: "HANGUP",
    params: 0
  },
  {
    name: "asyncAGIBreak",
    command: "ASYNCAGI BREAK",
    params: 0
  }
];

// src/agi-errors.ts
class AGIError extends Error {
  code;
  command;
  details;
  constructor(message, code, command, details) {
    super(message);
    this.name = "AGIError";
    this.code = code;
    this.command = command;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  toString() {
    const parts = [`${this.name}: ${this.message}`];
    if (this.command)
      parts.push(`Command: ${this.command}`);
    if (this.code !== undefined)
      parts.push(`Code: ${this.code}`);
    return parts.join(" | ");
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      command: this.command,
      code: this.code,
      details: this.details,
      stack: this.stack
    };
  }
}

class AGITimeoutError extends AGIError {
  timeout;
  suggestion;
  isDevelopmentTimeout;
  constructor(command, timeout) {
    const isDevMode = true;
    const suggestion = isDevMode ? "This might be normal in development without Asterisk connection. Consider using a mock or longer timeout." : "Check Asterisk connection and command validity.";
    super(`Command timed out after ${timeout}ms`, undefined, command, { timeout, suggestion, isDevMode });
    this.name = "AGITimeoutError";
    this.timeout = timeout;
    this.suggestion = suggestion;
    this.isDevelopmentTimeout = false;
  }
  toString() {
    return `${this.name}: ${this.message} | Command: ${this.command} | Suggestion: ${this.suggestion}`;
  }
}

class AGIConnectionError extends AGIError {
  constructor(message) {
    super(message);
    this.name = "AGIConnectionError";
  }
}

class AGICommandError extends AGIError {
  constructor(message, code, command, details) {
    super(`AGI command '${command}' failed: ${message} (code: ${code})`, code, command, details);
    this.name = "AGICommandError";
  }
}

class AGIValidationError extends AGIError {
  constructor(parameter, value, expected) {
    super(`Invalid parameter '${parameter}': got '${value}', expected ${expected}`);
    this.name = "AGIValidationError";
  }
}

// src/logger.ts
var LogLevel;
((LogLevel2) => {
  LogLevel2[LogLevel2["ERROR"] = 0] = "ERROR";
  LogLevel2[LogLevel2["WARN"] = 1] = "WARN";
  LogLevel2[LogLevel2["INFO"] = 2] = "INFO";
  LogLevel2[LogLevel2["DEBUG"] = 3] = "DEBUG";
  LogLevel2[LogLevel2["TRACE"] = 4] = "TRACE";
})(LogLevel ||= {});

class AGILogger {
  level = 2 /* INFO */;
  context;
  constructor(level = 2 /* INFO */, context) {
    this.level = level;
    this.context = context;
  }
  setLevel(level) {
    this.level = level;
  }
  setContext(context) {
    this.context = context;
  }
  shouldLog(level) {
    return level <= this.level;
  }
  formatMessage(entry) {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const context = entry.context || this.context || "AGI";
    let message = `[${timestamp}] ${levelName.padEnd(5)} [${context}] ${entry.message}`;
    if (entry.data && typeof entry.data === "object") {
      if (entry.data.error instanceof Error) {
        message += `
  Error: ${entry.data.error.message}`;
        if (entry.data.error.stack && this.level >= 3 /* DEBUG */) {
          message += `
  Stack: ${entry.data.error.stack.split(`
`).slice(1, 4).join(`
    `)}`;
        }
      } else {
        message += `
  Data: ${JSON.stringify(entry.data, null, 2)}`;
      }
    }
    return message;
  }
  log(level, message, data, context) {
    if (!this.shouldLog(level))
      return;
    const entry = {
      level,
      message,
      data,
      timestamp: new Date,
      context: context || this.context
    };
    const formatted = this.formatMessage(entry);
    switch (level) {
      case 0 /* ERROR */:
        console.error(formatted);
        break;
      case 1 /* WARN */:
        console.warn(formatted);
        break;
      case 2 /* INFO */:
        console.info(formatted);
        break;
      case 3 /* DEBUG */:
      case 4 /* TRACE */:
        console.log(formatted);
        break;
    }
  }
  error(message, data, context) {
    this.log(0 /* ERROR */, message, data, context);
  }
  warn(message, data, context) {
    this.log(1 /* WARN */, message, data, context);
  }
  info(message, data, context) {
    this.log(2 /* INFO */, message, data, context);
  }
  debug(message, data, context) {
    this.log(3 /* DEBUG */, message, data, context);
  }
  trace(message, data, context) {
    this.log(4 /* TRACE */, message, data, context);
  }
  commandSent(command, attempt = 1) {
    const arrow = attempt > 1 ? `\uD83D\uDD04 [${attempt}]` : "\uD83D\uDCE4";
    this.debug(`${arrow} Command sent`, { command, attempt });
  }
  commandReceived(response, attempt = 1) {
    const arrow = "\uD83D\uDCE5";
    this.debug(`${arrow} Response received`, { response, attempt });
  }
  commandTimeout(command, timeout, attempt) {
    this.warn("⏰ Command timeout", { command, timeout, attempt });
  }
  commandError(command, error, attempt) {
    this.error("❌ Command error", { command, error, attempt });
  }
  connectionEvent(event, data) {
    const icons = {
      connected: "\uD83D\uDD17",
      disconnected: "\uD83D\uDD0C",
      error: "\uD83D\uDCA5",
      variables: "\uD83D\uDCCB",
      hangup: "\uD83D\uDCDE",
      close: "\uD83D\uDEAA"
    };
    const icon = icons[event] || "\uD83D\uDCE1";
    this.info(`${icon} ${event}`, data);
  }
}

// src/dev-utils.ts
class DevModeManager {
  static _isDevMode = null;
  static _isMockMode = false;
  static get isDevMode() {
    if (this._isDevMode === null) {
      this._isDevMode = true;
    }
    return this._isDevMode;
  }
  static get isMockMode() {
    return this._isMockMode || !!process.env.AGI_MOCK_MODE;
  }
  static enableMockMode() {
    this._isMockMode = true;
    console.log("\uD83C\uDFAD Mock mode enabled - AGI commands will be simulated");
  }
  static disableMockMode() {
    this._isMockMode = false;
  }
  static shouldSuppressTimeouts() {
    return this.isDevMode && !process.env.AGI_SHOW_TIMEOUTS;
  }
  static shouldShowStackTraces() {
    return !!process.env.AGI_SHOW_STACK_TRACES || false;
  }
  static getRecommendedTimeout() {
    const ttsTimeout = process.env.AGI_COMMAND_TIMEOUT ? parseInt(process.env.AGI_COMMAND_TIMEOUT) : null;
    if (ttsTimeout)
      return ttsTimeout;
    return this.isDevMode ? 2000 : 30000;
  }
}

class AGIMockResponses {
  static responses = new Map([
    ["ANSWER", { code: 200, result: "0", delay: 100 }],
    ["HANGUP", { code: 200, result: "1", delay: 50 }],
    ["NOOP", { code: 200, result: "0", delay: 10 }],
    ["GET VARIABLE", { code: 200, result: "1", value: "mock_value", delay: 50 }],
    ["SET VARIABLE", { code: 200, result: "1", delay: 50 }],
    ["STREAM FILE", { code: 200, result: "0", delay: 200 }],
    ["SAY NUMBER", { code: 200, result: "0", delay: 150 }],
    ["GET DATA", { code: 200, result: "1234", delay: 300 }]
  ]);
  static getMockResponse(command) {
    const baseCommand = command.split(" ").slice(0, 2).join(" ").toUpperCase();
    if (this.responses.has(baseCommand)) {
      return this.responses.get(baseCommand);
    }
    for (const [key, response] of this.responses.entries()) {
      if (command.toUpperCase().startsWith(key)) {
        return response;
      }
    }
    return { code: 200, result: "0", delay: 100 };
  }
  static addMockResponse(command, response) {
    this.responses.set(command.toUpperCase(), response);
  }
}

// src/agi-context.ts
class AGIContext extends EventEmitter {
  variables = {};
  debug;
  logger;
  conn;
  stream;
  state = 0 /* INIT */;
  msg = "";
  pending = null;
  commandTimeout;
  maxRetries;
  retryDelay;
  isConnected = true;
  connectionId;
  reconnectionAttempts = 0;
  maxReconnectionAttempts = 3;
  reconnectionDelay = 1000;
  isReconnecting = false;
  constructor(conn, options = {}) {
    super();
    this.debug = options.debug ?? DevModeManager.isDevMode;
    this.conn = conn;
    this.commandTimeout = options.commandTimeout ?? DevModeManager.getRecommendedTimeout();
    this.maxRetries = options.maxRetries ?? (DevModeManager.isDevMode ? 1 : 3);
    this.retryDelay = options.retryDelay ?? (DevModeManager.isDevMode ? 500 : 1000);
    this.maxReconnectionAttempts = options.maxReconnectionAttempts ?? 3;
    this.reconnectionDelay = options.reconnectionDelay ?? 1000;
    this.connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const logLevel = this.debug ? 3 /* DEBUG */ : 2 /* INFO */;
    this.logger = new AGILogger(logLevel, this.connectionId);
    this.stream = new Readable;
    this.stream.setEncoding("utf8");
    this.stream.wrap(this.conn);
    this.stream.on("readable", () => {
      this.msg = this.read();
    });
    this.stream.on("error", (err) => {
      const streamError = new AGIConnectionError(`Stream error: ${err.message}`);
      streamError.details = {
        originalError: err.message,
        connectionId: this.connectionId,
        isConnected: this.isConnected,
        state: this.state
      };
      this.logger.connectionEvent("error", streamError.details);
      this.isConnected = false;
      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        pending(streamError);
      }
      this.emit("error", streamError);
    });
    this.stream.on("close", () => {
      this.isConnected = false;
      this.logger.connectionEvent("close", { connectionId: this.connectionId });
      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        const closeError = new AGIConnectionError("Connection closed unexpectedly");
        pending(closeError);
      }
      this.emit("close");
      if (!DevModeManager.isDevMode && this.reconnectionAttempts < this.maxReconnectionAttempts && !this.isReconnecting) {
        this.attemptReconnection();
      }
    });
    this.initializeCommands();
  }
  read() {
    try {
      const buffer = this.stream.read();
      if (!buffer)
        return this.msg;
      this.msg += buffer;
      if (this.state === 0 /* INIT */) {
        if (this.msg.indexOf(`

`) < 0)
          return this.msg;
        this.readVariables(this.msg);
      } else if (this.state === 2 /* WAITING */) {
        if (this.msg.indexOf(`
`) < 0)
          return this.msg;
        this.readResponse(this.msg);
      }
      return "";
    } catch (error) {
      const readError = new AGIError("Failed to read from stream", undefined, undefined, {
        originalError: error instanceof Error ? error.message : String(error),
        state: this.state,
        messageLength: this.msg?.length || 0,
        connectionId: this.connectionId
      });
      this.logger.error("Stream read error", readError.details);
      this.emit("error", readError);
      return this.msg;
    }
  }
  readVariables(msg) {
    try {
      const lines = msg.split(`
`);
      if (lines.length === 0) {
        throw new AGIError("No variables received in initialization", undefined, undefined, {
          messageContent: msg,
          connectionId: this.connectionId
        });
      }
      lines.forEach((line) => {
        if (!line.trim())
          return;
        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) {
          this.logger.debug("Skipping malformed variable line", { line, connectionId: this.connectionId });
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
        this.logger.warn("No valid AGI variables found during initialization", {
          rawMessage: msg,
          connectionId: this.connectionId
        });
      }
      this.logger.connectionEvent("variables", {
        count: variableCount,
        channel: this.variables.agi_channel,
        uniqueid: this.variables.agi_uniqueid
      });
      this.emit("variables", this.variables);
      this.setState(2 /* WAITING */);
    } catch (error) {
      const variableError = error instanceof AGIError ? error : new AGIError("Failed to parse AGI variables", undefined, undefined, {
        originalError: error instanceof Error ? error.message : String(error),
        messageContent: msg,
        connectionId: this.connectionId
      });
      this.logger.error("Variable parsing error", variableError.details);
      this.emit("error", variableError);
    }
  }
  readResponse(msg) {
    const lines = msg.split(`
`);
    lines.forEach((line) => {
      this.readResponseLine(line);
    });
  }
  readResponseLine(line) {
    if (!line || !line.trim())
      return;
    try {
      const parsed = /^(\d{3})(?:\s+(?:result=)?(.*))?$/.exec(line);
      if (!parsed) {
        if (line.toLowerCase().includes("hangup") || line.toLowerCase().includes("sighup")) {
          this.logger.connectionEvent("hangup", { line, connectionId: this.connectionId });
          this.emit("hangup");
          return;
        }
        if (line.startsWith("ASYNCAGI BREAK") || line.includes("Channel was hung up")) {
          this.logger.connectionEvent("channel_event", { line, type: "hangup", connectionId: this.connectionId });
          this.emit("hangup");
          return;
        }
        if (line.includes("TIMEOUT") || line.includes("Connection timed out")) {
          this.logger.connectionEvent("timeout", { line, connectionId: this.connectionId });
          const timeoutError = new AGITimeoutError("AGI command timeout", 5000);
          if (this.pending) {
            const pending = this.pending;
            this.pending = null;
            pending(timeoutError);
          }
          return;
        }
        const parseError = new AGIError("Failed to parse AGI response", undefined, this.pending ? "unknown" : undefined, {
          responseLine: line,
          connectionId: this.connectionId,
          hasPendingCommand: !!this.pending
        });
        this.logger.warn("Unparseable response line", parseError.details);
        if (this.pending) {
          const pending = this.pending;
          this.pending = null;
          pending(parseError);
        }
        this.emit("error", parseError);
        return;
      }
      const code = parseInt(parsed[1]);
      if (isNaN(code) || code < 100 || code > 999) {
        const invalidCodeError = new AGIError(`Invalid AGI response code: ${parsed[1]}`, code, this.pending ? "unknown" : undefined, {
          responseLine: line,
          parsedCode: parsed[1],
          connectionId: this.connectionId
        });
        this.logger.error("Invalid response code", invalidCodeError.details);
        if (this.pending) {
          const pending = this.pending;
          this.pending = null;
          pending(invalidCodeError);
        }
        this.emit("error", invalidCodeError);
        return;
      }
      const content = (parsed[2] || "").trim();
      let result = "";
      let value;
      const resultMatch = /^result=([^(]*)(?:\((.*)\))?/.exec(content);
      if (resultMatch) {
        result = resultMatch[1].trim();
        value = resultMatch[2];
      } else if (content.includes("(") && content.includes(")") && !content.startsWith("result=")) {
        const directMatch = /^([^(]*)(?:\((.*)\))?/.exec(content);
        if (directMatch) {
          result = directMatch[1].trim();
          value = directMatch[2];
        } else {
          result = content;
        }
      } else {
        result = content;
      }
      const response = {
        code,
        result
      };
      if (value) {
        response.value = value;
      }
      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        pending(null, response);
      }
      this.emit("response", response);
    } catch (error) {
      const processingError = new AGIError("Error processing AGI response line", undefined, this.pending ? "unknown" : undefined, {
        originalError: error instanceof Error ? error.message : String(error),
        responseLine: line,
        connectionId: this.connectionId
      });
      this.logger.error("Response processing error", processingError.details);
      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        pending(processingError);
      }
      this.emit("error", processingError);
    }
  }
  setState(state) {
    this.state = state;
  }
  send(msg, cb) {
    try {
      if (!this.isConnected) {
        const connectionError = new AGIConnectionError("Cannot send command: connection is closed");
        if (cb) {
          cb(connectionError);
        } else {
          this.emit("error", connectionError);
        }
        return;
      }
      if (cb) {
        this.pending = cb;
      }
      this.conn.write(msg, (error) => {
        if (error) {
          const writeError = new AGIConnectionError(`Failed to write to connection: ${error.message}`);
          this.logger.error("Write error", {
            error: error.message,
            message: msg,
            connectionId: this.connectionId
          });
          if (this.pending && cb) {
            this.pending = null;
            cb(writeError);
          } else {
            this.emit("error", writeError);
          }
        }
      });
    } catch (error) {
      const sendError = new AGIConnectionError(`Unexpected error sending command: ${error instanceof Error ? error.message : String(error)}`);
      this.logger.error("Send error", {
        error: sendError.message,
        message: msg,
        connectionId: this.connectionId
      });
      if (cb) {
        cb(sendError);
      } else {
        this.emit("error", sendError);
      }
    }
  }
  async close() {
    try {
      this.isConnected = false;
      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        const closeError = new AGIConnectionError("Connection closed during pending operation");
        pending(closeError);
      }
      this.removeAllListeners();
      if (!this.conn.destroyed) {
        this.conn.destroy();
      }
      this.logger.connectionEvent("close", { connectionId: this.connectionId });
    } catch (error) {
      const closeError = new AGIError("Error during connection close", undefined, undefined, {
        originalError: error instanceof Error ? error.message : String(error),
        connectionId: this.connectionId
      });
      this.logger.error("Close error", closeError.details);
      throw closeError;
    }
  }
  async sendCommand(command, retries = 0) {
    if (!this.isConnected && !DevModeManager.isMockMode) {
      const error = new AGIConnectionError("Connection is closed");
      if (!DevModeManager.shouldSuppressTimeouts()) {
        this.logger.commandError(command, error, retries + 1);
      }
      throw error;
    }
    if (this.variables.agi_channel && this.state === 2 /* WAITING */ && command !== "NOOP" && retries === 0) {
      this.logger.debug("Sending command after potential hangup", {
        command,
        channel: this.variables.agi_channel,
        connectionId: this.connectionId
      });
    }
    if (DevModeManager.isMockMode) {
      return this.handleMockCommand(command);
    }
    if (this.debug) {
      this.logger.commandSent(command, retries + 1);
    }
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pending) {
          this.pending = null;
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
              this.sendCommand(command, retries + 1).then(resolve).catch(reject);
            }, this.retryDelay);
          } else {
            if (DevModeManager.isDevMode && DevModeManager.shouldSuppressTimeouts()) {
              const devError = new AGITimeoutError(command, this.commandTimeout);
              devError.isDevelopmentTimeout = true;
              reject(devError);
            } else {
              this.logger.error("Command failed after all retries", {
                command,
                totalAttempts: retries + 1,
                error: error.toString()
              });
              reject(error);
            }
          }
        }
      }, this.commandTimeout);
      this.send(command + `
`, (err, result) => {
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
              this.sendCommand(command, retries + 1).then(resolve).catch(reject);
            }, this.retryDelay);
          } else {
            reject(err);
          }
        } else if (result) {
          result.timestamp = Date.now();
          result.command = command;
          this.logger.commandReceived(result, retries + 1);
          if (result.code >= 400) {
            if (result.code === 511 && result.result.toLowerCase().includes("dead channel")) {
              this.logger.info("Command attempted on dead channel", {
                command,
                code: result.code,
                message: result.result,
                connectionId: this.connectionId
              });
              result.isDeadChannel = true;
              resolve(result);
              return;
            }
            if (result.code === 511) {
              this.logger.warn("Command not permitted", {
                command,
                code: result.code,
                message: result.result,
                connectionId: this.connectionId
              });
            }
            if (result.code === 510) {
              this.logger.error("Invalid command syntax", {
                command,
                code: result.code,
                message: result.result,
                connectionId: this.connectionId
              });
            }
            if (result.code === 520) {
              this.logger.warn("Unknown or invalid command", {
                command,
                code: result.code,
                message: result.result,
                connectionId: this.connectionId
              });
            }
            const shouldRetry = result.code < 500 && result.code !== 410;
            const error = new AGICommandError(result.result || "Unknown AGI error", result.code, command, { response: result, attempt: retries + 1 });
            if (retries < this.maxRetries && shouldRetry && result.code !== 511 /* COMMAND_NOT_PERMITTED */) {
              this.logger.debug(`Retrying command due to error code in ${this.retryDelay}ms`, {
                command,
                code: result.code,
                attempt: retries + 2
              });
              setTimeout(() => {
                this.sendCommand(command, retries + 1).then(resolve).catch(reject);
              }, this.retryDelay);
            } else {
              this.logger.commandError(command, error, retries + 1);
              reject(error);
            }
          } else {
            resolve(result);
          }
        } else {
          const error = new AGIError("No result received", undefined, command, { attempt: retries + 1 });
          this.logger.commandError(command, error, retries + 1);
          reject(error);
        }
      });
    });
  }
  async handleMockCommand(command) {
    const mockResponse = AGIMockResponses.getMockResponse(command);
    if (mockResponse) {
      if (mockResponse.delay) {
        await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
      }
      const response = {
        code: mockResponse.code,
        result: mockResponse.result,
        value: mockResponse.value,
        timestamp: Date.now(),
        command
      };
      if (this.debug) {
        this.logger.debug("\uD83C\uDFAD Mock response", { command, response });
      }
      return response;
    }
    return {
      code: 200,
      result: "0",
      timestamp: Date.now(),
      command
    };
  }
  async onEvent(event, timeout) {
    return new Promise((resolve, reject) => {
      const eventTimeout = timeout || 30000;
      const timeoutId = setTimeout(() => {
        const timeoutError = new AGITimeoutError(`Event '${event}' timeout`, eventTimeout);
        reject(timeoutError);
      }, eventTimeout);
      const eventHandler = (data) => {
        clearTimeout(timeoutId);
        resolve(data);
      };
      this.once(event, eventHandler);
      this.once("error", (error) => {
        clearTimeout(timeoutId);
        this.off(event, eventHandler);
        reject(error);
      });
    });
  }
  initializeCommands() {
    agiCommands.forEach((command) => {
      this[command.name] = (...args) => {
        let commandStr;
        if (command.params > 0) {
          const preparedArgs = this.prepareArgs(args, command.paramRules, command.params);
          commandStr = command.command + " " + preparedArgs.join(" ");
        } else {
          commandStr = command.command;
        }
        return this.sendCommand(commandStr);
      };
    });
  }
  prepareArgs(args, argsRules, count) {
    if (!argsRules || !count) {
      return args.map((arg) => String(arg));
    }
    return new Array(count).fill(null).map((_, i) => {
      let arg = args[i] !== undefined && args[i] !== null ? args[i] : argsRules[i]?.default || "";
      const prepare = argsRules[i]?.prepare || ((x) => x);
      return prepare(String(arg));
    });
  }
  async dial(target, timeout, params) {
    try {
      return await this.exec("Dial", target + "," + timeout + "," + params);
    } catch (error) {
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
  async attemptReconnection() {
    if (this.isReconnecting)
      return;
    this.isReconnecting = true;
    this.reconnectionAttempts++;
    this.logger.info("Attempting reconnection", {
      attempt: this.reconnectionAttempts,
      maxAttempts: this.maxReconnectionAttempts,
      delay: this.reconnectionDelay,
      connectionId: this.connectionId
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, this.reconnectionDelay));
      this.emit("reconnecting", {
        attempt: this.reconnectionAttempts,
        maxAttempts: this.maxReconnectionAttempts
      });
      this.emit("reconnection-needed", {
        connectionId: this.connectionId,
        attempt: this.reconnectionAttempts
      });
    } catch (error) {
      this.logger.error("Reconnection attempt failed", {
        attempt: this.reconnectionAttempts,
        error: error instanceof Error ? error.message : String(error),
        connectionId: this.connectionId
      });
      if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
        this.logger.error("Max reconnection attempts reached", {
          maxAttempts: this.maxReconnectionAttempts,
          connectionId: this.connectionId
        });
        const finalError = new AGIConnectionError("Connection lost and reconnection failed after maximum attempts");
        finalError.details = {
          reconnectionAttempts: this.reconnectionAttempts,
          maxAttempts: this.maxReconnectionAttempts,
          connectionId: this.connectionId
        };
        this.emit("connection-failed", finalError);
      } else {
        setTimeout(() => {
          this.attemptReconnection();
        }, this.reconnectionDelay * this.reconnectionAttempts);
      }
    } finally {
      this.isReconnecting = false;
    }
  }
  resetConnection() {
    this.reconnectionAttempts = 0;
    this.isReconnecting = false;
    this.isConnected = true;
    this.logger.info("Connection state reset", {
      connectionId: this.connectionId
    });
  }
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return false;
      }
      await this.noop();
      return true;
    } catch (error) {
      this.logger.warn("Health check failed", {
        error: error instanceof Error ? error.message : String(error),
        connectionId: this.connectionId
      });
      return false;
    }
  }
  async answer() {
    throw new Error("Not implemented");
  }
  async hangup() {
    throw new Error("Not implemented");
  }
  async noop() {
    throw new Error("Not implemented");
  }
  async getVariable(name) {
    throw new Error("Not implemented");
  }
  async getFullVariable(name, channel) {
    throw new Error("Not implemented");
  }
  async setVariable(name, value) {
    throw new Error("Not implemented");
  }
  async streamFile(filename, escapeDigits) {
    throw new Error("Not implemented");
  }
  async controlStreamFile(filename, escapeDigits, skipms, ffchar, rewchr, pausechr, offsetms) {
    throw new Error("Not implemented");
  }
  async recordFile(filename, format, escapeDigits, timeout, offsetSamples, beep, silence) {
    throw new Error("Not implemented");
  }
  async sayNumber(number, escapeDigits) {
    throw new Error("Not implemented");
  }
  async sayAlpha(text, escapeDigits) {
    throw new Error("Not implemented");
  }
  async sayDate(date, escapeDigits) {
    throw new Error("Not implemented");
  }
  async sayTime(time, escapeDigits) {
    throw new Error("Not implemented");
  }
  async sayDateTime(datetime, escapeDigits, format, timezone) {
    throw new Error("Not implemented");
  }
  async sayDigits(digits, escapeDigits) {
    throw new Error("Not implemented");
  }
  async sayPhonetic(text, escapeDigits) {
    throw new Error("Not implemented");
  }
  async getData(filename, timeout, maxDigits) {
    throw new Error("Not implemented");
  }
  async getOption(filename, escapeDigits, timeout) {
    throw new Error("Not implemented");
  }
  async waitForDigit(timeout) {
    throw new Error("Not implemented");
  }
  async receiveChar(timeout) {
    throw new Error("Not implemented");
  }
  async receiveText(timeout) {
    throw new Error("Not implemented");
  }
  async channelStatus(channel) {
    throw new Error("Not implemented");
  }
  async setAutoHangup(time) {
    throw new Error("Not implemented");
  }
  async setCallerID(callerid) {
    throw new Error("Not implemented");
  }
  async setContext(context) {
    throw new Error("Not implemented");
  }
  async setExtension(extension) {
    throw new Error("Not implemented");
  }
  async setPriority(priority) {
    throw new Error("Not implemented");
  }
  async setMusic(on) {
    throw new Error("Not implemented");
  }
  async databaseGet(family, key) {
    throw new Error("Not implemented");
  }
  async databasePut(family, key, value) {
    throw new Error("Not implemented");
  }
  async databaseDel(family, key) {
    throw new Error("Not implemented");
  }
  async databaseDelTree(family, keyTree) {
    throw new Error("Not implemented");
  }
  async speechCreate(engine) {
    throw new Error("Not implemented");
  }
  async speechDestroy() {
    throw new Error("Not implemented");
  }
  async speechLoadGrammar(grammar, path) {
    throw new Error("Not implemented");
  }
  async speechUnloadGrammar(grammar) {
    throw new Error("Not implemented");
  }
  async speechActivateGrammar(grammar) {
    throw new Error("Not implemented");
  }
  async speechDeactivateGrammar(grammar) {
    throw new Error("Not implemented");
  }
  async speechSet(name, value) {
    throw new Error("Not implemented");
  }
  async speechRecognize(prompt, timeout, offset) {
    throw new Error("Not implemented");
  }
  async exec(application, ...args) {
    throw new Error("Not implemented");
  }
  async sendImage(image) {
    throw new Error("Not implemented");
  }
  async sendText(text) {
    throw new Error("Not implemented");
  }
  async verbose(message, level) {
    throw new Error("Not implemented");
  }
  async tddMode(on) {
    throw new Error("Not implemented");
  }
  async gosub(context, extension, priority, args) {
    throw new Error("Not implemented");
  }
  async asyncAGIBreak() {
    throw new Error("Not implemented");
  }
}

// src/agi-server.ts
class AGIServer extends EventEmitter2 {
  options;
  handler;
  server;
  constructor(handler, options = {}) {
    super();
    this.options = {
      port: options.port ?? 8090,
      debug: options.debug ?? false,
      logger: options.logger ?? false,
      host: options.host ?? "localhost"
    };
    this.handler = handler;
    this.server = createServer((connection) => {
      if (DevModeManager.isMockMode) {
        connection.destroy();
        return;
      }
      const context = new AGIContext(connection, {
        debug: this.options.debug,
        logger: this.options.logger
      });
      this.handler(context);
    });
  }
  init() {
    this.server.on("error", (error) => {
      if (!DevModeManager.shouldSuppressTimeouts()) {
        this.emit("error", new Error("Internal TCP server error: " + error.message));
      }
    });
    this.server.on("close", () => {
      this.emit("close");
    });
    this.server.listen(this.options.port, this.options.host, () => {
      console.log("AGI server listening on", this.options.port);
    });
  }
  close() {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
// src/mock-context.ts
import { EventEmitter as EventEmitter3 } from "events";
class MockAGIContext extends EventEmitter3 {
  variables = {
    agi_channel: "SIP/mock-channel-001",
    agi_uniqueid: "mock-" + Date.now(),
    agi_callerid: "1234567890",
    agi_context: "default",
    agi_extension: "1000",
    agi_priority: "1",
    agi_language: "en",
    agi_type: "SIP",
    agi_accountcode: "",
    agi_enhanced: "0.0",
    agi_version: "20.3.0"
  };
  debug = false;
  constructor() {
    super();
    setTimeout(() => {
      this.emit("variables", this.variables);
    }, 10);
  }
  async sendCommand(command) {
    const mockResponse = AGIMockResponses.getMockResponse(command);
    if (mockResponse) {
      if (mockResponse.delay) {
        await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
      }
      const response = {
        code: mockResponse.code,
        result: mockResponse.result,
        value: mockResponse.value,
        timestamp: Date.now(),
        command
      };
      return response;
    }
    return {
      code: 200,
      result: "0",
      timestamp: Date.now(),
      command
    };
  }
  async onEvent(event, timeout) {
    return new Promise((resolve, reject) => {
      const eventTimeout = timeout || 30000;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Mock event '${event}' timeout after ${eventTimeout}ms`));
      }, eventTimeout);
      const eventHandler = (data) => {
        clearTimeout(timeoutId);
        resolve(data);
      };
      this.once(event, eventHandler);
    });
  }
  async close() {
    return Promise.resolve();
  }
  async answer() {
    return this.sendCommand("ANSWER");
  }
  async hangup() {
    return this.sendCommand("HANGUP");
  }
  async noop() {
    return this.sendCommand("NOOP");
  }
  async getVariable(name) {
    return this.sendCommand(`GET VARIABLE ${name}`);
  }
  async getFullVariable(name, channel) {
    const cmd = channel ? `GET FULL VARIABLE ${name} ${channel}` : `GET FULL VARIABLE ${name}`;
    return this.sendCommand(cmd);
  }
  async setVariable(name, value) {
    return this.sendCommand(`SET VARIABLE ${name} "${value}"`);
  }
  async streamFile(filename, escapeDigits) {
    const cmd = escapeDigits ? `STREAM FILE ${filename} "${escapeDigits}"` : `STREAM FILE ${filename} ""`;
    return this.sendCommand(cmd);
  }
  async controlStreamFile(filename, escapeDigits, skipms, ffchar, rewchr, pausechr, offsetms) {
    return this.sendCommand(`CONTROL STREAM FILE ${filename}`);
  }
  async recordFile(filename, format, escapeDigits, timeout, offsetSamples, beep, silence) {
    return this.sendCommand(`RECORD FILE ${filename} ${format || "wav"}`);
  }
  async sayNumber(number, escapeDigits) {
    return this.sendCommand(`SAY NUMBER ${number} "${escapeDigits || ""}"`);
  }
  async sayAlpha(text, escapeDigits) {
    return this.sendCommand(`SAY ALPHA ${text} "${escapeDigits || ""}"`);
  }
  async sayDate(date, escapeDigits) {
    return this.sendCommand(`SAY DATE ${date} "${escapeDigits || ""}"`);
  }
  async sayTime(time, escapeDigits) {
    return this.sendCommand(`SAY TIME ${time} "${escapeDigits || ""}"`);
  }
  async sayDateTime(datetime, escapeDigits, format, timezone) {
    return this.sendCommand(`SAY DATETIME ${datetime}`);
  }
  async sayDigits(digits, escapeDigits) {
    return this.sendCommand(`SAY DIGITS ${digits} "${escapeDigits || ""}"`);
  }
  async sayPhonetic(text, escapeDigits) {
    return this.sendCommand(`SAY PHONETIC ${text} "${escapeDigits || ""}"`);
  }
  async getData(filename, timeout, maxDigits) {
    return this.sendCommand(`GET DATA ${filename} ${timeout || 5000} ${maxDigits || 4}`);
  }
  async getOption(filename, escapeDigits, timeout) {
    return this.sendCommand(`GET OPTION ${filename}`);
  }
  async waitForDigit(timeout) {
    return this.sendCommand(`WAIT FOR DIGIT ${timeout}`);
  }
  async receiveChar(timeout) {
    return this.sendCommand(`RECEIVE CHAR ${timeout}`);
  }
  async receiveText(timeout) {
    return this.sendCommand(`RECEIVE TEXT ${timeout}`);
  }
  async channelStatus(channel) {
    return this.sendCommand(`CHANNEL STATUS ${channel || ""}`);
  }
  async setAutoHangup(time) {
    return this.sendCommand(`SET AUTOHANGUP ${time}`);
  }
  async setCallerID(callerid) {
    return this.sendCommand(`SET CALLERID ${callerid}`);
  }
  async setContext(context) {
    return this.sendCommand(`SET CONTEXT ${context}`);
  }
  async setExtension(extension) {
    return this.sendCommand(`SET EXTENSION ${extension}`);
  }
  async setPriority(priority) {
    return this.sendCommand(`SET PRIORITY ${priority}`);
  }
  async setMusic(on) {
    return this.sendCommand(`SET MUSIC ${on ? "ON" : "OFF"}`);
  }
  async databaseGet(family, key) {
    return this.sendCommand(`DATABASE GET ${family} ${key}`);
  }
  async databasePut(family, key, value) {
    return this.sendCommand(`DATABASE PUT ${family} ${key} ${value}`);
  }
  async databaseDel(family, key) {
    return this.sendCommand(`DATABASE DEL ${family} ${key}`);
  }
  async databaseDelTree(family, keyTree) {
    return this.sendCommand(`DATABASE DELTREE ${family} ${keyTree || ""}`);
  }
  async speechCreate(engine) {
    return this.sendCommand(`SPEECH CREATE ${engine}`);
  }
  async speechDestroy() {
    return this.sendCommand("SPEECH DESTROY");
  }
  async speechLoadGrammar(grammar, path) {
    return this.sendCommand(`SPEECH LOAD GRAMMAR ${grammar} ${path}`);
  }
  async speechUnloadGrammar(grammar) {
    return this.sendCommand(`SPEECH UNLOAD GRAMMAR ${grammar}`);
  }
  async speechActivateGrammar(grammar) {
    return this.sendCommand(`SPEECH ACTIVATE GRAMMAR ${grammar}`);
  }
  async speechDeactivateGrammar(grammar) {
    return this.sendCommand(`SPEECH DEACTIVATE GRAMMAR ${grammar}`);
  }
  async speechSet(name, value) {
    return this.sendCommand(`SPEECH SET ${name} ${value}`);
  }
  async speechRecognize(prompt, timeout, offset) {
    return this.sendCommand(`SPEECH RECOGNIZE ${prompt} ${timeout}`);
  }
  async exec(application, ...args) {
    return this.sendCommand(`EXEC ${application} ${args.join(",")}`);
  }
  async sendImage(image) {
    return this.sendCommand(`SEND IMAGE ${image}`);
  }
  async sendText(text) {
    return this.sendCommand(`SEND TEXT ${text}`);
  }
  async verbose(message, level) {
    return this.sendCommand(`VERBOSE "${message}" ${level || 1}`);
  }
  async tddMode(on) {
    return this.sendCommand(`TDD MODE ${on ? "ON" : "OFF"}`);
  }
  async gosub(context, extension, priority, args) {
    return this.sendCommand(`GOSUB ${context},${extension},${priority}${args ? "," + args : ""}`);
  }
  async asyncAGIBreak() {
    return this.sendCommand("ASYNCAGI BREAK");
  }
  async dial(target, timeout, params) {
    return this.exec("Dial", target + "," + timeout + "," + params);
  }
  async healthCheck() {
    return Promise.resolve(true);
  }
  resetConnection() {}
}
// src/validation.ts
class AGIValidator {
  static validateRequired(value, paramName) {
    if (value === undefined || value === null || value === "") {
      throw new AGIValidationError(paramName, value, "non-empty value");
    }
  }
  static validateNumber(value, paramName) {
    if (typeof value === "number")
      return value;
    const num = Number(value);
    if (isNaN(num)) {
      throw new AGIValidationError(paramName, value, "number");
    }
    return num;
  }
  static validatePositiveNumber(value, paramName) {
    const num = this.validateNumber(value, paramName);
    if (num < 0) {
      throw new AGIValidationError(paramName, value, "positive number");
    }
    return num;
  }
  static validateString(value, paramName) {
    if (typeof value !== "string") {
      throw new AGIValidationError(paramName, value, "string");
    }
    return value;
  }
  static validateFilename(value, paramName) {
    const filename = this.validateString(value, paramName);
    if (filename.includes("..")) {
      throw new AGIValidationError(paramName, value, "filename without directory traversal (..)");
    }
    return filename;
  }
  static validateSafeFilename(value, paramName) {
    const filename = this.validateString(value, paramName);
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      throw new AGIValidationError(paramName, value, "safe filename without path separators");
    }
    return filename;
  }
  static validateTimeout(value, paramName) {
    const timeout = this.validateNumber(value, paramName);
    if (timeout < -1) {
      throw new AGIValidationError(paramName, value, "timeout >= -1 (-1 for infinite)");
    }
    return timeout;
  }
  static validateEscapeDigits(value, paramName) {
    if (value === undefined || value === null)
      return "#";
    const digits = this.validateString(value, paramName);
    const validChars = /^[0-9#*]+$/;
    if (!validChars.test(digits)) {
      throw new AGIValidationError(paramName, value, "digits, # or * characters only");
    }
    return digits;
  }
  static validateFormat(value, paramName, validFormats) {
    const format = this.validateString(value, paramName);
    if (!validFormats.includes(format)) {
      throw new AGIValidationError(paramName, value, `one of: ${validFormats.join(", ")}`);
    }
    return format;
  }
}
var AUDIO_FORMATS = ["wav", "gsm", "g729", "ulaw", "alaw"];
var TDD_MODES = ["on", "off", "mate", "tdd"];
// src/enhanced-commands.ts
class EnhancedAGICommands {
  static async streamFile(context, filename, escapeDigits = "#") {
    AGIValidator.validateRequired(filename, "filename");
    AGIValidator.validateFilename(filename, "filename");
    AGIValidator.validateEscapeDigits(escapeDigits, "escapeDigits");
    return context.sendCommand(`STREAM FILE "${filename}" "${escapeDigits}"`);
  }
  static async recordFile(context, filename, format = "wav", escapeDigits = "#", timeout = -1, offsetSamples = 0, beep = false, silence = 0) {
    AGIValidator.validateRequired(filename, "filename");
    AGIValidator.validateFilename(filename, "filename");
    AGIValidator.validateFormat(format, "format", AUDIO_FORMATS);
    AGIValidator.validateEscapeDigits(escapeDigits, "escapeDigits");
    AGIValidator.validateTimeout(timeout, "timeout");
    AGIValidator.validatePositiveNumber(offsetSamples, "offsetSamples");
    AGIValidator.validatePositiveNumber(silence, "silence");
    const timeoutMs = timeout > 0 ? timeout * 1000 : timeout;
    const beepFlag = beep ? 1 : 0;
    return context.sendCommand(`RECORD FILE "${filename}" ${format} "${escapeDigits}" ${timeoutMs} ${offsetSamples} ${beepFlag} ${silence}`);
  }
  static async sayNumber(context, number, escapeDigits = "#") {
    AGIValidator.validateNumber(number, "number");
    AGIValidator.validateEscapeDigits(escapeDigits, "escapeDigits");
    return context.sendCommand(`SAY NUMBER ${number} "${escapeDigits}"`);
  }
  static async getData(context, filename, timeout = 5000, maxDigits = 255) {
    AGIValidator.validateRequired(filename, "filename");
    AGIValidator.validateFilename(filename, "filename");
    AGIValidator.validateTimeout(timeout, "timeout");
    AGIValidator.validatePositiveNumber(maxDigits, "maxDigits");
    return context.sendCommand(`GET DATA "${filename}" ${timeout} ${maxDigits}`);
  }
  static async setVariable(context, name, value) {
    AGIValidator.validateRequired(name, "name");
    AGIValidator.validateString(name, "name");
    AGIValidator.validateString(value, "value");
    const escapedValue = value.replace(/"/g, "\\\"");
    return context.sendCommand(`SET VARIABLE ${name} "${escapedValue}"`);
  }
  static async waitForDigit(context, timeout) {
    AGIValidator.validateTimeout(timeout, "timeout");
    return context.sendCommand(`WAIT FOR DIGIT ${timeout}`);
  }
  static async dial(context, destination, timeout = 30, options = "") {
    AGIValidator.validateRequired(destination, "destination");
    AGIValidator.validateString(destination, "destination");
    AGIValidator.validatePositiveNumber(timeout, "timeout");
    AGIValidator.validateString(options, "options");
    const dialString = options ? `${destination},${timeout},${options}` : `${destination},${timeout}`;
    return context.sendCommand(`EXEC Dial ${dialString}`);
  }
  static async startMusicOnHold(context, musicClass = "default") {
    AGIValidator.validateString(musicClass, "musicClass");
    return context.sendCommand(`EXEC StartMusicOnHold ${musicClass}`);
  }
  static async stopMusicOnHold(context) {
    return context.sendCommand("EXEC StopMusicOnHold");
  }
  static async getChannelStatus(context, channel) {
    const response = channel ? await context.sendCommand(`CHANNEL STATUS ${channel}`) : await context.sendCommand("CHANNEL STATUS");
    const statusMap = {
      "0": "Down",
      "1": "Reserved",
      "2": "OffHook",
      "3": "Dialing",
      "4": "Ring",
      "5": "Ringing",
      "6": "Up",
      "7": "Busy",
      "8": "Dialing Offhook",
      "9": "Pre-ring"
    };
    const status = response.result;
    const description = statusMap[status] || "Unknown";
    return { status, description, response };
  }
}
// src/connection-manager.ts
import { EventEmitter as EventEmitter4 } from "events";
class AGIConnectionManager extends EventEmitter4 {
  connections = new Map;
  stats = {
    total: 0,
    active: 0,
    idle: 0,
    failed: 0,
    averageResponseTime: 0
  };
  responseTimes = [];
  maxConnections;
  connectionTimeout;
  constructor(maxConnections = 100, connectionTimeout = 300000) {
    super();
    this.maxConnections = maxConnections;
    this.connectionTimeout = connectionTimeout;
    setInterval(() => this.cleanupConnections(), 60000);
  }
  addConnection(id, context) {
    if (this.connections.size >= this.maxConnections) {
      throw new AGIConnectionError(`Maximum connections (${this.maxConnections}) reached`);
    }
    this.connections.set(id, context);
    this.stats.total++;
    this.stats.active++;
    context.on("close", () => {
      this.removeConnection(id);
    });
    context.on("error", (error) => {
      this.stats.failed++;
      this.emit("connectionError", id, error);
    });
    context.on("response", (response) => {
      if (response.timestamp) {
        const responseTime = Date.now() - response.timestamp;
        this.responseTimes.push(responseTime);
        if (this.responseTimes.length > 100) {
          this.responseTimes.shift();
        }
        this.stats.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
      }
    });
    this.emit("connectionAdded", id, context);
  }
  removeConnection(id) {
    const context = this.connections.get(id);
    if (context) {
      this.connections.delete(id);
      this.stats.active--;
      this.emit("connectionRemoved", id);
    }
  }
  getConnection(id) {
    return this.connections.get(id);
  }
  getAllConnections() {
    return new Map(this.connections);
  }
  getStats() {
    return { ...this.stats };
  }
  async closeAllConnections() {
    const closePromises = Array.from(this.connections.values()).map((context) => context.close().catch(() => {}));
    await Promise.all(closePromises);
    this.connections.clear();
    this.stats.active = 0;
  }
  cleanupConnections() {
    const now = Date.now();
    const toRemove = [];
    for (const [id, context] of this.connections) {
      const lastActivity = context.lastActivity || context.createdAt || now;
      if (now - lastActivity > this.connectionTimeout) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      const context = this.connections.get(id);
      if (context) {
        context.close().catch(() => {});
      }
    }
    if (toRemove.length > 0) {
      this.emit("connectionsCleanedUp", toRemove);
    }
  }
}
// src/index.ts
var src_default = AGIServer;
export {
  src_default as default,
  TDD_MODES,
  MockAGIContext,
  LogLevel,
  EnhancedAGICommands,
  DevModeManager,
  AUDIO_FORMATS,
  AGIValidator,
  AGIValidationError,
  AGITimeoutError,
  AGIState,
  AGIServer,
  AGIResponseCode,
  AGIMockResponses,
  AGILogger,
  AGIError,
  AGIContext,
  AGIConnectionManager,
  AGIConnectionError,
  AGICommandError
};
