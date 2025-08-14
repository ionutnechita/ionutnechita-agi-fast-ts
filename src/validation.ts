import { AGIValidationError } from './agi-errors';

export class AGIValidator {
  static validateRequired(value: any, paramName: string): void {
    if (value === undefined || value === null || value === '') {
      throw new AGIValidationError(paramName, value, 'non-empty value');
    }
  }

  static validateNumber(value: any, paramName: string): number {
    if (typeof value === 'number') return value;

    const num = Number(value);
    if (isNaN(num)) {
      throw new AGIValidationError(paramName, value, 'number');
    }
    return num;
  }

  static validatePositiveNumber(value: any, paramName: string): number {
    const num = this.validateNumber(value, paramName);
    if (num < 0) {
      throw new AGIValidationError(paramName, value, 'positive number');
    }
    return num;
  }

  static validateString(value: any, paramName: string): string {
    if (typeof value !== 'string') {
      throw new AGIValidationError(paramName, value, 'string');
    }
    return value;
  }

  static validateFilename(value: any, paramName: string): string {
    const filename = this.validateString(value, paramName);
    // Only prevent directory traversal attacks, allow legitimate paths
    if (filename.includes('..')) {
      throw new AGIValidationError(paramName, value, 'filename without directory traversal (..)');
    }
    return filename;
  }

  static validateSafeFilename(value: any, paramName: string): string {
    const filename = this.validateString(value, paramName);
    // Strict validation for cases where only simple filenames are allowed
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new AGIValidationError(paramName, value, 'safe filename without path separators');
    }
    return filename;
  }

  static validateTimeout(value: any, paramName: string): number {
    const timeout = this.validateNumber(value, paramName);
    if (timeout < -1) {
      throw new AGIValidationError(paramName, value, 'timeout >= -1 (-1 for infinite)');
    }
    return timeout;
  }

  static validateEscapeDigits(value: any, paramName: string): string {
    if (value === undefined || value === null) return '#';

    const digits = this.validateString(value, paramName);
    const validChars = /^[0-9#*]+$/;
    if (!validChars.test(digits)) {
      throw new AGIValidationError(paramName, value, 'digits, # or * characters only');
    }
    return digits;
  }

  static validateFormat(value: any, paramName: string, validFormats: readonly string[]): string {
    const format = this.validateString(value, paramName);
    if (!validFormats.includes(format)) {
      throw new AGIValidationError(paramName, value, `one of: ${validFormats.join(', ')}`);
    }
    return format;
  }
}

// Common validation constants
export const AUDIO_FORMATS = ['wav', 'gsm', 'g729', 'ulaw', 'alaw'] as const;
export const TDD_MODES = ['on', 'off', 'mate', 'tdd'] as const;