#!/usr/bin/env node
/**
 * Generate an argon2id hash for APP_PASSWORD_HASH.
 * Usage:
 *   npm run hash-password                       (prompts on stdin, shows `*`)
 *   npm run hash-password -- "mypassword"       (one-shot, no prompt)
 */
const { argon2id } = require('hash-wasm');
const crypto = require('node:crypto');

async function hash(pw) {
  const salt = crypto.randomBytes(16);
  return argon2id({
    password: pw,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded',
  });
}

function readMasked(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (typeof stdin.setRawMode !== 'function') {
      return reject(new Error('stdin is not a TTY — pass the password as an argument: npm run hash-password -- "mypass"'));
    }

    process.stdout.write(prompt);

    // Collect bytes so we can rebuild UTF-8 code points correctly at Enter.
    const chunks = [];
    let visibleCount = 0;

    const onData = (buf) => {
      for (let i = 0; i < buf.length; i++) {
        const b = buf[i];
        if (b === 0x03) { // Ctrl-C
          cleanup();
          process.stdout.write('\n');
          process.exit(130);
        }
        if (b === 0x0d || b === 0x0a) { // Enter
          cleanup();
          process.stdout.write('\n');
          const value = Buffer.concat(chunks).toString('utf8');
          return resolve(value);
        }
        if (b === 0x7f || b === 0x08) { // Backspace / DEL
          // Drop the last full UTF-8 code point.
          if (chunks.length === 0) continue;
          const merged = Buffer.concat(chunks);
          // find start of last UTF-8 char (byte with top bits != 10)
          let cut = merged.length - 1;
          while (cut > 0 && (merged[cut] & 0xc0) === 0x80) cut--;
          chunks.length = 0;
          if (cut > 0) chunks.push(merged.subarray(0, cut));
          if (visibleCount > 0) {
            process.stdout.write('\b \b');
            visibleCount--;
          }
          continue;
        }
        // Ignore other control bytes (arrow keys start with 0x1b, etc.)
        if (b < 0x20) continue;
        chunks.push(Buffer.from([b]));
        process.stdout.write('*');
        visibleCount++;
      }
    };

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

(async () => {
  try {
    let pw = process.argv[2];
    if (!pw) {
      pw = await readMasked('Password: ');
      const c = await readMasked('Confirm : ');
      if (pw !== c) {
        console.error(`Passwords do not match (len ${pw.length} vs ${c.length}).`);
        process.exit(1);
      }
    }
    if (!pw || pw.length < 8) {
      console.error('Password must be at least 8 characters.');
      process.exit(1);
    }
    const h = await hash(pw);
    // Escape every `$` — dotenv-expand (used by Next) treats `$foo` as a
    // variable reference and silently mangles the hash otherwise.
    const escaped = h.replace(/\$/g, '\\$');
    console.log('\nPaste this into your .env exactly as shown (every `$` is escaped):\n');
    console.log(`APP_PASSWORD_HASH=${escaped}`);
    console.log('');
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }
})();
