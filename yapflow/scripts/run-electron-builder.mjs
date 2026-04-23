import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
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

async function main() {
  const originalPackageJson = await readFile(packageJsonPath, 'utf8')
  const env = {
    ...process.env,
    YAPFLOW_OUTPUT_DIR: getRequiredOption('--out-dir'),
    YAPFLOW_APP_ID: getRequiredOption('--app-id'),
    YAPFLOW_PRODUCT_NAME: getRequiredOption('--product-name')
  }

  delete env.ELECTRON_RUN_AS_NODE

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
  } finally {
    const currentPackageJson = await readFile(packageJsonPath, 'utf8').catch(() => '')
    if (currentPackageJson !== originalPackageJson) {
      await writeFile(packageJsonPath, originalPackageJson, 'utf8')
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
