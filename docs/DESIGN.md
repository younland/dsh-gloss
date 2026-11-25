# DSH Gloss 设计说明

维护者文档。面向用户的说明见 [README](../README.md)。

当前版本仅保留两项界面增强：

- **长文本换行**：Alt+Enter 在输入区插入可撤销的换行符；
- **临时断网**：输入区工具行内的联网开关，关闭后拒绝 `web_search` / `web_fetch`。

## 1. 目的与边界

给 DSH 桌面端补「差一点」的交互细节，所有能力必须满足：

- 只用官方扩展点（Cordis `ctx.*` 与宿主 slot），不 monkey patch、不替换宿主节点；
- 最小侵入：能放官方座位就放座位；
- 全前缀命名空间，与其它插件共存；
- 每个入口 `try/catch` + 日志，单点失败只降级本插件；
- 生命周期内所有资源通过 `ctx.effect` / `ctx.inject` 注册，并在返回的 disposer 里成对清理，重复 enable/disable 幂等；
- 不编造数据、不改布局、尊重 `prefers-reduced-motion`；
- 组合包 manifest 符合官方文档要求：`package.json` 声明 `dsh.bundle.patch`、`main`、`engines.dsh`，并导出 `locale/*.json`。

## 2. 结论

两项需求均可实现，不需要 monkey patch，也不需要自建 DOM。

| 需求 | 机制 | 结论 |
| --- | --- | --- |
| Alt+Enter 换行 | 组件挂在官方 slot `conversation.input.activity`，监听 `keydown`（捕获阶段，作用域限本会话 composer），Alt+Enter 时调用 `inputActions.captureInsertion()` + `inputActions.insertText('\n', span)` | 可行（官方扩展点） |
| 联网开关 | Host 半边：`ctx.tools.guard()` 只拒绝 `web_search` / `web_fetch`（不注销，故不影响其他插件的工具注册）+ `ctx.systemPrompt.section({ name: 'dsh-gloss-no-web', order: 900 })` 注入禁止联网约束；状态经 `ctx.webServer.register({ kind: 'exact', path: '/dsh-gloss/web' })` 读写并持久化到插件目录 `state.json` | 可行（官方扩展点） |

**未引入的能力**（宿主没有，因此不实现、不伪造）：没有「重载 UI」服务、没有 send/submit 事件总线、没有设置光标 / 选区的公开 API。

## 3. 接口与挂载点

| 用途 | 接口 |
| --- | --- |
| 注册 client 模块 | `window.__ModuleLoader__.load({ id: 'dsh-gloss', factory(require) { … } })`，导出 `{ inject: ['slots','locale','sessions'], apply(ctx) }` |
| 拆装 | `ctx.effect(fn, label)`（renderer 卸载 / 热重载时执行返回的 disposer）、`ctx.slots.inject(name, () => ctx.slots.register({ name, id, order, locale, inject }, Component))` |
| 文案 | `ctx.locale.bind(ns)`、`ctx.locale.register(ns, { zh, en })` |
| 换行 | `useInput` / `inputActions` 由 `conversation.input.activity` 座位自动注入；组件内 `keydown` 捕获监听 → `inputActions.captureInsertion()` + `inputActions.insertText('\n', span)`；`span.draftRev` 过期即放弃 |
| 联网开关 | Host 半边（`index.js`）：`ctx.tools.guard()` 拒绝 `web_search` / `web_fetch` + `ctx.systemPrompt.section()` 注入禁止联网约束；状态经 `/dsh-gloss/web` 路由读写并持久化到 `state.json` |
| 状态通道 | Client 用相对路径 `fetch('/dsh-gloss/web')`：桌面端页面是 `dsh-app://app/`（自定义协议），相对请求由应用转发到本机 Harness 服务，不能用 `location.origin` 拼绝对 URL |
| 挂载点 | 联网开关：`conversation.input.left`（list 座位，权限控件右侧，order 10）；换行监听：`conversation.input.activity`（single 座位，order 5） |

## 4. 命名空间

`dsh-gloss-*`（slot id）、`.dshGloss*`（CSS 类）、`style[data-dsh-gloss-css]`（样式标签）、`data-dsh-gloss-*`（DOM 属性）、locale 命名空间 `dsh-gloss`、effect 标签 `dsh-gloss: *`、host 路由 `/dsh-gloss/web`、进程单例 `Symbol.for('dsh-gloss.runtime@1')`。

1.0.0 之前这些前缀是 `dsh-polish` / `dshPolish`（见 [CHANGELOG.pre-1.0.md](../CHANGELOG.pre-1.0.md)）。

## 5. 兼容性风险与对策

| 风险 | 对策 |
| --- | --- |
| 占用 `conversation.input.activity`（single 座位） | 组件返回 `null`（无节点、不占宽度），仅做事件监听；不调用 `onActiveChange`，不会把工具栏展开 |
| 样式泄漏 | 单 `<style data-dsh-gloss-css>`，全部选择器以 `.dshGloss*` 前缀作用域化，无全局选择器、无 `!important`；卸载时移除 |
| 事件 / 监听泄漏 | 所有监听、定时器都在 disposer 里成对清理；重复 enable/disable 幂等 |
| 失败隔离 | 全部入口 `try/catch` + `log`；失败只让本插件降级 / 提示，不冒泡到宿主 |

## 6. 文件结构

```
dsh-gloss/
  package.json          dsh.bundle.patch + main + engines.dsh + dsh.client{platform:"web", immediately:true, inject:[…]}
  cordis.patch.yml      - insert: - id: dsh-gloss  name: 'dsh-gloss'
  index.js              host 半边：联网开关门控（tools.guard + systemPrompt.section）、/dsh-gloss/web 路由、state.json
  client.js             web 半边：全部 UI（经典脚本 bundle，__ModuleLoader__.load）
  locale/               插件显示元数据（en.json / zh.json 的 meta.title / meta.description）
  README.md             面向用户
  CHANGELOG.md          1.0.0 起
  CHANGELOG.pre-1.0.md  旧名时期历史（0.1.0 – 1.5.1）
  docs/                 DESIGN.md / market-entry.yml / RELEASE.md
  state.json            运行时状态（不入包，已 gitignore）
```

安装：`plugin_manager action=install_bundle target=<目录>`，entryId 形如 `include:@younland/dsh-gloss`。

npm 发布后用 `dsh plugin add @younland/dsh-gloss` 安装。

## 7. 验证步骤

1. **静态**：`node --check client.js`、`node --check index.js`。
2. **换行**：在输入区按 Alt+Enter → 插入换行符，不触发发送；Ctrl+Z 可撤销。
3. **联网开关**：输入区工具行出现「联网」开关；点击关闭后发送任意需要联网的问题，模型不会调用 `web_search` / `web_fetch`。
4. **状态持久化**：关闭开关后重启应用，开关保持关闭。
5. **共存**：与 `codex-effort-slider`、`task-progress`、`billion-context` 同时启用，按钮布局与事件互不影响。
6. **幂等**：反复 disable / enable → DOM、样式、监听无堆积。

## 8. 已知限制

- 换行仅支持 Alt+Enter；Shift+Enter 等宿主原生快捷键保持原行为不变。
- 联网开关仅拒绝 `web_search` / `web_fetch`，不阻止其它联网途径。
