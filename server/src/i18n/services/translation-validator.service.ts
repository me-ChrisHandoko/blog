// src/i18n/services/translation-validator.service.ts - NEW FILE
import { Injectable, Logger } from '@nestjs/common';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../constants/languages';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface TranslationValidationOptions {
  checkMissingKeys: boolean;
  checkEmptyValues: boolean;
  checkPlaceholderConsistency: boolean;
  checkLength: boolean;
  maxLength?: number;
  minLength?: number;
  allowHtml: boolean;
  allowSpecialCharacters: boolean;
}

export interface KeyValidationResult extends ValidationResult {
  key: string;
  language: SupportedLanguage;
  value: string;
}

@Injectable()
export class TranslationValidatorService {
  private readonly logger = new Logger(TranslationValidatorService.name);
  private readonly defaultOptions: TranslationValidationOptions = {
    checkMissingKeys: true,
    checkEmptyValues: true,
    checkPlaceholderConsistency: true,
    checkLength: true,
    maxLength: 1000,
    minLength: 1,
    allowHtml: false,
    allowSpecialCharacters: true,
  };

  constructor() {
    this.logger.log('✅ TranslationValidatorService initialized');
  }

  /**
   * Validate a single translation key
   */
  validateTranslationKey(key: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check if key is valid format
    if (!key || typeof key !== 'string') {
      errors.push('Translation key must be a non-empty string');
      return { isValid: false, errors, warnings, suggestions };
    }

    // Check key format (should use dot notation)
    if (!key.includes('.')) {
      warnings.push(
        'Translation key should use dot notation (e.g., "module.component.label")',
      );
    }

    // Check key naming conventions
    if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(key)) {
      errors.push(
        'Translation key should start with a letter and contain only letters, numbers, dots, underscores, and hyphens',
      );
    }

    // Check for common anti-patterns
    if (key.includes('..')) {
      errors.push('Translation key should not contain consecutive dots');
    }

    if (key.startsWith('.') || key.endsWith('.')) {
      errors.push('Translation key should not start or end with a dot');
    }

    // Suggestions for better naming
    if (key.length > 100) {
      suggestions.push(
        'Consider shortening the translation key for better readability',
      );
    }

    if (key.split('.').length > 5) {
      suggestions.push(
        'Consider reducing the nesting depth of the translation key',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate a single translation value
   */
  validateTranslationValue(
    value: string,
    options: Partial<TranslationValidationOptions> = {},
  ): ValidationResult {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check if value exists
    if (mergedOptions.checkEmptyValues) {
      if (!value || typeof value !== 'string') {
        errors.push('Translation value must be a non-empty string');
        return { isValid: false, errors, warnings, suggestions };
      }

      if (value.trim().length === 0) {
        errors.push(
          'Translation value cannot be empty or contain only whitespace',
        );
      }
    }

    // Check length constraints
    if (mergedOptions.checkLength) {
      if (mergedOptions.minLength && value.length < mergedOptions.minLength) {
        errors.push(
          `Translation value is too short (minimum: ${mergedOptions.minLength} characters)`,
        );
      }

      if (mergedOptions.maxLength && value.length > mergedOptions.maxLength) {
        errors.push(
          `Translation value is too long (maximum: ${mergedOptions.maxLength} characters)`,
        );
      }
    }

    // Check for HTML content
    if (!mergedOptions.allowHtml && /<[^>]*>/.test(value)) {
      warnings.push('Translation value contains HTML tags');
    }

    // Check for special characters
    if (!mergedOptions.allowSpecialCharacters) {
      const specialCharsRegex = /[<>{}[\]|\\`~!@#$%^&*()_+=;:'",./?]/;
      if (specialCharsRegex.test(value)) {
        warnings.push('Translation value contains special characters');
      }
    }

    // Check for potential issues
    if (value.includes('{{') && !value.includes('}}')) {
      errors.push('Translation value contains unclosed placeholder');
    }

    if (value.includes('}}') && !value.includes('{{')) {
      errors.push('Translation value contains unopened placeholder');
    }

    // Check for suspicious content
    if (
      value.toLowerCase().includes('todo') ||
      value.toLowerCase().includes('fixme')
    ) {
      warnings.push('Translation value appears to contain placeholder text');
    }

    if (/\b(lorem ipsum|test|dummy|placeholder)\b/i.test(value)) {
      warnings.push('Translation value appears to contain dummy text');
    }

    // Suggestions
    if (value.includes('  ')) {
      suggestions.push('Consider removing extra spaces in translation value');
    }

    if (value !== value.trim()) {
      suggestions.push('Consider trimming whitespace from translation value');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate placeholder consistency across languages
   */
  validatePlaceholderConsistency(
    translations: Record<SupportedLanguage, string>,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const placeholdersByLanguage: Record<SupportedLanguage, string[]> =
      {} as any;

    // Extract placeholders for each language
    Object.entries(translations).forEach(([lang, value]) => {
      const placeholders = this.extractPlaceholders(value);
      placeholdersByLanguage[lang as SupportedLanguage] = placeholders;
    });

    // Compare placeholders across languages
    const languages = Object.keys(
      placeholdersByLanguage,
    ) as SupportedLanguage[];
    if (languages.length > 1) {
      const referenceLang = languages[0];
      const referencePlaceholders = placeholdersByLanguage[referenceLang];

      languages.slice(1).forEach((lang) => {
        const currentPlaceholders = placeholdersByLanguage[lang];

        // Check for missing placeholders
        referencePlaceholders.forEach((placeholder) => {
          if (!currentPlaceholders.includes(placeholder)) {
            errors.push(
              `Language ${lang} is missing placeholder: ${placeholder}`,
            );
          }
        });

        // Check for extra placeholders
        currentPlaceholders.forEach((placeholder) => {
          if (!referencePlaceholders.includes(placeholder)) {
            warnings.push(
              `Language ${lang} has extra placeholder: ${placeholder}`,
            );
          }
        });

        // Check placeholder order
        if (
          referencePlaceholders.length === currentPlaceholders.length &&
          referencePlaceholders.every((p) => currentPlaceholders.includes(p))
        ) {
          const referenceOrder = referencePlaceholders.join(',');
          const currentOrder = currentPlaceholders.join(',');
          if (referenceOrder !== currentOrder) {
            suggestions.push(
              `Language ${lang} has different placeholder order than ${referenceLang}`,
            );
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate a complete translation entry (key + values for all languages)
   */
  validateTranslationEntry(
    key: string,
    translations: Partial<Record<SupportedLanguage, string>>,
    options: Partial<TranslationValidationOptions> = {},
  ): KeyValidationResult[] {
    const results: KeyValidationResult[] = [];

    // Validate the key itself
    const keyValidation = this.validateTranslationKey(key);

    // Validate each translation value
    Object.entries(translations).forEach(([lang, value]) => {
      const language = lang as SupportedLanguage;

      if (!SUPPORTED_LANGUAGES.includes(language)) {
        results.push({
          key,
          language: language,
          value: value || '',
          isValid: false,
          errors: [`Unsupported language: ${lang}`],
          warnings: [],
          suggestions: [],
        });
        return;
      }

      const valueValidation = this.validateTranslationValue(
        value || '',
        options,
      );

      results.push({
        key,
        language,
        value: value || '',
        isValid: keyValidation.isValid && valueValidation.isValid,
        errors: [...keyValidation.errors, ...valueValidation.errors],
        warnings: [...keyValidation.warnings, ...valueValidation.warnings],
        suggestions: [
          ...keyValidation.suggestions,
          ...valueValidation.suggestions,
        ],
      });
    });

    // Check placeholder consistency if multiple languages provided
    if (Object.keys(translations).length > 1) {
      const consistencyValidation = this.validatePlaceholderConsistency(
        translations as Record<SupportedLanguage, string>,
      );

      // Add consistency errors to all language results
      if (!consistencyValidation.isValid) {
        results.forEach((result) => {
          result.errors.push(...consistencyValidation.errors);
          result.warnings.push(...consistencyValidation.warnings);
          result.suggestions.push(...consistencyValidation.suggestions);
          result.isValid = result.isValid && consistencyValidation.isValid;
        });
      }
    }

    return results;
  }

  /**
   * Batch validate multiple translation entries
   */
  validateTranslations(
    translations: Record<string, Partial<Record<SupportedLanguage, string>>>,
    options: Partial<TranslationValidationOptions> = {},
  ): {
    overallValid: boolean;
    results: KeyValidationResult[];
    summary: {
      totalKeys: number;
      validKeys: number;
      invalidKeys: number;
      totalErrors: number;
      totalWarnings: number;
    };
  } {
    const allResults: KeyValidationResult[] = [];

    Object.entries(translations).forEach(([key, langTranslations]) => {
      const keyResults = this.validateTranslationEntry(
        key,
        langTranslations,
        options,
      );
      allResults.push(...keyResults);
    });

    const validResults = allResults.filter((r) => r.isValid);
    const invalidResults = allResults.filter((r) => !r.isValid);
    const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = allResults.reduce(
      (sum, r) => sum + r.warnings.length,
      0,
    );

    return {
      overallValid: invalidResults.length === 0,
      results: allResults,
      summary: {
        totalKeys: Object.keys(translations).length,
        validKeys: validResults.length,
        invalidKeys: invalidResults.length,
        totalErrors,
        totalWarnings,
      },
    };
  }

  /**
   * Extract placeholders from translation value
   */
  private extractPlaceholders(value: string): string[] {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders: string[] = [];
    let match;

    while ((match = placeholderRegex.exec(value)) !== null) {
      placeholders.push(match[1].trim());
    }

    return placeholders.sort();
  }

  /**
   * Check if a translation key follows naming conventions
   */
  isValidKeyFormat(key: string): boolean {
    return (
      /^[a-zA-Z][a-zA-Z0-9._-]*$/.test(key) &&
      key.includes('.') &&
      !key.includes('..') &&
      !key.startsWith('.') &&
      !key.endsWith('.')
    );
  }

  /**
   * Suggest improvements for a translation key
   */
  suggestKeyImprovements(key: string): string[] {
    const suggestions: string[] = [];

    if (!key.includes('.')) {
      suggestions.push(
        'Use dot notation to organize keys (e.g., "module.component.label")',
      );
    }

    if (key.includes('_')) {
      suggestions.push('Consider using camelCase instead of underscores');
    }

    if (key.toUpperCase() === key) {
      suggestions.push('Consider using camelCase instead of all uppercase');
    }

    if (key.length > 100) {
      suggestions.push('Consider shortening the key for better readability');
    }

    return suggestions;
  }

  /**
   * Get validation statistics
   */
  getValidationStats(results: KeyValidationResult[]): {
    errorRate: number;
    warningRate: number;
    mostCommonErrors: Array<{ error: string; count: number }>;
    mostCommonWarnings: Array<{ warning: string; count: number }>;
  } {
    const totalResults = results.length;
    const resultsWithErrors = results.filter((r) => r.errors.length > 0).length;
    const resultsWithWarnings = results.filter(
      (r) => r.warnings.length > 0,
    ).length;

    // Count error frequency
    const errorCounts: Record<string, number> = {};
    const warningCounts: Record<string, number> = {};

    results.forEach((result) => {
      result.errors.forEach((error) => {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });
      result.warnings.forEach((warning) => {
        warningCounts[warning] = (warningCounts[warning] || 0) + 1;
      });
    });

    const mostCommonErrors = Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const mostCommonWarnings = Object.entries(warningCounts)
      .map(([warning, count]) => ({ warning, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      errorRate:
        totalResults > 0 ? (resultsWithErrors / totalResults) * 100 : 0,
      warningRate:
        totalResults > 0 ? (resultsWithWarnings / totalResults) * 100 : 0,
      mostCommonErrors,
      mostCommonWarnings,
    };
  }
}
