/**
 * Terminal UI helpers for Second Brain CLI
 *
 * Provides reusable utilities for:
 * - Spinners and progress indicators
 * - Colored output
 * - Response formatting
 * - Markdown rendering (future)
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';

/**
 * Creates and manages a spinner for a long-running operation
 */
export class ProgressSpinner {
  private spinner: Ora;

  constructor(message: string) {
    this.spinner = ora(message).start();
  }

  /**
   * Update the spinner text
   */
  update(message: string): void {
    this.spinner.text = message;
  }

  /**
   * Mark the operation as successful
   */
  succeed(message?: string): void {
    this.spinner.succeed(message);
  }

  /**
   * Mark the operation as failed
   */
  fail(message?: string): void {
    this.spinner.fail(message);
  }

  /**
   * Show a warning
   */
  warn(message?: string): void {
    this.spinner.warn(message);
  }

  /**
   * Show info
   */
  info(message?: string): void {
    this.spinner.info(message);
  }

  /**
   * Stop the spinner without any icon
   */
  stop(): void {
    this.spinner.stop();
  }
}

/**
 * Formats the final response with confidence indicators
 */
export function formatFinalResponse(response: string, confidence: number): string {
  const confidenceLabel =
    confidence >= 0.8
      ? chalk.green('High Confidence')
      : confidence >= 0.5
        ? chalk.yellow('Moderate Confidence')
        : chalk.red('Low Confidence');

  const confidenceBar = renderConfidenceBar(confidence);

  return `
${chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}

${response}

${chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
${confidenceLabel} ${confidenceBar} ${chalk.gray(`(${confidence.toFixed(2)})`)}
`;
}

/**
 * Renders a visual confidence bar
 */
function renderConfidenceBar(confidence: number): string {
  const totalBars = 10;
  const filledBars = Math.round(confidence * totalBars);
  const emptyBars = totalBars - filledBars;

  const color = confidence >= 0.8 ? chalk.green : confidence >= 0.5 ? chalk.yellow : chalk.red;

  return color('█'.repeat(filledBars)) + chalk.gray('░'.repeat(emptyBars));
}

/**
 * Formats timing information
 */
export function formatTiming(totalMs: number): string {
  const seconds = (totalMs / 1000).toFixed(1);
  return chalk.gray(`Completed in ${seconds}s`);
}

/**
 * Formats an error message
 */
export function formatError(error: Error): string {
  return `
${chalk.red.bold('━━━ Error ━━━')}

${chalk.red(error.message)}

${chalk.gray(error.stack || '')}
`;
}

/**
 * Shows a section header
 */
export function showHeader(title: string): void {
  console.log(`\n${chalk.bold.cyan(`🧠 ${title}`)}\n`);
}

/**
 * Shows a completion message
 */
export function showSuccess(message: string): void {
  console.log(`\n${chalk.green('✨')} ${chalk.bold(message)}\n`);
}

/**
 * Shows a warning message
 */
export function showWarning(message: string): void {
  console.log(`\n${chalk.yellow('⚠️')} ${chalk.yellow(message)}\n`);
}

/**
 * Shows an error message
 */
export function showError(message: string): void {
  console.log(`\n${chalk.red('❌')} ${chalk.red.bold(message)}\n`);
}
