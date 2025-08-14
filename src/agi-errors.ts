export class AGIError extends Error {
  public code?: number;
  public command?: string;
  public details?: Record<string, any>;

  constructor(message: string, code?: number, command?: string, details?: Record<string, any>) {
    super(message);
    this.name = 'AGIError';
    this.code = code;
    this.command = command;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toString(): string {
    const parts = [`${this.name}: ${this.message}`];
    if (this.command) parts.push(`Command: ${this.command}`);
    if (this.code !== undefined) parts.push(`Code: ${this.code}`);
    return parts.join(' | ');
  }

  toJSON(): Record<string, any> {
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

export class AGITimeoutError extends AGIError {
  public timeout: number;
  public suggestion?: string;
  public isDevelopmentTimeout?: boolean;

  constructor(command: string, timeout: number) {
    const isDevMode = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const suggestion = isDevMode
      ? 'This might be normal in development without Asterisk connection. Consider using a mock or longer timeout.'
      : 'Check Asterisk connection and command validity.';

    super(
      `Command timed out after ${timeout}ms`,
      undefined,
      command,
      { timeout, suggestion, isDevMode }
    );
    this.name = 'AGITimeoutError';
    this.timeout = timeout;
    this.suggestion = suggestion;
    this.isDevelopmentTimeout = false; // Will be set by context if needed
  }

  toString(): string {
    return `${this.name}: ${this.message} | Command: ${this.command} | Suggestion: ${this.suggestion}`;
  }
}

export class AGIConnectionError extends AGIError {
  constructor(message: string) {
    super(message);
    this.name = 'AGIConnectionError';
  }
}

export class AGICommandError extends AGIError {
  constructor(message: string, code: number, command: string, details?: Record<string, any>) {
    super(`AGI command '${command}' failed: ${message} (code: ${code})`, code, command, details);
    this.name = 'AGICommandError';
  }
}

export class AGIValidationError extends AGIError {
  constructor(parameter: string, value: any, expected: string) {
    super(`Invalid parameter '${parameter}': got '${value}', expected ${expected}`);
    this.name = 'AGIValidationError';
  }
}