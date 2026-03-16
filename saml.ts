import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { inflateRaw } from "zlib";
import { promisify } from "util";
import { randomUUID } from "crypto";

const inflateRawAsync = promisify(inflateRaw);

export interface SAMLKeys {
  privateKey: string;
  certificate: string;
  certificateData: string; // PEM body only, no headers, no newlines
}

export function generateKeys(): SAMLKeys {
  console.log("Generating RSA 2048 key pair (this takes a few seconds)...");
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

  const attrs = [{ name: "commonName", value: "Local SAML IdP" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certificate = forge.pki.certificateToPem(cert);
  const certificateData = certificate
    .replace(/-----BEGIN CERTIFICATE-----\r?\n?/, "")
    .replace(/\r?\n?-----END CERTIFICATE-----\r?\n?/, "")
    .replace(/\r?\n/g, "");

  return {
    privateKey: forge.pki.privateKeyToPem(keys.privateKey),
    certificate,
    certificateData,
  };
}

export interface ParsedAuthnRequest {
  id: string;
  issuer: string;
  acsUrl?: string;
  destination?: string;
}

export async function parseAuthnRequest(
  samlRequest: string
): Promise<ParsedAuthnRequest> {
  const decoded = Buffer.from(samlRequest, "base64");
  const xml = (await inflateRawAsync(decoded)).toString();

  const idMatch = xml.match(/\bID="([^"]+)"/);
  const issuerMatch = xml.match(
    /<(?:saml:|saml2:)?Issuer[^>]*>([^<]+)<\/(?:saml:|saml2:)?Issuer>/
  );
  const acsMatch = xml.match(/AssertionConsumerServiceURL="([^"]+)"/);
  const destMatch = xml.match(/Destination="([^"]+)"/);

  return {
    id: idMatch?.[1] ?? "",
    issuer: issuerMatch?.[1]?.trim() ?? "",
    acsUrl: acsMatch?.[1],
    destination: destMatch?.[1],
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function signXmlElement(
  xml: string,
  elementId: string,
  privateKey: string,
  certificateData: string
): string {
  const sig = new SignedXml();
  (sig as any).signingKey = privateKey;
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  (sig as any).keyInfoProvider = {
    getKeyInfo: (_key: unknown, prefix: string) =>
      `<${prefix}:X509Data><${prefix}:X509Certificate>${certificateData}</${prefix}:X509Certificate></${prefix}:X509Data>`,
    getKey: () => Buffer.from(privateKey),
  };
  sig.addReference(
    `//*[@ID="${elementId}"]`,
    [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    "http://www.w3.org/2001/04/xmlenc#sha256"
  );

  // Compute the signature (digest is computed over the element sans any
  // Signature children, so insertion position doesn't affect validity).
  sig.computeSignature(xml, { prefix: "ds" });

  // SAML 2.0 schema requires <ds:Signature> immediately after <saml:Issuer>.
  // xml-crypto appends to the end by default, which fails XSD validation.
  // Extract the computed signature element and splice it into the right place.
  const signatureXml = (sig as any).signatureXml as string;
  const insertAfter = "</saml:Issuer>";
  const insertIdx = xml.indexOf(insertAfter);
  if (insertIdx === -1) {
    // Fallback for elements without an Issuer (shouldn't happen in our case)
    return sig.getSignedXml();
  }
  return (
    xml.slice(0, insertIdx + insertAfter.length) +
    signatureXml +
    xml.slice(insertIdx + insertAfter.length)
  );
}

function normalizePemCert(cert: string): string {
  cert = cert.trim().replace(/\r\n/g, "\n");
  if (!cert.startsWith("-----BEGIN")) {
    // Bare base64 — wrap in PEM headers
    cert = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
  }
  return cert;
}

function encryptSAMLAssertion(assertionXml: string, spCertPem: string): string {
  const cert = forge.pki.certificateFromPem(normalizePemCert(spCertPem));
  const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;

  // Random AES-256 key and 16-byte IV
  const aesKey = forge.random.getBytesSync(32);
  const iv = forge.random.getBytesSync(16);

  // Encrypt assertion with AES-256-CBC; prepend IV to ciphertext (XML Enc spec)
  const cipher = forge.cipher.createCipher("AES-CBC", aesKey);
  cipher.start({ iv: forge.util.createBuffer(iv) });
  cipher.update(forge.util.createBuffer(assertionXml, "utf8"));
  cipher.finish();
  const encryptedDataB64 = forge.util.encode64(iv + cipher.output.getBytes());

  // Encrypt AES key with SP public key using RSA-OAEP
  const encryptedKeyB64 = forge.util.encode64(
    publicKey.encrypt(aesKey, "RSA-OAEP", {
      md: forge.md.sha1.create(),
      mgf1: { md: forge.md.sha1.create() },
    })
  );

  return (
    `<saml:EncryptedAssertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
    `<xenc:EncryptedData xmlns:xenc="http://www.w3.org/2001/04/xmlenc#" Type="http://www.w3.org/2001/04/xmlenc#Element">` +
    `<xenc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes256-cbc"/>` +
    `<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    `<xenc:EncryptedKey>` +
    `<xenc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p"/>` +
    `<xenc:CipherData><xenc:CipherValue>${encryptedKeyB64}</xenc:CipherValue></xenc:CipherData>` +
    `</xenc:EncryptedKey>` +
    `</ds:KeyInfo>` +
    `<xenc:CipherData><xenc:CipherValue>${encryptedDataB64}</xenc:CipherValue></xenc:CipherData>` +
    `</xenc:EncryptedData>` +
    `</saml:EncryptedAssertion>`
  );
}

export function generateSAMLResponse(params: {
  inResponseTo: string;
  recipient: string;
  audience: string;
  issuer: string;
  nameId: string;
  attributes: Record<string, string>;
  privateKey: string;
  certificateData: string;
  signAssertion: boolean;
  signResponse: boolean;
  encryptAssertion: boolean;
  spEncryptionCert?: string;
}): string {
  const {
    inResponseTo,
    recipient,
    audience,
    issuer,
    nameId,
    attributes,
    privateKey,
    certificateData,
    signAssertion,
    signResponse,
    encryptAssertion,
    spEncryptionCert,
  } = params;

  const responseId = "_" + randomUUID().replace(/-/g, "");
  const assertionId = "_" + randomUUID().replace(/-/g, "");
  const now = new Date();
  const notOnOrAfter = new Date(now.getTime() + 5 * 60 * 1000);
  const notBefore = new Date(now.getTime() - 60 * 1000);
  const sessionIndex = "_" + randomUUID().replace(/-/g, "");

  const nowStr = now.toISOString();
  const notOnOrAfterStr = notOnOrAfter.toISOString();
  const notBeforeStr = notBefore.toISOString();

  const attrStatements = Object.entries(attributes)
    .map(
      ([name, value]) =>
        `      <saml:Attribute Name="${escapeXml(name)}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">` +
        `<saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">${escapeXml(value)}</saml:AttributeValue>` +
        `</saml:Attribute>`
    )
    .join("");

  // Build assertion as standalone XML (namespaces declared here so exc-c14n is stable when embedded)
  const assertionXml =
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"` +
    ` ID="${assertionId}" Version="2.0" IssueInstant="${nowStr}">` +
    `<saml:Issuer>${escapeXml(issuer)}</saml:Issuer>` +
    `<saml:Subject>` +
    `<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${escapeXml(nameId)}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
    `<saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfterStr}" Recipient="${escapeXml(recipient)}" InResponseTo="${escapeXml(inResponseTo)}"/>` +
    `</saml:SubjectConfirmation>` +
    `</saml:Subject>` +
    `<saml:Conditions NotBefore="${notBeforeStr}" NotOnOrAfter="${notOnOrAfterStr}">` +
    `<saml:AudienceRestriction><saml:Audience>${escapeXml(audience)}</saml:Audience></saml:AudienceRestriction>` +
    `</saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${nowStr}" SessionIndex="${sessionIndex}">` +
    `<saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext>` +
    `</saml:AuthnStatement>` +
    `<saml:AttributeStatement>${attrStatements}</saml:AttributeStatement>` +
    `</saml:Assertion>`;

  // Optionally sign the assertion
  const signedAssertion = signAssertion
    ? signXmlElement(assertionXml, assertionId, privateKey, certificateData)
    : assertionXml;

  // Optionally encrypt the (possibly signed) assertion
  const assertionPart =
    encryptAssertion && spEncryptionCert
      ? encryptSAMLAssertion(signedAssertion, spEncryptionCert)
      : signedAssertion;

  // Build the response envelope
  const responseXml =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"` +
    ` ID="${responseId}" Version="2.0" IssueInstant="${nowStr}"` +
    ` Destination="${escapeXml(recipient)}" InResponseTo="${escapeXml(inResponseTo)}">` +
    `<saml:Issuer>${escapeXml(issuer)}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    assertionPart +
    `</samlp:Response>`;

  // Optionally sign the response envelope
  const finalXml = signResponse
    ? signXmlElement(responseXml, responseId, privateKey, certificateData)
    : responseXml;

  const response = `<?xml version="1.0" encoding="UTF-8"?>` + finalXml;

  return Buffer.from(response).toString("base64");
}

export function generateIdPMetadata(params: {
  entityId: string;
  ssoUrl: string;
  certificateData: string;
}): string {
  const { entityId, ssoUrl, certificateData } = params;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${escapeXml(entityId)}">` +
    `<md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">` +
    `<md:KeyDescriptor use="signing">` +
    `<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    `<ds:X509Data><ds:X509Certificate>${certificateData}</ds:X509Certificate></ds:X509Data>` +
    `</ds:KeyInfo>` +
    `</md:KeyDescriptor>` +
    `<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${escapeXml(ssoUrl)}"/>` +
    `<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${escapeXml(ssoUrl)}"/>` +
    `</md:IDPSSODescriptor>` +
    `</md:EntityDescriptor>`
  );
}
