# AGI Fast TypeScript - Features Overview

## 🎯 Core Features

### Complete AGI Command Support
- **47 AGI Commands**: All standard Asterisk AGI commands implemented
- **Parameter Validation**: Automatic parameter preparation with defaults and formatters
- **Type Safety**: Full TypeScript support with comprehensive type definitions

### Enhanced Error Handling
- **Dead Channel Detection**: Graceful handling of hung-up calls during operations
- **Specific Error Types**: `AGIError`, `AGITimeoutError`, `AGICommandError`, `AGIConnectionError`
- **Automatic Recovery**: Connection reconnection logic with configurable attempts
- **Error Context**: Detailed error information with connection IDs and command context

### Advanced Connection Management
- **Health Checking**: Built-in connection health monitoring
- **Reconnection Logic**: Configurable retry attempts and delays
- **Connection Pooling**: Efficient connection management for high-throughput scenarios
- **Timeout Management**: Configurable command timeouts with retry mechanisms

### Production-Ready Logging
- **Structured Logging**: JSON-formatted logs with metadata
- **Log Levels**: Configurable logging levels (debug, info, warn, error)
- **Performance Monitoring**: Command execution timing and connection metrics
- **Debug Mode**: Detailed command and response logging for development

## 🔧 Configuration Options

### Server Configuration
```typescript
const agi = new AGIServer(handler, {
  port: 8090,                    // Bind port (default: 8090)
  host: '0.0.0.0',              // Bind address (default: 'localhost')
  debug: true,                   // Enable debug logging (default: false)
  logger: true                   // Enable structured logging (default: false)
});
```

### Context Configuration
```typescript
const context = new AGIContext(socket, {
  debug: false,                  // Debug mode
  commandTimeout: 5000,          // Command timeout in ms (default: 5000/2000)
  maxRetries: 3,                 // Max retry attempts (default: 3)
  retryDelay: 1000,             // Delay between retries (default: 1000ms)
  maxReconnectionAttempts: 3,   // Max reconnection attempts (default: 3)
  reconnectionDelay: 1000       // Delay between reconnections (default: 1000ms)
});
```

## 📋 Supported AGI Commands

### Basic Commands
- `answer()` - Answer the channel
- `hangup()` - Hang up the channel
- `noop()` - No operation (useful for testing)

### Variable Management
- `getVariable(name)` - Get channel variable
- `setVariable(name, value)` - Set channel variable
- `getFullVariable(name, channel?)` - Get full variable with channel context

### Audio & Media
- `streamFile(filename, escapeDigits?)` - Stream audio file
- `controlStreamFile(filename, escapeDigits?, skipms?, ffchar?, rewchr?, pausechr?, offsetms?)` - Advanced audio streaming
- `recordFile(filename, format?, escapeDigits?, timeout?, offsetSamples?, beep?, silence?)` - Record audio

### Speech Synthesis
- `sayNumber(number, escapeDigits?)` - Say number
- `sayAlpha(text, escapeDigits?)` - Say text alphabetically
- `sayDate(date, escapeDigits?)` - Say date
- `sayTime(time, escapeDigits?)` - Say time
- `sayDateTime(datetime, escapeDigits?, format?, timezone?)` - Say date and time
- `sayDigits(digits, escapeDigits?)` - Say digits
- `sayPhonetic(text, escapeDigits?)` - Say text phonetically

### Input Collection
- `getData(filename, timeout?, maxDigits?)` - Play prompt and collect DTMF
- `getOption(filename, escapeDigits?, timeout?)` - Play prompt and wait for single digit
- `waitForDigit(timeout)` - Wait for single DTMF digit
- `receiveChar(timeout)` - Receive single character
- `receiveText(timeout)` - Receive text message

### Channel Control
- `channelStatus(channel?)` - Get channel status
- `setAutoHangup(time)` - Set automatic hangup time
- `setCallerID(callerid)` - Set caller ID
- `setContext(context)` - Set dialplan context
- `setExtension(extension)` - Set extension
- `setPriority(priority)` - Set priority
- `setMusic(on)` - Enable/disable music on hold

### Database Operations
- `databaseGet(family, key)` - Get database value
- `databasePut(family, key, value)` - Store database value
- `databaseDel(family, key)` - Delete database entry
- `databaseDelTree(family, keyTree?)` - Delete database tree

### Speech Recognition
- `speechCreate(engine)` - Create speech recognition instance
- `speechDestroy()` - Destroy speech recognition instance
- `speechLoadGrammar(grammar, path)` - Load speech grammar
- `speechUnloadGrammar(grammar)` - Unload speech grammar
- `speechActivateGrammar(grammar)` - Activate speech grammar
- `speechDeactivateGrammar(grammar)` - Deactivate speech grammar
- `speechSet(name, value)` - Set speech recognition parameter
- `speechRecognize(prompt, timeout, offset?)` - Perform speech recognition

### Utility Commands
- `exec(application, ...args)` - Execute dialplan application
- `dial(target, timeout, params)` - Dial number (sugar command)
- `sendImage(image)` - Send image to channel
- `sendText(text)` - Send text message
- `verbose(message, level?)` - Send verbose message to Asterisk
- `tddMode(on)` - Enable/disable TDD mode
- `gosub(context, extension, priority, args?)` - Gosub to dialplan location
- `asyncAGIBreak()` - Break out of async AGI

## 🧪 Testing & Quality Assurance

### Test Coverage
- **73+ Unit Tests**: Comprehensive test coverage
- **Integration Tests**: Real AGI protocol testing
- **Error Scenario Testing**: All error conditions covered
- **Performance Tests**: Timeout and retry logic validation

### Quality Features
- **TypeScript Strict Mode**: Full type checking enabled
- **ESLint Integration**: Code quality enforcement
- **Comprehensive Documentation**: Inline JSDoc comments

## 🚀 Performance Features

### Optimizations
- **Bun Runtime**: Ultra-fast JavaScript runtime
- **Event-driven Architecture**: Non-blocking I/O operations
- **Connection Pooling**: Efficient resource management
- **Memory Management**: Automatic cleanup and garbage collection

### Monitoring
- **Connection Metrics**: Track connection counts and health
- **Performance Timing**: Command execution time tracking  
- **Error Rate Monitoring**: Track error frequencies and patterns
- **Memory Usage**: Process memory monitoring

## 📦 Deployment Features

### Docker Support
Ready for containerized deployment with proper signal handling and graceful shutdown.

### Production Considerations
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **Error Recovery**: Automatic reconnection and retry logic
- **Logging**: Structured logs suitable for log aggregation systems
- **Health Checks**: Built-in health check endpoints

### Scaling
- **Multi-instance Ready**: Supports horizontal scaling
- **Load Balancer Compatible**: Works with standard load balancers
- **Session Management**: Stateless design for easy clustering

## 🔗 Integration Examples

### Basic Asterisk Integration
```
; extensions.conf
[default]
exten => 1000,1,AGI(agi://localhost:8090)
exten => 1000,n,Hangup()
```

### Advanced Features Usage
```typescript
// Error handling with specific error types
context.streamFile('welcome')
  .then((response) => {
    if (response.isDeadChannel) {
      console.log('Caller hung up - no error');
      return;
    }
    // Continue processing...
  })
  .catch((error) => {
    if (error instanceof AGITimeoutError) {
      console.log('Command timed out');
    } else if (error instanceof AGICommandError) {
      console.log(`AGI error: ${error.code} - ${error.message}`);
    }
  });
```

This comprehensive feature set makes AGI Fast TypeScript suitable for production telephony applications requiring reliability, performance, and maintainability.
