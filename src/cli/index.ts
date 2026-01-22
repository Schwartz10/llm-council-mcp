/**
 * Second Brain CLI - Main command implementations
 *
 * Orchestrates the full flow:
 * 1. Brain pre-processes user question
 * 2. Council deliberates (4 models in parallel)
 * 3. Consensus synthesizes responses
 * 4. Brain post-processes final answer
 */

import { loadConfig, BRAIN_MODEL_CONFIG } from '../config.js';
import { Brain } from '../brain/index.js';
import { Council } from '../council/index.js';
import { Consensus } from '../consensus/index.js';
import { SimpleSynthesis } from '../consensus/strategies/simple-synthesis.js';
import { createCouncilProviders, createProviderWithFallback } from '../providers/index.js';
import {
  ProgressSpinner,
  formatFinalResponse,
  formatTiming,
  formatError,
  showHeader,
  showSuccess,
  showError,
  showWarning,
} from './ui.js';
import chalk from 'chalk';

/**
 * Handles the 'ask' command - main entry point for Second Brain queries
 */
export async function handleAskCommand(question: string): Promise<void> {
  const startTime = Date.now();

  // Validate input
  if (!question || question.trim().length === 0) {
    showError('Please provide a question to ask Second Brain.');
    console.log(chalk.gray('Example: second-brain ask "What is TypeScript?"\n'));
    process.exit(1);
  }

  showHeader('Second Brain');
  console.log(chalk.gray(`Question: ${question}\n`));

  try {
    const config = loadConfig();

    // Check if we have any API keys configured
    const hasAnyApiKey =
      config.anthropicApiKey || config.openaiApiKey || config.xaiApiKey || config.groqApiKey;

    if (!hasAnyApiKey) {
      showError('No API keys configured.');
      console.log(chalk.gray('Please add at least one API key to your .env file.'));
      console.log(chalk.gray('See .env.example for reference.\n'));
      process.exit(1);
    }

    // Step 1: Initialize Personal Brain
    let brainSpinner = new ProgressSpinner('Initializing Personal Brain...');
    const brainProvider = await createProviderWithFallback(BRAIN_MODEL_CONFIG);

    if (!brainProvider) {
      brainSpinner.fail(chalk.red('Failed to initialize Personal Brain'));
      showError('Could not connect to any Brain models. Check your Anthropic API key.');
      process.exit(1);
    }

    const brain = new Brain({
      provider: brainProvider,
      debug: config.debug,
    });
    brainSpinner.succeed(chalk.green(`Personal Brain ready (${brainProvider.name})`));

    // Step 2: Pre-process the question
    brainSpinner = new ProgressSpinner('Personal Brain is preparing your question...');
    const formattedPrompt = await brain.prepareForCouncil(question);
    brainSpinner.succeed(chalk.green('Question prepared for Council'));

    if (config.debug) {
      console.log(chalk.gray(`\nFormatted prompt: ${formattedPrompt}\n`));
    }

    // Step 3: Initialize Council with all available providers
    const councilSpinner = new ProgressSpinner('Initializing Council of AI models...');
    const councilProviders = createCouncilProviders();

    if (councilProviders.length === 0) {
      councilSpinner.fail(chalk.red('No Council providers available'));
      showError('Could not connect to any Council models. Check your API keys.');
      process.exit(1);
    }

    const council = new Council(councilProviders, { debug: config.debug });
    councilSpinner.succeed(
      chalk.green(`Council assembled (${councilProviders.length} models ready)`)
    );

    // Show which models are in the Council
    console.log(chalk.gray('\nCouncil members:'));
    councilProviders.forEach((provider) => {
      console.log(chalk.gray(`  • ${provider.name}`));
    });
    console.log();

    // Step 4: Council deliberates
    const deliberationSpinner = new ProgressSpinner('Council is deliberating...');

    const deliberationResult = await council.deliberate(
      formattedPrompt,
      ({ providerName, success, completed, total }) => {
        if (success) {
          console.log(`  ${chalk.green('✓')} ${providerName} responded`);
        } else {
          console.log(`  ${chalk.red('✗')} ${providerName} failed`);
        }

        deliberationSpinner.update(`Council deliberating... (${completed}/${total} completed)`);
      }
    );

    if (deliberationResult.successCount === 0) {
      deliberationSpinner.fail(chalk.red('All Council members failed to respond'));
      showError('Council deliberation failed completely. Please try again.');
      process.exit(1);
    }

    deliberationSpinner.succeed(
      chalk.green(
        `Council deliberation complete (${deliberationResult.successCount}/${councilProviders.length} models responded)`
      )
    );

    if (deliberationResult.failureCount > 0) {
      showWarning(
        `${deliberationResult.failureCount} model(s) failed to respond, continuing with remaining responses.`
      );
    }

    // Step 5: Synthesize consensus
    const consensusSpinner = new ProgressSpinner('Synthesizing consensus...');
    const consensus = new Consensus({
      strategy: new SimpleSynthesis(brain),
    });

    const consensusResult = await consensus.synthesize(
      deliberationResult.responses,
      formattedPrompt
    );

    consensusSpinner.succeed(chalk.green('Consensus synthesized'));

    if (config.debug) {
      console.log(chalk.gray(`\nAgreement: ${consensusResult.agreement}`));
      console.log(chalk.gray(`Confidence: ${consensusResult.confidence.toFixed(2)}`));
      if (consensusResult.dissent) {
        console.log(chalk.gray(`Dissent: ${consensusResult.dissent}`));
      }
      console.log();
    }

    // Step 6: Post-process the result
    const postProcessSpinner = new ProgressSpinner('Personal Brain is formatting the answer...');
    const finalResponse = await brain.presentToUser(consensusResult);
    postProcessSpinner.succeed(chalk.green('Answer ready'));

    // Step 7: Display the final result
    console.log(formatFinalResponse(finalResponse, consensusResult.confidence));

    const totalTime = Date.now() - startTime;
    console.log(formatTiming(totalTime));

    showSuccess('Second Brain has completed your query!');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.log(formatError(err));
    showError('An unexpected error occurred.');
    process.exit(1);
  }
}
