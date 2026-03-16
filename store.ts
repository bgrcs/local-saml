import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { generateKeys, type SAMLKeys } from "./saml";

const DATA_DIR = join(import.meta.dir, "data");
mkdirSync(DATA_DIR, { recursive: true });

export interface User {
  id: string;
  email: string;
  name: string;
  attributes: Record<string, string>;
}

export interface SPConfig {
  entityId: string;
  acsUrl: string;
  loginUrl?: string;
  encryptionCert?: string; // SP's public cert for assertion encryption
}

export interface SigningOptions {
  signAssertion: boolean;
  signResponse: boolean;
  encryptAssertion: boolean;
}

export interface AppState {
  sp: SPConfig | null;
  users: User[];
  signing: SigningOptions;
}

// In-memory SAML request sessions (ctx token -> parsed request data)
export interface SAMLSession {
  id: string;
  issuer: string;
  acsUrl: string;
  relayState?: string;
  createdAt: number;
}
const samlSessions = new Map<string, SAMLSession>();

export function storeSAMLSession(token: string, session: SAMLSession) {
  samlSessions.set(token, session);
  // Clean up old sessions (older than 10 minutes)
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of samlSessions) {
    if (v.createdAt < cutoff) samlSessions.delete(k);
  }
}

export function getSAMLSession(token: string): SAMLSession | undefined {
  return samlSessions.get(token);
}

export function deleteSAMLSession(token: string) {
  samlSessions.delete(token);
}

const STATE_FILE = join(DATA_DIR, "state.json");
const KEYS_FILE = join(DATA_DIR, "keys.json");

function defaultState(): AppState {
  return {
    sp: null,
    signing: { signAssertion: true, signResponse: false, encryptAssertion: false },
    users: [
      {
        id: "1",
        email: "alice@example.com",
        name: "Alice Example",
        attributes: {
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Example",
          role: "admin",
        },
      },
      {
        id: "2",
        email: "bob@example.com",
        name: "Bob Test",
        attributes: {
          email: "bob@example.com",
          firstName: "Bob",
          lastName: "Test",
          role: "user",
        },
      },
    ],
  };
}

let appState: AppState;
let samlKeys: SAMLKeys;

export function initStore(): { state: AppState; keys: SAMLKeys } {
  if (existsSync(STATE_FILE)) {
    appState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    // Migrate: ensure signing options exist for existing state files
    if (!appState.signing) {
      appState.signing = { signAssertion: true, signResponse: false, encryptAssertion: false };
    } else if (appState.signing.encryptAssertion === undefined) {
      appState.signing.encryptAssertion = false;
    }
  } else {
    appState = defaultState();
    persistState();
  }

  if (existsSync(KEYS_FILE)) {
    samlKeys = JSON.parse(readFileSync(KEYS_FILE, "utf-8"));
    console.log("Loaded existing SAML keys.");
  } else {
    samlKeys = generateKeys();
    writeFileSync(KEYS_FILE, JSON.stringify(samlKeys, null, 2));
    console.log("Keys generated and saved to data/keys.json");
  }

  return { state: appState, keys: samlKeys };
}

export function getAppState(): AppState {
  return appState;
}

export function getKeys(): SAMLKeys {
  return samlKeys;
}

export function persistState() {
  writeFileSync(STATE_FILE, JSON.stringify(appState, null, 2));
}

export function updateSP(sp: SPConfig | null) {
  appState.sp = sp;
  persistState();
}

export function setUsers(users: User[]) {
  appState.users = users;
  persistState();
}

export function updateSigning(signing: SigningOptions) {
  appState.signing = signing;
  persistState();
}
