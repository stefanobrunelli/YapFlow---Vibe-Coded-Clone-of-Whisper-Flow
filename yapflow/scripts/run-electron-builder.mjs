import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const packageJsonPath = path.join(projectRoot, 'package.json')
const electronBuilderCli = path.join(
  projectRoot,
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js'
)

const argv = process.argv.slice(2)
const passthroughIndex = argv.indexOf('--')
const optionArgs = passthroughIndex === -1 ? argv : argv.slice(0, passthroughIndex)
const builderArgs = passthroughIndex === -1 ? [] : argv.slice(passthroughIndex + 1)

function getRequiredOption(name) {
  const prefix = `${name}=`
  const value = optionArgs.find((arg) => arg.startsWith(prefix))
  if (!value) {
    throw new Error(`Missing required option: ${name}`)
  }
  return value.slice(prefix.length)
}

function getOption(name, fallback) {
  const prefix = `${name}=`
  const value = optionArgs.find((arg) => arg.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

async function main() {
  const originalPackageJson = await readFile(packageJsonPath, 'utf8')
  const finalOutDir = path.resolve(projectRoot, getRequiredOption('--out-dir'))
  const signIdentity = getOption(
    '--sign-identity',
    process.env.YAPFLOW_SIGN_IDENTITY || process.env.CSC_NAME || 'YapFlow Local Signer'
  )

  // Build in /tmp/ because the iCloud File Provider daemon (fpfs#P) continuously
  // re-applies com.apple.FinderInfo xattrs to anything inside ~/Documents/. That
  // xattr trips codesign with "resource fork, Finder information, or similar
  // detritus not allowed", and no amount of xattr -cr beats the daemon's ~2s
  // refresh window. /tmp is outside the file-provider root, so xattrs stay
  // stripped through the signing pass.
  const tmpBuildRoot = await mkdtemp(path.join(os.tmpdir(), 'yapflow-build-'))

  const env = {
    ...process.env,
    YAPFLOW_OUTPUT_DIR: tmpBuildRoot,
    YAPFLOW_APP_ID: getRequiredOption('--app-id'),
    YAPFLOW_PRODUCT_NAME: getRequiredOption('--product-name'),
    YAPFLOW_SIGN_IDENTITY: signIdentity,
    CSC_NAME: signIdentity
  }

  delete env.ELECTRON_RUN_AS_NODE
  if (signIdentity === '-') {
    delete env.CSC_NAME
  }

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [electronBuilderCli, ...builderArgs], {
        cwd: projectRoot,
        env,
        stdio: 'inherit'
      })

      child.on('error', reject)
      child.on('exit', (code, signal) => {
        if (signal) {
          reject(new Error(`electron-builder exited via signal ${signal}`))
          return
        }
        if (code !== 0) {
          reject(new Error(`electron-builder exited with code ${code}`))
          return
        }
        resolve()
      })
    })

    // Copy distributable artifacts back to the user's requested outDir.
    // We skip the raw mac-arm64/YapFlow.app directory — re-copying a signed
    // .app into ~/Documents lets the file-provider daemon smear FinderInfo
    // back over it and break the signature for direct-launch use. Anyone
    // wanting the .app should extract from the DMG or ZIP (both ship signed
    // copies frozen at build time).
    const wantedExts = ['.dmg', '.zip', '.blockmap', '.yml', '.yaml']
    await mkdir(finalOutDir, { recursive: true })
    const entries = await readdir(tmpBuildRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase()
      if (!wantedExts.includes(ext)) continue
      const src = path.join(tmpBuildRoot, entry.name)
      const dst = path.join(finalOutDir, entry.name)
      await rm(dst, { force: true })
      await cp(src, dst)
      console.log(`[run-electron-builder] copied ${entry.name} -> ${finalOutDir}`)
    }
  } finally {
    const currentPackageJson = await readFile(packageJsonPath, 'utf8').catch(() => '')
    if (currentPackageJson !== originalPackageJson) {
      await writeFile(packageJsonPath, originalPackageJson, 'utf8')
    }
    await rm(tmpBuildRoot, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
