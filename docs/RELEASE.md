# 发布检查单

当前状态：本地发布物已就绪（2.0.2），**GitHub 与 npm 均未动手**。以下步骤按需执行。

## A. 准备工作（一次性）

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
gh auth login          # 交互式，浏览器里授权一次即可
```

## B. 建 GitHub 仓库

```powershell
cd plugins/dsh-gloss
git init
git add -A
git commit -m "@younland/dsh-gloss 2.0.2"
gh repo create dsh-gloss --public --source . --push `
  --description "Alt+Enter line breaks and a web-access toggle for DeepSeek Harness"
```

仓库设置里补 topic：`dsh-plugin`（上架 CI 硬性要求）、`deepseek-harness`、`cordis`。

## C. 回填元数据（建仓之后才做）

在 `package.json` 里补三行（现在故意留空，避免指向不存在的仓库）：

```json
"repository": { "type": "git", "url": "git+https://github.com/<owner>/dsh-gloss.git" },
"homepage": "https://github.com/<owner>/dsh-gloss#readme",
"bugs": { "url": "https://github.com/<owner>/dsh-gloss/issues" }
```

补完跑一次 `npm pack --dry-run`，确认 files 白名单命中：
`index.js / client.js / cordis.patch.yml / locale/*.json / README.md / LICENSE / CHANGELOG.md / CHANGELOG.pre-1.0.md / docs`。

## D. 可选：发 npm

```powershell
npm login
npm publish --access public     # 包名 @younland/dsh-gloss
```

发版前核对两条必须一致：`package.json` 的 `name` 与 `client.js` 里
`window.__ModuleLoader__.load({ id: '@younland/dsh-gloss' })` 的 id。

## E. 提交到插件目录（awesome-dsh-plugin）

前置：C 已完成，且仓库创建已满 1 天。

1. fork `awesome-dsh-plugin/awesome-dsh-plugin`
2. 按 `docs/market-entry.yml` 的内容，新建 `data/plugins/<owner>__dsh-gloss.yml`（把 `<owner>` 换成你的 GitHub 用户名）
3. 提 PR，等 CI 校验 `dsh.bundle`、仓库年龄、topic；合并后所有装了 dshmarket 的用户即可搜到

## F. 收尾自检

- [ ] `node --check client.js` / `node --check index.js`
- [ ] 重载页面后确认仅「联网」开关与 Alt+Enter 换行生效
- [ ] `GET /dsh-gloss/web` → `200 {"ok":true,"enabled":true}`
- [ ] 卸载重装一次（`plugin_manager remove_bundle` → `install_bundle`），确认无残留 DOM / 样式
- [ ] `git grep -i "dsh-polish"` 只剩 `CHANGELOG.pre-1.0.md` 与 `docs/` 里的历史说明
- [ ] 版本语义化：破坏性改名 / slot id 变更 → major；新增能力 → minor；修 bug → patch
