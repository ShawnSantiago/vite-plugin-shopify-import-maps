import type { Plugin, Rollup } from 'vite'
import type { BareModules, PluginOptions } from './types'
import path from 'node:path'
import { parse } from 'es-module-lexer'
import MagicString from 'magic-string'

/**
 * Use bare specifier in import module statements defined in bareModules option groups or files.
 */
export default function bareModules(options: PluginOptions): Plugin {
  const moduleSpecifierMap = new Map<string, string>()

  return {
    name: 'vite-plugin-shopify-import-maps:bare-modules',
    api: {
      get moduleSpecifierMap() {
        return moduleSpecifierMap
      }
    },
    renderChunk(_, chunk) {
      const bareModules = options.bareModules as BareModules & { files?: Record<string, string> }
      const groups = bareModules.groups || {}
      const files = bareModules.files || {}
      const moduleId = chunk.facadeModuleId ?? chunk.moduleIds.at(-1)

      let specifierKey: string | undefined

      // Handle exact file mappings
      for (const [specifier, filename] of Object.entries(files)) {
        if (chunk.fileName === path.basename(filename)) {
          specifierKey = specifier
          break
        }
      }

      // Fallback to group matching
      if (!specifierKey && moduleId !== undefined) {
        for (const group in groups) {
          const value = groups[group]

          if (Array.isArray(value)) {
            const match = value.some(v =>
              v instanceof RegExp ? v.test(moduleId) : moduleId.includes(v)
            )
            if (match) {
              specifierKey = buildSpecifierKey(chunk.name, group)
              break
            }
          } else if (
            (typeof value === 'string' && moduleId.includes(value)) ||
            (value instanceof RegExp && value.test(moduleId))
          ) {
            specifierKey = buildSpecifierKey(chunk.name, group)
            break
          }
        }
      }

      if (!specifierKey) {
        specifierKey = buildSpecifierKey(chunk.name, bareModules.defaultGroup)
      }

      moduleSpecifierMap.set(chunk.fileName, specifierKey)
    },
    generateBundle(options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName]

        if (chunk.type === 'chunk') {
          const code = new MagicString(chunk.code)
          const [imports] = parse(chunk.code)

          for (let { s, e, d, n } of imports) {
            const name = path.parse(n ?? '').base
            const specifier = moduleSpecifierMap.get(name)

            if (specifier) {
              // Keep quotes for dynamic import.
              if (d > -1) {
                s += 1
                e -= 1
              }
              code.overwrite(s, e, specifier)
            }
          }

          if (code.hasChanged()) {
            chunk.code = code.toString()

            if (options.sourcemap !== false) {
              chunk.map = code.generateMap({ hires: true }) as Rollup.SourceMap
            }
          }
        }
      }
    }
  }
}

function buildSpecifierKey(name: string, group: string): string {
  return `${group}/${name}`
}
