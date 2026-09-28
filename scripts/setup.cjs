#!/usr/bin/env node
/**
 * Guided setup for Powerhour.
 *
 * Local development:
 *   npm run setup
 *
 * Release install:
 *   docker run --rm -it -v "$PWD:/workspace" "$POWERHOUR_IMAGE" \
 *     node scripts/setup.cjs --env /workspace/.env --template /workspace/.env.example
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawnSync } = require("child_process");

const PLACEHOLDERS = new Set([
  "",
  "replace-with-strong-password",
  "replace-with-url-encoded-password",
  "build-placeholder",
]);

const NEXT_COMMANDS = [
  "docker compose --profile tools run --rm migrate",
  "docker compose up -d",
];

function parseArgs(argv) {
  const options = {
    envPath: path.resolve(process.cwd(), ".env"),
    templatePath: path.resolve(process.cwd(), ".env.example"),
    version: null,
    password: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      i += 1;
      return value;
    };

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--env") {
      options.envPath = path.resolve(readValue());
    } else if (arg.startsWith("--env=")) {
      options.envPath = path.resolve(arg.slice("--env=".length));
    } else if (arg === "--template") {
      options.templatePath = path.resolve(readValue());
    } else if (arg.startsWith("--template=")) {
      options.templatePath = path.resolve(arg.slice("--template=".length));
    } else if (arg === "--version") {
      options.version = readValue();
    } else if (arg.startsWith("--version=")) {
      options.version = arg.slice("--version=".length);
    } else if (arg === "--password") {
      options.password = readValue();
    } else if (arg.startsWith("--password=")) {
      options.password = arg.slice("--password=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Powerhour setup

Usage:
  node scripts/setup.cjs [options]

Options:
  --env <path>       Path to write .env. Defaults to ./.env.
  --template <path>  Template to use when .env does not exist. Defaults to ./.env.example.
  --version <tag>    Set POWERHOUR_VERSION, for example v1.0.0.
  --password <value> Pre-fill the dashboard password prompt.
  --help             Show this help.
`);
}

function generateEncryptionKey() {
  return crypto.randomBytes(32).toString("hex");
}

function generateSessionSecret() {
  return crypto.randomBytes(64).toString("hex");
}

function generatePostgresPassword() {
  return crypto.randomBytes(24).toString("base64url");
}

function buildDatabaseUrl(postgresUser, postgresPassword, postgresDb) {
  return `postgresql://${encodeURIComponent(postgresUser)}:${encodeURIComponent(
    postgresPassword
  )}@db:5432/${encodeURIComponent(postgresDb)}`;
}

function isPlaceholder(value) {
  return PLACEHOLDERS.has((value ?? "").trim());
}

function parseEnv(content) {
  const values = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = parseEnvValue(match[2]);
  }

  return values;
}

function parseEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return value;
}

function formatEnvValue(value) {
  const stringValue = String(value);
  if (!/[\s#'$"]/.test(stringValue)) {
    return stringValue;
  }
  return `'${stringValue.replace(/'/g, "'\\''")}'`;
}

function setEnvValue(content, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}=.*$`, "m");
  const formattedValue = formatEnvValue(value);

  if (regex.test(content)) {
    return content.replace(regex, `${key}=${formattedValue}`);
  }

  const suffix = content.endsWith("\n") ? "" : "\n";
  return `${content}${suffix}${key}=${formattedValue}\n`;
}

function applyEnvValues(content, values, { overwrite = false } = {}) {
  let updated = content;
  const current = parseEnv(content);

  for (const [key, value] of Object.entries(values)) {
    const existing = current[key];
    if (!overwrite && existing !== undefined && !isPlaceholder(existing)) {
      continue;
    }
    updated = setEnvValue(updated, key, value);
    current[key] = value;
  }

  return updated;
}

function applyExplicitEnvValues(content, values) {
  let updated = content;
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    updated = setEnvValue(updated, key, value);
  }
  return updated;
}

function buildGeneratedValues({
  mode,
  passwordHash,
  appUrl,
  version,
  existing = {},
  overwrite = false,
  plaidClientId = "",
  plaidSecret = "",
  plaidEnv = "development",
  plaidWebhookUrl = "",
  geminiApiKey = "",
}) {
  const postgresUser = isPlaceholder(existing.POSTGRES_USER)
    ? "finance_app"
    : existing.POSTGRES_USER ?? "finance_app";
  const postgresDb = isPlaceholder(existing.POSTGRES_DB)
    ? "finance"
    : existing.POSTGRES_DB ?? "finance";
  const postgresPassword = overwrite || isPlaceholder(existing.POSTGRES_PASSWORD)
    ? generatePostgresPassword()
    : existing.POSTGRES_PASSWORD;

  const values = {
    POSTGRES_USER: postgresUser,
    POSTGRES_PASSWORD: postgresPassword,
    POSTGRES_DB: postgresDb,
    DATABASE_URL: buildDatabaseUrl(postgresUser, postgresPassword, postgresDb),
    DATABASE_SSL: "disable",
    ENCRYPTION_KEY: generateEncryptionKey(),
    SESSION_SECRET: generateSessionSecret(),
    DEMO_MODE: mode === "demo" ? "true" : "false",
    NEXT_PUBLIC_DEMO_MODE: mode === "demo" ? "true" : "false",
  };

  if (passwordHash) values.DASHBOARD_PASSWORD_HASH = passwordHash;
  if (version) values.POWERHOUR_VERSION = version;

  const explicitValues = {
    NEXT_PUBLIC_APP_URL: appUrl,
  };

  if (geminiApiKey) {
    explicitValues.GEMINI_API_KEY = geminiApiKey;
  }

  if (mode === "production") {
    explicitValues.PLAID_CLIENT_ID = plaidClientId;
    explicitValues.PLAID_SECRET = plaidSecret;
    explicitValues.PLAID_ENV = plaidEnv || "development";
    explicitValues.PLAID_WEBHOOK_URL = plaidWebhookUrl;
    explicitValues.GEMINI_API_KEY = geminiApiKey;
  }

  return { generatedValues: values, explicitValues };
}

async function hashPassword(password) {
  if (!password || password.length < 8) {
    throw new Error("Dashboard password must be at least 8 characters.");
  }

  const bcrypt = require("bcryptjs");
  return bcrypt.hash(password, 12);
}

function createPrompter({ input = process.stdin, output = process.stdout } = {}) {
  return {
    ask(question, defaultValue = "") {
      const suffix = defaultValue ? ` [${defaultValue}]` : "";
      const rl = readline.createInterface({ input, output });
      return new Promise((resolve) => {
        rl.question(`${question}${suffix}: `, (answer) => {
          rl.close();
          resolve(answer.trim() || defaultValue);
        });
      });
    },
  };
}

async function promptPassword(prompt, providedPassword) {
  if (providedPassword) return providedPassword;
  return prompt.ask("Dashboard password (min 8 chars)");
}

async function promptMode(prompt) {
  const answer = (await prompt.ask("Setup mode: production or demo", "production")).toLowerCase();
  if (answer === "demo" || answer === "d") return "demo";
  return "production";
}

async function confirm(prompt, question, defaultYes = false) {
  const defaultLabel = defaultYes ? "Y/n" : "y/N";
  const answer = (await prompt.ask(`${question} (${defaultLabel})`)).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

function loadEnvContent(envPath, templatePath) {
  if (fs.existsSync(envPath)) {
    return {
      content: fs.readFileSync(envPath, "utf8"),
      created: false,
    };
  }

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  return {
    content: fs.readFileSync(templatePath, "utf8"),
    created: true,
  };
}

function writeAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(tempPath, content, { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

function commandExists(command) {
  const result =
    process.platform === "win32"
      ? spawnSync("where", [command], { stdio: "ignore" })
      : spawnSync("sh", ["-lc", `command -v ${command}`], { stdio: "ignore" });
  return result.status === 0;
}

function canRunDockerCompose() {
  if (!commandExists("docker")) return false;
  const result = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
  return result.status === 0;
}

function runCommand(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: "inherit",
  });
  return result.status === 0;
}

function printNextCommands(cwd) {
  console.log("\nNext commands:");
  console.log(`  cd ${cwd}`);
  for (const command of NEXT_COMMANDS) {
    console.log(`  ${command}`);
  }
}

async function maybeRunDockerCommands(prompt, cwd) {
  printNextCommands(cwd);

  if (!canRunDockerCompose()) {
    console.log("\nDocker Compose is not available to this setup process.");
    console.log("Run the commands above from your host shell.");
    return;
  }

  const shouldRun = await confirm(prompt, "Run migration and start containers now?", true);
  if (!shouldRun) return;

  for (const command of NEXT_COMMANDS) {
    console.log(`\n$ ${command}`);
    if (!runCommand(command, cwd)) {
      throw new Error(`Command failed: ${command}`);
    }
  }
}

async function collectWizardAnswers({
  prompt,
  existing,
  providedPassword,
  version,
  overwrite,
}) {
  const mode = await promptMode(prompt);
  const needsPassword = overwrite || isPlaceholder(existing.DASHBOARD_PASSWORD_HASH);
  const password = needsPassword ? await promptPassword(prompt, providedPassword) : null;
  const passwordHash = needsPassword ? await hashPassword(password) : null;
  const defaultAppUrl = existing.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const appUrl = await prompt.ask("App URL", defaultAppUrl);

  if (mode === "demo") {
    return {
      mode,
      passwordHash,
      appUrl,
      version,
      geminiApiKey: await prompt.ask(
        "Gemini API key (optional, enables AI features)",
        existing.GEMINI_API_KEY || ""
      ),
    };
  }

  return {
    mode,
    passwordHash,
    appUrl,
    version,
    plaidClientId: await prompt.ask("Plaid client ID (optional)", existing.PLAID_CLIENT_ID || ""),
    plaidSecret: await prompt.ask("Plaid secret (optional)", existing.PLAID_SECRET || ""),
    plaidEnv: await prompt.ask("Plaid environment", existing.PLAID_ENV || "development"),
    plaidWebhookUrl: await prompt.ask(
      "Plaid webhook URL (optional)",
      existing.PLAID_WEBHOOK_URL || ""
    ),
    geminiApiKey: await prompt.ask("Gemini API key (optional)", existing.GEMINI_API_KEY || ""),
  };
}

async function runSetup({
  argv = process.argv.slice(2),
  input = process.stdin,
  output = process.stdout,
} = {}) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }

  if (!input.isTTY) {
    throw new Error("Interactive setup requires a TTY. Re-run the Docker setup command with -it.");
  }

  console.log("\nPowerhour setup\n");

  const { content, created } = loadEnvContent(options.envPath, options.templatePath);
  const existing = parseEnv(content);
  const prompt = createPrompter({ input, output });
  const overwrite = created
    ? true
    : await confirm(prompt, "Regenerate generated secrets and dashboard password?", false);
  const answers = await collectWizardAnswers({
    prompt,
    existing,
    providedPassword: options.password,
    version: options.version,
    overwrite,
  });
  const { generatedValues, explicitValues } = buildGeneratedValues({
    ...answers,
    existing,
    overwrite,
  });
  const updated = applyExplicitEnvValues(
    applyEnvValues(content, generatedValues, { overwrite }),
    explicitValues
  );

  writeAtomic(options.envPath, updated);

  console.log(`\nSaved configuration to ${options.envPath}`);
  if (created) {
    console.log(`Created it from ${options.templatePath}`);
  }

  await maybeRunDockerCommands(prompt, path.dirname(options.envPath));
  return 0;
}

if (require.main === module) {
  runSetup()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`\nSetup failed: ${err instanceof Error ? err.message : err}`);
      process.exitCode = 1;
    });
}

module.exports = {
  NEXT_COMMANDS,
  applyEnvValues,
  applyExplicitEnvValues,
  buildDatabaseUrl,
  buildGeneratedValues,
  formatEnvValue,
  hashPassword,
  isPlaceholder,
  loadEnvContent,
  parseEnvValue,
  parseArgs,
  parseEnv,
  runSetup,
  setEnvValue,
};
