// Enforces the layering described in CODING_STANDARDS.md. A failing test here means a module
// reaches into a layer it must not know about; move the call instead of widening the rules.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src')

type Layer = 'platform' | 'data' | 'domain' | 'types' | 'services' | 'stores' | 'composables' | 'ui' | 'i18n' | 'view' | 'other'

function layerOf(file: string): Layer {
  const top = relative(SRC, file).split(/[\\/]/)[0] ?? ''
  if (['components', 'pages', 'layouts'].includes(top)) return 'view'
  if (['platform', 'data', 'domain', 'types', 'services', 'stores', 'composables', 'ui', 'i18n'].includes(top)) return top as Layer
  return 'other'
}

/** Internal layers each layer may import at runtime (`import type` is always allowed). */
const ALLOWED: Record<Layer, Layer[]> = {
  types: ['types'],
  domain: ['domain', 'types'],
  platform: ['platform', 'types'],
  data: ['data', 'platform', 'domain', 'types'],
  services: ['services', 'data', 'platform', 'domain', 'types'],
  i18n: ['i18n'],
  ui: ['ui'],
  stores: ['stores', 'services', 'domain', 'types', 'i18n', 'ui'],
  composables: ['composables', 'stores', 'services', 'domain', 'types', 'i18n', 'ui'],
  view: ['view', 'composables', 'stores', 'services', 'domain', 'types', 'i18n', 'ui', 'other'],
  other: ['other', 'domain', 'types', 'i18n', 'view'],
}

/** External packages that only one layer may import. */
const PACKAGE_OWNERS: Array<[RegExp, Layer]> = [
  [/^@tauri-apps\//, 'platform'],
  [/^dexie$/, 'data'],
  [/^quasar$/, 'ui'],
]

/** Layers that must stay framework-free. */
const NO_VUE: Layer[] = ['types', 'domain', 'platform', 'data', 'services']

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|vue)$/.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}

function runtimeImports(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  const imports: string[] = []
  for (const match of text.matchAll(/^\s*import\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
    if (!match[1]) imports.push(match[2] ?? '')
  }
  for (const match of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) imports.push(match[1] ?? '')
  return imports
}

describe('architecture', () => {
  const violations: string[] = []
  for (const file of sourceFiles(SRC)) {
    const layer = layerOf(file)
    const name = relative(SRC, file)
    for (const specifier of runtimeImports(file)) {
      if (specifier.startsWith('.')) {
        const target = layerOf(resolve(dirname(file), specifier))
        if (!ALLOWED[layer].includes(target)) violations.push(`${name} (${layer}) imports ${specifier} (${target})`)
        continue
      }
      const owner = PACKAGE_OWNERS.find(([pattern]) => pattern.test(specifier))?.[1]
      if (owner && owner !== layer) violations.push(`${name} (${layer}) imports ${specifier}, reserved for ${owner}`)
      if (NO_VUE.includes(layer) && /^(vue|pinia)$/.test(specifier)) violations.push(`${name} (${layer}) must not depend on ${specifier}`)
    }
  }

  it('keeps every import inside the allowed layers', () => {
    expect(violations).toEqual([])
  })
})
