#!/usr/bin/env node
/**
 * Generate an argon2id hash for APP_PASSWORD_HASH.
 * Usage: npm run hash-password
 * (Prompts for the password on stdin without echo.)
 */
const readline = require('node:readline');
const { argon2id } = require('hash-wasm');
const crypto = require('node:crypto');

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdin = process.stdin;
    process.stdout.write(question);
    let buf = '';
    const onData = (ch) => {
      const s = ch.toString();
      if (s === '\r' || s === '\n' || s === '\r\n') {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(buf);
        return;
      }
      if (s === '') {
        process.exit(130);
      }
      if (s === '' || s === '') {
        buf = buf.slice(0, -1);
        return;
      }
      buf += s;
    };
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

(async () => {
  try {
    const pw1 = await promptHidden('Password: ');
    if (!pw1 || pw1.length < 8) {
      console.error('Password must be at least 8 characters.');
      process.exit(1);
    }
    const pw2 = await promptHidden('Confirm : ');
    if (pw1 !== pw2) {
      console.error('Passwords do not match.');
      process.exit(1);
    }
    const salt = crypto.randomBytes(16);
    const hash = await argon2id({
      password: pw1,
      salt,
      parallelism: 1,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
      outputType: 'encoded',
    });
    console.log('\nPaste this into your .env as APP_PASSWORD_HASH:\n');
    console.log(hash);
    console.log('');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
