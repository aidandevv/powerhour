import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const setup = require("../setup.cjs");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "powerhour-setup-"));
}

describe("setup env helpers", () => {
  it("creates release env values from a template without placeholders", () => {
    const content = [
      "DATABASE_URL=postgresql://finance_app:replace-with-url-encoded-password@db:5432/finance",
      "POSTGRES_USER=finance_app",
      "POSTGRES_PASSWORD=replace-with-strong-password",
      "POSTGRES_DB=finance",
      "ENCRYPTION_KEY=",
      "SESSION_SECRET=",
      "DASHBOARD_PASSWORD_HASH=",
      "NEXT_PUBLIC_APP_URL=",
      "DEMO_MODE=false",
      "NEXT_PUBLIC_DEMO_MODE=false",
      "POWERHOUR_VERSION=latest",
      "",
    ].join("\n");

    const { generatedValues, explicitValues } = setup.buildGeneratedValues({
      mode: "production",
      passwordHash: "$2b$12$hashed",
      appUrl: "https://finance.example.com",
      version: "v1.0.0",
      existing: setup.parseEnv(content),
      plaidClientId: "plaid-client",
      plaidSecret: "plaid-secret",
      plaidEnv: "production",
      plaidWebhookUrl: "https://finance.example.com/api/webhooks/plaid",
      geminiApiKey: "gemini-key",
    });
    const updated = setup.applyExplicitEnvValues(
      setup.applyEnvValues(content, generatedValues, { overwrite: true }),
      explicitValues
    );
    const parsed = setup.parseEnv(updated);

    expect(parsed.POSTGRES_PASSWORD).not.toBe("replace-with-strong-password");
    expect(parsed.DATABASE_URL).toContain("postgresql://finance_app:");
    expect(parsed.DATABASE_URL).toContain("@db:5432/finance");
    expect(parsed.ENCRYPTION_KEY).toHaveLength(64);
    expect(parsed.SESSION_SECRET).toHaveLength(128);
    expect(parsed.DASHBOARD_PASSWORD_HASH).toBe("$2b$12$hashed");
    expect(parsed.NEXT_PUBLIC_APP_URL).toBe("https://finance.example.com");
    expect(parsed.POWERHOUR_VERSION).toBe("v1.0.0");
    expect(parsed.PLAID_CLIENT_ID).toBe("plaid-client");
    expect(parsed.GEMINI_API_KEY).toBe("gemini-key");
  });

  it("preserves existing generated secrets unless overwrite is requested", () => {
    const existingKey = "a".repeat(64);
    const existingSecret = "b".repeat(128);
    const content = [
      `ENCRYPTION_KEY=${existingKey}`,
      `SESSION_SECRET=${existingSecret}`,
      "DASHBOARD_PASSWORD_HASH=$2b$12$existing",
      "POSTGRES_USER=finance_app",
      "POSTGRES_PASSWORD=already-secret",
      "POSTGRES_DB=finance",
      "DATABASE_URL=postgresql://finance_app:already-secret@db:5432/finance",
      "NEXT_PUBLIC_APP_URL=https://old.example.com",
      "PLAID_CLIENT_ID=old-client",
      "GEMINI_API_KEY=old-gemini",
      "",
    ].join("\n");

    const { generatedValues, explicitValues } = setup.buildGeneratedValues({
      mode: "production",
      passwordHash: "$2b$12$new",
      appUrl: "https://new.example.com",
      existing: setup.parseEnv(content),
      plaidClientId: "new-client",
      geminiApiKey: "new-gemini",
    });
    const updated = setup.applyExplicitEnvValues(
      setup.applyEnvValues(content, generatedValues, { overwrite: false }),
      explicitValues
    );
    const parsed = setup.parseEnv(updated);

    expect(parsed.ENCRYPTION_KEY).toBe(existingKey);
    expect(parsed.SESSION_SECRET).toBe(existingSecret);
    expect(parsed.DASHBOARD_PASSWORD_HASH).toBe("$2b$12$existing");
    expect(parsed.POSTGRES_PASSWORD).toBe("already-secret");
    expect(parsed.NEXT_PUBLIC_APP_URL).toBe("https://new.example.com");
    expect(parsed.PLAID_CLIENT_ID).toBe("new-client");
    expect(parsed.GEMINI_API_KEY).toBe("new-gemini");
  });

  it("url-encodes database credentials", () => {
    expect(setup.buildDatabaseUrl("finance@app", "p@ss word/?:#", "finance db")).toBe(
      "postgresql://finance%40app:p%40ss%20word%2F%3F%3A%23@db:5432/finance%20db"
    );
  });

  it("quotes values that Docker Compose would otherwise interpolate", () => {
    const updated = setup.setEnvValue("DASHBOARD_PASSWORD_HASH=\n", "DASHBOARD_PASSWORD_HASH", "$2b$12$hashed");

    expect(updated).toContain("DASHBOARD_PASSWORD_HASH='$2b$12$hashed'");
    expect(setup.parseEnv(updated).DASHBOARD_PASSWORD_HASH).toBe("$2b$12$hashed");
  });

  it("sets demo mode without provider credentials", () => {
    const { generatedValues, explicitValues } = setup.buildGeneratedValues({
      mode: "demo",
      passwordHash: "$2b$12$hashed",
      appUrl: "http://localhost:3000",
      existing: {},
      plaidClientId: "ignored",
    });

    expect(generatedValues.DEMO_MODE).toBe("true");
    expect(generatedValues.NEXT_PUBLIC_DEMO_MODE).toBe("true");
    expect(explicitValues.PLAID_CLIENT_ID).toBeUndefined();
    expect(explicitValues.GEMINI_API_KEY).toBeUndefined();
  });

  it("preserves an optional Gemini key in demo mode", () => {
    const { explicitValues } = setup.buildGeneratedValues({
      mode: "demo",
      appUrl: "http://localhost:3000",
      existing: {},
      geminiApiKey: "gemini-key",
    });

    expect(explicitValues.GEMINI_API_KEY).toBe("gemini-key");
  });
});

describe("setup CLI behavior", () => {
  it("prints help without requiring a TTY", () => {
    const output = execFileSync("node", ["scripts/setup.cjs", "--help"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output).toContain("Powerhour setup");
    expect(output).toContain("--env <path>");
  });

  it("fails non-TTY setup without writing .env", () => {
    const dir = tempDir();
    const envPath = path.join(dir, ".env");
    const templatePath = path.join(dir, ".env.example");
    fs.writeFileSync(templatePath, "ENCRYPTION_KEY=\n");

    expect(() =>
      execFileSync(
        "node",
        ["scripts/setup.cjs", "--env", envPath, "--template", templatePath],
        {
          cwd: repoRoot,
          encoding: "utf8",
          stdio: "pipe",
        }
      )
    ).toThrow(/Interactive setup requires a TTY/);
    expect(fs.existsSync(envPath)).toBe(false);
  });

  it("rejects short dashboard passwords", async () => {
    await expect(setup.hashPassword("short")).rejects.toThrow(
      "Dashboard password must be at least 8 characters."
    );
  });
});
