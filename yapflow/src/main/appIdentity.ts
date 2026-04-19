import { mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export type AppVariant = 'production' | 'test' | 'development'

function resolveVariant(): AppVariant {
  const explicit = process.env.YAPFLOW_RUNTIME_PROFILE
  if (explicit === 'production' || explicit === 'test' || explicit === 'development') {
    return explicit
  }

  if (!app.isPackaged) {
    return 'development'
  }

  return /test/i.test(app.getName()) ? 'test' : 'production'
}

function defaultDisplayName(variant: AppVariant): string {
  switch (variant) {
    case 'development':
      return 'YapFlow Dev'
    case 'test':
      return 'YapFlow Test'
    default:
      return 'YapFlow'
  }
}

export function configureAppIdentity(): { variant: AppVariant; displayName: string } {
  const variant = resolveVariant()
  const displayName = process.env.YAPFLOW_DISPLAY_NAME || defaultDisplayName(variant)

  if (app.getName() !== displayName) {
    app.setName(displayName)
  }

  // Keep non-production builds isolated so settings, API keys, and history do not
  // collide with the installed production app.
  if (variant !== 'production') {
    const userDataPath = join(app.getPath('appData'), displayName)
    const sessionDataPath = join(userDataPath, 'session')

    mkdirSync(userDataPath, { recursive: true })
    mkdirSync(sessionDataPath, { recursive: true })

    app.setPath('userData', userDataPath)
    app.setPath('sessionData', sessionDataPath)
  }

  return { variant, displayName }
}
