/**
 * Host half of dsh-gloss.
 *
 * 当前插件仅保留两项界面增强：
 * - 长文本换行（Alt+Enter）：完全在 Client 半边实现；
 * - 临时断网（联网开关）：门控在这里落地。
 *
 * 遵循官方最佳实践：
 * - Host 插件导出 `name` 与 `apply(ctx, config)`，并通过 `ctx.inject([...], ...)`
 *   声明对 `webServer`、`tools`、`systemPrompt` 等服务的依赖；
 * - 所有注册的资源（路由、门控）都在 inject 返回的清理函数或 `ctx.effect` 中
 *   成对释放，保证插件卸载或 HMR 重载时自动回收；
 * - 使用 `ctx.tools.guard()` 做同步拒绝，不注销工具，不影响其他插件。
 *
 * 联网开关状态由本插件持有并持久化到同目录的 `state.json`，关闭时用两条官方通道生效：
 *
 * 1. `ctx.tools.guard()` —— 拒绝 `web_search` / `web_fetch` 的调用（只拒绝，
 *    不注销别人的工具，因此不影响其他插件的注册）。
 * 2. `ctx.systemPrompt.section()` —— 注入一条「本轮禁止联网」的提示词约束，
 *    开关打开时移除。
 *
 * Client 半边通过 `ctx.webServer.register()` 暴露的 `/dsh-gloss/web` 路由读写
 * 这个状态（GET 读、POST 写），因此 UI 与门控共享同一份事实。
 *
 * 状态与路由都挂在进程级单例上（`Symbol.for`）：插件被 HMR 重新 apply 时，
 * 旧实例的清理可能与新实例的注册交错，导致 `webServer.register` 撞上
 * “duplicate route” 抛错、路由被移除后没人补回来（客户端 POST 全 404、开关
 * 点了又弹回去）。单例保证：状态只有一份、路由只注册一次、失败时退避重试。
 */
import { readFile, writeFile } from 'node:fs/promises';

const STATE_FILE = new URL('./state.json', import.meta.url);
const ROUTE_PATH = '/dsh-gloss/web';
const WEB_TOOL_NAMES = ['web_search', 'web_fetch'];
const MAX_BODY_BYTES = 8192;
const ROUTE_RETRY_MS = 400;
const ROUTE_MAX_ATTEMPTS = 12;

const NO_WEB_REASON = '联网工具已关闭：请在输入区的「联网」开关中重新开启后再试。';
const NO_WEB_PROMPT = [
  '联网工具已由用户在输入区关闭（DSH Gloss「联网」开关为关闭状态）。',
  '本轮不要调用 web_search、web_fetch，也不要通过终端、脚本或任何间接方式访问网络（curl、wget、Invoke-WebRequest、fetch 等）。',
  '如果任务确实必须联网，先用一句话说明需要联网，并请用户打开「联网」开关，不要自行绕过。'
].join('\n');

const RUNTIME_KEY = Symbol.for('dsh-gloss.runtime@1');

function runtime() {
  const existing = globalThis[RUNTIME_KEY];
  if (existing !== undefined && existing !== null) return existing;
  const created = {
    enabled: true,
    loaded: false,
    disposers: [],
    gate: null,
    routeDispose: null,
    routeAttempts: 0,
    routeTimer: null,
    server: null
  };
  globalThis[RUNTIME_KEY] = created;
  return created;
}

export const name = 'dsh-gloss';

function warn(error) {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') console.warn('[dsh-gloss]', error);
}

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        resolve('');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

export function apply(ctx) {
  const rt = runtime();

  const clearGates = () => {
    const list = rt.disposers;
    rt.disposers = [];
    for (const dispose of list) {
      try {
        dispose();
      } catch (error) {
        warn(error);
      }
    }
  };

  /** 状态变化时重新安装门控；服务还没就绪就交给 inject 回调里的首次 sync。 */
  const sync = () => {
    if (typeof rt.gate === 'function') rt.gate();
  };

  const persist = async () => {
    try {
      await writeFile(STATE_FILE, `${JSON.stringify({ webEnabled: rt.enabled }, null, 2)}\n`, 'utf8');
      return true;
    } catch (error) {
      warn(error);
      return false;
    }
  };

  const respond = (res, status, payload) => {
    const body = JSON.stringify(payload);
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  };

  const handler = async (req, res) => {
    const url = new URL(req.url ?? ROUTE_PATH, 'http://dsh-gloss.local');
    if (url.pathname !== ROUTE_PATH) {
      respond(res, 404, { ok: false, reason: 'not-found' });
      return;
    }
    if (req.method === 'GET') {
      respond(res, 200, { ok: true, enabled: rt.enabled });
      return;
    }
    if (req.method !== 'POST') {
      respond(res, 405, { ok: false, reason: 'method-not-allowed' });
      return;
    }
    const raw = await readBody(req);
    let patch = null;
    try {
      patch = JSON.parse(raw === '' ? '{}' : raw);
    } catch {
      respond(res, 400, { ok: false, reason: 'bad-json' });
      return;
    }
    if (typeof patch?.enabled !== 'boolean') {
      respond(res, 400, { ok: false, reason: 'bad-request' });
      return;
    }
    const changed = rt.enabled !== patch.enabled;
    rt.enabled = patch.enabled;
    if (changed) sync();
    const persisted = await persist();
    respond(res, 200, { ok: true, enabled: rt.enabled, persisted });
  };

  /**
   * 路由只注册一次；撞上 “duplicate route”（上一次 apply 的注册还没撤掉）时
   * 退避重试，直到挂上为止——否则客户端会一直 404。
   */
  const registerRoute = (server) => {
    if (server === null || server === undefined) return;
    rt.server = server;
    if (typeof rt.routeDispose === 'function') return;
    if (rt.routeTimer !== null) return;
    const attempt = () => {
      rt.routeTimer = null;
      if (typeof rt.routeDispose === 'function') return;
      rt.routeAttempts += 1;
      try {
        const dispose = server.register({ kind: 'exact', path: ROUTE_PATH, handler });
        rt.routeDispose = typeof dispose === 'function' ? dispose : () => {};
        rt.routeAttempts = 0;
      } catch (error) {
        warn(error);
        if (rt.routeAttempts < ROUTE_MAX_ATTEMPTS) {
          rt.routeTimer = setTimeout(attempt, ROUTE_RETRY_MS);
        }
      }
    };
    attempt();
  };

  // 读回上次的状态（首次运行没有文件，保持默认开启）。
  if (rt.loaded !== true) {
    rt.loaded = true;
    readFile(STATE_FILE, 'utf8')
      .then((raw) => {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.webEnabled === 'boolean') rt.enabled = parsed.webEnabled;
      })
      .catch(() => {})
      .finally(() => {
        sync();
      });
  }

  // 路由必须等 webServer 就绪再挂：插件 apply 早于该服务时 `ctx.get('webServer')`
  // 拿不到实例，静默跳过注册 → 客户端 GET/POST 全 404，开关点了也会弹回去。
  ctx.inject(['webServer'], (inner) => {
    registerRoute(inner.webServer);
    return () => {
      if (rt.routeTimer !== null) {
        clearTimeout(rt.routeTimer);
        rt.routeTimer = null;
      }
      if (typeof rt.routeDispose === 'function') {
        try {
          rt.routeDispose();
        } catch (error) {
          warn(error);
        }
        rt.routeDispose = null;
      }
    };
  });

  // 门控同样等 tools/systemPrompt 就绪；服务重载时 inject 会重新调用这里。
  ctx.inject(['tools', 'systemPrompt'], (inner) => {
    const install = () => {
      clearGates();
      if (rt.enabled) return;
      try {
        const dispose = inner.tools.guard((execution) =>
          WEB_TOOL_NAMES.includes(execution?.name) ? NO_WEB_REASON : undefined
        );
        if (typeof dispose === 'function') rt.disposers.push(dispose);
      } catch (error) {
        warn(error);
      }
      try {
        const dispose = inner.systemPrompt.section({ name: 'dsh-gloss-no-web', order: 900, text: NO_WEB_PROMPT });
        if (typeof dispose === 'function') rt.disposers.push(dispose);
      } catch (error) {
        warn(error);
      }
    };
    rt.gate = install;
    install();
    return () => {
      if (rt.gate === install) rt.gate = null;
      clearGates();
    };
  });

  if (typeof ctx.effect === 'function') {
    ctx.effect(
      () => () => {
        clearGates();
      },
      'dsh-gloss: web access'
    );
  }
}
