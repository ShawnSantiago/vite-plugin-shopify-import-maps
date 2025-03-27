export interface BareModules {
  defaultGroup: string
  groups: Record<string, string | RegExp | Array<string | RegExp>>
  files?: Record<string, string>
}

export interface PluginOptions {
  snippetFile: string
  themeRoot: string
  bareModules: boolean | BareModules
  modulePreload: boolean
}
