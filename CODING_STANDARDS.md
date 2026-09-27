# UnityPackHub 编码规范

> Vue 3 + TypeScript + Quasar + Tauri 桌面应用
>
> 参考来源：[Microsoft C# Coding Conventions](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions) · [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) · [Vue 官方风格指南](https://vuejs.org/style-guide/) · [Tauri Security](https://tauri.app/security/)

---

## 1 目录结构与分层

```
src/
├── pages/ components/   # 视图：只做展示和把用户操作转给 composable / store
├── composables/         # 视图逻辑（useXxx）：一个面板/对话框的状态与操作
├── stores/              # Pinia：应用状态 + 编排 service 调用
├── services/            # 用例：组合 data + platform + domain，不依赖 Vue / Pinia
├── data/                # 持久化：Dexie 表、迁移、settings.json
├── platform/            # 唯一允许 import @tauri-apps/* 的地方（Rust 命令 + 插件）
├── domain/              # 纯逻辑：扫描对账、筛选排序、Unity 关联、撤销变更集……
├── types/               # 纯类型
├── i18n/                # 文案（zh-CN / en-US）
├── ui/                  # 通知与确认框（唯一允许 import quasar 插件的地方）
├── utils/ constants/ styles/ boot/
tests/                   # vitest：domain 单测、数据库迁移、架构检查
src-tauri/src/
├── library/ package/ unity/ system.rs   # Tauri 命令，按领域分模块
├── protocol.rs paths.rs files.rs        # 与 Unity 的文件协议、磁盘位置、文件工具
└── bridge/                              # 部署到 Unity 的 C# 脚本
```

### 依赖方向

只允许从上往下依赖，`import type` 不受限制：

| 层 | 可以依赖 |
|----|----------|
| components / pages | composables、stores、services、domain、i18n、ui |
| composables | stores、services、domain、i18n、ui |
| stores | 其他 store、services、domain、i18n、ui |
| services | data、platform、domain |
| data | platform、domain |
| platform | 仅 `@tauri-apps/*` |
| domain / types | 仅 domain / types，不依赖 Vue |

`tests/architecture.test.ts` 会检查这张表，越层导入会直接让 `npm test` 失败。遇到失败时应当把调用挪到正确的层，而不是放宽规则。

### 文件归属原则

| 问自己 | 放在 |
|--------|------|
| 纯计算，不做 I/O，不用 Vue？ | `domain/` |
| 调用 Rust 命令或 Tauri 插件？ | `platform/` |
| 读写 IndexedDB 或 settings.json？ | `data/` |
| 一个完整用例（扫描、导入、渲染封面）？ | `services/` |
| 多个组件共享的状态？ | `stores/` |
| 某个面板自己的状态与交互？ | `composables/` |

---

## 2 命名规范

### 2.1 总览

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `AssetCard.vue` |
| 组合式函数 | camelCase + `use` 前缀 | `useFormatBytes()` |
| Pinia Store | camelCase + `use[X]Store` | `useAssetStore` |
| 接口（抽象契约）| PascalCase + `I` 前缀 | `IAssetRepository` |
| 类型/接口（数据）| PascalCase | `Asset`、`ScanDirectory` |
| 联合类型别名 | PascalCase | `CardSize`、`SortKey` |
| 常量 | UPPER_SNAKE_CASE | `CARD_SIZE_MAP` |
| SCSS 变量 | kebab-case + `$` 前缀 | `$color-background` |
| CSS 类名 | BEM kebab-case | `.asset-card__name--selected` |
| 事件处理器 | camelCase + `handle` 前缀 | `handleClick` |
| 自定义事件名 | kebab-case（模板中） | `@update:favorite` |
| 文件夹 | camelCase | `repositories/`、`strategies/` |

### 2.2 禁止项

- 不使用缩写（除非广泛接受：`id`、`url`、`i18n`、`UI`）
- 不使用单字母变量名（循环计数 `i`/`j` 除外）
- 不使用 `any`——用 `unknown` + 类型守卫代替
- 布尔值命名使用 `is`/`has`/`can`/`should` 前缀：`isScanning`、`hasError`

---

## 3 TypeScript

### 3.1 类型系统

```typescript
// 对象结构 → interface
interface Asset {
  id: string
  name: string
}

// 联合类型 / 工具类型 → type
type CardSize = 'sm' | 'md' | 'lg'
type AssetUpdate = Partial<Omit<Asset, 'id'>>

// 枚举 → 用字面量联合代替 enum
// Good
type SortOrder = 'asc' | 'desc'
// Bad
enum SortOrder { Asc, Desc }
```

### 3.2 函数签名

```typescript
// 必须显式标注返回类型
async function loadAssets(dir: string): Promise<Asset[]> { ... }

// 回调参数使用箭头函数类型
type FilterFn = (asset: Asset) => boolean
```

### 3.3 类型守卫优先于类型断言

```typescript
// Good
function isAsset(value: unknown): value is Asset {
  return typeof value === 'object' && value !== null && 'id' in value
}

// Bad
const asset = value as Asset
```

### 3.4 严格模式规则

- `strict: true` 始终开启
- 不使用 `@ts-ignore`，允许有注释说明的 `@ts-expect-error`
- 不使用 `!` 非空断言——用可选链 `?.` 或类型收窄
- 导出类型使用 `export type` / `import type` 区分值和类型

---

## 4 Vue 组件

### 4.1 文件组织

```vue
<!-- 顺序：script → template → style -->
<script setup lang="ts">
// 1. 导入（外部库 → 内部模块 → 类型）
// 2. Props & Emits
// 3. Store & Composables
// 4. 响应式状态（ref / reactive）
// 5. 计算属性（computed）
// 6. 方法（function）
// 7. 生命周期钩子（onMounted / onUnmounted）
</script>

<template>
  <!-- 单根元素或 <Teleport>/<Suspense> -->
</template>

<style scoped lang="scss">
/* BEM 结构 */
</style>
```

### 4.2 Props & Emits

```typescript
// 使用类型声明，不使用运行时声明
const props = defineProps<{
  asset: Asset
  width: number
}>()

// 命名元组风格的 emits
const emit = defineEmits<{
  click: [asset: Asset]
  'update:favorite': [id: string]
}>()
```

### 4.3 模板规则

- 属性超过 3 个时，每行一个属性
- `v-for` 必须配合 `:key`
- `v-if` 和 `v-for` 不同时出现在同一元素上
- 组件名在模板中使用 PascalCase：`<AssetCard />`
- 自闭合无子元素的组件：`<StatusBar />`

### 4.4 组件体积上限

单个 `.vue` 文件超过 **300 行**时必须考虑拆分。拆分依据：
- 独立的 UI 区块 → 子组件
- 可复用的逻辑 → composable
- 复杂的内联模板逻辑 → computed 属性

---

## 5 Composables（组合式函数）

### 5.1 何时提取

- 同一逻辑在 **2 个以上**组件中出现
- 组件的 `<script>` 中有超过 **20 行**不直接与模板绑定的逻辑
- 需要封装副作用的生命周期管理（如事件监听的注册/注销）

### 5.2 规范

```typescript
// composables/useFormatBytes.ts
import { computed, type Ref } from 'vue'

export function useFormatBytes(bytes: Ref<number>) {
  const formatted = computed<string>(() => {
    const b = bytes.value
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
    return `${(b / 1024 ** 3).toFixed(2)} GB`
  })

  return { formatted }
}
```

规则：
- 文件名和函数名均以 `use` 开头
- 接收 `Ref` 或 `() => T` 作为参数（保持响应式）
- 返回一个对象 `{ ... }`（解构友好）
- 副作用必须在 `onUnmounted` 中清理

---

## 6 状态管理（Pinia）

### 6.1 定义风格

```typescript
// 统一使用 Composition API 风格
export const useAssetStore = defineStore('assets', () => {
  // state
  const assets = ref<Asset[]>([])

  // getters（computed）
  const totalCount = computed(() => assets.value.length)

  // actions（function）
  async function load(): Promise<void> { ... }

  return { assets, totalCount, load }
})
```

### 6.2 规则

- Store 不直接操作 DOM、路由或浏览器 API
- 异步操作包裹 `try/finally`，确保 loading 状态复位
- Store 间依赖通过 `useXxxStore()` 在 store 内部调用，不循环依赖
- Store 只通过 services 做 I/O，不直接访问 Dexie 或 Tauri

### 6.3 计算属性拆分原则

过滤、排序这类纯计算放进 `domain/`（例如 `domain/assetQuery.ts`），store 中的 `computed` 只负责把状态传进去：

```typescript
const visibleAssets = computed(() => queryAssets(assets.assets, {
  kind: kind.value, search: search.value, favoritesOnly: favoritesOnly.value, /* ... */
}, (asset) => searchIndex.value.get(asset.id) ?? ''))
```

---

## 7 服务层与关键机制

### 7.1 持久化

- Dexie 表只在 `data/` 中访问（`data/repositories.ts` 提供按表的访问对象）
- Schema 变更时新增 `db.version(n)`，并在 `upgrade` 中迁移旧数据；旧版本声明保持原样
- 迁移逻辑中的纯转换放在 `domain/legacyRecords.ts`，由 `tests/databaseMigration.test.ts` 覆盖

### 7.2 撤销 / 重做

- 用户对资产的编辑（标签、收藏、备注）一律走 `assetStore.edit(ids, change)`，删除走 `assetStore.remove(ids)`
- `domain/assetChanges.ts` 只记录真正发生变化的资产和字段的前后值，所以撤销能精确还原
- 自动产生的变化（封面、渲染状态、使用时间、扫描结果）走 `assetStore.patch`，不进入历史
- 扫描会重建资产，所以扫描后会清空历史

### 7.3 与 Unity 的文件协议

- app 与 Unity 通过 `%APPDATA%/com.unitypackhub.app` 下的 JSON 文件通信
- 格式只在 `src-tauri/src/protocol.rs` 和 `bridge/UnityPackHubProtocol.cs` 两处定义，字段逐一对应
- 修改任何格式时，两边同时递增 `VERSION`。Rust 测试会校验两边的版本号和文件名是否一致
- 预览图文件名只由 Rust 的 `preview_output_file` 生成，前端和 C# 都只读取它给出的名字

---

## 8 样式规范

### 8.1 SCSS

```scss
// 引入变量
@use '../styles/variables' as *;

// BEM 命名
.asset-card {
  background: $color-surface;
  border-radius: $radius-card;

  &__name {
    color: $color-text;
    font-size: $font-size-card-name;
  }

  &--selected {
    outline: 2px solid $apple-blue;
  }
}
```

### 8.2 规则

- 所有颜色、间距、圆角、阴影、动效时长**必须使用 SCSS 变量**，禁止硬编码
- 使用 `scoped` 样式隔离
- 遵循 BEM 命名：`.block__element--modifier`
- 避免超过 3 层嵌套
- 媒体查询放在对应选择器内部（就近原则）

### 8.3 设计令牌

| 令牌 | 用途 |
|------|------|
| `$radius-card: 16px` | 卡片圆角 |
| `$radius-button: 10px` | 按钮圆角 |
| `$radius-input: 8px` | 输入框圆角 |
| `$radius-tag: 20px` | 标签胶囊圆角 |
| `$transition-default: 0.25s` | 默认过渡 |
| `$transition-fast: 0.15s` | 快速交互 |
| `$transition-slow: 0.35s` | 图片/抽屉 |

---

## 9 i18n 国际化

- 翻译字符串集中管理在 `services/i18n.ts`
- 所有用户可见文案必须走 `t.xxx` 或 `tr('key', params)`
- 新增功能时同步添加 zh-CN 和 en-US 翻译
- 翻译 key 使用 camelCase：`t.importToUnity`、`t.noAssetsYet`
- 不在模板中直接写中文字符串

---

## 10 错误处理

### 10.1 分层策略

| 层级 | 处理方式 |
|------|----------|
| **data / platform** | 抛出异常，不捕获 |
| **Service** | 可恢复的问题作为结构化结果返回（如 `ScanWarning`），其余抛出带原因的错误（如 `UnityError`） |
| **Store / Composable** | `try/finally` 管理 loading 状态；把错误翻译成文案，通过 `ui/feedback` 提示 |
| **Component** | 只展示，不吞异常 |

### 10.2 规则

```typescript
// Good — 具体异常 + 用户反馈
try {
  await libraryService.scan(directories, classificationPath)
} catch (error) {
  notify.error(tr('scanFailed', { reason: errorMessage(error) }))
}

// Bad — 静默吞掉
try { await scan() } catch {}
```

- `console.error` 仅用于开发调试
- 用户操作失败时必须显示 Toast 提示
- 错误消息必须走 i18n

---

## 11 异步编程

### 11.1 规则

- 所有 I/O 操作（文件、数据库、Tauri 命令）使用 `async/await`
- **禁止 `async void`** 函数——仅允许在事件处理器中
- 不使用 `.then()` 链——统一用 `await`
- 长操作提供取消能力：

```typescript
const controller = new AbortController()

async function scan(signal?: AbortSignal): Promise<void> {
  for (const dir of dirs) {
    if (signal?.aborted) break
    await processDir(dir)
  }
}

// 组件中
onUnmounted(() => controller.abort())
```

### 11.2 竞态保护

```typescript
let scanGeneration = 0

async function scan(): Promise<void> {
  const thisGeneration = ++scanGeneration
  const result = await doScan()
  if (thisGeneration !== scanGeneration) return // 被新一轮覆盖
  assets.value = result
}
```

---

## 12 性能指南

### 12.1 列表渲染

- 超过 100 项的列表使用 Quasar `QVirtualScroll` 虚拟滚动
- `v-for` 的 `:key` 使用稳定的 `id`，不使用数组索引

### 12.2 响应式优化

- 大型只读列表使用 `shallowRef` 代替 `ref`（避免深度代理）
- 高频更新的值（搜索输入）使用防抖：`watchDebounced` 或手动 `setTimeout`
- `computed` 中避免创建新对象/数组（如果引用没变就不要触发更新）

### 12.3 组件优化

- 纯展示组件使用 `defineOptions({ inheritAttrs: false })` 避免多余属性透传
- 大型列表项组件考虑 `v-memo` 跳过不必要的重渲染
- 图片使用 `loading="lazy"` 懒加载

---

## 13 安全规范（Tauri）

### 13.1 权限最小化

- `tauri.conf.json` 中只声明实际需要的 Tauri 插件权限
- 文件系统访问限定在用户选择的目录范围内
- 不使用 `dangerousRemoteDomainIpcAccess`

### 13.2 输入验证

- 所有来自文件系统的路径在使用前做规范化和边界检查
- 用户输入（搜索、笔记）在写入 IndexedDB 前进行消毒
- Shell 命令参数不直接拼接用户输入

### 13.3 数据持久化

- 敏感配置不存储在 IndexedDB 中（可被 DevTools 读取）
- 设置文件存储在 Tauri 的 `appDataDir` 中

---

## 14 Git 规范

### 14.1 提交信息格式（Conventional Commits）

```
<type>(<scope>): <subject>

[可选正文]

[可选脚注]
```

**Type:**

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改变行为） |
| `style` | 格式调整（空格、分号等） |
| `perf` | 性能优化 |
| `docs` | 文档变更 |
| `test` | 测试相关 |
| `chore` | 构建/工具链/依赖变更 |

**Scope（可选）：** `asset`、`tag`、`store`、`ui`、`scanner`、`i18n`、`tauri`

**示例：**

```
feat(scanner): 支持递归扫描子目录中的 unitypackage
fix(store): 修复撤销操作后列表不刷新的问题
refactor(asset): 将 fileSizeDisplay 提取为 composable
chore: 升级 Quasar 至 2.20
```

### 14.2 分支规范

| 分支 | 用途 |
|------|------|
| `main` | 稳定版本 |
| `dev` | 开发集成 |
| `feat/<name>` | 新功能开发 |
| `fix/<name>` | Bug 修复 |
| `refactor/<name>` | 重构 |

### 14.3 规则

- 一个功能一个分支，一个 PR
- 提交粒度：一个逻辑变更一个提交，不混合不相关的修改
- 不提交 `node_modules/`、`.quasar/`、`dist/`、`.env*`

---

## 15 测试规范

### 15.1 文件组织

```
tests/
├── architecture.test.ts       # 分层规则
├── databaseMigration.test.ts  # Dexie 升级（fake-indexeddb）
├── librarySync.test.ts        # 扫描对账
└── domain.test.ts             # 其余 domain 纯逻辑
```

运行 `npm test`（vitest）、`cargo test`（Rust 与协议一致性）和 `npm run check:bridge`（离线编译 C# 桥接）。

### 15.2 规则

- 测试放在根目录 `tests/` 下
- 文件名：`[source].test.ts`
- `domain/` 中的纯函数**必须**有单元测试
- 数据库 schema 变更**必须**补迁移测试
- 测试命名使用 `describe` + `it` 结构：

```typescript
describe('CommandManager', () => {
  it('should execute command and add to history', async () => { ... })
  it('should undo last command', async () => { ... })
  it('should limit history to maxHistory', async () => { ... })
})
```

---

## 16 数据持久化

- 资产、标签、分组数据：Dexie (IndexedDB)
- 用户设置：Tauri `appDataDir` 下的 JSON 文件
- 数据库 Schema 变更必须递增版本号，提供迁移逻辑

---

## 17 代码审查检查清单

提交 PR 前自查：

- [ ] TypeScript 无报错（`npm run typecheck`）
- [ ] `npm test` 和 `cargo test` 通过，改了 C# 桥接时 `npm run check:bridge` 通过
- [ ] 无 `any` 类型
- [ ] 无硬编码的颜色/间距/字符串
- [ ] 新增文案已添加中英文翻译
- [ ] 异步操作有 loading 状态和错误处理
- [ ] 组件 Props/Emits 有类型声明
- [ ] SCSS 使用变量而非魔法数字
- [ ] 新增公共函数有对应测试
- [ ] 提交信息符合 Conventional Commits 格式
