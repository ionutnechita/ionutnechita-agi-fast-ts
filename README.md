# AGI Fast TypeScript

Modern TypeScript implementation of AGI (Asterisk Gateway Interface) server, converted from the original [ding-dong](https://github.com/antirek/ding-dong) library.

## Features

- 🔷 **Full TypeScript support** with comprehensive type definitions
- ⚡ **Modern Promise-based API** 
- 🔄 **100% API compatible** with ding-dong
- 🧪 **Complete test coverage** (60+ tests)
- 📦 **Built with Bun** for fast development and testing

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

const agi = new AGIServer(handler, { port: 3000, debug: true });
agi.init();
```

### Migration from ding-dong

The API is 100% compatible with ding-dong:

```javascript
// ding-dong (JavaScript)
const AGIServer = require('ding-dong');

// agi-fast-ts (TypeScript) - same API!
import AGIServer from './src/index';
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
exten => 1000,1,AGI(agi://localhost:3000)
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

All 60+ tests pass, ensuring compatibility with the original ding-dong implementation.

## Architecture

- `src/index.ts` - Main exports (generic, like ding-dong)
- `src/agi-server.ts` - AGI server implementation
- `src/agi-context.ts` - AGI context with all commands
- `src/types.ts` - TypeScript type definitions
- `src/commands.ts` - AGI command definitions
- `src/example.ts` - Usage example
- `test/` - Comprehensive test suite

## License

MIT