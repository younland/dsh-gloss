/**
 * dsh-gloss —— 仅保留两项界面增强：
 * - 长文本换行：Alt+Enter 在输入区插入可撤销的换行符；
 * - 临时断网：输入区工具行内的联网开关，关闭后拒绝 web_search / web_fetch。
 *
 * 纯 Client 插件：Host 半边（index.js）仅负责联网开关的门控与状态持久化。
 * 全部挂载点均为官方 slot，不修改宿主渲染树、不替换宿主节点。
 */
window.__ModuleLoader__.load({
  id: '@younland/dsh-gloss',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useRef, useState } = React;

    const NS = 'dsh-gloss';

    const ID_WEB = 'dsh-gloss-web';
    const ID_LINE_BREAK = 'dsh-gloss-line-break';
    /** 与 Host 半边共享的开关状态路由（Host 用同一个路径）。 */
    const WEB_ROUTE = '/dsh-gloss/web';

    const CSS = `
.dshGlossWeb_row{position:relative;display:flex;align-items:center;flex:none}
.dshGlossWeb_btn{appearance:none;display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px;border:1px solid var(--dsw-alias-interactive-bg,rgba(255,255,255,.14));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa3b2);font-size:12px;line-height:1;cursor:pointer;flex:none;transition:background-color .16s ease,border-color .16s ease,color .16s ease,opacity .16s ease}
.dshGlossWeb_btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,#cdd3dd)}
.dshGlossWeb_btn[data-on="1"]{color:var(--dsw-alias-state-business-primary,#4d6bfe);border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}
.dshGlossWeb_btn:disabled{cursor:default;opacity:.6}
.dshGlossWeb_btn[data-unavailable="1"]{cursor:not-allowed;opacity:.45}
.dshGlossWeb_btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:1px}
.dshGlossWeb_globe{width:14px;height:14px;flex:none}
.dshGlossWeb_slash{stroke:currentColor;stroke-width:1.3;stroke-linecap:round}
.dshGlossWeb_text{font-size:12px;white-space:nowrap}
.dshGlossWeb_track{position:relative;width:22px;height:13px;border-radius:999px;background:var(--dsw-alias-interactive-bg,rgba(255,255,255,.16));flex:none;transition:background-color .18s ease}
.dshGlossWeb_btn[data-on="1"] .dshGlossWeb_track{background:var(--dsw-alias-state-business-primary,#4d6bfe)}
.dshGlossWeb_knob{position:absolute;top:2px;left:2px;width:9px;height:9px;border-radius:999px;background:#fff;transition:transform .2s cubic-bezier(.4,0,.2,1)}
.dshGlossWeb_btn[data-on="1"] .dshGlossWeb_knob{transform:translateX(9px)}
.dshGlossWeb_toast{position:absolute;bottom:calc(100% + 8px);left:0;white-space:nowrap;font-size:12px;line-height:18px;padding:3px 8px;border-radius:6px;background:var(--dsw-alias-bg-elevated,#2b2f36);color:#ff8b8b;box-shadow:0 2px 10px rgba(0,0,0,.3);z-index:2}
@media (prefers-reduced-motion:reduce){.dshGlossWeb_btn,.dshGlossWeb_track,.dshGlossWeb_knob{transition:none}}
`;

    const ZH = {
      'web.label': '联网',
      'web.on': '联网已开启，点击关闭',
      'web.off': '联网已关闭，点击开启',
      'web.failed': '设置失败',
      'web.unavailable': '联网开关暂不可用（宿主未响应）'
    };
    const EN = {
      'web.label': 'Web',
      'web.on': 'Web access on — click to turn off',
      'web.off': 'Web access off — click to turn on',
      'web.failed': 'Update failed',
      'web.unavailable': 'Web toggle unavailable (host not responding)'
    };

    function log(error) {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') console.warn('[dsh-gloss]', error);
    }

    /**
     * 作用域化样式：单一 data 标记，通过 `ctx.effect` 注册并在插件卸载时移除。
     *
     * 官方推荐在 `apply` 内用 `ctx.effect`/`ctx.on` 管理样式、定时器、监听器等资源，
     * 并返回清理函数；这样插件被禁用或 HMR 重载时资源会被框架自动回收。
     */
    function installStyles() {
      if (document.querySelector('style[data-dsh-gloss-css]') !== null) return () => {};
      const tag = document.createElement('style');
      tag.dataset.dshGlossCss = '';
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    }

    /**
     * 请求用同一个相对路径：桌面端页面自身是 `dsh-app://app/`，该协议会把
     * 同源请求转发到本机 Harness 服务，因此不需要（也不应该）猜 HTTP 端口。
     */
    function webEndpoint() {
      if (typeof fetch !== 'function') return '';
      if (typeof document === 'undefined' || document === null) return '';
      const base = typeof document.baseURI === 'string' ? document.baseURI : '';
      if (base === '') return '';
      return WEB_ROUTE;
    }

    /**
     * 联网开关的共享状态。
     * 唯一事实来源在 Host 半边（`/dsh-gloss/web`）：GET 读、POST 写。
     * 这里做三件事：乐观更新（点击立即反馈）、失败回滚、多实例同步。
     */
    function createWebAccessStore() {
      const listeners = new Set();
      let enabled = true;
      let busy = false;
      let lastError = '';
      let available = true;
      const emit = () => {
        for (const listener of listeners) {
          try {
            listener();
          } catch (error) {
            log(error);
          }
        }
      };
      /**
       * 读 Host 状态。Host 插件比 webServer 服务先 apply 时路由会稍晚就绪，
       * 因此首轮失败按 400/800/1200/1600ms 退避重试，全部失败才判定不可用，
       * 避免把「刚启动还没挂上路由」误显示成开关坏了。
       */
      const probe = async (attempt) => {
        const endpoint = webEndpoint();
        if (endpoint === '') return;
        try {
          const response = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
          if (!response.ok) throw new Error(`web toggle http ${response.status}`);
          const data = await response.json();
          let changed = available !== true || lastError !== '';
          available = true;
          lastError = '';
          if (typeof data?.enabled === 'boolean' && data.enabled !== enabled) {
            enabled = data.enabled;
            changed = true;
          }
          if (changed) emit();
        } catch (error) {
          log(error);
          if (attempt < 4) {
            window.setTimeout(() => {
              void probe(attempt + 1);
            }, 400 * (attempt + 1));
            return;
          }
          available = false;
          lastError = String(error && error.message ? error.message : error).slice(0, 90);
          emit();
        }
      };
      return {
        read: () => enabled,
        isBusy: () => busy,
        isAvailable: () => available,
        readError: () => lastError,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        async load() {
          await probe(0);
        },
        async set(next) {
          const previous = enabled;
          enabled = next;
          busy = true;
          emit();
          const endpoint = webEndpoint();
          if (endpoint === '') {
            lastError = 'no-endpoint';
            busy = false;
            emit();
            return false;
          }
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              cache: 'no-store',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ enabled: next })
            });
            if (!response.ok) throw new Error(`web toggle http ${response.status}`);
            const data = await response.json();
            if (typeof data?.enabled === 'boolean') enabled = data.enabled;
            available = true;
            lastError = '';
            busy = false;
            emit();
            return true;
          } catch (error) {
            log(error);
            const message = String(error && error.message ? error.message : error).slice(0, 90);
            // 404 = 宿主路由没挂上（插件 Host 半边没跑起来），这时把开关标记为不可用，
            // 而不是让用户反复点击却只看到「设置失败」。
            if (message.includes('404')) available = false;
            lastError = message;
            enabled = previous;
            busy = false;
            emit();
            return false;
          }
        }
      };
    }

    /** 输入区工具行最左侧（权限控件右侧）的联网开关。 */
    function WebToggle(props) {
      const { t, webAccess } = props;
      const [enabled, setEnabled] = useState(() => webAccess.read());
      const [busy, setBusy] = useState(() => webAccess.isBusy());
      const [available, setAvailable] = useState(() => webAccess.isAvailable());
      const [failed, setFailed] = useState(false);
      const [errorText, setErrorText] = useState(() => webAccess.readError());
      const failTimer = useRef(null);

      useEffect(() => {
        // 订阅后立刻同步一次：load() 可能在组件挂载前就已完成，
        // 只靠订阅回调会漏掉那一次 emit（表现为 UI 停在默认值）。
        const sync = () => {
          setEnabled(webAccess.read());
          setBusy(webAccess.isBusy());
          setAvailable(webAccess.isAvailable());
          setErrorText(webAccess.readError());
        };
        sync();
        return webAccess.subscribe(sync);
      }, [webAccess]);

      useEffect(
        () => () => {
          if (failTimer.current !== null) window.clearTimeout(failTimer.current);
        },
        []
      );

      const onClick = useCallback(() => {
        if (busy || !available) return;
        const next = !webAccess.read();
        setEnabled(next); // 乐观更新：点击立刻反馈，失败再回滚
        setFailed(false);
        webAccess.set(next).then((ok) => {
          if (ok) return;
          setFailed(true);
          if (failTimer.current !== null) window.clearTimeout(failTimer.current);
          failTimer.current = window.setTimeout(() => setFailed(false), 2400);
        });
      }, [busy, available, webAccess]);

      return h(
        'div',
        { className: 'dshGlossWeb_row' },
        h(
          'button',
          {
            type: 'button',
            role: 'switch',
            'aria-checked': enabled ? 'true' : 'false',
            'aria-label': t('web.label'),
            title: available === false ? t('web.unavailable') : enabled ? t('web.on') : t('web.off'),
            className: 'dshGlossWeb_btn',
            'data-on': enabled ? '1' : '0',
            'data-unavailable': available ? '0' : '1',
            'data-dsh-gloss': 'web-toggle',
            disabled: busy,
            onClick
          },
          h(
            'svg',
            {
              className: 'dshGlossWeb_globe',
              viewBox: '0 0 16 16',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.3,
              'aria-hidden': 'true'
            },
            h('circle', { cx: 8, cy: 8, r: 6 }),
            h('path', { d: 'M2 8h12' }),
            h('path', { d: 'M8 2c1.7 1.8 2.7 3.8 2.7 6S9.7 12.2 8 14c-1.7-1.8-2.7-3.8-2.7-6S7.3 3.8 8 2z' }),
            enabled
              ? null
              : h('line', { className: 'dshGlossWeb_slash', x1: 2.6, y1: 13.4, x2: 13.4, y2: 2.6 })
          ),
          h('span', { className: 'dshGlossWeb_text' }, t('web.label')),
          h(
            'span',
            { className: 'dshGlossWeb_track', 'aria-hidden': 'true' },
            h('span', { className: 'dshGlossWeb_knob' })
          )
        ),
        failed
          ? h(
              'span',
              { className: 'dshGlossWeb_toast', role: 'status' },
              errorText === '' ? t('web.failed') : `${t('web.failed')}: ${errorText}`
            )
          : null
      );
    }

    /** 从锚点向上找到「包含可编辑区」的组件容器，作为按键监听范围。 */
    function dshEnhComposerScope(node) {
      let element = node === null || node === undefined ? null : node.parentElement;
      for (let depth = 0; depth < 10 && element !== null; depth += 1) {
        if (element.querySelector('[contenteditable="true"], textarea') !== null) return element;
        element = element.parentElement;
      }
      return null;
    }

    /**
     * 长文本换行：Alt+Enter 在输入区插入可通过 Ctrl+Z 回退的换行符，不触发发送；
     * 输入法组词期间不拦截。
     *
     * 组件不渲染可见 UI，仅作为 keydown 监听锚点挂入官方 input activity 座位。
     */
    function LineBreakAnchor(props) {
      const { inputActions } = props;
      const anchorRef = useRef(null);

      useEffect(() => {
        const anchor = anchorRef.current;
        if (anchor === null || inputActions === undefined) return undefined;
        const scope = dshEnhComposerScope(anchor);
        if (scope === null) return undefined;
        const onKeyDown = (event) => {
          if (event.key !== 'Enter') return;
          if (event.isComposing === true || event.keyCode === 229) return;
          const target = event.target;
          const editor = typeof target?.closest === 'function' ? target.closest('[contenteditable="true"], textarea') : null;
          if (editor === null || !scope.contains(editor)) return;
          if (event.altKey !== true) return;
          if (event.ctrlKey === true || event.metaKey === true || event.shiftKey === true) return;
          event.preventDefault();
          event.stopPropagation();
          try {
            const span = inputActions.captureInsertion();
            if (inputActions.insertText('\n', span) === false) {
              // 草稿版本已变化（例如刚提交）：放弃这次换行，绝不覆盖新内容。
              log('dsh-gloss: alt+enter skipped (stale draft)');
            }
          } catch (error) {
            log(error);
          }
        };
        scope.addEventListener('keydown', onKeyDown, true);
        return () => scope.removeEventListener('keydown', onKeyDown, true);
      }, [inputActions]);

      return h('span', {
        ref: anchorRef,
        'data-dsh-gloss-line-break-anchor': '',
        'aria-hidden': 'true',
        style: { display: 'none' }
      });
    }

    /**
     * 插件主体的实际初始化。
     *
     * 遵循官方最佳实践：
     * - 所有资源（slot、locale、样式、状态）都通过 `ctx.effect`/`ctx.on` 注册，
     *   并返回清理函数，保证插件卸载或 HMR 重载时自动回收；
     * - `ctx.effect()` 只接受释放函数、null/undefined 或（异步）可迭代对象，
     *   返回其它对象会抛 `TypeError: Invalid effect`，导致整个 client 条目启动失败。
     *   因此 `install` 统一把 effect 体归一化为「函数或 undefined」，并用 try/catch
     *   把异常限制在本插件内部，避免冒泡到宿主启动审计。
     */
    function activate(ctx) {
      const t = ctx.locale.bind(NS);
      const webAccess = createWebAccessStore();

      const install = (label, body) => {
        try {
          ctx.effect(() => {
            try {
              const disposer = body();
              return typeof disposer === 'function' ? disposer : undefined;
            } catch (error) {
              log(error);
              return undefined;
            }
          }, label);
        } catch (error) {
          log(error);
        }
      };

      // 基础：文案与样式。
      install('dsh-gloss: locale', () => {
        ctx.locale.register(NS, { zh: ZH, en: EN });
        return () => {};
      });
      install('dsh-gloss: styles', () => installStyles());

      // 联网开关 —— 输入区工具行最左侧（权限模式控件右侧）。
      install('dsh-gloss: web access state', () => {
        webAccess.load();
        return () => {};
      });
      install('dsh-gloss: web toggle', () =>
        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.left',
              id: ID_WEB,
              order: 10,
              locale: NS,
              inject: () => ({ t, webAccess })
            },
            WebToggle
          )
        )
      );

      // 长文本换行 —— 挂在 input activity 座位获取 inputActions。
      install('dsh-gloss: line break', () =>
        ctx.slots.inject('conversation.input.activity', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.activity',
              id: ID_LINE_BREAK,
              order: 5,
              locale: NS,
              inject: () => ({})
            },
            LineBreakAnchor
          )
        )
      );
    }

    return {
      name: NS,
      inject: ['slots', 'locale'],
      apply(ctx) {
        try {
          activate(ctx);
        } catch (error) {
          log(error);
        }
      }
    };
  }
});
