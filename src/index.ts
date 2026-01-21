#!/usr/bin/env node

import { Command } from 'commander';
import { getMissingApiKeys, COUNCIL_MODELS, ModelConfig } from './config.js';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import chalk from 'chalk';
import ora from 'ora';

interface CliOptions {
  testProviders?: boolean;
  testProvider?: string;
}

const program = new Command();

program.name('second-brain').description('Multi-model AI deliberation CLI tool').version('1.0.0');

program
  .option('--test-providers', 'Test connectivity to all AI providers')
  .option('--test-provider <provider>', 'Test connectivity to a specific provider (e.g., "GPT")')
  .action(async (options: CliOptions) => {
    if (options.testProvider) {
      await testSingleProvider(options.testProvider);
    } else if (options.testProviders) {
      await testProviders();
    } else {
      program.help();
    }
  });

/**
 * Creates a provider client based on provider type
 */
function createProviderClient(provider: string, apiKey: string) {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey });
    case 'openai':
      return createOpenAI({ apiKey });
    case 'xai':
      return createXai({ apiKey });
    case 'groq':
      return createGroq({ apiKey });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Tests a single model and returns success status
 */
async function testModel(modelConfig: ModelConfig, modelId: string): Promise<boolean> {
  if (!modelConfig.apiKey) {
    throw new Error('API key not configured');
  }

  const client = createProviderClient(modelConfig.provider, modelConfig.apiKey);
  const result = await generateText({
    model: client(modelId),
    prompt: `Say "Hello from ${modelConfig.name}" and nothing else.`,
  });

  return result.text.includes('Hello') || result.text.toLowerCase().includes('hello');
}

interface TestResult {
  name: string;
  success: boolean;
  modelUsed?: string;
  error?: string;
  skipped?: boolean;
}

async function testSingleProvider(providerName: string) {
  console.log(chalk.bold(`\n🧠 Testing Provider: ${providerName}\n`));

  const modelConfig = COUNCIL_MODELS.find(
    (m) => m.name.toLowerCase() === providerName.toLowerCase()
  );

  if (!modelConfig) {
    console.error(chalk.red(`\n❌ Unknown provider: ${providerName}\n`));
    console.log(chalk.bold('Available providers:'));
    COUNCIL_MODELS.forEach((m) => {
      console.log(chalk.gray(`  - ${m.name}`));
    });
    console.log();
    process.exit(1);
  }

  // Check if API key is configured
  if (!modelConfig.apiKey) {
    console.error(chalk.red(`\n❌ Missing API key for ${modelConfig.name}\n`));
    console.log(
      chalk.yellow(
        `Please add the required API key to your .env file and try again.\n` +
          `See .env.example for reference.\n`
      )
    );
    process.exit(1);
  }

  const spinner = ora(`Testing ${modelConfig.name}...`).start();

  // Try each model in order (primary first, then fallbacks)
  let lastError: Error | null = null;
  for (const modelId of modelConfig.models) {
    try {
      const success = await testModel(modelConfig, modelId);
      if (success) {
        const modelInfo =
          modelConfig.models.length > 1 && modelId !== modelConfig.models[0]
            ? ` (using ${modelId})`
            : '';
        spinner.succeed(chalk.green(`${modelConfig.name} connected${modelInfo}`));
        console.log(chalk.green('\n✨ Provider is ready!\n'));
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      // Continue to next model
    }
  }

  // All models failed
  const errorMessage = lastError?.message || 'All models failed';
  spinner.fail(chalk.red(`${modelConfig.name} failed`));
  console.log(chalk.red(`\nError: ${errorMessage}\n`));
  process.exit(1);
}

async function testProviders() {
  console.log(chalk.bold('\n🧠 Testing Second Brain Provider Connectivity\n'));

  const missingKeys = getMissingApiKeys();

  // Show warnings for missing API keys
  if (missingKeys.length > 0) {
    console.log(chalk.yellow('⚠️  Missing API keys for the following providers:'));
    missingKeys.forEach((key) => {
      console.log(chalk.yellow(`   - ${key}`));
    });
    console.log(chalk.gray('\nThese providers will be skipped.\n'));
  }

  const results: TestResult[] = [];

  // Test each model config
  for (const modelConfig of COUNCIL_MODELS) {
    if (!modelConfig.apiKey) {
      // Skip this provider
      results.push({
        name: modelConfig.name,
        success: false,
        skipped: true,
        error: 'API key not configured',
      });
      continue;
    }

    // Try models in order (primary first, then fallbacks)
    const spinner = ora(`Testing ${modelConfig.name}...`).start();
    let succeeded = false;
    let lastError: string | null = null;

    for (const modelId of modelConfig.models) {
      try {
        const success = await testModel(modelConfig, modelId);
        if (success) {
          const modelInfo =
            modelConfig.models.length > 1 && modelId !== modelConfig.models[0]
              ? ` (using ${modelId})`
              : '';
          spinner.succeed(chalk.green(`${modelConfig.name} connected${modelInfo}`));
          results.push({
            name: modelConfig.name,
            success: true,
            modelUsed: modelId,
          });
          succeeded = true;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        // Continue to next model
      }
    }

    if (!succeeded) {
      spinner.fail(chalk.red(`${modelConfig.name} failed`));
      results.push({
        name: modelConfig.name,
        success: false,
        error: lastError || 'All models failed',
      });
    }
  }

  // Print summary
  console.log(chalk.bold('\n📊 Test Results:\n'));
  const successCount = results.filter((r) => r.success).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const failedCount = results.filter((r) => !r.success && !r.skipped).length;
  const totalCount = results.length;

  results.forEach((result) => {
    if (result.skipped) {
      const icon = chalk.yellow('⊘');
      const status = chalk.yellow('Skipped');
      console.log(`${icon} ${result.name}: ${status}`);
    } else {
      const icon = result.success ? chalk.green('✓') : chalk.red('✗');
      const modelInfo = result.modelUsed ? chalk.gray(` (${result.modelUsed})`) : '';
      const status = result.success ? chalk.green('Connected') : chalk.red('Failed');
      console.log(`${icon} ${result.name}: ${status}${modelInfo}`);
      if (!result.success && result.error) {
        console.log(chalk.gray(`  Error: ${result.error}`));
      }
    }
  });

  console.log(`\n${chalk.bold('Summary:')}`);
  console.log(`  ${chalk.green('✓')} ${successCount} connected`);
  if (failedCount > 0) {
    console.log(`  ${chalk.red('✗')} ${failedCount} failed`);
  }
  if (skippedCount > 0) {
    console.log(`  ${chalk.yellow('⊘')} ${skippedCount} skipped (no API key)`);
  }
  console.log();

  if (successCount === 0) {
    console.log(chalk.red('❌ No providers are available. Please add API keys to .env\n'));
    process.exit(1);
  } else if (failedCount > 0) {
    console.log(chalk.yellow('⚠️  Some providers failed. Check your API keys in .env\n'));
    process.exit(1);
  } else if (skippedCount > 0) {
    console.log(
      chalk.green(
        `✨ ${successCount}/${totalCount - skippedCount} configured providers are ready!\n`
      )
    );
  } else {
    console.log(chalk.green('✨ All providers are ready!\n'));
  }
}

program.parse();
