#!/usr/bin/env node
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, chmodSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const platformMap = {
  "linux-x64": "local-saml-linux-x64",
  "linux-arm64": "local-saml-linux-arm64",
  "darwin-x64": "local-saml-darwin-x64",
  "darwin-arm64": "local-saml-darwin-arm64",
  "win32-x64": "local-saml-windows-x64.exe",
};

const key = `${process.platform}-${process.arch}`;
const binaryName = platformMap[key];

if (!binaryName) {
  console.error(`local-saml-idp: unsupported platform: ${key}`);
  console.error(`Supported platforms: ${Object.keys(platformMap).join(", ")}`);
  process.exit(1);
}

const binaryPath = join(__dirname, "../binaries", binaryName);

if (!existsSync(binaryPath)) {
  console.error(`local-saml-idp: binary not found at ${binaryPath}`);
  console.error("Try reinstalling: npm install -g local-saml-idp");
  process.exit(1);
}

// Ensure binary is executable (may lose permissions on some npm installs)
try {
  chmodSync(binaryPath, 0o755);
} catch {
  // ignore — Windows doesn't support chmod
}

const result = spawnSync(binaryPath, process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
