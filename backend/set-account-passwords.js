const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const accountEmails = [
  'zibeke@outlook.com',
  'onwabe@outlook.com',
  'bandile@outlook.com'
];
let pipedPasswords;

function readPassword(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      if (!pipedPasswords) {
        pipedPasswords = new Promise((resolveLines) => {
          const reader = readline.createInterface({ input, crlfDelay: Infinity });
          const lines = [];
          reader.on('line', (line) => lines.push(line));
          reader.on('close', () => resolveLines(lines));
        });
      }
      pipedPasswords.then((lines) => {
        if (!lines.length) return reject(new Error('Password input was not provided.'));
        process.stdout.write(`${prompt}[hidden input]\n`);
        resolve(lines.shift());
      });
      return;
    }

    const wasRaw = input.isRaw;
    let password = '';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();

    function finish(error) {
      input.removeListener('data', onData);
      input.setRawMode(wasRaw);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(password);
    }

    function onData(key) {
      if (key === '\u0003') return finish(new Error('Password entry cancelled.'));
      if (key === '\r' || key === '\n') return finish();
      if (key === '\u007f' || key === '\b') {
        if (password) {
          password = Array.from(password).slice(0, -1).join('');
          process.stdout.write('\b \b');
        }
        return;
      }
      if (!/[\u0000-\u001f\u007f]/.test(key)) {
        password += key;
        process.stdout.write('*'.repeat(Array.from(key).length));
      }
    }

    input.on('data', onData);
  });
}

async function setAccountPasswords() {
  let password = '';
  let confirmation = '';
  try {
    console.warn('This sets one shared password for all three accounts. Password123 is easy to guess and should only be temporary.');
    password = await readPassword('New password (minimum 8 characters): ');
    if (password.length < 8) {
      throw new Error('The password must contain at least 8 characters.');
    }
    confirmation = await readPassword('Confirm new password: ');
    if (password !== confirmation) {
      throw new Error('The passwords do not match.');
    }

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cci-community-portal');
    const users = await User.find({ email: { $in: accountEmails } }).select('email');
    if (users.length !== accountEmails.length) {
      const foundEmails = new Set(users.map((user) => user.email));
      const missingEmails = accountEmails.filter((email) => !foundEmails.has(email));
      throw new Error(`These accounts were not found: ${missingEmails.join(', ')}. Run the seed command first.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await User.updateMany(
      { email: { $in: accountEmails } },
      { $set: { passwordHash } },
      { runValidators: true }
    );
    if (result.modifiedCount !== accountEmails.length) {
      throw new Error(`Expected to update ${accountEmails.length} accounts, updated ${result.modifiedCount}.`);
    }
    console.log('Passwords updated in the database for all three accounts.');
  } finally {
    password = '';
    confirmation = '';
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

setAccountPasswords().catch((error) => {
  console.error('Unable to update account passwords:', error.message);
  process.exitCode = 1;
});
