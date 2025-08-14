#!/usr/bin/env bun
import { Socket } from 'net';

interface StressTestResult {
  connectionId: number;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  commandsSent: number;
  responseTimes: number[];
  totalDataSent: number;
  totalDataReceived: number;
}

interface TestStats {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  averageConnectionDuration: number;
  minConnectionDuration: number;
  maxConnectionDuration: number;
  totalCommandsSent: number;
  averageCommandsPerConnection: number;
  connectionsPerSecond: number;
  totalDataTransferred: number;
  peakConcurrentConnections: number;
}

class AGIStressTest {
  private readonly host: string;
  private readonly port: number;
  private results: StressTestResult[] = [];
  private maxConcurrentConnections: number;
  private totalConnections: number;
  private connectionDelay: number;
  private commandTimeout: number;
  private activeConnections: number = 0;
  private peakConcurrentConnections: number = 0;
  private startTime: number = 0;

  constructor(
    host = 'localhost',
    port = 8090,
    maxConcurrentConnections = 50,
    totalConnections = 200,
    connectionDelay = 50, // ms between new connections
    commandTimeout = 10000 // 10 seconds per connection
  ) {
    this.host = host;
    this.port = port;
    this.maxConcurrentConnections = maxConcurrentConnections;
    this.totalConnections = totalConnections;
    this.connectionDelay = connectionDelay;
    this.commandTimeout = commandTimeout;
  }

  private async simulateStressConnection(connectionId: number): Promise<StressTestResult> {
    const result: StressTestResult = {
      connectionId,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false,
      commandsSent: 0,
      responseTimes: [],
      totalDataSent: 0,
      totalDataReceived: 0
    };

    return new Promise((resolve) => {
      const socket = new Socket();
      let buffer = '';
      let commandCount = 0;
      let lastCommandTime = 0;

      this.activeConnections++;
      if (this.activeConnections > this.peakConcurrentConnections) {
        this.peakConcurrentConnections = this.activeConnections;
      }

      const timeout = setTimeout(() => {
        socket.destroy();
        result.error = 'Connection timeout';
        result.endTime = Date.now();
        result.duration = result.endTime - result.startTime;
        this.activeConnections--;
        resolve(result);
      }, this.commandTimeout);

      socket.connect(this.port, this.host, () => {
        if (connectionId % 10 === 0) {
          console.log(`🔗 Connection ${connectionId} established (${this.activeConnections} active)`);
        }

        // Send comprehensive AGI variables
        const agiVariables = [
          'agi_request: agi://localhost:8090',
          `agi_channel: SIP/stress-${connectionId.toString().padStart(8, '0')}`,
          'agi_language: en',
          'agi_type: SIP',
          `agi_uniqueid: ${Date.now()}.${connectionId}`,
          'agi_version: 20.7.0',
          `agi_callerid: "Stress Test ${connectionId}" <${1000 + (connectionId % 9000)}>`,
          `agi_calleridname: Stress Test ${connectionId}`,
          'agi_callingpres: 0',
          'agi_callingani2: 0',
          'agi_callington: 0',
          'agi_callingtns: 0',
          `agi_dnid: ${1000 + (connectionId % 100)}`,
          'agi_rdnis: unknown',
          'agi_context: default',
          `agi_extension: ${1000 + (connectionId % 100)}`,
          'agi_priority: 1',
          'agi_enhanced: 0.0',
          'agi_accountcode: STRESS_TEST',
          `agi_threadid: ${140000000000 + connectionId}`,
          ''
        ];

        const agiData = agiVariables.join('\n') + '\n';
        socket.write(agiData);
        result.totalDataSent += Buffer.byteLength(agiData);
      });

      socket.on('data', (data) => {
        const dataStr = data.toString();
        buffer += dataStr;
        result.totalDataReceived += Buffer.byteLength(dataStr);

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const now = Date.now();
            if (lastCommandTime > 0) {
              result.responseTimes.push(now - lastCommandTime);
            }

            // Respond to AGI commands with realistic delays
            if (line.startsWith('ANSWER')) {
              lastCommandTime = now;
              socket.write('200 result=0\n');
              result.totalDataSent += 15;
              commandCount++;
            } else if (line.startsWith('STREAM FILE')) {
              lastCommandTime = now;
              // Simulate file streaming duration
              const endPos = Math.floor(Math.random() * 100000) + 10000;
              socket.write(`200 result=0 endpos=${endPos}\n`);
              result.totalDataSent += 25;
              commandCount++;
            } else if (line.startsWith('GET DATA')) {
              lastCommandTime = now;
              // Simulate DTMF input with random digits
              const digits = Math.floor(Math.random() * 99999) + 10000;
              socket.write(`200 result=${digits}\n`);
              result.totalDataSent += 20;
              commandCount++;
            } else if (line.startsWith('SET VARIABLE')) {
              lastCommandTime = now;
              socket.write('200 result=1\n');
              result.totalDataSent += 15;
              commandCount++;
            } else if (line.startsWith('VERBOSE')) {
              lastCommandTime = now;
              socket.write('200 result=1\n');
              result.totalDataSent += 15;
              commandCount++;
            } else if (line.startsWith('HANGUP')) {
              lastCommandTime = now;
              socket.write('200 result=1\n');
              result.totalDataSent += 15;
              commandCount++;
              // Close after HANGUP with small delay
              setTimeout(() => socket.end(), 50);
            }
          }
        }
      });

      socket.on('close', () => {
        clearTimeout(timeout);
        result.endTime = Date.now();
        result.duration = result.endTime - result.startTime;
        result.success = commandCount > 0;
        result.commandsSent = commandCount;
        this.activeConnections--;

        if (connectionId % 25 === 0) {
          console.log(`🚪 Connection ${connectionId} closed (${result.duration}ms, ${commandCount} commands)`);
        }
        resolve(result);
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        result.error = error.message;
        result.endTime = Date.now();
        result.duration = result.endTime - result.startTime;
        result.commandsSent = commandCount;
        this.activeConnections--;

        if (connectionId % 50 === 0) {
          console.error(`❌ Connection ${connectionId} error: ${error.message}`);
        }
        resolve(result);
      });
    });
  }

  async runStressTest(): Promise<void> {
    console.log('🔥 Starting AGI Stress Test');
    console.log(`📊 Configuration:`);
    console.log(`   Target: ${this.host}:${this.port}`);
    console.log(`   Total connections: ${this.totalConnections}`);
    console.log(`   Max concurrent: ${this.maxConcurrentConnections}`);
    console.log(`   Connection delay: ${this.connectionDelay}ms`);
    console.log(`   Command timeout: ${this.commandTimeout}ms`);
    console.log('');

    this.startTime = Date.now();
    const promises: Promise<StressTestResult>[] = [];
    let connectionCount = 0;

    // Launch connections with controlled rate using a different approach
    while (connectionCount < this.totalConnections) {
      // Wait for available slot if we've reached max concurrent connections
      while (this.activeConnections >= this.maxConcurrentConnections) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      connectionCount++;
      promises.push(this.simulateStressConnection(connectionCount));

      // Add delay between connection launches (except for the last one)
      if (connectionCount < this.totalConnections) {
        await new Promise(resolve => setTimeout(resolve, this.connectionDelay));
      }
    }

    console.log(`🚀 All ${this.totalConnections} connections launched, waiting for completion...`);

    // Wait for all connections to complete
    this.results = await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;

    this.printStressResults(totalTime);
  }

  private printStressResults(totalTime: number): void {
    console.log('\n🔥 STRESS TEST RESULTS');
    console.log('='.repeat(60));

    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const durations = successful.map(r => r.duration);
    const allResponseTimes = successful.flatMap(r => r.responseTimes);

    const stats: TestStats = {
      totalConnections: this.results.length,
      successfulConnections: successful.length,
      failedConnections: failed.length,
      averageConnectionDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minConnectionDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxConnectionDuration: durations.length > 0 ? Math.max(...durations) : 0,
      totalCommandsSent: this.results.reduce((sum, r) => sum + r.commandsSent, 0),
      averageCommandsPerConnection: this.results.length > 0 ? this.results.reduce((sum, r) => sum + r.commandsSent, 0) / this.results.length : 0,
      connectionsPerSecond: totalTime > 0 ? (this.results.length / (totalTime / 1000)) : 0,
      totalDataTransferred: this.results.reduce((sum, r) => sum + r.totalDataSent + r.totalDataReceived, 0),
      peakConcurrentConnections: this.peakConcurrentConnections
    };

    console.log('📊 CONNECTION SUMMARY:');
    console.log(`   Total connections attempted: ${stats.totalConnections}`);
    console.log(`   Successful connections: ${stats.successfulConnections}`);
    console.log(`   Failed connections: ${stats.failedConnections}`);
    console.log(`   Success rate: ${((stats.successfulConnections / stats.totalConnections) * 100).toFixed(1)}%`);
    console.log(`   Peak concurrent connections: ${stats.peakConcurrentConnections}`);
    console.log('');

    console.log('⏱️ TIMING METRICS:');
    console.log(`   Total test duration: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);
    console.log(`   Average connection duration: ${Math.round(stats.averageConnectionDuration)}ms`);
    console.log(`   Fastest connection: ${stats.minConnectionDuration}ms`);
    console.log(`   Slowest connection: ${stats.maxConnectionDuration}ms`);
    console.log(`   Connection rate: ${stats.connectionsPerSecond.toFixed(2)} connections/second`);
    console.log('');

    if (allResponseTimes.length > 0) {
      const avgResponseTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;
      const minResponseTime = Math.min(...allResponseTimes);
      const maxResponseTime = Math.max(...allResponseTimes);

      console.log('📡 COMMAND RESPONSE TIMES:');
      console.log(`   Total commands processed: ${stats.totalCommandsSent}`);
      console.log(`   Average commands per connection: ${Math.round(stats.averageCommandsPerConnection)}`);
      console.log(`   Average response time: ${Math.round(avgResponseTime)}ms`);
      console.log(`   Fastest response: ${minResponseTime}ms`);
      console.log(`   Slowest response: ${maxResponseTime}ms`);
      console.log('');
    }

    console.log('💾 DATA TRANSFER:');
    console.log(`   Total data transferred: ${(stats.totalDataTransferred / 1024).toFixed(2)} KB`);
    console.log(`   Average per connection: ${Math.round(stats.totalDataTransferred / stats.totalConnections)} bytes`);
    console.log('');

    // Error analysis
    if (failed.length > 0) {
      console.log('❌ ERROR ANALYSIS:');
      const errorTypes: { [key: string]: number } = {};
      failed.forEach(r => {
        const errorType = r.error || 'Unknown error';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      });

      for (const [error, count] of Object.entries(errorTypes)) {
        console.log(`   ${error}: ${count} occurrences`);
      }
      console.log('');
    }

    // Performance assessment
    const successRate = (stats.successfulConnections / stats.totalConnections) * 100;
    console.log('🎯 PERFORMANCE ASSESSMENT:');

    if (successRate >= 95) {
      console.log('   ✅ EXCELLENT: Server handled stress test with minimal issues');
    } else if (successRate >= 90) {
      console.log('   ⚠️ GOOD: Server performed well with some minor issues');
    } else if (successRate >= 80) {
      console.log('   ⚠️ FAIR: Server showed stress under high load');
    } else {
      console.log('   ❌ POOR: Server struggled significantly under load');
    }

    if (stats.peakConcurrentConnections < this.maxConcurrentConnections * 0.8 && stats.averageConnectionDuration > 2000) {
      console.log('   ⚠️ Server may have connection limits or bottlenecks');
    } else if (stats.peakConcurrentConnections < this.maxConcurrentConnections * 0.5 && stats.averageConnectionDuration < 1000) {
      console.log('   🚀 Server is highly optimized - connections complete very quickly');
    }

    if (stats.averageConnectionDuration > 5000) {
      console.log('   ⚠️ Connection durations are high - possible performance issues');
    }

    console.log('');
    console.log('📝 RECOMMENDATIONS:');
    if (successRate < 95) {
      console.log('   - Consider reducing concurrent connection limit');
      console.log('   - Check server resources (CPU, memory, file descriptors)');
    }
    if (stats.averageConnectionDuration > 3000) {
      console.log('   - Optimize AGI command processing');
      console.log('   - Check for blocking operations in server code');
    }
    if (failed.some(r => r.error?.includes('ECONNREFUSED'))) {
      console.log('   - Verify server connection limits and backlog settings');
    }
    console.log('');
  }
}

// Configure and run stress test
const runStressTest = async () => {
  try {
    const test = new AGIStressTest(
      'localhost',  // host
      8090,         // port
      30,           // max concurrent connections
      150,          // total connections to test
      100,          // delay between new connections (ms)
      20000         // timeout per connection (20s)
    );

    await test.runStressTest();

  } catch (error) {
    console.error('❌ Error in stress test:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stress test interrupted by user');
  process.exit(0);
});

// Run the test
console.log('🔥 AGI Stress Test Tool');
console.log('Press Ctrl+C to stop\n');

runStressTest();