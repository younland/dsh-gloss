<!-- ai-assisted: true; generated-by: DeepSeek Harness coding agent under human review -->
# DSH Gloss

> 仅保留两项高频交互增强：长文本换行、临时断网。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![AI-assisted](https://img.shields.io/badge/code-AI--assisted-lightgrey.svg)](#ai-参与说明)

DSH Gloss 是 DeepSeek Harness 桌面端的界面增强插件。当前版本只提供两个最常用的输入控制：

- **Alt+Enter 换行**：在输入区长文本中插入可通过 `Ctrl+Z` 回退的换行符，不触发发送；
- **联网开关**：输入区工具行内的开关，关闭后拒绝 `web_search`、`web_fetch`，并注入本轮禁止联网的系统提示；状态持久化。

实现上仅使用宿主公开的扩展点，不修改渲染树、不替换宿主节点。

> **AI 参与编写**：本项目的代码与文档由 AI 编码代理（DeepSeek Harness）生成初稿，由人工完成需求定义、方案取舍、逐项验收与发布决策。详见 [AI 参与说明](#ai-参与说明)。

## 功能

| 使用场景 | 插件行为 |
| --- | --- |
| 长文本换行 | **Alt+Enter 换行**：插入可通过 `Ctrl+Z` 回退的换行符，不触发发送；输入法组词期间不拦截 |
| 需要临时断网 | **联网开关**：输入区工具行内的开关，关闭后拒绝 `web_search`、`web_fetch`，并注入本轮禁止联网的系统提示；状态持久化 |

## 安装

当前仅支持本地目录安装：

1. 将本仓库克隆或下载到任意目录。
2. 在 DSH 中由 agent 调用 `plugin_manager action=install_bundle target=<该目录绝对路径>`。
3. 重载页面，在「设置 → 插件」中确认 `dsh-gloss` 已启用。

安装后，profile 的 `package.json` 会增加一条 `"@younland/dsh-gloss": "link:…"` 依赖，`dsh.profile.bundles` 末尾追加 `@younland/dsh-gloss`；`cordis.patch.yml` 中的 `- insert:` 条目由本包提供，无需手工修改 profile。

发布至 npm 后可改用 `dsh plugin add @younland/dsh-gloss`。

## 兼容性

- 实测环境：DSH 桌面端 `0.2.2-rc.1`（Windows）。
- `package.json` 声明 `engines.dsh: ">=0.2.0 <0.3.0"`，安装和 profile 启动会校验当前 DSH 版本是否满足该范围。
- 仅使用官方扩展点：Cordis `ctx.effect` / `ctx.slots` / `ctx.locale` / `ctx.webServer` / `ctx.tools.guard` / `ctx.systemPrompt.section`，以及 `conversation.input.left`、`conversation.input.activity` 两个座位。
- 所有资源均通过 `ctx.effect` / `ctx.inject` 注册并返回清理函数，插件卸载或 HMR 重载时自动回收。
- 宿主缺少某个座位时，对应功能自动降级或关闭，不影响页面启动。
- 运行时标识（slot id、CSS 类、DOM 属性、locale 命名空间）仍保持 `dsh-gloss-*` 前缀，与包名 `@younland/dsh-gloss` 解耦。

## 运行行为与副作用

- **联网开关为减法实现**：关闭时仅拒绝 `web_search`、`web_fetch` 两个工具并追加一段禁止联网的系统提示，不注销任何工具注册，不影响其它插件。

## 数据与隐私

- 插件自身不发起网络请求，不上报任何数据。
- 唯一持久化文件为插件目录下的 `state.json`，内容仅包含 `webEnabled` 字段。
- `/dsh-gloss/web` 路由仅用于本机前端读写该开关状态。

## 卸载与故障排查

- 卸载：`plugin_manager action=remove_bundle target=@younland/dsh-gloss`。手工清理需移除 profile `package.json` 中的依赖项与 `dsh.profile.bundles` 中的条目，并删除插件目录。
- 与其它插件共存时，可通过以下前缀识别本插件：slot id `dsh-gloss-*`、CSS 类 `.dshGloss*`、样式标签 `style[data-dsh-gloss-css]`、DOM 属性 `data-dsh-gloss-*`、locale 命名空间 `dsh-gloss`、effect 标签 `dsh-gloss: *`、host 路由 `/dsh-gloss/web`。
- 界面异常时，检查桌面应用日志目录下的 `crash-*-web-boot.log`。插件所有入口均包裹 `try/catch`，单个功能失败仅自身降级。

## 开发

```bash
node --check plugins/dsh-gloss/client.js
node --check plugins/dsh-gloss/index.js
```

插件显示元数据（Plugin Manager 中的标题与描述）放在 `locale/en.json` 与 `locale/zh.json` 的 `meta` 字段下，随包导出。

设计取舍、接口与挂载点清单、风险对策与已知限制见 [docs/DESIGN.md](./docs/DESIGN.md)；1.0.0 之前的变更记录见 [CHANGELOG.pre-1.0.md](./CHANGELOG.pre-1.0.md)。

## AI 参与说明

本项目在开发过程中使用 AI 编码代理（DeepSeek Harness）生成代码与文档初稿。分工如下：

- **AI 承担**：实现代码、测试脚本、文档初稿、发布材料与提交信息。
- **人工承担**：需求定义、方案取舍、兼容性验收、逐项功能测试与发布决策。
- **验收方式**：每次变更均需通过 `node --check` 语法检查，并在真实桌面端重载后逐项截图核对。
- **运行期影响**：AI 仅参与开发过程，不作为运行时依赖；插件本身不包含任何模型调用或远程服务。

上述标记同时以 HTML 注释 `ai-assisted: true` 形式写入本文件头部，便于工具识别。

## English

DSH Gloss is a UI enhancement plugin for the DeepSeek Harness desktop app. This version keeps only two controls: Alt+Enter line breaks in the composer and a web-access toggle in the input toolbar. It relies solely on public extension points and never patches the host render tree.

Code and documentation were drafted by an AI coding agent (DeepSeek Harness) and reviewed, tested and released by a human maintainer. See [AI 参与说明](#ai-参与说明) for details.

## 许可

MIT
