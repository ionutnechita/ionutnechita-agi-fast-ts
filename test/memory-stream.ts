import { Readable } from 'stream';

export class MemoryStream extends Readable {
  private buffer: string = '';

  constructor(options?: any) {
    super(options);
    this.setEncoding('utf8');
  }

  _read(): void {
    // Implementation for readable stream
  }

  write(chunk: string): boolean {
    this.buffer += chunk;
    this.push(chunk);
    return true;
  }

  end(): void {
    this.push(null);
  }

  // Mock Socket methods for AGI server testing
  destroy(): this {
    this.emit('close');
    return this;
  }

  // Mock methods to match original MemoryStream behavior
  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
}