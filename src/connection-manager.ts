import { EventEmitter } from 'events';
import { AGIContext } from './types';
import { AGIConnectionError } from './agi-errors';

export interface ConnectionStats {
  total: number;
  active: number;
  idle: number;
  failed: number;
  averageResponseTime: number;
}

export class AGIConnectionManager extends EventEmitter {
  private connections = new Map<string, AGIContext>();
  private stats: ConnectionStats = {
    total: 0,
    active: 0,
    idle: 0,
    failed: 0,
    averageResponseTime: 0
  };
  private responseTimes: number[] = [];
  private maxConnections: number;
  private connectionTimeout: number;

  constructor(maxConnections: number = 100, connectionTimeout: number = 300000) { // 5 min default
    super();
    this.maxConnections = maxConnections;
    this.connectionTimeout = connectionTimeout;

    // Cleanup inactive connections every minute
    setInterval(() => this.cleanupConnections(), 60000);
  }

  public addConnection(id: string, context: AGIContext): void {
    if (this.connections.size >= this.maxConnections) {
      throw new AGIConnectionError(`Maximum connections (${this.maxConnections}) reached`);
    }

    this.connections.set(id, context);
    this.stats.total++;
    this.stats.active++;

    // Track connection events
    context.on('close', () => {
      this.removeConnection(id);
    });

    context.on('error', (error) => {
      this.stats.failed++;
      this.emit('connectionError', id, error);
    });

    // Track response times
    context.on('response', (response) => {
      if (response.timestamp) {
        const responseTime = Date.now() - response.timestamp;
        this.responseTimes.push(responseTime);

        // Keep only last 100 response times for average calculation
        if (this.responseTimes.length > 100) {
          this.responseTimes.shift();
        }

        this.stats.averageResponseTime =
          this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
      }
    });

    this.emit('connectionAdded', id, context);
  }

  public removeConnection(id: string): void {
    const context = this.connections.get(id);
    if (context) {
      this.connections.delete(id);
      this.stats.active--;
      this.emit('connectionRemoved', id);
    }
  }

  public getConnection(id: string): AGIContext | undefined {
    return this.connections.get(id);
  }

  public getAllConnections(): Map<string, AGIContext> {
    return new Map(this.connections);
  }

  public getStats(): ConnectionStats {
    return { ...this.stats };
  }

  public async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(
      context => context.close().catch(() => { }) // Ignore close errors
    );

    await Promise.all(closePromises);
    this.connections.clear();
    this.stats.active = 0;
  }

  private cleanupConnections(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, context] of this.connections) {
      // Remove connections that haven't been active for too long
      const lastActivity = (context as any).lastActivity || (context as any).createdAt || now;
      if (now - lastActivity > this.connectionTimeout) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      const context = this.connections.get(id);
      if (context) {
        context.close().catch(() => { }); // This will trigger removeConnection
      }
    }

    if (toRemove.length > 0) {
      this.emit('connectionsCleanedUp', toRemove);
    }
  }
}