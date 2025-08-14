import { AGIContext as IAGIContext } from './types';
import { AGIValidator, AUDIO_FORMATS } from './validation';
import { AGIResponse } from './types';

export class EnhancedAGICommands {

  /**
   * Enhanced streamFile with validation and better error handling
   */
  static async streamFile(
    context: IAGIContext,
    filename: string,
    escapeDigits: string = '#'
  ): Promise<AGIResponse> {
    AGIValidator.validateRequired(filename, 'filename');
    AGIValidator.validateFilename(filename, 'filename');
    AGIValidator.validateEscapeDigits(escapeDigits, 'escapeDigits');

    return context.sendCommand(`STREAM FILE "${filename}" "${escapeDigits}"`);
  }

  /**
   * Enhanced recordFile with comprehensive validation
   */
  static async recordFile(
    context: IAGIContext,
    filename: string,
    format: string = 'wav',
    escapeDigits: string = '#',
    timeout: number = -1,
    offsetSamples: number = 0,
    beep: boolean = false,
    silence: number = 0
  ): Promise<AGIResponse> {
    AGIValidator.validateRequired(filename, 'filename');
    AGIValidator.validateFilename(filename, 'filename');
    AGIValidator.validateFormat(format, 'format', AUDIO_FORMATS);
    AGIValidator.validateEscapeDigits(escapeDigits, 'escapeDigits');
    AGIValidator.validateTimeout(timeout, 'timeout');
    AGIValidator.validatePositiveNumber(offsetSamples, 'offsetSamples');
    AGIValidator.validatePositiveNumber(silence, 'silence');

    const timeoutMs = timeout > 0 ? timeout * 1000 : timeout;
    const beepFlag = beep ? 1 : 0;

    return context.sendCommand(
      `RECORD FILE "${filename}" ${format} "${escapeDigits}" ${timeoutMs} ${offsetSamples} ${beepFlag} ${silence}`
    );
  }

  /**
   * Enhanced sayNumber with validation
   */
  static async sayNumber(
    context: IAGIContext,
    number: number,
    escapeDigits: string = '#'
  ): Promise<AGIResponse> {
    AGIValidator.validateNumber(number, 'number');
    AGIValidator.validateEscapeDigits(escapeDigits, 'escapeDigits');

    return context.sendCommand(`SAY NUMBER ${number} "${escapeDigits}"`);
  }

  /**
   * Enhanced getData with validation
   */
  static async getData(
    context: IAGIContext,
    filename: string,
    timeout: number = 5000,
    maxDigits: number = 255
  ): Promise<AGIResponse> {
    AGIValidator.validateRequired(filename, 'filename');
    AGIValidator.validateFilename(filename, 'filename');
    AGIValidator.validateTimeout(timeout, 'timeout');
    AGIValidator.validatePositiveNumber(maxDigits, 'maxDigits');

    return context.sendCommand(`GET DATA "${filename}" ${timeout} ${maxDigits}`);
  }

  /**
   * Enhanced setVariable with validation
   */
  static async setVariable(
    context: IAGIContext,
    name: string,
    value: string
  ): Promise<AGIResponse> {
    AGIValidator.validateRequired(name, 'name');
    AGIValidator.validateString(name, 'name');
    AGIValidator.validateString(value, 'value');

    // Escape quotes in value
    const escapedValue = value.replace(/"/g, '\\"');

    return context.sendCommand(`SET VARIABLE ${name} "${escapedValue}"`);
  }

  /**
   * Enhanced waitForDigit with validation
   */
  static async waitForDigit(
    context: IAGIContext,
    timeout: number
  ): Promise<AGIResponse> {
    AGIValidator.validateTimeout(timeout, 'timeout');

    return context.sendCommand(`WAIT FOR DIGIT ${timeout}`);
  }

  /**
   * Safe dial command with timeout and parameter validation
   */
  static async dial(
    context: IAGIContext,
    destination: string,
    timeout: number = 30,
    options: string = ''
  ): Promise<AGIResponse> {
    AGIValidator.validateRequired(destination, 'destination');
    AGIValidator.validateString(destination, 'destination');
    AGIValidator.validatePositiveNumber(timeout, 'timeout');
    AGIValidator.validateString(options, 'options');

    const dialString = options ? `${destination},${timeout},${options}` : `${destination},${timeout}`;
    return context.sendCommand(`EXEC Dial ${dialString}`);
  }

  /**
   * Background music control with validation
   */
  static async startMusicOnHold(
    context: IAGIContext,
    musicClass: string = 'default'
  ): Promise<AGIResponse> {
    AGIValidator.validateString(musicClass, 'musicClass');
    return context.sendCommand(`EXEC StartMusicOnHold ${musicClass}`);
  }

  static async stopMusicOnHold(context: IAGIContext): Promise<AGIResponse> {
    return context.sendCommand('EXEC StopMusicOnHold');
  }

  /**
   * Channel status with enhanced response parsing
   */
  static async getChannelStatus(
    context: IAGIContext,
    channel?: string
  ): Promise<{ status: string; description: string; response: AGIResponse }> {
    const response = channel
      ? await context.sendCommand(`CHANNEL STATUS ${channel}`)
      : await context.sendCommand('CHANNEL STATUS');

    const statusMap: { [key: string]: string } = {
      '0': 'Down',
      '1': 'Reserved',
      '2': 'OffHook',
      '3': 'Dialing',
      '4': 'Ring',
      '5': 'Ringing',
      '6': 'Up',
      '7': 'Busy',
      '8': 'Dialing Offhook',
      '9': 'Pre-ring'
    };

    const status = response.result;
    const description = statusMap[status] || 'Unknown';

    return { status, description, response };
  }
}