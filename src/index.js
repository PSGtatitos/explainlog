#!/usr/bin/env node
import { program } from 'commander';
import { render } from 'ink';
import React from 'react';
import { readFileSync, writeFileSync } from 'fs';
import * as readline from 'readline';
import Conf from 'conf';
import App from './App.js';

const config = new Conf({ projectName: 'explainlog' });

program
  .name('explainlog')
  .description('AI-powered log analyzer with TUI')
  .argument('[file]', 'Log file to analyze (or pipe via stdin)')
  .option('-k, --key <key>', 'Groq API key (or set GROQ_API_KEY)')
  .option('--setup', 'Save your Groq API key for future sessions')
  .parse();

const opts = program.opts();
const args = program.args;

// --setup flow
if (opts.setup) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const existing = config.get('groqApiKey');

  if (existing) {
    console.log(`Current key: ${existing.slice(0, 8)}${'*'.repeat(20)}`);
  }

  rl.question('Enter your Groq API key: ', (key) => {
    key = key.trim();
    if (!key) {
      console.error('No key entered, aborting.');
      process.exit(1);
    }
    config.set('groqApiKey', key);
    console.log(`✓ Key saved to ${config.path}`);
    console.log('You can now run explainlog without setting GROQ_API_KEY each time.');
    rl.close();
    process.exit(0);
  });

} else {

  // Normal run — resolve key from flag → env → saved config
  const apiKey = opts.key || process.env.GROQ_API_KEY || config.get('groqApiKey');

  if (!apiKey) {
    console.error('Error: No Groq API key found.');
    console.error('Run  explainlog --setup  to save your key, or set GROQ_API_KEY.');
    process.exit(1);
  }

  async function getLogContent() {
    if (args[0]) {
      return readFileSync(args[0], 'utf-8');
    }
    if (!process.stdin.isTTY) {
      return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data));
      });
    }
    console.error('Error: provide a file or pipe log content via stdin.');
    console.error('  explainlog error.log');
    console.error('  journalctl -xe | explainlog');
    process.exit(1);
  }

  const logContent = await getLogContent();

  if (!logContent.trim()) {
    console.error('Error: no log content found.');
    process.exit(1);
  }

  let inkOptions = {};
  if (!process.stdin.isTTY) {
    const { openSync } = await import('fs');
    const { ReadStream } = await import('tty');
    const fd = openSync('/dev/tty', 'r+');
    const ttyStream = new ReadStream(fd);
    inkOptions = { stdin: ttyStream };
  }

  render(React.createElement(App, { logContent, groqApiKey: apiKey }), inkOptions);
}