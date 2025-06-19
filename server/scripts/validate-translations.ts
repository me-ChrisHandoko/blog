#!/usr/bin/env node
/**
 * Translation Files Validation Script
 *
 * This script validates that all translation files are consistent across languages
 * and that all required keys exist.
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalFiles: number;
    totalKeys: Record<string, number>;
    missingKeys: Record<string, string[]>;
    extraKeys: Record<string, string[]>;
    commonKeys: string[];
    filesStatus: Record<string, Record<string, boolean>>;
  };
}

class TranslationFilesValidator {
  private readonly translationsPath: string;
  private readonly supportedLanguages = ['id', 'en', 'zh'];
  private readonly requiredFiles = [
    'auth.json',
    'users.json',
    'validation.json',
    'common.json',
  ];

  constructor() {
    this.translationsPath = path.join(
      process.cwd(),
      'src',
      'i18n',
      'translations',
    );
  }

  validate(): ValidationResult {
    console.log('🔍 Validating translation files...\n');

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      stats: {
        totalFiles: 0,
        totalKeys: {},
        missingKeys: {},
        extraKeys: {},
        commonKeys: [],
        filesStatus: {},
      },
    };

    // Check if translations directory exists
    if (!fs.existsSync(this.translationsPath)) {
      result.errors.push(
        'Translations directory not found: ' + this.translationsPath,
      );
      result.isValid = false;
      return result;
    }

    // Validate directory structure
    this.validateDirectoryStructure(result);

    // Load and validate all translation files
    const allTranslations = this.loadAllTranslations(result);

    // Find common keys across all languages
    this.findCommonKeys(allTranslations, result);

    // Check for missing and extra keys
    this.validateKeyConsistency(allTranslations, result);

    // Validate translation quality
    this.validateTranslationQuality(allTranslations, result);

    // Print results
    this.printResults(result);

    return result;
  }

  private validateDirectoryStructure(result: ValidationResult): void {
    console.log('📁 Validating directory structure...');

    for (const lang of this.supportedLanguages) {
      const langPath = path.join(this.translationsPath, lang);
      result.stats.filesStatus[lang] = {};

      if (!fs.existsSync(langPath)) {
        result.errors.push(`Language directory missing: ${lang}`);
        result.isValid = false;
        continue;
      }

      console.log(`  ✓ ${lang} directory exists`);

      // Check required files
      for (const file of this.requiredFiles) {
        const filePath = path.join(langPath, file);
        const exists = fs.existsSync(filePath);
        result.stats.filesStatus[lang][file] = exists;

        if (!exists) {
          result.errors.push(`Missing required file: ${lang}/${file}`);
          result.isValid = false;
        } else {
          console.log(`    ✓ ${file} exists`);
          result.stats.totalFiles++;
        }
      }
    }
  }

  private loadAllTranslations(
    result: ValidationResult,
  ): Record<string, Record<string, any>> {
    console.log('\n📄 Loading translation files...');

    const allTranslations: Record<string, Record<string, any>> = {};

    for (const lang of this.supportedLanguages) {
      allTranslations[lang] = {};
      const langPath = path.join(this.translationsPath, lang);

      if (!fs.existsSync(langPath)) continue;

      for (const file of this.requiredFiles) {
        const filePath = path.join(langPath, file);

        if (!fs.existsSync(filePath)) continue;

        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(content);
          const fileKey = path.basename(file, '.json');

          allTranslations[lang][fileKey] = parsed;
          console.log(`  ✓ Loaded ${lang}/${file}`);
        } catch (error) {
          result.errors.push(
            `Failed to parse ${lang}/${file}: ${error.message}`,
          );
          result.isValid = false;
        }
      }

      // Count total keys for this language
      result.stats.totalKeys[lang] = this.countTotalKeys(allTranslations[lang]);
    }

    return allTranslations;
  }

  private countTotalKeys(
    translations: Record<string, any>,
    prefix: string = '',
  ): number {
    let count = 0;

    for (const [key, value] of Object.entries(translations)) {
      if (typeof value === 'string') {
        count++;
      } else if (typeof value === 'object' && value !== null) {
        count += this.countTotalKeys(value, prefix ? `${prefix}.${key}` : key);
      }
    }

    return count;
  }

  private getAllKeys(
    translations: Record<string, any>,
    prefix: string = '',
  ): string[] {
    const keys: string[] = [];

    for (const [key, value] of Object.entries(translations)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        keys.push(fullKey);
      } else if (typeof value === 'object' && value !== null) {
        keys.push(...this.getAllKeys(value, fullKey));
      }
    }

    return keys.sort();
  }

  private findCommonKeys(
    allTranslations: Record<string, Record<string, any>>,
    result: ValidationResult,
  ): void {
    console.log('\n🔍 Finding common keys...');

    const allLanguageKeys: Record<string, string[]> = {};

    // Get all keys for each language
    for (const lang of this.supportedLanguages) {
      if (allTranslations[lang]) {
        allLanguageKeys[lang] = this.getAllKeys(allTranslations[lang]);
      }
    }

    // Find common keys (keys that exist in all languages)
    if (Object.keys(allLanguageKeys).length > 0) {
      const [firstLang, ...otherLangs] = Object.keys(allLanguageKeys);
      let commonKeys = allLanguageKeys[firstLang] || [];

      for (const lang of otherLangs) {
        commonKeys = commonKeys.filter((key) =>
          allLanguageKeys[lang]?.includes(key),
        );
      }

      result.stats.commonKeys = commonKeys;
      console.log(
        `  ✓ Found ${commonKeys.length} common keys across all languages`,
      );
    }
  }

  private validateKeyConsistency(
    allTranslations: Record<string, Record<string, any>>,
    result: ValidationResult,
  ): void {
    console.log('\n🔧 Validating key consistency...');

    const allLanguageKeys: Record<string, string[]> = {};

    // Get all keys for each language
    for (const lang of this.supportedLanguages) {
      if (allTranslations[lang]) {
        allLanguageKeys[lang] = this.getAllKeys(allTranslations[lang]);
      }
    }

    // Find missing and extra keys for each language
    const allUniqueKeys = new Set<string>();
    Object.values(allLanguageKeys).forEach((keys) => {
      keys.forEach((key) => allUniqueKeys.add(key));
    });

    const completeKeySet = Array.from(allUniqueKeys).sort();

    for (const lang of this.supportedLanguages) {
      const langKeys = allLanguageKeys[lang] || [];

      // Missing keys
      const missingKeys = completeKeySet.filter(
        (key) => !langKeys.includes(key),
      );
      result.stats.missingKeys[lang] = missingKeys;

      // Extra keys (shouldn't happen if we're comparing against all keys, but useful for future)
      const extraKeys = langKeys.filter(
        (key) => !result.stats.commonKeys.includes(key),
      );
      result.stats.extraKeys[lang] = extraKeys;

      if (missingKeys.length > 0) {
        result.warnings.push(
          `${lang} is missing ${missingKeys.length} keys: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`,
        );
        console.log(`  ⚠️  ${lang}: ${missingKeys.length} missing keys`);
      } else {
        console.log(`  ✓ ${lang}: All keys present`);
      }
    }
  }

  private validateTranslationQuality(
    allTranslations: Record<string, Record<string, any>>,
    result: ValidationResult,
  ): void {
    console.log('\n🎯 Validating translation quality...');

    for (const lang of this.supportedLanguages) {
      if (!allTranslations[lang]) continue;

      const issues = this.findTranslationIssues(allTranslations[lang], lang);

      if (issues.length > 0) {
        issues.forEach((issue) => result.warnings.push(`${lang}: ${issue}`));
        console.log(`  ⚠️  ${lang}: ${issues.length} quality issues found`);
      } else {
        console.log(`  ✓ ${lang}: No quality issues found`);
      }
    }
  }

  private findTranslationIssues(
    translations: Record<string, any>,
    lang: string,
    prefix: string = '',
  ): string[] {
    const issues: string[] = [];

    for (const [key, value] of Object.entries(translations)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        // Check for empty translations
        if (value.trim() === '') {
          issues.push(`Empty translation for key: ${fullKey}`);
        }

        // Check for untranslated placeholders (English words in non-English translations)
        if (lang !== 'en') {
          const englishWords = [
            'email',
            'password',
            'user',
            'admin',
            'error',
            'success',
          ];
          const hasEnglishWords = englishWords.some(
            (word) =>
              value.toLowerCase().includes(word.toLowerCase()) &&
              !value.includes('{'), // Not a placeholder
          );

          if (hasEnglishWords && lang === 'id') {
            // Only warn for obvious cases
            if (
              value.toLowerCase().includes('email') &&
              !fullKey.includes('email')
            ) {
              issues.push(`Possible untranslated English word in: ${fullKey}`);
            }
          }
        }

        // Check for placeholder consistency
        const placeholders = value.match(/{[^}]+}/g) || [];
        if (placeholders.length > 0) {
          // This would need comparison with other languages to be fully effective
          // For now, just check if placeholders are well-formed
          placeholders.forEach((placeholder) => {
            if (!placeholder.match(/^{[a-zA-Z][a-zA-Z0-9]*}$/)) {
              issues.push(
                `Malformed placeholder ${placeholder} in: ${fullKey}`,
              );
            }
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        issues.push(...this.findTranslationIssues(value, lang, fullKey));
      }
    }

    return issues;
  }

  private printResults(result: ValidationResult): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 VALIDATION RESULTS');
    console.log('='.repeat(50));

    // Overall status
    if (result.isValid) {
      console.log('✅ Overall Status: VALID');
    } else {
      console.log('❌ Overall Status: INVALID');
    }

    // Statistics
    console.log('\n📈 Statistics:');
    console.log(`   Total Files: ${result.stats.totalFiles}`);
    console.log(`   Languages: ${this.supportedLanguages.join(', ')}`);
    console.log(`   Common Keys: ${result.stats.commonKeys.length}`);

    // Keys per language
    console.log('\n🔢 Keys per Language:');
    for (const [lang, count] of Object.entries(result.stats.totalKeys)) {
      console.log(`   ${lang}: ${count} keys`);
    }

    // Missing keys summary
    console.log('\n⚠️  Missing Keys Summary:');
    let totalMissing = 0;
    for (const [lang, missing] of Object.entries(result.stats.missingKeys)) {
      totalMissing += missing.length;
      if (missing.length > 0) {
        console.log(`   ${lang}: ${missing.length} missing`);
      }
    }
    if (totalMissing === 0) {
      console.log('   None - All keys are consistent! ✅');
    }

    // Errors
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // Warnings
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (result.errors.length > 0) {
      console.log('   1. Fix all errors before deploying to production');
    }
    if (totalMissing > 0) {
      console.log('   2. Add missing translation keys to maintain consistency');
    }
    if (result.warnings.length > 0) {
      console.log('   3. Review warnings to improve translation quality');
    }
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('   🎉 Your translations are in excellent shape!');
    }

    console.log('\n' + '='.repeat(50));
  }

  // Method to fix common issues automatically
  fixCommonIssues(): void {
    console.log('🔧 Attempting to fix common issues...\n');

    // This could include:
    // - Creating missing files with empty structure
    // - Adding missing keys with placeholder values
    // - Formatting JSON files consistently

    for (const lang of this.supportedLanguages) {
      const langPath = path.join(this.translationsPath, lang);

      // Create language directory if it doesn't exist
      if (!fs.existsSync(langPath)) {
        fs.mkdirSync(langPath, { recursive: true });
        console.log(`✅ Created directory: ${lang}`);
      }

      // Create missing files with basic structure
      for (const file of this.requiredFiles) {
        const filePath = path.join(langPath, file);

        if (!fs.existsSync(filePath)) {
          const basicStructure = this.getBasicFileStructure(file);
          fs.writeFileSync(filePath, JSON.stringify(basicStructure, null, 2));
          console.log(`✅ Created file: ${lang}/${file}`);
        }
      }
    }

    console.log('\n🎉 Common issues fixed! Please run validation again.');
  }

  private getBasicFileStructure(filename: string): any {
    const fileKey = path.basename(filename, '.json');

    const structures = {
      auth: {
        messages: {},
      },
      users: {
        messages: {},
        roles: {},
        fields: {},
      },
      validation: {
        generic: {},
        email: {},
        password: {},
        name: {},
        phone: {},
        language: {},
      },
      common: {
        messages: {},
        pagination: {},
        actions: {},
        status: {},
      },
    };

    return structures[fileKey] || {};
  }
}

// CLI Interface
if (require.main === module) {
  const validator = new TranslationFilesValidator();

  const args = process.argv.slice(2);

  if (args.includes('--fix')) {
    validator.fixCommonIssues();
  } else {
    const result = validator.validate();
    process.exit(result.isValid ? 0 : 1);
  }
}

export { TranslationFilesValidator };
