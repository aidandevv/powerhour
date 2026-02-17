#!/usr/bin/env node
/**
 * Setup script for powerhour — generates secrets and prepares .env
 * Run: npm run setup
 * Or with password: npm run setup -- --password=yourpassword
 *
 * Generates: ENCRYPTION_KEY, SESSION_SECRET, DASHBOARD_PASSWORD_HASH
 * Copies .env.example to .env if .env doesn't exist
 * Leaves PLAID_*, DATABASE_URL, GEMINI_API_KEY for you to fill in
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ROOT = path.resolve(__dirname, "..");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");
const ENV_FILE = path.join(ROOT, ".env");

function generateEncryptionKey() {
  return crypto.randomBytes(32).toString("hex");
}

function generateSessionSecret() {
  return crypto.randomBytes(64).toString("hex");
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function generatePasswordHash() {
  const passwordFromArg = process.argv.find((a) => a.startsWith("--password="));
  let password;
  if (passwordFromArg) {
    password = passwordFromArg.split("=")[1];
  } else {
    password = await prompt("Enter a password for the dashboard (min 8 chars): ");
  }
  if (!password || password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const bcrypt = require("bcryptjs");
  return bcrypt.hash(password, 12);
}

function updateEnv(content, replacements) {
  let updated = content;
  for (const [key, value] of Object.entries(replacements)) {
    // Only replace if value is empty (key= followed by optional whitespace and/or comment)
    const regex = new RegExp(`^(${key}=)\\s*(?:#.*)?$`, "m");
    if (regex.test(updated)) {
      updated = updated.replace(regex, `$1${value}`);
    }
  }
  return updated;
}

async function main() {
  console.log("\n🔐 powerhour setup\n");

  if (!fs.existsSync(ENV_EXAMPLE)) {
    console.error(".env.example not found. Are you in the project root?");
    process.exit(1);
  }

  if (!fs.existsSync(ENV_FILE)) {
    fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
    console.log("Created .env from .env.example");
  } else {
    console.log(".env already exists, updating generated values only");
  }

  let content = fs.readFileSync(ENV_FILE, "utf8");

  const encryptionKey = generateEncryptionKey();
  const sessionSecret = generateSessionSecret();
  const passwordHash = await generatePasswordHash();

  content = updateEnv(content, {
    ENCRYPTION_KEY: encryptionKey,
    SESSION_SECRET: sessionSecret,
    DASHBOARD_PASSWORD_HASH: passwordHash,
  });

  fs.writeFileSync(ENV_FILE, content);

  console.log("\n✅ Generated and saved to .env:");
  console.log("   • ENCRYPTION_KEY");
  console.log("   • SESSION_SECRET");
  console.log("   • DASHBOARD_PASSWORD_HASH");
  console.log("\n📋 Next steps:");
  console.log("   1. Edit .env and add: PLAID_CLIENT_ID, PLAID_SECRET, DATABASE_URL, GEMINI_API_KEY");
  console.log("   2. docker compose -f docker/docker-compose.yml up db -d");
  console.log("   3. npm run db:push");
  console.log("   4. npm run dev");
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
