// Compiles the C# bridge scripts (src-tauri/src/bridge) against an installed Unity Editor's
// assemblies, without opening Unity. Needs the .NET SDK.
//   npm run check:bridge                 uses the newest editor found via Unity Hub
//   UNITY_EDITOR=<path to Unity.exe> npm run check:bridge
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bridge = join(root, 'src-tauri', 'src', 'bridge')

function editors() {
  const roots = ['C:\\Program Files\\Unity\\Hub\\Editor']
  try {
    const custom = JSON.parse(
      readFileSync(join(process.env.APPDATA ?? '', 'UnityHub', 'secondaryInstallPath.json'), 'utf8'),
    )
    if (custom) roots.push(custom)
  } catch {
    /* no custom install location */
  }
  return roots
    .filter(existsSync)
    .flatMap((directory) => readdirSync(directory).map((version) => join(directory, version, 'Editor', 'Unity.exe')))
    .filter(existsSync)
    .sort()
    .reverse()
}

const editor = process.env.UNITY_EDITOR ?? editors()[0]
if (!editor) {
  console.error('No Unity Editor found. Set UNITY_EDITOR to the path of Unity.exe.')
  process.exit(1)
}
const managed = join(dirname(editor), 'Data', 'Managed', 'UnityEngine')
console.log(`Checking bridge scripts against ${editor}`)

const work = join(tmpdir(), 'unitypackhub-bridge-check')
mkdirSync(work, { recursive: true })
writeFileSync(
  join(work, 'global.json'),
  JSON.stringify({ sdk: { rollForward: 'latestMajor', allowPrerelease: false } }),
)
writeFileSync(
  join(work, 'BridgeCheck.csproj'),
  `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netstandard2.1</TargetFramework>
    <LangVersion>9.0</LangVersion>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
    <!-- CS0649: fields filled by Unity's JsonUtility. -->
    <NoWarn>CS0618;CS0414;CS0649</NoWarn>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="${join(bridge, '*.cs')}" />
    <!-- The monolithic UnityEditor.dll duplicates the editor modules; reference the modules only. -->
    <Reference Include="${join(managed, '*.dll')}" Exclude="${join(managed, 'UnityEditor.dll')}" Private="false" />
  </ItemGroup>
</Project>
`,
)

try {
  execFileSync('dotnet', ['build', '-nologo', '-v', 'q', '-clp:ErrorsOnly'], { cwd: work, stdio: 'inherit' })
  console.log('Bridge scripts compile.')
} catch {
  process.exit(1)
}
