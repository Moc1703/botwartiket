const chalk = require('chalk');

/**
 * Logger utility for clean console output with timestamps and colors
 */
const logger = {
  /**
   * Get formatted timestamp
   */
  getTimestamp() {
    return new Date().toLocaleTimeString('id-ID', { hour12: false });
  },

  /**
   * Info message (blue)
   */
  info(message) {
    console.log(chalk.blue(`[${this.getTimestamp()}] ℹ ${message}`));
  },

  /**
   * Success message (green)
   */
  success(message) {
    console.log(chalk.green(`[${this.getTimestamp()}] ✓ ${message}`));
  },

  /**
   * Warning message (yellow)
   */
  warn(message) {
    console.log(chalk.yellow(`[${this.getTimestamp()}] ⚠ ${message}`));
  },

  /**
   * Error message (red)
   */
  error(message) {
    console.log(chalk.red(`[${this.getTimestamp()}] ✗ ${message}`));
  },

  /**
   * War mode message (magenta, for critical actions)
   */
  war(message) {
    console.log(chalk.magenta.bold(`[${this.getTimestamp()}] 🔥 ${message}`));
  },

  /**
   * Waiting/Queue message (cyan)
   */
  queue(message) {
    console.log(chalk.cyan(`[${this.getTimestamp()}] ⏳ ${message}`));
  },

  /**
   * Debug message (gray) - only shows when DEBUG env is set
   */
  debug(message) {
    if (process.env.DEBUG) {
      console.log(chalk.gray(`[${this.getTimestamp()}] 🔍 ${message}`));
    }
  },

  /**
   * Banner display
   */
  banner() {
    console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════╗
║         LOKET WAR BOT - High Speed Sniper         ║
║              Use at your own risk!                ║
╚═══════════════════════════════════════════════════╝
    `));
  },

  /**
   * Progress indicator
   */
  progress(current, total, label = '') {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(percentage / 5);
    const empty = 20 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`\r${chalk.cyan(`[${bar}] ${percentage}% ${label}`)}`);
  }
};

module.exports = logger;
