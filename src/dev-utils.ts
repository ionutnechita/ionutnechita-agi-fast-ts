export class DevModeManager {
  private static _isDevMode: boolean | null = null;
  private static _isMockMode: boolean = false;

  static get isDevMode(): boolean {
    if (this._isDevMode === null) {
      this._isDevMode = !process.env.NODE_ENV ||
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'dev' ||
        !!process.env.AGI_DEV_MODE;
    }
    return this._isDevMode;
  }

  static get isMockMode(): boolean {
    return this._isMockMode || !!process.env.AGI_MOCK_MODE;
  }

  static enableMockMode(): void {
    this._isMockMode = true;
    console.log('🎭 Mock mode enabled - AGI commands will be simulated');
  }

  static disableMockMode(): void {
    this._isMockMode = false;
  }

  static shouldSuppressTimeouts(): boolean {
    return this.isDevMode && !process.env.AGI_SHOW_TIMEOUTS;
  }

  static shouldShowStackTraces(): boolean {
    return !!process.env.AGI_SHOW_STACK_TRACES || process.env.NODE_ENV === 'debug';
  }

  static getRecommendedTimeout(): number {
    const ttsTimeout = process.env.AGI_COMMAND_TIMEOUT ? parseInt(process.env.AGI_COMMAND_TIMEOUT) : null;
    if (ttsTimeout) return ttsTimeout;

    return this.isDevMode ? 2000 : 30000;
  }
}

export interface MockResponse {
  code: number;
  result: string;
  value?: string;
  delay?: number; // Simulate response delay
}

export class AGIMockResponses {
  private static responses: Map<string, MockResponse> = new Map([
    ['ANSWER', { code: 200, result: '0', delay: 100 }],
    ['HANGUP', { code: 200, result: '1', delay: 50 }],
    ['NOOP', { code: 200, result: '0', delay: 10 }],
    ['GET VARIABLE', { code: 200, result: '1', value: 'mock_value', delay: 50 }],
    ['SET VARIABLE', { code: 200, result: '1', delay: 50 }],
    ['STREAM FILE', { code: 200, result: '0', delay: 200 }],
    ['SAY NUMBER', { code: 200, result: '0', delay: 150 }],
    ['GET DATA', { code: 200, result: '1234', delay: 300 }],
  ]);

  static getMockResponse(command: string): MockResponse | null {
    // Extract base command (first two words)
    const baseCommand = command.split(' ').slice(0, 2).join(' ').toUpperCase();

    // Try exact match first
    if (this.responses.has(baseCommand)) {
      return this.responses.get(baseCommand)!;
    }

    // Try partial matches
    for (const [key, response] of this.responses.entries()) {
      if (command.toUpperCase().startsWith(key)) {
        return response;
      }
    }

    // Default response for unknown commands
    return { code: 200, result: '0', delay: 100 };
  }

  static addMockResponse(command: string, response: MockResponse): void {
    this.responses.set(command.toUpperCase(), response);
  }
}