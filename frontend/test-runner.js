#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

const testCommands = {
  'unit': 'jest __tests__/legal-report.test.js',
  'coverage': 'jest --coverage',
  'watch': 'jest --watch',
  'all': 'jest',
  'help': () => {
    console.log(`
SMALDA Test Runner

Usage: node test-runner.js <command>

Commands:
  unit      - Run unit tests for Legal Report page
  coverage  - Run tests with coverage report
  watch     - Run tests in watch mode
  all       - Run all tests
  help      - Show this help message

Examples:
  node test-runner.js unit
  node test-runner.js coverage
  node test-runner.js watch
    `);
  }
};

if (!command || command === 'help') {
  testCommands.help();
  process.exit(0);
}

if (!testCommands[command]) {
  console.error(`Unknown command: ${command}`);
  console.log('Run "node test-runner.js help" for available commands');
  process.exit(1);
}

const testCommand = testCommands[command];
const [cmd, ...cmdArgs] = testCommand.split(' ');

console.log(`Running: ${testCommand}`);
console.log('='.repeat(50));

const child = spawn(cmd, cmdArgs, {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

child.on('close', (code) => {
  console.log('='.repeat(50));
  console.log(`Test run completed with exit code: ${code}`);
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Failed to start test process:', error);
  process.exit(1);
}); 