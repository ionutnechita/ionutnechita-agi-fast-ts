#!/usr/bin/env bun
import { Socket } from 'net';

interface TestResult {
  connectionId: number;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  variablesReceived: boolean;
  commandsSent: number;
  responses: string[];
}

class AGIPerformanceTest {
  private readonly host: string;
  private readonly port: number;
  private results: TestResult[] = [];
  private concurrentConnections: number;
  private testDuration: number;

  constructor(
    host = 'localhost',
    port = 8090,
    concurrentConnections = 10,
    testDuration = 30000 // 30 seconds
  ) {
    this.host = host;
    this.port = port;
    this.concurrentConnections = concurrentConnections;
    this.testDuration = testDuration;
  }

  private async simulateAGIConnection(connectionId: number): Promise<TestResult> {
    const result: TestResult = {
      connectionId,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false,
      variablesReceived: false,
      commandsSent: 0,
      responses: []
    };

    return new Promise((resolve) => {
      const socket = new Socket();
      let buffer = '';
      let variablesSent = false;
      let commandCount = 0;

      const timeout = setTimeout(() => {
        socket.destroy();
        result.error = 'Connection timeout';
        result.endTime = Date.now();
        result.duration = result.endTime - result.startTime;
        resolve(result);
      }, this.testDuration);

      socket.connect(this.port, this.host, () => {
        console.log(`🔗 Connection ${connectionId} established`);

        // Send standard AGI variables
        const agiVariables = [
          'agi_request: agi://localhost:8090',
          'agi_channel: SIP/test-00000001',
          'agi_language: en',
          'agi_type: SIP',
          'agi_uniqueid: 1234567890.1',
          'agi_version: 20.7.0',
          'agi_callerid: "Test User" <1000>',
          'agi_calleridname: Test User',
          'agi_callingpres: 0',
          'agi_callingani2: 0',
          'agi_callington: 0',
          'agi_callingtns: 0',
          'agi_dnid: 1000',
          'agi_rdnis: unknown',
          'agi_context: default',
          'agi_extension: 1000',
          'agi_priority: 1',
          'agi_enhanced: 0.0',
          'agi_accountcode: ',
          'agi_threadid: 140123456789',
          ''
        ];

        // Send AGI variables
        socket.write(agiVariables.join('\n') + '\n');
        variablesSent = true;
        console.log(`📤 Connection ${connectionId}: AGI variables sent`);
      });

      socket.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            result.responses.push(line);
            console.log(`📥 Connection ${connectionId}: ${line}`);

            // Respond to AGI commands
            if (line.startsWith('ANSWER')) {
              socket.write('200 result=0\n');
              commandCount++;
            } else if (line.startsWith('STREAM FILE')) {
              socket.write('200 result=0 endpos=12345\n');
              commandCount++;
            } else if (line.startsWith('GET DATA')) {
              // Simulate DTMF code input
              socket.write('200 result=23313\n');
              commandCount++;
            } else if (line.startsWith('SET VARIABLE')) {
              socket.write('200 result=1\n');
              commandCount++;
            } else if (line.startsWith('VERBOSE')) {
              socket.write('200 result=1\n');
              commandCount++;
            } else if (line.startsWith('HANGUP')) {
              socket.write('200 result=1\n');
              commandCount++;
              // After HANGUP, close connection
              setTimeout(() => {
                socket.end();
              }, 100);
            }
          }
        }
      });

      socket.on('close', () => {
        clearTimeout(timeout);
        result.endTime = Date.now();
        result.duration = result.endTime - result.startTime;
        result.success = variablesSent && commandCount > 0;
        result.variablesReceived = variablesSent;
        result.commandsSent = commandCount;
        console.log(`🚪 Connection ${connectionId} closed (${result.duration}ms, ${commandCount} commands)`);
        resolve(result);
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        result.error = error.message;
        result.endTime = Date.now();
        result.duration = result.endTime - result.startTime;
        console.error(`❌ Connection ${connectionId} error:`, error.message);
        resolve(result);
      });
    });
  }

  async runTest(): Promise<void> {
    console.log('🚀 Starting AGI performance test');
    console.log(`📊 Configuration: ${this.concurrentConnections} concurrent connections`);
    console.log(`🕐 Timeout per connection: ${this.testDuration}ms`);
    console.log(`🎯 Target: ${this.host}:${this.port}`);
    console.log('');

    const startTime = Date.now();
    const promises: Promise<TestResult>[] = [];

    // Launch concurrent connections
    for (let i = 1; i <= this.concurrentConnections; i++) {
      promises.push(this.simulateAGIConnection(i));
      // Small delay between connections to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for all connections to complete
    this.results = await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    this.printResults(totalTime);
  }

  private printResults(totalTime: number): void {
    console.log('\n📈 PERFORMANCE TEST RESULTS');
    console.log('='.repeat(50));

    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const durations = successful.map(r => r.duration);
    const commandCounts = this.results.map(r => r.commandsSent);

    console.log(`✅ Successful connections: ${successful.length}/${this.results.length}`);
    console.log(`❌ Failed connections: ${failed.length}/${this.results.length}`);
    console.log(`🕐 Total test time: ${totalTime}ms`);
    console.log('');

    if (durations.length > 0) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      console.log('⏱️ RESPONSE TIMES:');
      console.log(`   Minimum: ${minDuration}ms`);
      console.log(`   Maximum: ${maxDuration}ms`);
      console.log(`   Average: ${Math.round(avgDuration)}ms`);
      console.log('');
    }

    if (commandCounts.length > 0) {
      const totalCommands = commandCounts.reduce((a, b) => a + b, 0);
      const avgCommands = totalCommands / commandCounts.length;

      console.log('📡 AGI COMMANDS:');
      console.log(`   Total processed: ${totalCommands}`);
      console.log(`   Average per connection: ${Math.round(avgCommands)}`);
      console.log('');
    }

    // Display errors
    if (failed.length > 0) {
      console.log('❌ ERRORS:');
      const errorGroups: { [key: string]: number } = {};
      failed.forEach(r => {
        const errorType = r.error || 'Unknown error';
        errorGroups[errorType] = (errorGroups[errorType] || 0) + 1;
      });

      for (const [error, count] of Object.entries(errorGroups)) {
        console.log(`   ${error}: ${count} cases`);
      }
      console.log('');
    }

    // Calculate success rate
    const successRate = (successful.length / this.results.length) * 100;
    const throughput = totalTime > 0 ? (this.results.length / (totalTime / 1000)) : 0;

    console.log('📊 PERFORMANCE METRICS:');
    console.log(`   Success rate: ${successRate.toFixed(1)}%`);
    console.log(`   Throughput: ${throughput.toFixed(2)} connections/second`);
    console.log(`   Concurrent connections: ${this.concurrentConnections}`);
    console.log('');

    // Recommendations
    if (successRate < 95) {
      console.log('⚠️ RECOMMENDATIONS:');
      if (failed.some(r => r.error?.includes('timeout'))) {
        console.log('   - Increase timeout for slow connections');
      }
      if (failed.some(r => r.error?.includes('ECONNREFUSED'))) {
        console.log('   - Check that AGI server is running on the specified port');
      }
      console.log('');
    } else {
      console.log('✅ AGI server performing excellently!');
      console.log('');
    }
  }
}

// Configure and run test
const runPerformanceTest = async () => {
  try {
    // You can modify these parameters
    const test = new AGIPerformanceTest(
      'localhost',  // host
      8090,         // port
      60,           // concurrent connections
      15000         // timeout per connection (15s)
    );

    await test.runTest();

  } catch (error) {
    console.error('❌ Error in performance test:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted by user');
  process.exit(0);
});

// Run the test
console.log('🧪 AGI Performance Test');
console.log('Press Ctrl+C to stop\n');

runPerformanceTest();