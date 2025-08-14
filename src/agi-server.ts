import { EventEmitter } from 'events';
import { createServer, Server, Socket } from 'net';
import { AGIServerOptions, AGIHandler } from './types';
import { AGIContext } from './agi-context';
import { DevModeManager } from './dev-utils';

export class AGIServer extends EventEmitter {
  private options: Required<AGIServerOptions>;
  private handler: AGIHandler;
  private server: Server;

  constructor(handler: AGIHandler, options: AGIServerOptions = {}) {
    super();

    this.options = {
      port: options.port ?? 8090,
      debug: options.debug ?? false,
      logger: options.logger ?? false,
      host: options.host ?? 'localhost',
    };

    this.handler = handler;

    this.server = createServer((connection: Socket) => {
      // In mock mode, don't use real socket connections
      if (DevModeManager.isMockMode) {
        // Close the real connection immediately to prevent timeouts
        connection.destroy();
        return;
      }

      const context = new AGIContext(connection, {
        debug: this.options.debug,
        logger: this.options.logger,
      });

      this.handler(context);
    });
  }

  public init(): void {
    this.server.on('error', (error) => {
      // In dev mode, suppress connection errors that are expected
      if (!DevModeManager.shouldSuppressTimeouts()) {
        this.emit('error', new Error('Internal TCP server error: ' + error.message));
      }
    });

    this.server.on('close', () => {
      this.emit('close');
    });

    this.server.listen(this.options.port, this.options.host, () => {
      console.log('AGI server listening on', this.options.port);
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}