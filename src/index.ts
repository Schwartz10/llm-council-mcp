#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, Config, getMissingApiKeys } from './config.js';
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
  .option(
    '--test-provider <provider>',
    'Test connectivity to a specific provider (e.g., anthropic/claude-sonnet-4-5)'
  )
  .action(async (options: CliOptions) => {
    if (options.testProvider) {
      await testSingleProvider(options.testProvider);
    } else if (options.testProviders) {
      await testProviders();
    } else {
      program.help();
    }
  });

// Provider test definitions
type ProviderTestFn = (config: Config) => Promise<boolean>;

interface ProviderTest {
  key: string;
  displayName: string;
  configKey: keyof Config;
  testFn: ProviderTestFn;
}

const PROVIDER_TESTS: ProviderTest[] = [
  {
    key: 'anthropic/claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    configKey: 'anthropicApiKey',
    testFn: async (config) => {
      const anthropic = createAnthropic({ apiKey: config.anthropicApiKey });
      const result = await generateText({
        model: anthropic('claude-sonnet-4-5-20250929'),
        prompt: 'Say "Hello from Claude" and nothing else.',
      });
      return result.text.includes('Claude') || result.text.includes('Hello');
    },
  },
  {
    key: 'openai/gpt-5-2',
    displayName: 'GPT-5.2',
    configKey: 'openaiApiKey',
    testFn: async (config) => {
      const openai = createOpenAI({ apiKey: config.openaiApiKey });
      const result = await generateText({
        model: openai('gpt-5.2'),
        prompt: 'Say "Hello from GPT" and nothing else.',
      });
      return result.text.includes('GPT') || result.text.includes('Hello');
    },
  },
  {
    key: 'xai/grok-beta',
    displayName: 'Grok',
    configKey: 'xaiApiKey',
    testFn: async (config) => {
      const xai = createXai({ apiKey: config.xaiApiKey });
      const result = await generateText({
        model: xai('grok-3-beta'),
        prompt: 'Say "Hello from Grok" and nothing else.',
      });
      return result.text.includes('Grok') || result.text.includes('Hello');
    },
  },
  {
    key: 'groq/llama-4-maverick',
    displayName: 'Llama 4 Maverick (via Groq)',
    configKey: 'groqApiKey',
    testFn: async (config) => {
      const groq = createGroq({ apiKey: config.groqApiKey });
      const result = await generateText({
        model: groq('meta-llama/llama-4-maverick-17b-128e-instruct'),
        prompt: 'Say "Hello from Llama" and nothing else.',
      });
      return result.text.includes('Llama') || result.text.includes('Hello');
    },
  },
];

async function testSingleProvider(providerKey: string) {
  console.log(chalk.bold(`\n🧠 Testing Provider: ${providerKey}\n`));

  const config = loadConfig();
  const providerTest = PROVIDER_TESTS.find((p) => p.key === providerKey);

  if (!providerTest) {
    console.error(chalk.red(`\n❌ Unknown provider: ${providerKey}\n`));
    console.log(chalk.bold('Available providers:'));
    PROVIDER_TESTS.forEach((p) => {
      console.log(chalk.gray(`  - ${p.key} (${p.displayName})`));
    });
    console.log();
    process.exit(1);
  }

  // Check if API key is configured
  const apiKey = config[providerTest.configKey];
  if (!apiKey) {
    console.error(chalk.red(`\n❌ Missing API key for ${providerTest.displayName}\n`));
    console.log(
      chalk.yellow(
        `Please add the required API key to your .env file and try again.\n` +
          `See .env.example for reference.\n`
      )
    );
    process.exit(1);
  }

  const spinner = ora(`Testing ${providerTest.displayName}...`).start();

  try {
    const success = await providerTest.testFn(config);
    if (success) {
      spinner.succeed(chalk.green(`${providerTest.displayName} connected successfully`));
      console.log(chalk.green('\n✨ Provider is ready!\n'));
    } else {
      spinner.fail(chalk.red(`${providerTest.displayName} failed (unexpected response)`));
      console.log(chalk.red('\n❌ Provider test failed\n'));
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    spinner.fail(chalk.red(`${providerTest.displayName} failed`));
    console.log(chalk.red(`\nError: ${errorMessage}\n`));
    process.exit(1);
  }
}

async function testProviders() {
  console.log(chalk.bold('\n🧠 Testing Second Brain Provider Connectivity\n'));

  const config = loadConfig();
  const missingKeys = getMissingApiKeys();

  // Show warnings for missing API keys
  if (missingKeys.length > 0) {
    console.log(chalk.yellow('⚠️  Missing API keys for the following providers:'));
    missingKeys.forEach((key) => {
      console.log(chalk.yellow(`   - ${key}`));
    });
    console.log(chalk.gray('\nThese providers will be skipped.\n'));
  }

  const results: Array<{ name: string; success: boolean; error?: string; skipped?: boolean }> = [];

  // Test providers that have API keys
  for (const providerTest of PROVIDER_TESTS) {
    const apiKey = config[providerTest.configKey];

    if (!apiKey) {
      // Skip this provider
      results.push({
        name: providerTest.displayName,
        success: false,
        skipped: true,
        error: 'API key not configured',
      });
    } else {
      // Test this provider
      await testProvider(providerTest.displayName, () => providerTest.testFn(config), results);
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
      const status = result.success ? chalk.green('Connected') : chalk.red('Failed');
      console.log(`${icon} ${result.name}: ${status}`);
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

async function testProvider(
  name: string,
  testFn: () => Promise<boolean>,
  results: Array<{ name: string; success: boolean; error?: string }>
) {
  const spinner = ora(`Testing ${name}...`).start();

  try {
    const success = await testFn();
    if (success) {
      spinner.succeed(chalk.green(`${name} connected`));
      results.push({ name, success: true });
    } else {
      spinner.fail(chalk.red(`${name} failed (unexpected response)`));
      results.push({ name, success: false, error: 'Unexpected response from provider' });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    spinner.fail(chalk.red(`${name} failed`));
    results.push({ name, success: false, error: errorMessage });
  }
}

program.parse();
