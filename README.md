# AGI Fast TypeScript

Modern, high-performance TypeScript implementation of AGI (Asterisk Gateway Interface) server for telephony applications.

## Features

- 🔷 **Full TypeScript support** with comprehensive type definitions
- ⚡ **Modern Promise-based API** with async/await support
- 🛡️ **Enhanced error handling** with dead channel detection and automatic recovery
- 🔄 **Robust connection management** with reconnection logic
- 🧪 **Complete test coverage** (73+ tests)
- 📦 **Built with Bun** for lightning-fast development and testing
- 🎯 **Parameter preparation** with default values and formatters
- 🌐 **Configurable host binding** for flexible deployment

## Installation

```bash
bun install
```

## Usage

### Basic Example

```typescript
import { AGIServer, AGIContext } from './src/index';

const handler = (context: AGIContext) => {
  context.onEvent('variables')
    .then((vars) => {
      console.log('AGI Variables:', vars);
      return context.streamFile('beep');
    })
    .then((result) => {
      return context.setVariable('RESULT', 'success');
    })
    .then(() => {
      return context.close();
    })
    .catch((err) => {
      console.error('AGI Error:', err);
      context.close();
    });
};

const agi = new AGIServer(handler, { port: 8090, debug: true });
agi.init();
```

### Server Configuration

Configure the server with various options:

```typescript
const agi = new AGIServer(handler, {
  port: 8090,           // Port to bind to (default: 8090)
  host: '0.0.0.0',      // Host address to bind (default: 'localhost')
  debug: true,          // Enable debug logging (default: false)
  logger: true          // Enable structured logging (default: false)
});
```

## Development Commands

```bash
bun run dev          # Run example server with watch mode
bun run build        # Build for production
bun run type-check   # Run TypeScript type checking
bun run test         # Run tests
bun run test:watch   # Run tests in watch mode
```

## AGI Commands

All AGI commands are fully typed and available:

### Basic Commands
- `answer()` - Answer the channel
- `hangup()` - Hang up the channel
- `noop()` - No operation

### Variable Commands
- `getVariable(name)` - Get channel variable
- `setVariable(name, value)` - Set channel variable
- `getFullVariable(name, channel?)` - Get full variable

### Audio Commands
- `streamFile(filename, escapeDigits?)` - Stream audio file
- `recordFile(filename, format?, escapeDigits?, timeout?, ...)` - Record audio
- `controlStreamFile(...)` - Stream with control

### Say Commands
- `sayNumber(number, escapeDigits?)` - Say number
- `sayAlpha(text, escapeDigits?)` - Say alphabetically
- `sayDate(date, escapeDigits?)` - Say date
- `sayTime(time, escapeDigits?)` - Say time
- `sayDigits(digits, escapeDigits?)` - Say digits

### Input Commands
- `getData(filename, timeout?, maxDigits?)` - Get DTMF input
- `waitForDigit(timeout)` - Wait for single digit
- `receiveChar(timeout)` - Receive character

### Database Commands
- `databaseGet(family, key)` - Get database value
- `databasePut(family, key, value)` - Put database value
- `databaseDel(family, key)` - Delete database entry

### And many more...

## Asterisk Configuration

Add to your `extensions.conf`:

```
[default]
exten => 1000,1,AGI(agi://localhost:8090)
```

## Events

The context emits several events:

```typescript
context.on('variables', (vars) => {
  // Called when AGI variables are received
});

context.on('response', (response) => {
  // Called for each command response
});

context.on('hangup', () => {
  // Called when channel hangs up
});

context.on('error', (err) => {
  // Called on errors
});

context.on('close', () => {
  // Called when connection closes
});
```

## Type Safety

Full TypeScript support with IntelliSense:

```typescript
import { AGIServer, AGIContext, AGIResponse } from './src/index';

const handler = (context: AGIContext) => {
  // All methods are fully typed
  context.streamFile('hello-world')
    .then((response: AGIResponse) => {
      console.log(`Code: ${response.code}, Result: ${response.result}`);
    });
};
```

## Testing

Run tests to verify functionality:

```bash
bun test
```

All 73+ tests pass, ensuring reliable AGI command handling and error recovery.

## Architecture

- `src/index.ts` - Main exports and public API
- `src/agi-server.ts` - AGI server implementation with connection handling
- `src/agi-context.ts` - AGI context with all commands and enhanced error handling
- `src/types.ts` - Complete TypeScript type definitions
- `src/commands.ts` - All 47 AGI command definitions with parameter rules
- `src/agi-errors.ts` - Comprehensive error classes
- `src/logger.ts` - Structured logging system
- `test/` - Comprehensive test suite with 73+ tests

## Error Handling

Enhanced error handling with specific error types:

```typescript
import { AGIError, AGITimeoutError, AGICommandError, AGIConnectionError } from './src/agi-errors';

context.streamFile('audio-file')
  .then((response) => {
    if (response.isDeadChannel) {
      console.log('Channel was hung up during playback');
      // Handle gracefully without throwing error
    }
  })
  .catch((error) => {
    if (error instanceof AGITimeoutError) {
      console.log('Command timed out');
    } else if (error instanceof AGICommandError) {
      console.log(`AGI command failed: ${error.code}`);
    }
  });
```

## License

MIT
