#!/usr/bin/env node
/**
 * create-self-signed-cert.mjs — one-time setup for local code signing.
 *
 * Creates or repairs a self-signed code-signing certificate named
 * "YapFlow Local Signer" in the login keychain. Every future
 * `npm run package:mac` signs the whole app with this same certificate,
 * giving macOS a stable signing requirement across private-tester rebuilds.
 *
 * Usage:
 *   node scripts/create-self-signed-cert.mjs
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const IDENTITY_NAME = 'YapFlow Local Signer'
const LOGIN_KEYCHAIN = `${process.env.HOME}/Library/Keychains/login.keychain-db`
const P12_PASS = 'yapflow-local-signer'

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...opts })
}

function runAllowFail(cmd, args) {
  try {
    return { ok: true, out: run(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }) }
  } catch (err) {
    return { ok: false, out: (err.stdout || '') + (err.stderr || '') }
  }
}

function identityLine(output) {
  return output.split('\n').find((line) => line.includes(`"${IDENTITY_NAME}"`)) || ''
}

function isValidIdentity(output) {
  const line = identityLine(output)
  return Boolean(line && !line.includes('CSSMERR'))
}

function trustCertificate(crtPath) {
  console.log('[create-self-signed-cert] marking trusted for code signing (may prompt for password)')
  const trust = runAllowFail('security', [
    'add-trusted-cert',
    '-r', 'trustRoot',
    '-p', 'codeSign',
    '-k', LOGIN_KEYCHAIN,
    crtPath
  ])

  if (!trust.ok) {
    console.warn('[create-self-signed-cert] trust step failed:')
    console.warn(trust.out)
  }
}

function verifyIdentity() {
  const verify = run('security', ['find-identity', '-v', '-p', 'codesigning', LOGIN_KEYCHAIN])
  if (!isValidIdentity(verify)) {
    console.error('[create-self-signed-cert] ERROR: identity is still not valid for code signing:')
    console.error(verify)
    process.exit(1)
  }

  console.log('[create-self-signed-cert] done. find-identity output:')
  console.log(identityLine(verify))
}

const work = mkdtempSync(join(tmpdir(), 'yapflow-cert-'))
const keyPath = join(work, 'key.pem')
const crtPath = join(work, 'cert.crt')
const p12Path = join(work, 'cert.p12')
const cfgPath = join(work, 'openssl.cnf')

try {
  const existing = runAllowFail('security', ['find-identity', '-v', '-p', 'codesigning', LOGIN_KEYCHAIN])
  if (existing.ok && existing.out.includes(IDENTITY_NAME)) {
    if (isValidIdentity(existing.out)) {
      console.log(`[create-self-signed-cert] "${IDENTITY_NAME}" already exists and is valid.`)
      console.log(identityLine(existing.out))
      process.exit(0)
    }

    console.log(`[create-self-signed-cert] "${IDENTITY_NAME}" exists but is not trusted; repairing trust.`)
    const cert = runAllowFail('security', [
      'find-certificate',
      '-c', IDENTITY_NAME,
      '-p',
      LOGIN_KEYCHAIN
    ])
    if (!cert.ok || !cert.out.trim()) {
      console.error('[create-self-signed-cert] could not export existing certificate for trust repair:')
      console.error(cert.out)
      process.exit(1)
    }

    writeFileSync(crtPath, cert.out)
    trustCertificate(crtPath)
    verifyIdentity()
    process.exit(0)
  }

  console.log(`[create-self-signed-cert] creating "${IDENTITY_NAME}" (10-year validity)`)

  const opensslConfig = `
[ req ]
distinguished_name = req_dn
prompt = no
x509_extensions = v3_ext

[ req_dn ]
CN = ${IDENTITY_NAME}
O = YapFlow Local
OU = YAPFLOWLCL
C = US

[ v3_ext ]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
subjectKeyIdentifier = hash
`

  writeFileSync(cfgPath, opensslConfig)

  run('openssl', [
    'req', '-x509',
    '-newkey', 'rsa:2048',
    '-keyout', keyPath,
    '-out', crtPath,
    '-days', '3650',
    '-nodes',
    '-config', cfgPath
  ], { stdio: ['ignore', 'pipe', 'pipe'] })

  const pkcs12Common = [
    '-out', p12Path,
    '-inkey', keyPath,
    '-in', crtPath,
    '-passout', `pass:${P12_PASS}`,
    '-name', IDENTITY_NAME,
    '-certpbe', 'PBE-SHA1-3DES',
    '-keypbe', 'PBE-SHA1-3DES',
    '-macalg', 'SHA1'
  ]

  const withLegacy = runAllowFail('openssl', ['pkcs12', '-export', '-legacy', ...pkcs12Common])
  if (!withLegacy.ok) {
    if (/unknown option|unrecognized option|invalid option/i.test(withLegacy.out)) {
      const withoutLegacy = runAllowFail('openssl', ['pkcs12', '-export', ...pkcs12Common])
      if (!withoutLegacy.ok) {
        console.error('[create-self-signed-cert] openssl pkcs12 -export failed:')
        console.error(withoutLegacy.out)
        throw new Error('openssl pkcs12 export failed')
      }
    } else {
      console.error('[create-self-signed-cert] openssl pkcs12 -export failed:')
      console.error(withLegacy.out)
      throw new Error('openssl pkcs12 export failed')
    }
  }

  console.log('[create-self-signed-cert] importing into login keychain')
  run('security', [
    'import', p12Path,
    '-k', LOGIN_KEYCHAIN,
    '-P', P12_PASS,
    '-T', '/usr/bin/codesign',
    '-T', '/usr/bin/security',
    '-T', '/usr/bin/productsign'
  ])

  runAllowFail('security', [
    'set-key-partition-list',
    '-S', 'apple-tool:,apple:,codesign:',
    '-s',
    '-k', '',
    LOGIN_KEYCHAIN
  ])

  trustCertificate(crtPath)
  verifyIdentity()
  console.log('\nNext: run `npm run package:mac`, then `bash scripts/install-yapflow.sh`.')
} finally {
  rmSync(work, { recursive: true, force: true })
}
