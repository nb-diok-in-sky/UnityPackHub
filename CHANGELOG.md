# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-09-27

### Fixed

- 扫描时无法访问的目录（移动硬盘未插、目录改名）不再导致其中资产连同标签、备注、封面被删除；这些资产和被禁用目录中的资产一样改为隐藏，目录恢复后重新扫描即可回来
- 目录前缀误判：`D:\Assets` 不再匹配 `D:\Assets2` 下的资产
- 扫描会进入 Unity 工程的 `Library/`、`Temp/` 等生成目录，但会跳过用户自己名叫 `Library`、`Temp` 的普通文件夹；现在只在 Unity 工程根目录下跳过
- 中文路径下检测不到打开的 Unity 项目（PowerShell 输出为 GBK 编码）；同时排除 batchmode 进程，避免误把导入工作进程或预览工程识别为用户项目
- Unity 编辑器检测只查默认目录，现在读取 Unity Hub 的自定义安装位置
- 导入后生成的预览写入错误目录、使用错误文件名，前端永远读不到；现在导入与橱窗共用一条渲染链路
- 中文名 Prefab 的预览永远匹配不上（前端与 Rust 的哈希算法不一致）；文件名改为只由 Rust 生成
- Unity 渲染进行中收到新请求会打乱当前任务；manifest 被部分渲染覆盖而丢条目；`Generate Missing Previews` 菜单仍在解析旧格式
- 模型封面批量渲染：单个文件出错会中断整批；Unity 崩溃后要等 10 分钟超时；每次运行都会让预览工程重新编译并重新导入
- 解析大包、扫描、检测项目等命令在主线程同步执行，期间窗口卡死；现在全部改为异步
- 路径含 `&` 的资源包无法打开
- 同时打开多个 Unity 编辑器时，"在 Unity 中定位"和项目同步可能由错误的编辑器执行，渲染请求也可能被没有这些资源的编辑器吞掉；现在请求带项目路径，心跳按编辑器分开，渲染请求留给能匹配到资源的编辑器
- 导入完成回调中，名称带点号的包（如 `Forest v1.8.8`）匹配不到导入记录，不会生成预览
- 包预览在浅色材质上过曝成一片白
- 抽屉首次打开不加载 Unity 预览；撤销按钮永远不可用；文本框里的 Ctrl+A、Ctrl+Z、Esc 被全局快捷键抢走
- 卡片双击导入不走 Unity 桥接；"最近使用"排序从未生效
- 缩略图被缓存淘汰后可见卡片变空白；网格列宽没扣除内边距
- 移除扫描目录后资产残留；删除标签后资产上残留标签 id；删除资产后分组计数不变

### Changed

- 前端按 platform / data / domain / services / stores / composables / 视图 分层，并由 `tests/architecture.test.ts` 强制检查
- 撤销改为统一的资产变更集：单个与批量的标签、收藏、备注、删除都可以撤销和重做（Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y）
- 数据库升级到 v8：`thumbnailPath` 拆成 `cover`，模型字段收进 `modelPreview`，内联 data-URL 封面迁入 blob 表
- Rust 按 library / package / unity 分模块；与 Unity 的文件协议集中在 `protocol.rs` 与 `UnityPackHubProtocol.cs`，并带版本号，Unity 中运行旧版 bridge 时会提示
- C# 桥接脚本统一到 `UnityPackHub` 命名空间，两套渲染器合并为一套；在用户项目中渲染时不再修改当前场景的 RenderSettings
- 所有界面文案进入中英文语言包
- 移除未使用的命令（`parse_unity_package`、`extract_package_preview`、`extract_single_asset`、`debug_package_pathnames`）和 `shell:allow-execute` 权限

## [0.2.0] - 2026-07-06

### Fixed

- **资产分类全部显示为 Other**：`.unitypackage` 的 pathname 文件末尾有 `\n` + 两个 ASCII `0` 的 padding，导致扩展名从 `.unity` 变成 `.unity\n00`，匹配不到分类规则。改为在 Rust 层读取原始字节时按第一个 `\n` 截断，因为 Unity 路径不会包含换行符
- **橱窗卡片被压成横线**：CSS Grid 在 `max-height` 约束下会压缩行高。改用 `flex-wrap` + `flex-shrink: 0` 布局，与主页资产网格保持一致

### Added

- **Unity 预览图自动生成系统**：在 Unity Editor 内通过桥接脚本自动渲染 prefab/模型截图，使用独立 preview scene + 自定义相机 + 双光源，根据模型 bounds 自适应相机距离
- **prefabs.json 索引机制**：每个包的预览文件夹下生成 `prefabs.json` 列出所有 prefab 文件名，Unity 端据此批量匹配和渲染，替代了之前逐个路径查找的方式，更可靠也更容易管理
- **自动触发截图**：橱窗打开时检测缺失的预览图，写入 `_trigger` 文件，Unity 桥接脚本每 2 秒轮询发现后自动开始渲染
- **Unity 手动菜单**：`Tools > UnityPackHub > Generate Missing Previews`，作为自动触发的备用方案
- **清除所有预览图按钮**：橱窗内一键删除所有已保存的截图，方便重新生成

### Changed

- **橱窗前端重写**：之前反复修补效果不好，基于已验证过的橱窗板块直接重写，只保留 Prefab / Texture / Script 三类，聚焦核心需求
- **渲染背景改为浅灰**：原来的深灰背景下深色模型（树木、岩石等）对比度太差，几乎看不清轮廓
- **相机距离拉近**：默认渲染物体在画面中占比太小，缩小距离系数让模型基本填满画面
- **图片加载改为 Rust 端批量读取 base64**：Tauri 的 asset protocol scope 配置在中文用户名路径下始终返回 403，改由后端直接读取文件返回 data URL 绕过此限制
- **移除"从包中提取封面"按钮**：功能与新的预览图系统重复
- **Unity 项目检测改为大小写不敏感**：用户的 Unity 使用 `-projectpath`（全小写），之前只匹配 camelCase 导致检测失败

### Performance

- 图片使用 `loading="lazy"` 延迟加载
- 仅对已存在截图的 prefab 设置 img src，避免大量 ERR_CONNECTION_REFUSED 请求

## [0.1.0] - 2026-07-03

### Added

- Asset scanning: recursively scan directories for `.unitypackage` files
- Tag system: create, edit, delete colored tags; bulk assign to assets
- Group system: organize assets into named groups with custom icons
- Favorites: star/unstar assets, filter favorites only
- Search: full-text search across name, filename, notes, and tags
- Sorting: by name, date, file size, last used (Strategy pattern)
- Undo/Redo: reversible batch operations via Command pattern
- One-click import: double-click to import asset into Unity project
- Settings: scan directories, Unity editor path, card size, sort preferences
- i18n: Chinese Simplified and English
- Themes: Light and Dark mode
- Data persistence: Dexie (IndexedDB) with Repository pattern
- Coding standards document
