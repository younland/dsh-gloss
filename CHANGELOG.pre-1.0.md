# Changelog

## 1.5.1 — 2026-10-31

### 修复「联网开关关不掉」与「刷新后闪退」

- **关不掉**：`POST /dsh-polish/web` 一直 404。宿主半边在 `apply` 时用 `ctx.get('webServer')` 取服务，此刻服务尚未就绪，取到 `undefined` 后静默跳过路由注册，于是客户端每次切换都失败回滚成「开」。改为 `ctx.inject(['webServer'], …)`，服务就绪后才注册（模式取自 `dsh-client-modules`）。
- 同一处把状态与路由挂到进程级单例 `Symbol.for('dsh-polish.runtime@1')`：插件被重新 apply 时旧实例的清理与新实例的注册会交错，`webServer.register` 撞上 `duplicate route` 抛错且没人补回路由（同样表现为 404）。现在状态只有一份、路由只注册一次，撞车时按 400ms × 12 次退避重试。
- **闪退**：`crash-2026-10-31T07-11-13-868Z-web-boot.log` 记录 `web boot: 1 entry did not activate` / `dsh-polish: import failed`。客户端 `apply` 里的顶层语句（`ctx.locale.bind`、各 store 构造）不在任何 try/catch 里，抛一次就让整个入口 `failed`，整页白屏并记 crash 日志。改为 `apply(ctx) { try { activate(ctx) } catch (error) { log(error) } }`，失败只降级成「少几个功能」，不再拖垮页面。
- 实测：`GET /dsh-polish/web` → `200 {"ok":true,"enabled":true}`；点击「联网」关闭 → `POST` → `200 {"ok":true,"enabled":false,"persisted":true}`，`state.json` 落盘 `webEnabled:false`；随后两次 F5 刷新，开关保持关闭、不再弹回，且无新增 crash 日志。
- 版本 1.5.1；`node --check`（两半边）、`tools/test-client-apply.mjs`（10 effects / 6 slots）、`tools/test-undo-render.mjs` 通过。

## 1.5.0 — 2026-10-31

### T7 进度条 ETA + 流光

- ETA：`createProgressState()` 记录本次运行起点 `startedAt`（running 由 false→true 时打点，结束清零），估算 = `已用时间 / 已完成数 × 剩余数`；只有**运行中 + 有总数 + 已完成 ≥ 1 + 尚未做完 + 估算 ≤ 2 小时**才显示，条件不满足一律不显示（无总数、0 完成、已完成=总数都不编造）。文案形如 `2/4 · 约 21 秒` / `3/4 · 约 10 秒`，运行中每秒刷新一次，不跑时停掉定时器。
- 流光：进度条填充层加 `::after` 白色渐变带，`@keyframes dshPolishProgressShine 1.5s ease-in-out infinite` 左右扫过；只在 `bar[data-shine="1"]`（即运行中）出现，`prefers-reduced-motion: reduce` 下整条隐藏。
- 实测（Test Session，todo_write 4 条 → 6 条）：条内文案随进度从 `2/4 · 约 21 秒` 变为 `3/4 · 约 10 秒`；逐帧采样条内亮度峰值位置 `1507 → 1041 → 1139 → 1499`（亮度 547/639/681），确认流光是移动的；无待办时只走不确定动画、不显示数字与估算。
- 版本 1.5.0；`node --check`、`tools/test-client-apply.mjs`（10 effects / 6 slots）、`tools/test-undo-render.mjs` 通过；无新增 crash 日志。

## 1.4.2 — 2026-10-31

### T8 改为「只闪圆点」（用户反馈「删除线条，仅将闪烁功能加在原有的圆点上」）

- 删掉整条圆环：`.dshEnh_SessionRing` 的定位图层、`data-kind` 配色、`@keyframes dshEnhRingBlink` 及其 `prefers-reduced-motion` 兜底全部移除；body 上不再新增任何节点。
- 闪烁改为直接作用在**宿主原有的状态圆点**上：状态变成「完成未读」或「待用户操作」且该行不是当前选中会话时，用 Web Animations API 跑一段 900ms 的 `opacity 1 → .15 → 1 → .15 → 1`（闪两下即停），动画结束自动回收，不写宿主类名/内联样式，也不改宿主结构。
- 组件只剩一行 `display:none` 的锚点用于定位会话行；不再有 300ms 轮询定位、不再有 rect 计算与 body 图层。
- `prefers-reduced-motion: reduce` 时直接不闪。
- 实测（150% DPI，P2 probe message 后台跑完）：圆点出现后采样 `69 → 49/61 → 57/57 → 69`（两次变暗）后稳定，侧栏再无任何线条；当前选中行不闪。
- 版本 1.4.2；`node --check`、`tools/test-client-apply.mjs`（10 effects / 6 slots）、`tools/test-undo-render.mjs` 通过。

## 1.4.1 — 2026-10-31

### T8 环造型调整（用户反馈「应环绕整个图标、线条再细一点」）

- 环直径由「图标 + 6px」放大到「图标 + 12px」（下限 20px、上限 30px），整个图标被完整框住并留出均等间隙，不再只贴着左侧那一小块。
- 描边 `2px → 1.5px`，外发光由 `0 0 6px 1px .45` 收到 `0 0 5px 0 .38`，线更细、光更收敛。
- 形状仍跟随宿主 `corner-shape`（与会话图标同为圆角方形）；如需正圆，可加 `corner-shape: round`。
- 实测（150% DPI）：绿环（后台完成）与橙环（待回答）都以新尺寸环住图标，与标题文字仍留有间隙；进入会话后照常 190ms 内消失。
- 版本 1.4.1；`node --check`、`tools/test-client-apply.mjs`、`tools/test-undo-render.mjs` 通过。

## 1.4.0 — 2026-10-31

### T8 侧栏会话状态环

- 用户不在某个会话界面时，该会话若在后台跑完，侧栏该行的图标外圈会出现一圈绿环（`#30c463`），出现时闪两下（`@keyframes dshEnhRingBlink .62s ease-in-out 2`）后常驻；切进该会话后 260ms `opacity` 过渡平滑淡出。
- 若该任务在等用户操作（`pendingInteraction`：审批 / 提问 / 计划确认），同一位置的环改为橙色（`#f5a623`），其余行为一致。
- 落点：锚点注册在 `sidebar.workspaces.session.row.action`（宿主每行无条件渲染），圆环画在 `document.body` 的固定图层上——因为 `sidebar.session.row.leading` 在非 idle 状态会被宿主的 `StateDot` 顶替，不能用来挂组件。
- 状态来源：root hook `useSessionStatus` 的 `snapshot.get(sessionId)` → `{ running, pendingInteraction, completionUnread }`，纯事件驱动，不轮询任务状态；只有「定位」用 300ms 间隔跟随列表滚动/窗口缩放。
- 已选中（`row[aria-selected="true"]`）的行不画环：否则「待回答」会一直挂着，用户盯着的会话反而一直亮橙圈。
- 实测（150% DPI）：后台完成 → 绿环，帧采样 `green=61 → 322 → 61 → 322 → 61`（两次闪烁）后稳定 322；后台等待回答 → 橙环（实测 420 像素同形状）；点击该行进入后 190ms 内消失；当前会话行始终无环。
- 版本 1.4.0；`node --check`、`tools/test-client-apply.mjs`（10 effects / 6 slots，含 `dsh-polish-ring`）、`tools/test-undo-render.mjs` 通过；无新增 crash 日志。

## 1.3.1 — 2026-10-31

### T6 光晕增强（用户反馈「让光晕更明显一点」）

- 描边由 `0 0 0 1px rgba(122,170,255,.30)` 提升到 `0 0 0 2px rgba(122,170,255,.62)`；外发光由单层 `0 0 18px 3px .20` 改为双层 `0 0 12px 2px .40` + `0 0 30px 8px .30`。
- 呼吸下限 `.60 → .78`（幅度略收、整体更亮），`scale` 上限 `1.0035 → 1.004`；`clip-path` 边距 `-22px → -36px`，让更大的外发光有空间，但底边依旧裁掉，底栏统计仍不可能被遮挡。
- 实测（Test Session）：运行中框外蓝色光晕明显，底栏 `轮次 · tok/s · token · 缓存命中` 行清晰无遮挡；任务结束后光晕消失且输入框/底栏位置不变。
- 版本 1.3.1；`node --check`、`tools/test-client-apply.mjs`、`tools/test-undo-render.mjs` 通过；无新增 crash 日志。

## 1.3.0 — 2026-10-31

### T6 运行态聚焦光晕

- 任务运行时，输入框外壳周围出现淡蓝色光晕（`box-shadow: 0 0 0 1px rgba(122,170,255,.30), 0 0 18px 3px rgba(122,170,255,.20)`），低幅呼吸：`@keyframes dshEnhGlowBreath`，`opacity .60 ↔ 1`、`scale 1 ↔ 1.0035`，3.6s `ease-in-out infinite`；任务结束 `opacity` 过渡 `.42s` 平滑消失。
- 实现方式：body 上的固定图层 `div.dshPolishGlow_ring`（`position:fixed; pointer-events:none; z-index:900`），矩形由组件从锚点向上找到的「输入框外壳」`getBoundingClientRect()` 提供，`ResizeObserver` + `resize` + 600ms 低频对齐同步；**不插入宿主节点、不参与布局**。
- 不遮挡底栏：图层用 `clip-path: inset(-22px -22px 0 -22px)` 把底边裁掉，光晕只出现在输入框上/左/右三侧，物理上不可能盖到底栏的轮次/步数/token 统计。
- 光晕复用 `conversation.input.activity` 这一个 single 座位（与 P2 撤回键同一组件），不额外注册第二个组件争抢座位。
- `prefers-reduced-motion` 下呼吸动画与过渡都关闭（静态光晕）。
- 实测（Test Session）：运行中截到光晕（框外淡蓝描边）、底栏统计行完全不受影响；任务结束后光晕消失、输入框尺寸与底栏位置不变；运行期沿上边缘采样亮度在 `26 ↔ 29` 之间周期变化（呼吸生效）。
- 版本 1.3.0；`node --check`、`tools/test-client-apply.mjs`（9 effects / 5 slots）、`tools/test-undo-render.mjs` 通过；无新增 crash 日志。

## 1.2.0 — 2026-10-31

### T5 顶栏下方状态指示条

- 新增贯穿左右的一条 2px 状态条（`position: fixed; top: var(--dsh-windows-titlebar-height, 40px)`，`pointer-events: none`，`z-index: 1099`），挂在 `document.body`，不进入任何 slot 的布局流，因此不推动也不遮挡顶栏。
- 三色映射：运行 `#4d6bfe`（复用 `--dsw-alias-state-business-primary`）、完成 `#30c463`、撤回/中断 `#e5484d`；颜色与出现都由 CSS `transition` 完成（`opacity .22s`、`transform .24s cubic-bezier(.4,0,.2,1)`、`background-color .3s`），`prefers-reduced-motion` 下过渡置空。
- 事件驱动：无头桥组件 `StatusBridge` 用官方 `useSession(s => s.running)` 推 running/done，本插件自己的两处撤回（P2 取消任务、T3 缓冲撤回）在成功回调里 `pulseCancel()` 置红。完成/红条保持 `2600ms` 后淡出。
- 输入隐藏：`useInput(s => s.draft)` 变化 → 收起色条，停止输入 `1200ms` 后恢复（防抖）。**不是**「草稿非空就隐藏」——撤回后草稿会留在输入框里，那样会把刚点亮的红条立刻藏起来。
- 实测（Test Session / 全局，物理像素 y=60..62 采样）：空闲 `(21,21,23)` 无条 → 运行 `(122,170,255)` 蓝 → 完成 `(48,196,99)` 绿 → 约 2.6s 后淡回底色；缓冲内撤回 `(229,72,77)` 红；输入草稿时隐藏为底色，停止输入 1.2s 后恢复。
- 已知限制：宿主 `sessionStatus` 快照只有 `running / pendingInteraction / completionUnread`，**没有失败信号**，所以红态只覆盖本插件可确定的中断（撤回/取消），不对「任务失败」做猜测。
- 版本 1.2.0；`node --check`、`tools/test-client-apply.mjs`（9 effects / 5 slots，含 `dsh-polish-status`）、`tools/test-undo-render.mjs` 通过；无新增 crash 日志。

## 1.1.0 — 2026-10-31

### T4 联网工具开关

- 输入区工具行（权限控件右侧，官方 slot `conversation.input.left`）新增「🌐 联网」开关：胶囊形，复用 `--dsw-alias-*` 设计 token，开态蓝色描边 + 滑块右移 + 蓝色地球，关态灰底 + 滑块左移 + 地球斜杠；`role="switch"` + `aria-checked`，悬停提示「联网已开启，点击关闭」/「联网已关闭，点击开启」。
- 门控（Host 半边 `index.js`）：关闭时 `ctx.tools.guard()` 拒绝 `web_search` / `web_fetch`，理由串「联网工具已关闭：请在输入区的「联网」开关中重新开启后再试。」；用 guard 而非 restrict，不注销任何工具，**不影响其他插件注册**。
- 提示词约束：同时 `ctx.systemPrompt.section({ name: 'dsh-polish-no-web', order: 900 })` 注入「本轮禁止联网（含 curl/wget/fetch 等间接方式）」；开启时一并移除（`system-prompt/change` 自动重算）。
- 状态通道与持久化：Host 注册 `GET/POST /dsh-polish/web`（`kind: 'exact'`），状态写入插件目录 `state.json`（`{ "webEnabled": boolean }`），进程重启后读回。Client 用**相对路径** `fetch('/dsh-polish/web')` —— 桌面端页面是 `dsh-app://app/` 自定义协议，用 `location.origin` 拼绝对 URL 会失败（`设置失败: no-origin`）。
- 交互：点击乐观更新 → 失败回滚并在开关上方 toast「设置失败: <原因>」2.4s。
- 实测（Test Session / 全局）：关 → `GET {"enabled":false}` 且 `state.json` 同步 → 直接调用 `web_search` 返回「联网工具已关闭：请在输入区的「联网」开关中重新开启后再试。」，同时系统提示词里出现禁止联网段落；开 → `GET {"enabled":true}`、段落消失、工具恢复；关掉后整页重载，开关仍显示关，重载为开则显示开。
- 版本 1.1.0；`node --check`（client + index）、`tools/test-client-apply.mjs`（8 effects / 4 slots）、`tools/test-undo-render.mjs` 通过；无新增 crash 日志。

## 1.0.9 — 2026-10-31

### T3 增补：缓冲期内再点发送键 = 立即发送

- 点击拦截里新增分支：若当前正处于 3s 缓冲窗口，点发送键不再「重新计时」，而是 `flushBuffer()` 立刻提交（剩余倒计时作废）。
- `flushBuffer()` 用**当前草稿**刷新记录再提交，因此缓冲期内改过文案也能按最新内容发出（不会因为 `draft changed` 被丢弃）；没有改动时行为与到点自动发送一致。
- 撤回键仍可点：缓冲内点撤回 = 取消（不发送）；点发送键 = 立即发送；两者互不干扰。
- 实测（Test Session，`t3force.ps1 -DelayMs 900`）：Enter 后 0.95s 点发送键 → 1.06s 帧已有气泡、输入框清空；3.28s 帧进入运行态且只有一条气泡（无重复提交）；不点第二次仍按 3s 自动发送。
- 版本 1.0.9；`node --check`、`tools/test-client-apply.mjs`、`tools/test-undo-render.mjs` 通过；无新增 crash 日志。

## 1.0.8 — 2026-10-31

### T3：发送缓冲 3s + 环形倒计时

- 发送手势（Enter / 点发送键）被捕获层拦下：不立刻提交，先进入 3s 缓冲窗口；窗口内撤回键亮起并带白色环形倒计时（`stroke-dasharray:99` + `stroke-dashoffset 99→0`，3s `linear`，纯 CSS 关键帧，不跑 JS 计时器）。
- 缓冲到点才走官方 `inputActions.submit('queue', 'dsh-enh-buffer')`，因此**撤回期从未提交、也不需要调用停止运行中任务**：撤回只取消这次待提交，草稿/附件/光标一直是原样。
- 守卫：草稿为空（纯附件）不拦、运行态下那颗键是「停止」不拦、`isComposing`/`keyCode 229` 不拦；缓冲期内草稿被改动 → 放弃这次提交（`buffer dropped (draft changed)`），绝不覆盖用户新输入；组件卸载时清掉未触发的倒计时。
- 提交后仍保留原 P2 的取消式撤回（任务已启动时可停），两种撤回互不干扰。
- 缓冲期不插入用户气泡：气泡在 3s 到点时随提交一起出现（宿主没有「先渲染后调度」的钩子，见「已知限制」）。
- 实测（Test Session，同一进程内精确定时）：`t3revoke.ps1 -DelayMs 700` → 0.75s 点击撤回，3s 后仍无气泡、草稿保留、轮次计数未变；不撤回时 3s 到点自动发出并进入运行态。
- 环形逐帧增长（白像素计数，抓帧于 0.81s/1.69s/2.58s）：162 → 271 → 378（首版方向写反，`from 0 to 99` 会让弧线缩短，已改为 `from 99 to 0`）。
- 版本 1.0.8；`node --check`、`tools/test-client-apply.mjs`、`tools/test-undo-render.mjs` 通过；无新增 crash 日志。

## 1.0.7 — 2026-10-31

### T2：Alt+Enter 换行

- 宿主对 `Alt+Enter` 主动放行（README：Alt / AltGraph / Ctrl+Cmd / Shift+Ctrl 组合「keeps the DOM event available to application shortcuts」，且不 `preventDefault`），因此可在不覆盖任何保留绑定的前提下补一条换行键。
- 实现：撤回键组件内的 `keydown` 捕获监听（作用域为「包含可编辑区的祖先容器」，只处理本会话 composer）→ `inputActions.captureInsertion()` + `inputActions.insertText('\n', span)`，走宿主官方 action，插入的是 Lexical 可撤销节点。
- 守卫：`event.key==='Enter' && altKey && !ctrlKey && !metaKey && !shiftKey`；`isComposing` / `keyCode 229`（IME 组词）直接放行；`span.draftRev` 过期（`insertText` 返回 false）时放弃本次换行，绝不覆盖新内容。
- 常驻零占位锚点 `.dshEnh_UndoAnchor`（`display:none`）：组件收起时仍有一件稳定的 DOM 参照，供按键监听定位 composer；不参与布局、不可交互。
- 未改动宿主绑定：Shift+Enter 换行、Enter 发送、Ctrl/Cmd+Enter 互补投递保持原样。
- 版本 1.0.7；`node --check`、`tools/test-client-apply.mjs`、`tools/test-undo-render.mjs` 通过；无新增 crash 日志。

## 1.0.6 — 2026-10-31

### T1 调优：入场动画放慢到肉眼可辨

- 实测（本机 150% DPI，`tools/tap.ps1` 同进程定时抓帧，偏移 120/300/520/760 ms）：`.52s` 版本在 120 ms 时已完成 90% 位移，人眼即「瞬间出现」。
- 调整：`.dshPolishUndoIn .52s` → **`.9s`**（`cubic-bezier(.22,.85,.28,1)`，模型名区 40px 左移分摊到 0.9s）；`.dshPolishUndoPopIn .44s .1s` → **`.78s` 无延迟**（`cubic-bezier(.2,.9,.3,1)`，`opacity 0→1`、`translateX(14px)→0`、`scale(.45)→1`，撤回键从发送键一侧「长出来」）。
- 复测同一组偏移：`labelLeftX` 1591(静止) → 1567 → 1546 → 1537 → 1534，红圆像素覆盖 1145 → 1745 → 1995 → 2004（满值 2004），逐帧可见。
- 退场仍为 `.3s` 收起；`prefers-reduced-motion:reduce` 保持「无动画、直接终态」。
- 按钮底色还原 `#e5484d`（诊断期间的临时亮绿已清除）。

## 1.0.5 — 2026-10-31

### T1 修复：发送后撤回键不再「瞬间出现」

- 根因：展开靠 `mounted` + `requestAnimationFrame(() => setExpanded(true))` 两段状态。首个 `rAF` 可能在浏览器首次样式解析前就触发，`width:0 → 40px` 在同一帧内完成 → 没有过渡，肉眼即「瞬间出现」。
- 修复：去掉 `expanded` 两段状态，`data-open` 直接由 `open` 驱动，入场/退场改为 CSS 关键帧并 `animation-fill-mode:both`：
  - `.dshPolishUndo_cell[data-open="1"]{animation:dshPolishUndoIn .52s cubic-bezier(.4,0,.2,1) both}`（`@keyframes` 内 `width:0 → 40px`）。
  - 新增 `.dshPolishUndo_pop` 包裹层承担淡入：`.44s cubic-bezier(.34,.9,.35,1) .1s both`，`opacity 0→1`、`translateX(10px)→0`、`scale(.8)→1`；按钮自身只保留 hover/active 的 `transform` 过渡，两者不再互相覆盖。
  - 退场 `.28s` / `.16s`，`UNDO_COLLAPSE_MS` 260→300 与之对齐。
- `prefers-reduced-motion:reduce`：关键帧置空、`.dshPolishUndo_pop` 直接取终态（`opacity:1; transform:none`），不会因基础态 `opacity:0` 而不可见。

## 1.0.4 — 2026-10-31

### T1 发送后过渡动画序列

- 模型名区左移：`.dshPolishUndo_cell` 宽度 0 → 40px（6px 内距 + 34px 按钮，常量），`transition:width .26s cubic-bezier(.4,0,.2,1)`（加速—减速）。
- 撤回键淡入：`.dshPolishUndo_btn` 由 `opacity:0; transform:translateY(-2.75px) translateX(8px) scale(.82)` → `opacity:1; translateX(0) scale(1)`，`transform .26s cubic-bezier(.34,.86,.33,1)` + `opacity .2s ease`，延迟 60ms（让左移先起步）。
- 按钮只做 transform/opacity（合成层），不再参与宽度动画；禁用态 `.dshPolishUndo_cell[data-open="1"] .dshPolishUndo_btn:disabled{opacity:.55}`，避免基础态 opacity:0 覆盖。
- `prefers-reduced-motion:reduce` 下 `.dshPolishUndo_cell/.dshPolishUndo_btn` 过渡置空（状态直切，不播放动画）。
- 撤回点击后的收起走同一套属性反向过渡，动画与展开一致。

## 1.0.3 — 2026-10-31

### 调整（P2 撤回键）

- **图标改为掉头箭头**：左竖线上行 → 180° 半圆 → 右竖线下行 → 朝下的箭头（`M4.7 12V6.9a2.7 2.7 0 0 1 5.4 0V10.2` + `M8 7.9l2.1 2.3 2.1-2.3`），图标 17→18px，即公路「掉头标识」的形态。
- **悬停浮层**：`title` 原生提示改为自绘 `.dshPolishUndo_tip`（`role="tooltip"`，位于按钮上方的 `bottom:calc(100% + 8px)`，`opacity/transform` 140ms 过渡），文案 `undo.label` 由「撤回发送」改为「撤回」。
- **仅任务进行时显示**：`open = running && (ARMED || CANCELLING)`，任务结束（`running` 转假）立即收起，不再保留 1.2s 可点窗口。

### 实机验证（Test Session 会话，Windows 桌面版 127.0.0.1:1781，150% DPI）

- 发送 → 红色键出现，放大截图确认掉头箭头；悬停 → 上方浮层显示「撤回」。
- 任务自然结束后按钮消失（无残留可点区域）。
- 发送后 0.8s 点撤回 → 任务取消、输入框恢复 `用 500 字总结 DSH 插件开发要点`、按钮收起、发送键回到 ↑。

## 1.0.2 — 2026-10-31

### 调整（P2 撤回键造型与文案）

- 撤回键改成与宿主发送键同尺寸的正圆：`width/height:34px`、`border-radius:999px`，并补 `corner-shape:round`（宿主 `.GRgSLq_primary` 即用该属性，缺它会渲染成方形圆角）。
- 垂直平移 `translateY(-2.75px)`，使圆心与发送键圆心重合（发送键自身 `.GRgSLq_primary{transform:translateY(-2px)}`）。
- 去掉 `.dshPolishUndo_cell` 的 `overflow:hidden`（它把 34px 圆裁成 51×45 物理像素的扁圆），改用 `visibility` 在收起动画结束后隐藏，宽度动画保持不变。

### 修复（文案键直出）

- locale 字典改为**扁平键**：`lookup(ns,key,chain)` 实现是 `dicts.get(ns)?.get(locale)?.[key]`，嵌套对象取不到，导致提示气泡直出 `undo.label` / `refresh.label`。

### 实机验证（Windows 桌面版，GUI 127.0.0.1:1781，150% DPI）

- 按颜色定位实测：撤回键包围盒 51×51 物理像素、中心 (1901,1465)；发送键 51×51、中心 (1970,1466) → 直径同为 34 CSS px，圆心纵向差 1 物理像素（取整误差）。
- 悬停提示显示「一键刷新」，不再是 `refresh.label`。
- 撤回 → 任务取消、输入框恢复 `p2 final check`、按钮收起、发送键回到 ↑。

## 1.0.1 — 2026-10-31

### 修复（P2 发送后撤回不可见）

- **根因 1：撤回键宽度恒为 0。** CSS 只有 `.dshPolishUndo_cell{width:0}` 和 `[data-open="0"]{opacity:0}`，漏了展开规则，按钮进入 ARMED 也被裁成 0 宽度。补 `.dshPolishUndo_cell[data-open="1"]{width:34px;opacity:1}`。
- **根因 2：座位放错，模型名区不会左移。** 原来注册在 `conversation.input.right`（在模型选择器之前），撤回键插在模型名左侧，模型名不动。改注册 `conversation.input.activity`（模型选择器之后、提交键之前的 single 座位），撤回键从 0→34px 的过渡把模型名区向左推，即需求要的加减速位移。
- 保持零占位：空闲时组件返回 `null`，座位里不留空节点。

### 实机验证（Windows 桌面版，GUI 127.0.0.1:1781）

- 发送 `p2 undo check` → 模型名区左移（约 46px，含 12px gap）、发送键左侧淡入红色圆形撤回键（白色向下箭头）。
- 点击撤回 → 状态机 `cancelling` → `restored` → `idle`：任务经 `conversation.cancel()` 取消，输入框恢复 `p2 undo check`，发送键从 ■ 回到 ↑。
- `running` 结束后 1.2s 自动收起；显示期间用户重新输入则立即收起且不覆盖新内容。

## 1.0.0 — 2026-10-31

首个对外发布版本，由内部名 `@local/dsh-compat-ui` 更名为 **`dsh-polish`（DSH Polish）**。

### 更名（破坏性）

| 位置 | 旧 | 新 |
| --- | --- | --- |
| npm 包名 / loader id / entry id | `@local/dsh-compat-ui` / `dsh-compat-ui` | `dsh-polish` |
| slot id | `dsh-compat-refresh`/`-undo`/`-progress` | `dsh-polish-refresh`/`-undo`/`-progress` |
| CSS 类前缀 | `.dshCompat*` | `.dshPolish*` |
| 样式标签 | `style[data-dsh-compat-css]` | `style[data-dsh-polish-css]` |
| DOM 属性 | `data-dsh-compat-*` | `data-dsh-polish-*` |
| locale NS / effect label | `dsh-compat-ui` / `dsh-compat-ui: *` | `dsh-polish` / `dsh-polish: *` |

升级须知：旧版本需先 `remove_bundle` 再装新包，否则 profile 里会残留两条 composition 条目。

### 能力

- **一键刷新**：桌面标题栏「编辑」右侧的仅图标按钮（28px，与菜单项同高）。点击 → 图标顺时针 360°（`0.32s cubic-bezier(.34,.04,.32,1)`）→ `location.reload()` 软刷新页面；宿主进程与正在运行的任务不受影响。刷新中按钮 `disabled` 防重复点击；1.5s 看门狗兜底，失败在按钮右侧提示「刷新失败」。
- **发送后撤回**：发送后注册进 `conversation.input.right`，模型名区因 `.trailing` 的 `margin-left:auto` 自然左移（不改写宿主节点）；撤回键为 28px 红色圆形 + 白色向下箭头，淡入出现。点击 → 记录 `{text, attachmentIds}` → `sessions.scope(id).get('conversation').cancel()` → 成功后 `setDraft` + `addAttachments` + `persistDraft` 恢复输入；失败在按钮上方 toast「撤回失败」并回滚，`UNDO` 状态机防重复点击。
- **顶栏进度条**：桥组件读取 `useSession(s => s.running)` 与 `useProjection('todos')`，把 `{running, done, total}` 写入 store；绘制层挂在 `document.body`（`top:0; left:50%; translateX(-50%)`，`z-index:1099`，`pointer-events:none`），宽度过渡 `0.3s cubic-bezier(.42,0,.28,1)`。有 todo 时显示「已完成/总数」与确定进度；无 todo 时走不确定动画，绝不伪造数字；无任务时不渲染。

### 修复

- `ctx.effect` 返回 `{ dispose }` 普通对象触发 Cordis `TypeError: Invalid effect` → client 条目 failed → **web boot 整体启动失败**。现在统一由 `install(label, body)` 归一化为「函数或 undefined」并 `try/catch` 隔离，任何本插件异常都不再影响宿主启动。
- 进度条在座位内使用 `position:fixed` 时被祖先的 `backdrop-filter/transform` 变成相对包含块，落不到顶栏中心 → 改为「无头桥 + body 图层」。
- 冷启动时桌面标题栏可能晚于插件物化创建 → 有界 `MutationObserver`（15s）等待后挂载，并与降级座位共享 `titlebarState` 保证互斥。

### 已知限制

- P2 的实机验证需要真发一条消息（自动化截图无法稳定覆盖），逻辑已由 headless 契约测试 + 官方 `conversation.cancel()` 路径保证。
- 光标只能恢复到文末：宿主没有设置选区/光标位置的公开 API。
