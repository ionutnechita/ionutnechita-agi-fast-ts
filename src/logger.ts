export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: Date;
  context?: string;
}

export class AGILogger {
  private level: LogLevel = LogLevel.INFO;
  private context?: string;

  constructor(level: LogLevel = LogLevel.INFO, context?: string) {
    this.level = level;
    this.context = context;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setContext(context: string): void {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const context = entry.context || this.context || 'AGI';

    let message = `[${timestamp}] ${levelName.padEnd(5)} [${context}] ${entry.message}`;

    if (entry.data && typeof entry.data === 'object') {
      if (entry.data.error instanceof Error) {
        message += `\n  Error: ${entry.data.error.message}`;
        if (entry.data.error.stack && this.level >= LogLevel.DEBUG) {
          message += `\n  Stack: ${entry.data.error.stack.split('\n').slice(1, 4).join('\n    ')}`;
        }
      } else {
        message += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
      }
    }

    return message;
  }

  private log(level: LogLevel, message: string, data?: any, context?: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      context: context || this.context
    };

    const formatted = this.formatMessage(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.log(formatted);
        break;
    }
  }

  error(message: string, data?: any, context?: string): void {
    this.log(LogLevel.ERROR, message, data, context);
  }

  warn(message: string, data?: any, context?: string): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  info(message: string, data?: any, context?: string): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  debug(message: string, data?: any, context?: string): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  trace(message: string, data?: any, context?: string): void {
    this.log(LogLevel.TRACE, message, data, context);
  }

  // AGI specific logging methods
  commandSent(command: string, attempt: number = 1): void {
    const arrow = attempt > 1 ? `🔄 [${attempt}]` : '📤';
    this.debug(`${arrow} Command sent`, { command, attempt });
  }

  commandReceived(response: any, attempt: number = 1): void {
    const arrow = '📥';
    this.debug(`${arrow} Response received`, { response, attempt });
  }

  commandTimeout(command: string, timeout: number, attempt: number): void {
    this.warn('⏰ Command timeout', { command, timeout, attempt });
  }

  commandError(command: string, error: Error, attempt: number): void {
    this.error('❌ Command error', { command, error, attempt });
  }

  connectionEvent(event: string, data?: any): void {
    const icons: Record<string, string> = {
      'connected': '🔗',
      'disconnected': '🔌',
      'error': '💥',
      'variables': '📋',
      'hangup': '📞',
      'close': '🚪'
    };

    const icon = icons[event] || '📡';
    this.info(`${icon} ${event}`, data);
  }
}