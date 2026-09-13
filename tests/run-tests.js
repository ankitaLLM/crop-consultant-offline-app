/**
 * TerraSync Unified Test Runner
 * Executes all unit test suites using Node's built-in test runner.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const testFiles = [
  path.join(__dirname, 'geometry.test.js'),
  path.join(__dirname, 'location-service.test.js'),
  path.join(__dirname, 'map-controller.test.js'),
  path.join(__dirname, 'sync.test.js'),
  path.join(__dirname, 'release-integrity.test.js')
];

console.log('Running TerraSync Unit Tests:');
testFiles.forEach(file => console.log(`  - ${path.basename(file)}`));

const result = spawnSync('node', ['--test', ...testFiles], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
