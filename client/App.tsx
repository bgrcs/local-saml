import { useState, useEffect, useCallback } from "react";

// ---- Types ---------------------------------------------------------------

interface IdPConfig {
  entityId: string;
  ssoUrl: string;
  metadataUrl: string;
  certificate: string;
  certificateData: string;
}

interface SPConfig {
  entityId: string;
  acsUrl: string;
  loginUrl?: string;
  encryptionCert?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  attributes: Record<string, string>;
}

interface SigningOptions {
  signAssertion: boolean;
  signResponse: boolean;
  encryptAssertion: boolean;
}

interface AppConfig {
  idp: IdPConfig;
  sp: SPConfig | null;
  users: User[];
  signing: SigningOptions;
}

// ---- Styles (CSS-in-JS) --------------------------------------------------

const css = `
  :root {
    --indigo: #6366f1;
    --indigo-dark: #4f46e5;
    --indigo-light: #e0e7ff;
    --slate-50: #f8fafc;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-400: #94a3b8;
    --slate-500: #64748b;
    --slate-600: #475569;
    --slate-700: #334155;
    --slate-800: #1e293b;
    --green: #22c55e;
    --green-light: #dcfce7;
    --red: #ef4444;
    --red-light: #fee2e2;
    --amber: #f59e0b;
    --amber-light: #fef3c7;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--slate-50); color: var(--slate-800); }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* Header */
  .header {
    background: #fff;
    border-bottom: 1px solid var(--slate-200);
    padding: 0 32px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 1px 2px rgba(0,0,0,.04);
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .header-icon {
    width: 34px;
    height: 34px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  .header-title {
    font-weight: 700;
    font-size: 16px;
  }
  .header-subtitle {
    font-size: 12px;
    color: var(--slate-400);
    margin-top: 1px;
  }
  .header-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--slate-100);
    border: 1px solid var(--slate-200);
    border-radius: 20px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--slate-600);
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 0 2px var(--green-light);
  }

  /* Tabs */
  .tabs {
    background: #fff;
    border-bottom: 1px solid var(--slate-200);
    padding: 0 32px;
    display: flex;
    gap: 0;
  }
  .tab-btn {
    padding: 14px 20px;
    font-size: 14px;
    font-weight: 500;
    color: var(--slate-500);
    border: none;
    background: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all .15s;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .tab-btn:hover { color: var(--slate-800); }
  .tab-btn.active {
    color: var(--indigo);
    border-bottom-color: var(--indigo);
  }
  .tab-badge {
    background: var(--indigo-light);
    color: var(--indigo);
    font-size: 11px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 10px;
  }

  /* Main content */
  .main { flex: 1; padding: 32px; max-width: 860px; margin: 0 auto; width: 100%; }

  /* Section */
  .section-title {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .section-desc {
    font-size: 14px;
    color: var(--slate-500);
    margin-bottom: 24px;
  }

  /* Card */
  .card {
    background: #fff;
    border: 1px solid var(--slate-200);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,.04);
  }
  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--slate-500);
    text-transform: uppercase;
    letter-spacing: .05em;
    margin-bottom: 12px;
  }

  /* Copy field */
  .copy-field {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid var(--slate-200);
    border-radius: 8px;
    overflow: hidden;
    background: var(--slate-50);
  }
  .copy-value {
    flex: 1;
    padding: 10px 14px;
    font-size: 13px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: var(--slate-700);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: transparent;
  }
  .copy-btn {
    padding: 10px 14px;
    background: none;
    border: none;
    border-left: 1px solid var(--slate-200);
    cursor: pointer;
    color: var(--slate-400);
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all .15s;
    white-space: nowrap;
  }
  .copy-btn:hover { color: var(--indigo); background: var(--indigo-light); }
  .copy-btn.copied { color: var(--green); }

  /* Cert textarea */
  .cert-box {
    width: 100%;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 11px;
    padding: 12px;
    border: 1px solid var(--slate-200);
    border-radius: 8px;
    background: var(--slate-50);
    color: var(--slate-700);
    resize: vertical;
    min-height: 120px;
    line-height: 1.6;
    outline: none;
  }
  .cert-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    justify-content: flex-end;
  }

  /* Form */
  .form-group { margin-bottom: 18px; }
  .form-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 6px;
    color: var(--slate-700);
  }
  .form-hint {
    font-size: 12px;
    color: var(--slate-400);
    margin-top: 4px;
  }
  .form-input {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--slate-200);
    border-radius: 8px;
    font-size: 14px;
    color: var(--slate-800);
    outline: none;
    transition: border-color .15s, box-shadow .15s;
    background: #fff;
    font-family: inherit;
  }
  .form-input:focus {
    border-color: var(--indigo);
    box-shadow: 0 0 0 3px rgba(99,102,241,.1);
  }
  .form-input.mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
  }

  /* Buttons */
  .btn {
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all .15s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
  }
  .btn-primary {
    background: var(--indigo);
    color: #fff;
  }
  .btn-primary:hover { background: var(--indigo-dark); }
  .btn-secondary {
    background: var(--slate-100);
    color: var(--slate-700);
    border: 1px solid var(--slate-200);
  }
  .btn-secondary:hover { background: var(--slate-200); }
  .btn-danger {
    background: var(--red-light);
    color: var(--red);
    border: 1px solid #fecaca;
  }
  .btn-danger:hover { background: #fecaca; }
  .btn-ghost {
    background: none;
    color: var(--slate-500);
    padding: 6px 10px;
  }
  .btn-ghost:hover { background: var(--slate-100); color: var(--slate-800); }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .btn-sm { padding: 6px 12px; font-size: 13px; }

  /* Alert */
  .alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 20px;
  }
  .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
  .alert-success { background: var(--green-light); border: 1px solid #86efac; color: #15803d; }
  .alert-warning { background: var(--amber-light); border: 1px solid #fcd34d; color: #92400e; }

  /* User list */
  .user-list { display: flex; flex-direction: column; gap: 10px; }
  .user-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--slate-200);
    border-radius: 10px;
    background: #fff;
  }
  .user-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 16px;
    flex-shrink: 0;
  }
  .user-meta { flex: 1; min-width: 0; }
  .user-name-text { font-weight: 500; font-size: 14px; }
  .user-email-text { font-size: 12px; color: var(--slate-500); margin-top: 1px; }
  .user-attrs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .attr-pill {
    font-size: 11px;
    background: var(--slate-100);
    color: var(--slate-600);
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--slate-200);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
  }
  .modal {
    background: #fff;
    border-radius: 14px;
    padding: 28px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,.2);
  }
  .modal-title {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--slate-100);
  }

  /* Attrs editor */
  .attr-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    align-items: center;
  }
  .attr-row .form-input { flex: 1; }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--slate-800);
    color: #fff;
    padding: 12px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    z-index: 200;
    box-shadow: 0 8px 24px rgba(0,0,0,.3);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideUp .2s ease;
  }
  @keyframes slideUp {
    from { transform: translateY(12px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* Toggle switch */
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid var(--slate-100);
  }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-label { flex: 1; min-width: 0; }
  .toggle-label-text { font-size: 14px; font-weight: 500; color: var(--slate-800); }
  .toggle-label-hint { font-size: 12px; color: var(--slate-400); margin-top: 2px; }
  .toggle {
    position: relative;
    width: 42px;
    height: 24px;
    flex-shrink: 0;
    margin-left: 16px;
  }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-track {
    position: absolute;
    inset: 0;
    background: var(--slate-200);
    border-radius: 12px;
    cursor: pointer;
    transition: background .2s;
  }
  .toggle-track::after {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    top: 3px;
    left: 3px;
    transition: transform .2s;
    box-shadow: 0 1px 3px rgba(0,0,0,.2);
  }
  .toggle input:checked + .toggle-track { background: var(--indigo); }
  .toggle input:checked + .toggle-track::after { transform: translateX(18px); }

  /* Misc */
  .row { display: flex; gap: 10px; align-items: center; }
  .divider { height: 1px; background: var(--slate-100); margin: 20px 0; }
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--slate-400);
    font-size: 14px;
  }
  .empty-state-icon { font-size: 36px; margin-bottom: 12px; }
`;

// ---- Utility hooks -------------------------------------------------------

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }, []);

  return { copiedKey, copy };
}

function useToast() {
  const [toast, setToast] = useState<string | null>(null);

  const show = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, show };
}

// ---- Sub-components ------------------------------------------------------

function CopyField({
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (v: string, k: string) => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="copy-field">
        <div className="copy-value" title={value}>
          {value}
        </div>
        <button
          className={`copy-btn ${copiedKey === copyKey ? "copied" : ""}`}
          onClick={() => onCopy(value, copyKey)}
        >
          {copiedKey === copyKey ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ---- Signing toggle component --------------------------------------------

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" />
    </label>
  );
}

// ---- Tab: IdP Details ----------------------------------------------------

function IdPDetailsTab({
  idp,
  signing,
  copiedKey,
  onCopy,
  onSigningChange,
}: {
  idp: IdPConfig;
  signing: SigningOptions;
  copiedKey: string | null;
  onCopy: (v: string, k: string) => void;
  onSigningChange: (s: SigningOptions) => Promise<void>;
}) {
  const [showFullCert, setShowFullCert] = useState(false);
  const [savingSign, setSavingSign] = useState(false);

  async function handleToggle(key: keyof SigningOptions, value: boolean) {
    setSavingSign(true);
    await onSigningChange({ ...signing, [key]: value });
    setSavingSign(false);
  }

  return (
    <div>
      <div className="section-title">IdP Details</div>
      <p className="section-desc">
        Copy these values into your platform's SAML IdP configuration.
      </p>

      <div
        className="alert alert-info"
        style={{ marginBottom: 24 }}
      >
        <span>ℹ️</span>
        <span>
          Your platform's SP settings (Entity ID, ACS URL) must be configured in
          the <strong>Service Provider</strong> tab before testing.
        </span>
      </div>

      <div className="card">
        <div className="card-title">Single Sign-On URL (SSO URL)</div>
        <CopyField
          label=""
          value={idp.ssoUrl}
          copyKey="ssoUrl"
          copiedKey={copiedKey}
          onCopy={onCopy}
        />
        <p className="form-hint">
          Also called: SSO URL, Login URL, HTTP-Redirect endpoint, Sign-in URL
        </p>
      </div>

      <div className="card">
        <div className="card-title">Identity Provider Issuer (Entity ID)</div>
        <CopyField
          label=""
          value={idp.entityId}
          copyKey="entityId"
          copiedKey={copiedKey}
          onCopy={onCopy}
        />
        <p className="form-hint">
          Also called: Issuer, IdP Entity ID, Identifier
        </p>
      </div>

      <div className="card">
        <div className="card-title">X.509 Certificate</div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
            gap: 8,
          }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowFullCert(!showFullCert)}
          >
            {showFullCert ? "Show compact" : "Show PEM"}
          </button>
          <button
            className={`btn btn-secondary btn-sm ${copiedKey === "cert" ? "" : ""}`}
            onClick={() =>
              onCopy(
                showFullCert ? idp.certificate : idp.certificateData,
                "cert"
              )
            }
          >
            {copiedKey === "cert" ? "✓ Copied!" : "Copy certificate"}
          </button>
        </div>
        <textarea
          className="cert-box"
          readOnly
          value={showFullCert ? idp.certificate : idp.certificateData}
          rows={showFullCert ? 10 : 5}
        />
        <p className="form-hint" style={{ marginTop: 8 }}>
          {showFullCert
            ? "Full PEM format (with headers)"
            : "Base64-encoded certificate body (no headers) — use this if your platform asks for just the certificate data"}
        </p>
      </div>

      <div className="card">
        <div className="card-title">Metadata URL</div>
        <CopyField
          label=""
          value={idp.metadataUrl}
          copyKey="metadataUrl"
          copiedKey={copiedKey}
          onCopy={onCopy}
        />
        <p className="form-hint">
          Some platforms can auto-configure from this URL instead of entering
          the fields above manually.
        </p>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 0 }}>
          Signing{" "}
          {savingSign && (
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--slate-400)", textTransform: "none" }}>
              saving…
            </span>
          )}
        </div>
        <div className="toggle-row">
          <div className="toggle-label">
            <div className="toggle-label-text">Sign assertion</div>
            <div className="toggle-label-hint">
              Embeds an XML signature inside the <code>&lt;saml:Assertion&gt;</code> element
            </div>
          </div>
          <Toggle
            checked={signing.signAssertion}
            onChange={(v) => handleToggle("signAssertion", v)}
          />
        </div>
        <div className="toggle-row">
          <div className="toggle-label">
            <div className="toggle-label-text">Sign response</div>
            <div className="toggle-label-hint">
              Embeds an XML signature in the outer <code>&lt;samlp:Response&gt;</code> element
            </div>
          </div>
          <Toggle
            checked={signing.signResponse}
            onChange={(v) => handleToggle("signResponse", v)}
          />
        </div>
        <div className="toggle-row">
          <div className="toggle-label">
            <div className="toggle-label-text">Encrypt assertion</div>
            <div className="toggle-label-hint">
              Wraps the assertion in <code>&lt;saml:EncryptedAssertion&gt;</code> using the SP's
              public key — requires an SP encryption certificate in the Service Provider tab
            </div>
          </div>
          <Toggle
            checked={signing.encryptAssertion}
            onChange={(v) => handleToggle("encryptAssertion", v)}
          />
        </div>
        {signing.encryptAssertion && (
          <div className="alert alert-info" style={{ marginTop: 16, marginBottom: 0 }}>
            <span>🔑</span>
            <span>
              Paste the SP's <strong>encryption certificate</strong> in the{" "}
              <strong>Service Provider</strong> tab to enable encryption.
            </span>
          </div>
        )}
        {!signing.signAssertion && !signing.signResponse && !signing.encryptAssertion && (
          <div
            className="alert alert-warning"
            style={{ marginTop: 16, marginBottom: 0 }}
          >
            <span>⚠️</span>
            <span>All options are off — the SAML response will be unsigned and most SPs will reject it.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Tab: Service Provider -----------------------------------------------

function SPConfigTab({
  sp,
  onSave,
  onClear,
}: {
  sp: SPConfig | null;
  onSave: (sp: SPConfig) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [entityId, setEntityId] = useState(sp?.entityId ?? "");
  const [acsUrl, setAcsUrl] = useState(sp?.acsUrl ?? "");
  const [loginUrl, setLoginUrl] = useState(sp?.loginUrl ?? "");
  const [encryptionCert, setEncryptionCert] = useState(sp?.encryptionCert ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEntityId(sp?.entityId ?? "");
    setAcsUrl(sp?.acsUrl ?? "");
    setLoginUrl(sp?.loginUrl ?? "");
    setEncryptionCert(sp?.encryptionCert ?? "");
  }, [sp]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ entityId, acsUrl, loginUrl: loginUrl || undefined, encryptionCert: encryptionCert.trim() || undefined });
    setSaving(false);
  }

  return (
    <div>
      <div className="section-title">Service Provider</div>
      <p className="section-desc">
        Enter the SAML SP details from your platform so the IdP knows where to
        send the SAML response.
      </p>

      {sp && (
        <div className="alert alert-success">
          <span>✅</span>
          <span>
            SP configured: <strong>{sp.entityId}</strong>
          </span>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">SP Entity ID *</label>
            <input
              className="form-input mono"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="https://your-app.example.com/saml/metadata"
              required
            />
            <p className="form-hint">
              The unique identifier of your service provider. Found in your
              platform's SAML settings.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">ACS URL (Assertion Consumer Service URL) *</label>
            <input
              className="form-input mono"
              value={acsUrl}
              onChange={(e) => setAcsUrl(e.target.value)}
              placeholder="https://your-app.example.com/saml/callback"
              required
            />
            <p className="form-hint">
              The URL where the IdP will POST the SAML response after login.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">SP Login URL (optional)</label>
            <input
              className="form-input mono"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
              placeholder="https://your-app.example.com/login"
            />
            <p className="form-hint">
              Your app's login page — used as a quick link in this dashboard.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">SP Encryption Certificate (optional)</label>
            <textarea
              className="form-input mono"
              value={encryptionCert}
              onChange={(e) => setEncryptionCert(e.target.value)}
              placeholder={"-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----\n\n(or paste the bare base64 without headers)"}
              rows={5}
              style={{ resize: "vertical", lineHeight: 1.5 }}
            />
            <p className="form-hint">
              Required when <strong>Encrypt assertion</strong> is on (IdP Details → Signing).
              This is the SP's public key certificate used to encrypt the AES session key.
              Often the same cert as the SP's signing certificate.
            </p>
          </div>

          <div className="divider" />

          <div className="row" style={{ justifyContent: "space-between" }}>
            {sp && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={onClear}
              >
                Clear SP config
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save SP configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Tab: Test Users -----------------------------------------------------

function newUser(): User {
  return {
    id: String(Date.now()),
    email: "",
    name: "",
    attributes: { email: "", firstName: "", lastName: "", role: "user" },
  };
}

function UserModal({
  user,
  onSave,
  onClose,
}: {
  user: User | null;
  onSave: (u: User) => void;
  onClose: () => void;
}) {
  const editing = user ?? newUser();
  const [email, setEmail] = useState(editing.email);
  const [name, setName] = useState(editing.name);
  const [attrs, setAttrs] = useState<[string, string][]>(
    Object.entries(editing.attributes)
  );

  function setAttrKey(i: number, k: string) {
    setAttrs((a) => a.map((e, j) => (j === i ? [k, e[1]] : e)));
  }
  function setAttrVal(i: number, v: string) {
    setAttrs((a) => a.map((e, j) => (j === i ? [e[0], v] : e)));
  }
  function removeAttr(i: number) {
    setAttrs((a) => a.filter((_, j) => j !== i));
  }
  function addAttr() {
    setAttrs((a) => [...a, ["", ""]]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const attributeMap: Record<string, string> = {};
    for (const [k, v] of attrs) {
      if (k.trim()) attributeMap[k.trim()] = v;
    }
    // ensure email attr is set
    if (email && !attributeMap.email) attributeMap.email = email;
    onSave({
      id: editing.id,
      email,
      name,
      attributes: attributeMap,
    });
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">
          <span>{user ? "Edit User" : "Add Test User"}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Display name *</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alice Example"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email (NameID) *</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setAttrs((a) =>
                  a.map(([k, v]) => (k === "email" ? [k, e.target.value] : [k, v]))
                );
              }}
              placeholder="alice@example.com"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: 10 }}>
              SAML Attributes
            </label>
            {attrs.map(([k, v], i) => (
              <div className="attr-row" key={i}>
                <input
                  className="form-input mono"
                  value={k}
                  onChange={(e) => setAttrKey(i, e.target.value)}
                  placeholder="attribute name"
                  style={{ flex: "0 0 160px" }}
                />
                <input
                  className="form-input"
                  value={v}
                  onChange={(e) => setAttrVal(i, e.target.value)}
                  placeholder="value"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeAttr(i)}
                  title="Remove"
                  style={{ flexShrink: 0, color: "#ef4444" }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addAttr}
              style={{ marginTop: 8 }}
            >
              + Add attribute
            </button>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {user ? "Save changes" : "Add user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UsersTab({
  users,
  onSave,
}: {
  users: User[];
  onSave: (users: User[]) => Promise<void>;
}) {
  const [modalUser, setModalUser] = useState<User | null | "new">(null);

  async function handleSaveUser(u: User) {
    const isNew = !users.find((x) => x.id === u.id);
    const updated = isNew ? [...users, u] : users.map((x) => (x.id === u.id ? u : x));
    await onSave(updated);
    setModalUser(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this test user?")) return;
    await onSave(users.filter((u) => u.id !== id));
  }

  return (
    <div>
      <div className="section-title">Test Users</div>
      <p className="section-desc">
        These accounts appear on the login page when your SP initiates a SAML
        flow. Click a user to sign in as them.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          className="btn btn-primary"
          onClick={() => setModalUser("new")}
        >
          + Add user
        </button>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div>No test users yet. Add one to get started.</div>
        </div>
      ) : (
        <div className="user-list">
          {users.map((u) => (
            <div className="user-row" key={u.id}>
              <div className="user-avatar">{u.name[0] ?? "?"}</div>
              <div className="user-meta">
                <div className="user-name-text">{u.name}</div>
                <div className="user-email-text">{u.email}</div>
                <div className="user-attrs">
                  {Object.entries(u.attributes)
                    .filter(([k]) => k !== "email")
                    .map(([k, v]) => (
                      <span className="attr-pill" key={k}>
                        {k}: {v}
                      </span>
                    ))}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setModalUser(u)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(u.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalUser !== null && (
        <UserModal
          user={modalUser === "new" ? null : modalUser}
          onSave={handleSaveUser}
          onClose={() => setModalUser(null)}
        />
      )}
    </div>
  );
}

// ---- Main App ------------------------------------------------------------

type Tab = "idp" | "sp" | "users";

export default function App() {
  const [tab, setTab] = useState<Tab>("idp");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copiedKey, copy } = useCopy();
  const { toast, show: showToast } = useToast();

  async function loadConfig() {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error(await res.text());
      setConfig(await res.json());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  async function saveSP(sp: SPConfig) {
    const res = await fetch("/api/sp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sp),
    });
    if (!res.ok) throw new Error(await res.text());
    await loadConfig();
    showToast("✅ SP configuration saved");
  }

  async function clearSP() {
    await fetch("/api/sp", { method: "DELETE" });
    await loadConfig();
    showToast("SP configuration cleared");
  }

  async function saveSigning(signing: SigningOptions) {
    const res = await fetch("/api/signing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signing),
    });
    if (!res.ok) throw new Error(await res.text());
    await loadConfig();
  }

  async function saveUsers(users: User[]) {
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(users),
    });
    if (!res.ok) throw new Error(await res.text());
    await loadConfig();
    showToast("✅ Users saved");
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 12,
          color: "#ef4444",
        }}
      >
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontWeight: 600 }}>Failed to load configuration</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{error}</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 12,
          color: "#64748b",
        }}
      >
        <div style={{ fontSize: 32 }}>🔐</div>
        <div style={{ fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <header className="header">
          <div className="header-brand">
            <div className="header-icon">🔐</div>
            <div>
              <div className="header-title">Local SAML IdP</div>
              <div className="header-subtitle">Development Identity Provider</div>
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            {config.sp?.loginUrl && (
              <a
                href={config.sp.loginUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                Open SP →
              </a>
            )}
            <div className="header-badge">
              <div className="status-dot" />
              localhost:{3100}
            </div>
          </div>
        </header>

        <nav className="tabs">
          {(
            [
              { id: "idp", label: "IdP Details", icon: "🪪" },
              { id: "sp", label: "Service Provider", icon: "🔗" },
              { id: "users", label: "Test Users", icon: "👤", count: config.users.length },
            ] as { id: Tab; label: string; icon: string; count?: number }[]
          ).map(({ id, label, icon, count }) => (
            <button
              key={id}
              className={`tab-btn ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              {icon} {label}
              {count !== undefined && (
                <span className="tab-badge">{count}</span>
              )}
            </button>
          ))}
        </nav>

        <main className="main">
          {tab === "idp" && (
            <IdPDetailsTab
              idp={config.idp}
              signing={config.signing}
              copiedKey={copiedKey}
              onCopy={copy}
              onSigningChange={saveSigning}
            />
          )}
          {tab === "sp" && (
            <SPConfigTab
              sp={config.sp}
              onSave={saveSP}
              onClear={clearSP}
            />
          )}
          {tab === "users" && (
            <UsersTab
              users={config.users}
              onSave={saveUsers}
            />
          )}
        </main>
      </div>

      {toast && (
        <div className="toast">
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}
