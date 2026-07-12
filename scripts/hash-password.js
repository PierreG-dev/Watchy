#!/usr/bin/env node
/* eslint-disable no-console */
const readline = require('node:readline');
const crypto = require('node:crypto');
const { argon2id } = require('hash-wasm');

const ARGON_OPTIONS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536,
  hashLength: 32,
  outputType: 'hex',
};

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdin = process.openStdin();
    process.stdout.write(question);

    let value = '';
    const onData = (char) => {
      const s = char.toString('utf8');
      if (s === '\n' || s === '\r' || s === '') {
        stdin.removeListener('data', onData);
        stdin.pause();
        process.stdout.write('\n');
        rl.close();
        resolve(value);
      } else if (s === '') {
        process.exit(130);
      } else if (s === '' || s === '\b') {
        value = value.slice(0, -1);
      } else {
        value += s;
      }
    };
    process.stdin.setRawMode?.(true);
    stdin.on('data', onData);
  });
}

(async () => {
  const pw = await promptHidden('Password: ');
  if (!pw) {
    console.error('Empty password.');
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  const hash = await argon2id({ ...ARGON_OPTIONS, password: pw, salt });
  const encoded = `${salt.toString('hex')}:${hash}`;
  console.log('\nAPP_PASSWORD_HASH=' + encoded);
})();
