# Local SAML 2.0 IdP

A development SAML 2.0 Identity Provider that runs at `http://localhost:3100`.

## Quick start

```bash
bun install
bun run dev        # or: bun start
```

Open **http://localhost:3100** in your browser.

## Usage

### 1. Copy IdP details into your platform

On the **IdP Details** tab you'll find:

| Field | Value |
|---|---|
| SSO URL | `http://localhost:3100/sso` |
| IdP Entity ID / Issuer | `http://localhost:3100` |
| X.509 Certificate | displayed on the page (copy button) |
| Metadata URL | `http://localhost:3100/metadata` |

### 2. Enter your SP details

On the **Service Provider** tab, enter your platform's:
- **SP Entity ID** — found in your app's SAML settings
- **ACS URL** — where the IdP POSTs the SAML response after login

### 3. Test users

On the **Test Users** tab, add/edit test accounts. Each user has a set of SAML attributes that will be included in the response.

### 4. Initiate login from your SP

Start the SAML flow from your platform. You'll be redirected to a simple login page at `http://localhost:3100/login?ctx=...` — click any test user to complete authentication.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /sso` | SSO endpoint (HTTP-Redirect binding) |
| `POST /sso` | SSO endpoint (HTTP-POST binding) |
| `GET /login` | Login user-selection page |
| `POST /sso/authenticate` | Complete auth and POST SAML response to ACS |
| `GET /metadata` | IdP metadata XML |
| `GET /api/config` | Current configuration (JSON) |

## Persistence

Keys and configuration are stored in `data/` (auto-created, git-ignored). The RSA key pair is generated once on first run.
