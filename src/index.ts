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
import axios from 'axios';
import { ProgressSpinner, showHeader, showSuccess, showError, formatTiming } from './ui.js';
import { CouncilResponse } from './server/types.js';

interface CliOptions {
  testProviders?: boolean;
  testProvider?: string;
  server?: string;
}

const program = new Command();

program
  .name('second-brain')
  .description('Multi-model AI Council consultation CLI')
  .version('1.0.0');

/**
 * Ask command - consult the Council
 */
program
  .command('ask <question>')
  .description('Consult the Council of 4 AI models for perspectives and critiques')
  .option('-s, --server <url>', 'Council server URL', 'http://127.0.0.1:3000')
  .action(async (question: string, options: { server: string }) => {
    await handleAskCommand(question, options.server);
  });

/**
 * Server command - start the Council daemon
 */
program
  .command('server')
  .description('Start the Council daemon server')
  .action(async () => {
    console.log(chalk.cyan('\n🚀 Starting Council daemon server...\n'));
    const { spawn } = await import('child_process');
    const serverProcess = spawn('node', ['dist/server/index.js'], {
      stdio: 'inherit',
    });

    serverProcess.on('error', (error) => {
      console.error(chalk.red(`Failed to start server: ${error.message}`));
      process.exit(1);
    });
  });

/**
 * Test commands
 */
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
 * Handles the 'ask' command - consults the Council via HTTP
 */
async function handleAskCommand(question: string, serverUrl: string): Promise<void> {
  const startTime = Date.now();

  // Validate input
  if (!question || question.trim().length === 0) {
    showError('Please provide a question to consult the Council about.');
    console.log(chalk.gray('Example: second-brain ask "What is TypeScript?"\n'));
    process.exit(1);
  }

  showHeader('Council Consultation');
  console.log(chalk.gray(`Question: ${question}\n`));

  try {
    // Check server health
    const healthSpinner = new ProgressSpinner('Connecting to Council server...');
    try {
      const healthResponse = await axios.get(`${serverUrl}/health`, { timeout: 5000 });
      const health = healthResponse.data;

      if (!health.council.initialized) {
        healthSpinner.fail(chalk.red('Council server not initialized'));
        showError('The Council server is not ready. Please wait and try again.');
        process.exit(1);
      }

      healthSpinner.succeed(
        chalk.green(`Connected to Council (${health.council.models_available} models available)`)
      );

      // Show available models
      console.log(chalk.gray('\nCouncil members:'));
      health.council.model_names.forEach((name: string) => {
        console.log(chalk.gray(`  • ${name}`));
      });
      console.log();
    } catch (error) {
      healthSpinner.fail(chalk.red('Cannot connect to Council server'));
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        showError('Council server is not running.');
        console.log(chalk.yellow('Start the server with: second-brain server'));
        console.log(chalk.gray('Or run: node dist/server/index.js\n'));
      } else {
        showError(`Server error: ${error instanceof Error ? error.message : String(error)}`);
      }
      process.exit(1);
    }

    // Consult the Council
    const consultSpinner = new ProgressSpinner('Consulting the Council...');

    const response = await axios.post(
      `${serverUrl}/mcp`,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'council_consult',
          arguments: {
            prompt: question,
          },
        },
      },
      {
        timeout: 120000, // 2 minute timeout for Council deliberation
      }
    );

    const result = response.data.result;

    // Extract structured content if available
    let councilResponse: CouncilResponse;
    if (result.structuredContent) {
      councilResponse = result.structuredContent;
    } else {
      // Parse from text response (fallback)
      consultSpinner.fail(chalk.red('Unexpected response format'));
      showError('Could not parse Council response. Please try again.');
      process.exit(1);
    }

    consultSpinner.succeed(
      chalk.green(
        `Council responded (${councilResponse.summary.models_responded}/${councilResponse.summary.models_consulted} models)`
      )
    );

    // Display results
    console.log(
      chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    );

    for (const critique of councilResponse.critiques) {
      if (critique.error) {
        console.log(chalk.red.bold(`${critique.model} ✗`));
        console.log(chalk.red(`Error: ${critique.error}\n`));
      } else {
        console.log(chalk.green.bold(`${critique.model} ✓`));
        console.log(`${critique.response}\n`);
      }
    }

    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    const totalTime = Date.now() - startTime;
    console.log(
      chalk.gray(
        `\n${councilResponse.summary.models_responded} models responded in ${formatTiming(councilResponse.summary.total_latency_ms)}`
      )
    );
    console.log(chalk.gray(`Total time: ${formatTiming(totalTime)}`));

    showSuccess('Council consultation complete!');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        showError('Request timed out. The Council is taking too long to respond.');
      } else if (error.response) {
        showError(`Server error: ${error.response.status} ${error.response.statusText}`);
      } else {
        showError(`Network error: ${error.message}`);
      }
    } else {
      showError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  }
}

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
