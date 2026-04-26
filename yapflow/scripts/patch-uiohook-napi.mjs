#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const target = path.join(
  projectRoot,
  'node_modules',
  'uiohook-napi',
  'src',
  'lib',
  'uiohook_worker.c'
)

const marker = 'hook_control_locked_by_worker'

if (!existsSync(target)) {
  console.warn(`[patch-uiohook-napi] ${target} not found; run npm install first.`)
  process.exit(0)
}

let source = readFileSync(target, 'utf8')
if (source.includes(marker)) {
  console.log('[patch-uiohook-napi] uiohook_worker.c already patched')
  process.exit(0)
}

const replacements = [
  [
    'static uv_cond_t hook_control_cond;\n',
    `static uv_cond_t hook_control_cond;\n\n// libuiohook calls EVENT_HOOK_DISABLED on the hook thread and locks\n// hook_control_mutex there. Startup failures do not emit that event, so the\n// thread must not blindly unlock a mutex it does not own. On macOS 26 that\n// owner mismatch can surface later as an abort inside uv_mutex_destroy().\nstatic bool ${marker} = false;\n`
  ],
  [
    `  // Set the hook status.\n  hook_thread_status = hook_run();\n\n  // Make sure we signal that we have passed any exception throwing code for\n  // the waiting hook_enable().\n  uv_cond_signal(&hook_control_cond);\n  uv_mutex_unlock(&hook_control_mutex);\n`,
    `  // Set the hook status.\n  hook_thread_status = hook_run();\n\n  // Make sure we signal that we have passed any exception throwing code for\n  // the waiting hook_enable(). EVENT_HOOK_DISABLED locks hook_control_mutex\n  // on this same thread during a normal stop; startup failures skip that event,\n  // so lock/signaling must be balanced here before hook_enable() cleans up.\n  if (${marker}) {\n    uv_cond_signal(&hook_control_cond);\n    ${marker} = false;\n    uv_mutex_unlock(&hook_control_mutex);\n  }\n  else {\n    uv_mutex_lock(&hook_control_mutex);\n    uv_cond_signal(&hook_control_cond);\n    uv_mutex_unlock(&hook_control_mutex);\n  }\n`
  ],
  [
    `  case EVENT_HOOK_DISABLED:\n    // Lock the control mutex until we exit.\n    uv_mutex_lock(&hook_control_mutex);\n\n    // Unlock the running mutex so we know if the hook is disabled.\n    uv_mutex_unlock(&hook_running_mutex);\n    break;\n`,
    `  case EVENT_HOOK_DISABLED:\n    // Lock the control mutex until hook_thread_proc exits.\n    uv_mutex_lock(&hook_control_mutex);\n    ${marker} = true;\n\n    // Unlock the running mutex so we know if the hook is disabled.\n    uv_mutex_unlock(&hook_running_mutex);\n    break;\n`
  ],
  [
    `  // Create event handles for the thread hook.\n  uv_mutex_init(&hook_running_mutex);\n  uv_mutex_init(&hook_control_mutex);\n  uv_cond_init(&hook_control_cond);\n`,
    `  // Create event handles for the thread hook.\n  ${marker} = false;\n  uv_mutex_init(&hook_running_mutex);\n  uv_mutex_init(&hook_control_mutex);\n  uv_cond_init(&hook_control_cond);\n`
  ]
]

for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    console.error('[patch-uiohook-napi] expected source block not found; refusing partial patch')
    process.exit(1)
  }
  source = source.replace(from, to)
}

writeFileSync(target, source, 'utf8')
console.log('[patch-uiohook-napi] patched uiohook_worker.c')
