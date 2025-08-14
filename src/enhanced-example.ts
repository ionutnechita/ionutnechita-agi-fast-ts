import {
  AGIServer,
  AGIHandler,
  EnhancedAGICommands,
  AGIConnectionManager,
  AGIError,
  AGITimeoutError,
  AGICommandError
} from './index';

// Connection manager for tracking active connections
const connectionManager = new AGIConnectionManager(50, 300000); // max 50, 5min timeout

connectionManager.on('connectionAdded', (id, context) => {
  console.log(`New AGI connection: ${id}`);
});

connectionManager.on('connectionRemoved', (id) => {
  console.log(`AGI connection closed: ${id}`);
});

connectionManager.on('connectionError', (id, error) => {
  console.error(`Connection ${id} error:`, error.message);
});

// Enhanced handler with proper error handling and validation
const enhancedHandler: AGIHandler = async (context) => {
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Add connection to manager
    connectionManager.addConnection(connectionId, context);

    // Wait for AGI variables
    const vars = await context.onEvent('variables');
    console.log('AGI Variables:', {
      network: vars.agi_network,
      uniqueid: vars.agi_uniqueid,
      channel: vars.agi_channel,
      callerid: vars.agi_callerid
    });

    // Answer the call
    await context.answer();
    console.log('Call answered');

    // Use enhanced commands with validation
    try {
      // Play welcome message
      const streamResult = await EnhancedAGICommands.streamFile(context, 'welcome');
      console.log('Welcome message played:', streamResult);

      // Get caller input
      const inputResult = await EnhancedAGICommands.getData(context, 'enter-number', 5000, 4);
      console.log('User input:', inputResult.result);

      if (inputResult.result && inputResult.result !== '0') {
        // Say the number back
        const number = parseInt(inputResult.result);
        await EnhancedAGICommands.sayNumber(context, number);

        // Set result variable
        await EnhancedAGICommands.setVariable(context, 'USER_INPUT', inputResult.result);

        // Record a message
        await EnhancedAGICommands.recordFile(
          context,
          `/tmp/recording_${vars.agi_uniqueid}`,
          'wav',
          '#',
          10, // 10 second timeout
          0,
          true // beep before recording
        );

        console.log('Recording completed');
      }

      // Get channel status
      const statusInfo = await EnhancedAGICommands.getChannelStatus(context);
      console.log('Channel status:', statusInfo);

      // Play goodbye
      await EnhancedAGICommands.streamFile(context, 'goodbye');

    } catch (error) {
      if (error instanceof AGITimeoutError) {
        console.log('Command timed out:', error.message);
        await EnhancedAGICommands.streamFile(context, 'timeout').catch(() => { });
      } else if (error instanceof AGICommandError) {
        console.log('AGI command failed:', error.message, 'Code:', error.code);
        await EnhancedAGICommands.streamFile(context, 'error').catch(() => { });
      } else if (error instanceof AGIError) {
        console.log('AGI error:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
    }

  } catch (error) {
    console.error('Handler error:', error);
  } finally {
    // Always close the connection
    await context.close();
    console.log('AGI session ended');
  }
};

// Create server with enhanced options
const agi = new AGIServer(enhancedHandler, {
  port: 8090,
  debug: true,
  host: '::'
});

// Server event handlers
agi.on('error', (error) => {
  console.error('AGI Server error:', error);
});

agi.on('close', () => {
  console.log('AGI Server closed');
  connectionManager.closeAllConnections();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down AGI server...');

  // Close all connections
  await connectionManager.closeAllConnections();

  // Close server
  await agi.close();

  console.log('AGI server shut down gracefully');
  process.exit(0);
});

// Statistics reporting
setInterval(() => {
  const stats = connectionManager.getStats();
  console.log('Connection stats:', {
    active: stats.active,
    total: stats.total,
    failed: stats.failed,
    avgResponseTime: Math.round(stats.averageResponseTime)
  });
}, 30000); // Every 30 seconds

// Start server
agi.init();

console.log('Enhanced AGI Server started on port 8090');
console.log('Features enabled:');
console.log('- Command validation and error handling');
console.log('- Connection management and pooling');
console.log('- Timeout and retry logic');
console.log('- Enhanced logging and statistics');
console.log('');
console.log('Add to Asterisk extensions.conf:');
console.log('[default]');
console.log('exten => 1000,1,AGI(agi://localhost:8090)');