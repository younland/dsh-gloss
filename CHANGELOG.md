# DSH Gloss 更新日志

本文件从 1.0.0 起记录。1.0.0 之前的历史（旧名 `dsh-polish`，版本 0.1.0 – 1.5.1）见 [CHANGELOG.pre-1.0.md](./CHANGELOG.pre-1.0.md)。

## 2.0.2 — 2026-11-25

### npm 发布准备

- 包名改为 `@younland/dsh-gloss`，scoped package 避免 npm 命名冲突。
- `package.json` 更新 `author`、`repository`、`homepage`、`bugs` 为 `younland` 名下地址。
- `client.js` 中的 `window.__ModuleLoader__.load({ id: ... })` 同步改为 `@younland/dsh-gloss`，与 `package.json` 的 `name` 保持一致。
- `cordis.patch.yml` 中的插件 `name` 同步改为 `@younland/dsh-gloss`。
- `README.md`、`docs/DESIGN.md`、`docs/RELEASE.md`、`docs/market-entry.yml` 中的安装、卸载、发布与索引说明同步更新。

## 2.0.1 — 2026-11-25

### 按官方文档优化

- `package.json` 补全官方推荐的组合包 manifest：添加 `main`、`engines.dsh`（`>=0.2.0 <0.3.0`），导出并打包 `locale/*.json`。
- 新增 `locale/en.json` 与 `locale/zh.json`，提供 Plugin Manager 显示用的 `meta.title` / `meta.description`。
- `client.js` / `index.js` 注释更新，明确所有资源均通过 `ctx.effect` / `ctx.inject` 注册并返回清理函数，符合官方生命周期与副作用管理规范。

## 2.0.0 — 2026-11-25

### 功能精简

- 移除其余功能，仅保留两项核心交互增强：
  - **长文本换行**：Alt+Enter 在输入区插入可 `Ctrl+Z` 回退的换行符；
  - **临时断网**：输入区工具行内的「联网」开关，关闭后拒绝 `web_search` / `web_fetch` 并注入禁止联网的系统提示。
- 删除的功能：一键刷新、发送后撤回、3 秒发送缓冲、顶栏进度条、状态指示条、侧栏圆点提醒。
- 同步精简 `client.js` 中的 CSS、locale、effect 与 slot 注册；更新 `README.md`、`docs/DESIGN.md`、`package.json` 描述。

### 验证

- `node --check` 通过（`client.js`、`index.js`）。
- 重挂 profile 后重载页面，换行与联网开关逐项截图核对；`GET /dsh-gloss/web` 返回 `200 {"ok":true,"enabled":true}`；无新增崩溃日志。

## 1.0.0 — 2026-11-14

首个公开发布版本，同时改名。

### 改名

- 包名 `dsh-polish` → `dsh-gloss`，显示名 DSH Polish → **DSH Gloss**。旧名在 npm 已被他人占位，无法继续发布。
- 对外标识符同步改名，避免与其它插件冲突：模块 id `dsh-gloss`、slot id `dsh-gloss-*`、CSS 类 `.dshGloss*`、样式标签 `style[data-dsh-gloss-css]`、DOM 属性 `data-dsh-gloss-*`、locale 命名空间 `dsh-gloss`、effect 标签 `dsh-gloss: *`、宿主路由 `/dsh-gloss/web`。
- 版本号归零到 1.0.0：这是新名字下的第一条产线，功能集合与 1.5.2 完全一致。

### 功能

- 一键刷新：桌面标题栏「编辑」右侧的图标按钮，点击后图标转一圈，页面软刷新，host 侧任务不受影响。
- 发送后撤回：任务进行中，发送键左侧出现红色圆键，点击 = 停止任务并恢复原始输入。
- 发送缓冲 3 秒：发送后 3 秒内可反悔，撤回只取消这次待提交，不停止任务；再点一次发送键可立即发出。
- Alt+Enter 换行：插入可 `Ctrl+Z` 回退的换行，不发送；输入法组词期间不拦截。
- 顶栏进度条：按 `todo_write` 的完成情况显示进度和剩余估算；没有总数时走不确定动画，不编造数字；运行中条内有一道流光。
- 联网开关：输入区工具行的「联网」开关，关闭后 `web_search` / `web_fetch` 被拒，并注入禁止联网的系统提示；状态持久化。
- 状态指示条：顶栏下方 2px 细条，运行蓝 / 完成绿 / 撤回红，输入时自动隐藏。
- 侧栏圆点提醒：不在该会话时，后台跑完或开始等你的会话，侧栏圆点闪两下。

### 验证

- `node --check` 通过（`client.js`、`index.js`）。
- `node tools/test-client-apply.mjs` → `ok: true`，10 个 effect、6 个 slot，id 均为 `dsh-gloss-*`。
- 重挂 profile 后重载页面，六项功能逐个截图核对；`GET /dsh-gloss/web` 返回 `200 {"ok":true,"enabled":true}`；无新增崩溃日志。
