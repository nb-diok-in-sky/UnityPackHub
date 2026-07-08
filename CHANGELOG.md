# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
