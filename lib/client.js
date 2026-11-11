window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-skin-denia-rewrite",
	factory: (require) => {
		const React = require("react");
		const h = React.createElement;
		const useEffect = React.useEffect;
		const useRef = React.useRef;
		const useState = React.useState;

		// ═══════════════════════════════════════════════════════════════
		//  SKIN IDENTITY
		// ═══════════════════════════════════════════════════════════════

		const SKIN_OWNER = "denia";
		const SKIN_VERSION = "2.1.0";
		const SKIN_TITLE = "达妮娅 · DeepSeek Harness";
		// The native WCO button strip does not follow theme-color and the plugin
		// host cannot reach setTitleBarOverlay, so keep the host's near-black chrome.
		const SKIN_SYSTEM_CHROME_COLOR = "#0D0820";

		// Routes are mounted under the page's base path, not the server root.
		const MOUNT = (() => {
			try {
				const path = new URL(document.baseURI).pathname;
				if (path === "/" || path === "") return "";
				return path.endsWith("/") ? path.slice(0, -1) : path;
			} catch {
				return "";
			}
		})();

		const API = MOUNT + "/api/dsh-denia-rewrite/palette-settings";
		const ASSET = MOUNT + "/api/dsh-denia-rewrite/assets/";
		const LOCAL_KEY = "denia-rewrite-palette-settings";

		// ═══════════════════════════════════════════════════════════════
		//  SETTINGS MODEL — one source of truth for CSS, page and pet
		// ═══════════════════════════════════════════════════════════════

		const DEFAULTS = {
			lightLeftChar: true,
			lightRightChar: true,
			lightChibi: true,
			darkLeftChar: true,
			darkRightChar: true,
			darkChibi: true,
			msgFrame: false,
			msgColor: false,
			bubbles: true,
			chainBorder: true,
			trim: true,
			petLocked: false,
			petVisible: true,
			contentWidth: 780,
			charHeight: 55,
			charOffsetX: 0,
			chibiSize: 110,
			chibiOffsetY: 0,
			bgOpacity: 100,
			bgBlur: 4,
			msgOpacity: 68,
			bubbleCount: 20,
			bubbleSpeed: 100,
			petX: null,
			petY: null,
			lightBackground: null,
			darkBackground: null,
		};

		// Mirrors the host whitelist; the host drops anything outside these ranges.
		const RANGES = {
			contentWidth: [500, 1000],
			charHeight: [30, 80],
			charOffsetX: [-50, 50],
			chibiSize: [60, 240],
			chibiOffsetY: [-420, 300],
			bgOpacity: [20, 100],
			bgBlur: [0, 12],
			msgOpacity: [20, 100],
			bubbleCount: [5, 40],
			bubbleSpeed: [30, 200],
		};

		const BOOLEANS = [
			"lightLeftChar", "lightRightChar", "lightChibi",
			"darkLeftChar", "darkRightChar", "darkChibi",
			"msgFrame", "msgColor", "bubbles", "chainBorder", "trim",
			"petLocked", "petVisible",
		];

		const store = {
			settings: Object.assign({}, DEFAULTS),
			// Host config (`lockPet: true` in cordis.patch.yml) wins over the UI toggle.
			configLockPet: false,
			loaded: false,
			error: null,
			listeners: new Set(),
			saveTimer: 0,
		};

		function emit() {
			for (const fn of Array.from(store.listeners)) {
				try {
					fn();
				} catch (error) {
					console.error("[denia]", error);
				}
			}
		}

		function subscribe(fn) {
			store.listeners.add(fn);
			return () => store.listeners.delete(fn);
		}

		function readLocal() {
			try {
				const raw = localStorage.getItem(LOCAL_KEY);
				if (!raw) return null;
				const parsed = JSON.parse(raw);
				return parsed && typeof parsed === "object" ? parsed : null;
			} catch {
				return null;
			}
		}

		function normalize(next) {
			const clean = {};
			if (!next || typeof next !== "object") return clean;
			for (const key of BOOLEANS) {
				if (typeof next[key] === "boolean") clean[key] = next[key];
			}
			for (const key of Object.keys(RANGES)) {
				const value = next[key];
				if (typeof value !== "number" || !Number.isFinite(value)) continue;
				const range = RANGES[key];
				clean[key] = Math.min(range[1], Math.max(range[0], value));
			}
			for (const key of ["petX", "petY"]) {
				if (next[key] === null) clean[key] = null;
				else if (typeof next[key] === "number" && Number.isFinite(next[key]) && Math.abs(next[key]) <= 8000) clean[key] = next[key];
			}
			for (const key of ["lightBackground", "darkBackground"]) {
				if (next[key] === null) clean[key] = null;
				else if (typeof next[key] === "string" && next[key].startsWith("data:image/")) clean[key] = next[key];
			}
			return clean;
		}

		function setSettings(patch, options) {
			const clean = normalize(patch);
			store.settings = Object.assign({}, store.settings, clean);
			const keys = Object.keys(clean);
			const petOnly = keys.length > 0 && keys.every((key) => key === "petX" || key === "petY" || key === "petLocked");
			// Pet-only changes must not rewrite the global CSS variables (that reflowed
			// the chat). They still have to reach React: the pet reads its lock state
			// from this store, so emit() below is what actually flips the switch.
			if (!petOnly) applyCssVars();
			emit();
			if (!(options && options.silent)) scheduleSave();
		}

		function scheduleSave() {
			if (store.saveTimer) clearTimeout(store.saveTimer);
			store.saveTimer = setTimeout(() => {
				store.saveTimer = 0;
				saveNow();
			}, 260);
		}

		function saveNow() {
			const body = JSON.stringify({ settings: store.settings });
			try {
				localStorage.setItem(LOCAL_KEY, body);
			} catch {
				/* quota — the host file stays authoritative */
			}
			fetch(API, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body,
			})
				.then((response) => response.json())
				.then((result) => {
					if (result && result.ok === false) {
						store.error = result.message || "save failed";
						emit();
					}
				})
				.catch((error) => {
					store.error = String((error && error.message) || error);
					emit();
				});
		}

		function loadSettings() {
			const cached = readLocal();
			if (cached) store.settings = Object.assign({}, store.settings, normalize(cached));
			applyCssVars();
			emit();
			fetch(API, { headers: { accept: "application/json" } })
				.then((response) => response.json())
				.then((result) => {
					if (!result || !result.ok) return;
					store.configLockPet = Boolean(result.config && result.config.lockPet);
					store.settings = Object.assign({}, DEFAULTS, normalize(result.settings || {}));
					store.loaded = true;
					store.error = null;
					applyCssVars();
					emit();
				})
				.catch(() => {
					/* offline: cached values stay in effect */
				});
		}

		// ═══════════════════════════════════════════════════════════════
		//  CSS — Denia palette, token overrides, layered chrome
		//  Art is served from the host route so the bundle stays small.
		// ═══════════════════════════════════════════════════════════════

		const css = `
/* === LIGHT MODE — 布景之形 === */
body[data-dsh-denia]{
	color:#5D3A8E;
	--denia-pink:#E8A5BF;--denia-rose:#D4859E;--denia-ice-blue:#A0C4E8;--denia-purple:#9B6BD8;--denia-violet:#7B4DBE;--denia-gold:#C5A468;--denia-ink:#2D1B4E;
	--denia-glass:rgba(248,240,245,0.45);
	--denia-shadow:0 18px 54px rgba(45,27,78,0.12),0 2px 8px rgba(45,27,78,0.08);
	--dsw-alias-bg-base:transparent;
	--dsw-alias-bg-layer-1:rgba(253,245,248,0.88);
	--dsw-alias-bg-layer-2:rgba(245,234,246,0.92);
	--dsw-alias-bg-overlay:rgba(253,245,248,0.98);
	--dsw-alias-border-l1:rgba(155,107,216,0.18);
	--dsw-alias-border-l2:rgba(155,107,216,0.3);
	--dsw-alias-brand-primary:#D4859E;
	--dsw-alias-button-elevated-fill:rgba(255,252,250,0.88);
	--dsw-alias-button-floating-fill:rgba(255,252,250,0.94);
	--dsw-alias-button-floating-hover:#F5EAE8;
	--dsw-alias-button-info-fill:#9B6BD8;
	--dsw-alias-button-info-hover:#7B4DBE;
	--dsw-alias-interactive-bg-active:rgba(197,164,108,0.24);
	--dsw-alias-interactive-bg-hover:rgba(212,133,158,0.12);
	--dsw-alias-interactive-bg-hover-solid:#F0E0F5;
	--dsw-alias-label-primary:#5D3A8E;
	--dsw-alias-label-secondary:#7B68A8;
	--dsw-alias-label-tertiary:#7F6C99;
	--dsw-alias-brand-text:#2D1B4E;
	--dsw-specific-input-major:rgba(255,252,250,0.82);
	--dsw-specific-selector:rgba(240,224,245,0.9);
	--dsw-specific-sidebar-fill:rgba(248,240,245,0.5);
	--denia-scrim:linear-gradient(rgba(253,245,248,0.58) 0%,rgba(248,240,245,0.48) 110px,rgba(245,234,246,0.38) 100%);
	--denia-base:#F5EAF6;
	background-color:transparent;
}
body[data-dsh-denia][data-ds-dark-theme]{
	color:#F5D5E8;
	--denia-glass:rgba(13,8,32,0.5);
	--denia-shadow:0 18px 58px rgba(0,0,0,0.38),0 2px 10px rgba(0,0,0,0.3);
	/* The shell paints .frame and .centerCol with this token: leaving it opaque
	   in dark mode hid the whole stage, so it must stay transparent here too. */
	--dsw-alias-bg-base:transparent;
	--dsw-alias-bg-layer-1:rgba(26,15,46,0.88);
	--dsw-alias-bg-layer-2:rgba(31,18,48,0.92);
	--dsw-alias-bg-overlay:rgba(13,8,32,0.98);
	--dsw-alias-border-l1:rgba(180,154,232,0.2);
	--dsw-alias-border-l2:rgba(180,154,232,0.34);
	--dsw-alias-brand-primary:#B49AE8;
	--dsw-alias-button-elevated-fill:rgba(26,15,46,0.88);
	--dsw-alias-button-floating-fill:rgba(31,18,48,0.94);
	--dsw-alias-button-floating-hover:#281640;
	--dsw-alias-button-info-fill:#7B4DBE;
	--dsw-alias-button-info-hover:#6B3DAE;
	--dsw-alias-interactive-bg-active:rgba(197,164,108,0.24);
	--dsw-alias-interactive-bg-hover:rgba(180,154,232,0.12);
	--dsw-alias-interactive-bg-hover-solid:#281640;
	--dsw-alias-label-primary:#F5D5E8;
	--dsw-alias-label-secondary:#C8A8D8;
	--dsw-alias-label-tertiary:#B89AC8;
	--dsw-alias-brand-text:#F5D5E8;
	--dsw-specific-input-major:rgba(26,15,46,0.82);
	--dsw-specific-selector:rgba(40,22,64,0.9);
	--dsw-specific-sidebar-fill:rgba(13,8,32,0.5);
	--denia-scrim:linear-gradient(rgba(13,8,32,0.52) 0%,rgba(26,15,46,0.44) 110px,rgba(31,18,48,0.34) 100%);
	--denia-base:#1A0F2E;
	background-color:transparent;
}

/* True circles: the desktop shell squircle-shapes every element with a bare
   * selector, which turned the bubbles into rounded squares. */
body[data-dsh-denia] [data-denia-bubble],body[data-dsh-denia] [data-denia-bubble-bg],body[data-dsh-denia] [data-denia-character],body[data-dsh-denia] [data-skin-chrome]{corner-shape:round}

/* === LAYERS — wallpaper, tint, art, then the app on top ===
   The wallpaper keeps upstream's soft look (a blur on the image itself), the
   tint sits between wallpaper and art so the art stays crisp like upstream's
   character layer, and the whole stage stays behind #root so text is never
   covered. Negative z-index also leaves body portals above it. */
body[data-dsh-denia] [data-skin-chrome='stage']{position:fixed;inset:0;z-index:-2;pointer-events:none;overflow:hidden;background-color:var(--denia-base,#F5EAF6)}
body[data-dsh-denia] [data-skin-chrome='stage-tint']{position:absolute;inset:0;pointer-events:none;background-image:var(--denia-scrim)}
body[data-dsh-denia] [data-denia-bg-art]{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:var(--denia-bg-opacity,1);filter:blur(var(--denia-bg-blur,4px));transform:scale(1.06);transition:opacity 0.4s ease,filter 0.2s ease}
body[data-dsh-denia] [data-denia-character]{position:absolute;bottom:0;object-fit:contain;transition:max-height 0.3s ease,max-width 0.3s ease,left 0.3s ease,opacity 0.3s ease}

/* Left art clears the sidebar; right art hugs the right edge. */
body[data-dsh-denia] [data-denia-character='left']{left:calc(var(--denia-sidebar-width,280px) + 8px + var(--denia-char-offset,0px));max-height:calc(var(--denia-char-height,55vh) * 0.82);max-width:20vw}
body[data-dsh-denia] [data-denia-character='right']{right:var(--denia-char-offset,0px);max-height:var(--denia-char-height,55vh);max-width:22vw}
body[data-dsh-denia][data-ds-dark-theme] [data-denia-character='right']{max-height:calc(var(--denia-char-height,55vh) * 1.09);max-width:25vw}
body[data-dsh-denia][data-denia-sidebar-size='rail'] [data-denia-character='left']{max-height:calc(var(--denia-char-height,55vh) * 1.05);max-width:28vw;left:calc(8px + var(--denia-char-offset,0px))}
body[data-dsh-denia]:not([data-ds-dark-theme])[data-denia-sidebar-size='rail'] [data-denia-character='right']{max-height:calc(var(--denia-char-height,55vh) * 1.18);max-width:27vw}
body[data-dsh-denia][data-ds-dark-theme][data-denia-sidebar-size='rail'] [data-denia-character='right']{max-height:calc(var(--denia-char-height,55vh) * 1.27);max-width:30vw}

/* Fade the art to a watermark while a side panel is open. */
body[data-dsh-denia][data-denia-details='open'] [data-denia-character]{opacity:0.28}

/* The Windows shell paints the whole frame with the sidebar fill token; leave
   the tinting to the scrim so the wallpaper stays readable behind the columns. */
html[data-windows-titlebar] body[data-dsh-denia] [class*='_frame']{background:transparent}

/* === CHAIN BORDER === */
body[data-dsh-denia] [data-skin-chrome='chain-border']{position:fixed;top:var(--dsh-windows-titlebar-height,0px);bottom:0;left:var(--denia-sidebar-width,280px);width:6px;background-repeat:repeat-y;background-position:center;opacity:0.5;pointer-events:none;z-index:3;transition:left 0.3s ease,opacity 0.2s ease}
body[data-dsh-denia][data-denia-sidebar-size='rail'] [data-skin-chrome='chain-border']{opacity:0}
body[data-dsh-denia][data-denia-chain='off'] [data-skin-chrome='chain-border']{opacity:0}

/* === TOP/BOTTOM TRIM === */
body[data-dsh-denia] [data-skin-chrome='top-trim'],body[data-dsh-denia] [data-skin-chrome='bottom-trim']{
	position:fixed;left:0;right:var(--denia-trim-right,0px);height:6px;pointer-events:none;z-index:9000;
	background:linear-gradient(90deg,var(--denia-gold) 0%,var(--denia-pink) 20%,var(--denia-ice-blue) 40%,var(--denia-purple) 60%,var(--denia-pink) 80%,var(--denia-gold) 100%);
	opacity:0.7;
}
body[data-dsh-denia] [data-skin-chrome='top-trim']{top:0}
body[data-dsh-denia] [data-skin-chrome='bottom-trim']{bottom:0}
body[data-dsh-denia][data-denia-trim='off'] [data-skin-chrome='top-trim'],body[data-dsh-denia][data-denia-trim='off'] [data-skin-chrome='bottom-trim']{opacity:0}

/* === SIDEBAR FOOTER + CORNERS === */
body[data-dsh-denia] [data-denia-sidebar-footer]{box-sizing:border-box;flex:0 0 auto;min-height:calc(var(--denia-sidebar-swag-height,54px) + 56px);padding:calc(var(--denia-sidebar-swag-height,54px) - 6px) 18px 12px;box-shadow:none;background:0 0;border:0;position:relative}
body[data-dsh-denia] [data-denia-sidebar-footer]:before{content:'';z-index:0;height:var(--denia-sidebar-swag-height,54px);background:url(${ASSET}swag.svg) center top / 100% 100% no-repeat;pointer-events:none;filter:drop-shadow(0 4px 9px rgba(45,27,78,0.26));position:absolute;inset:0 0 auto 0;opacity:0.5}
body[data-dsh-denia] [data-skin-chrome='sidebar-corners']{position:absolute;inset:0;pointer-events:none;z-index:1}
body[data-dsh-denia] [data-skin-chrome='sidebar-corners'] [data-skin-corner]{position:absolute;width:48px;height:48px;opacity:0.75;background-repeat:no-repeat;background-size:contain;background-image:url(${ASSET}star.svg)}
body[data-dsh-denia] [data-skin-chrome='sidebar-corners'] [data-skin-corner='top-left']{top:0;left:0}
body[data-dsh-denia] [data-skin-chrome='sidebar-corners'] [data-skin-corner='top-right']{top:0;right:0;transform:scaleX(-1)}
body[data-dsh-denia] [data-skin-chrome='sidebar-corners'] [data-skin-corner='bottom-right']{bottom:0;right:0;transform:scale(-1,-1)}
body[data-dsh-denia] [data-skin-chrome='sidebar-corners'] [data-skin-corner='bottom-left']{bottom:0;left:0;transform:scaleY(-1)}


/* === SIDEBAR ROWS — attribute selectors, no DOM tagging === */
body[data-dsh-denia] [role='treeitem']{transition:background-color 0.15s ease}
body[data-dsh-denia] [role='treeitem']:hover{background-image:linear-gradient(90deg,rgba(232,165,191,0.15) 0%,transparent 80%)}
body[data-dsh-denia] [role='treeitem'][aria-selected='true']{background-image:linear-gradient(90deg,rgba(155,107,216,0.12) 0%,transparent 80%);box-shadow:inset 3px 0 0 0 var(--denia-purple)}
body[data-dsh-denia] [role='treeitem'][aria-selected='true'] [class*='label'],body[data-dsh-denia] [role='treeitem'][aria-selected='true'] [class*='name'],body[data-dsh-denia] [role='treeitem'][aria-selected='true'] [class*='title']{
	background:linear-gradient(120deg,var(--denia-pink),var(--denia-purple) 55%,var(--denia-ice-blue));
	-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
}
body[data-dsh-denia][data-ds-dark-theme] [role='treeitem'][aria-selected='true'] [class*='label'],body[data-dsh-denia][data-ds-dark-theme] [role='treeitem'][aria-selected='true'] [class*='name'],body[data-dsh-denia][data-ds-dark-theme] [role='treeitem'][aria-selected='true'] [class*='title']{
	background:linear-gradient(120deg,#F0A8C8,#B49AE8 55%,#A0C4E8);
	-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
}

/* === THEME TOGGLE LABELS === */
body[data-dsh-denia] [data-denia-theme-label='light']{font-size:0!important}
body[data-dsh-denia] [data-denia-theme-label='light']::after{content:'布景之形';font-size:14px}
body[data-dsh-denia] [data-denia-theme-label='dark']{font-size:0!important}
body[data-dsh-denia] [data-denia-theme-label='dark']::after{content:'幻灭之形';font-size:14px}

/* === SCROLLBAR === */
body[data-dsh-denia] ::-webkit-scrollbar-thumb{background:linear-gradient(180deg,var(--denia-pink),var(--denia-purple));border-radius:4px}
body[data-dsh-denia] ::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,var(--denia-pink),var(--denia-violet))}

/* === BUBBLES — CSS animation only, static nodes === */
body[data-dsh-denia] [data-skin-chrome='bubble-field']{position:fixed;inset:0;pointer-events:none;z-index:4;overflow:hidden}
body[data-dsh-denia][data-denia-bubbles='off'] [data-skin-chrome='bubble-field']{display:none}
body[data-dsh-denia] [data-denia-bubble]{position:absolute;bottom:-120px;border-radius:50%!important;box-sizing:border-box;animation:denia-bubble-rise linear infinite;will-change:transform}
body[data-dsh-denia] [data-denia-bubble][hidden]{display:none}
body[data-dsh-denia]:not([data-ds-dark-theme]) [data-denia-bubble]{background:radial-gradient(circle at 28% 22%,rgba(255,255,255,0.7) 0%,transparent 18%),conic-gradient(from 200deg at 50% 50%,rgba(160,196,232,0.35),rgba(232,165,191,0.35),rgba(155,107,216,0.28),rgba(160,196,232,0.32),rgba(232,165,191,0.3));border:1px solid rgba(255,255,255,0.45)}
body[data-dsh-denia][data-ds-dark-theme] [data-denia-bubble]{background:radial-gradient(circle at 28% 22%,rgba(255,255,255,0.4) 0%,transparent 18%),conic-gradient(from 200deg at 50% 50%,rgba(155,107,216,0.2),rgba(180,154,232,0.16),rgba(123,77,190,0.14),rgba(155,107,216,0.18),rgba(180,154,232,0.15));border:1px solid rgba(180,154,232,0.28)}
@keyframes denia-bubble-rise{0%{transform:translateY(0) translateX(0) scale(0.3);opacity:0}8%{opacity:0.7}25%{transform:translateY(-25vh) translateX(12px) scale(0.6)}50%{transform:translateY(-50vh) translateX(-10px) scale(0.85);opacity:0.5}75%{transform:translateY(-75vh) translateX(8px) scale(1)}100%{transform:translateY(-110vh) translateX(-6px) scale(1.05);opacity:0}}
body[data-dsh-denia] [data-denia-bubble-bg]{position:absolute;bottom:-60px;border-radius:50%;animation:denia-bubble-rise-bg linear infinite;will-change:transform}
body[data-dsh-denia] [data-denia-bubble-bg][hidden]{display:none}
body[data-dsh-denia]:not([data-ds-dark-theme]) [data-denia-bubble-bg]{background:radial-gradient(circle at 28% 22%,rgba(255,255,255,0.35) 0%,transparent 18%),conic-gradient(from 200deg at 50% 50%,rgba(160,196,232,0.16),rgba(232,165,191,0.16),rgba(155,107,216,0.12),rgba(160,196,232,0.16));border:1px solid rgba(255,255,255,0.22)}
body[data-dsh-denia][data-ds-dark-theme] [data-denia-bubble-bg]{background:radial-gradient(circle at 28% 22%,rgba(255,255,255,0.15) 0%,transparent 18%),conic-gradient(from 200deg at 50% 50%,rgba(155,107,216,0.14),rgba(180,154,232,0.1),rgba(155,107,216,0.14));border:1px solid rgba(180,154,232,0.18)}
@keyframes denia-bubble-rise-bg{0%{transform:translateY(0) scale(0.2);opacity:0}10%{opacity:0.4}50%{opacity:0.25}90%{opacity:0.05}100%{transform:translateY(-110vh) scale(0.7);opacity:0}}

/* === FORM TRANSITION === */
body[data-dsh-denia] [data-skin-chrome='form-transition']{position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:0}
body[data-dsh-denia] [data-skin-chrome='form-transition'][data-denia-transition='erupt']{background-color:rgba(13,8,32,0.9);animation:denia-void-erupt 1.6s ease-out forwards}
body[data-dsh-denia] [data-skin-chrome='form-transition'][data-denia-transition='awaken']{background-color:rgba(248,225,238,0.9);animation:denia-gentle-awaken 1.6s ease-out forwards}
@keyframes denia-void-erupt{0%{opacity:0}12%{opacity:0.85}55%{opacity:0.3}100%{opacity:0}}
@keyframes denia-gentle-awaken{0%{opacity:0}12%{opacity:0.85}55%{opacity:0.3}100%{opacity:0}}

/* === CONTENT WIDTH === */
body[data-dsh-denia] [class*='_centerCol'] [class*='_viewArea'],body[data-dsh-denia] [class*='_centerCol'] [class*='_composerSeat']{max-width:var(--denia-content-width,780px)!important;margin:0 auto!important;width:100%!important}

/* === ACCENTS === */
body[data-dsh-denia] [class*='floating'][class*='button']{background-image:linear-gradient(135deg,var(--denia-pink),var(--denia-purple))}
body[data-dsh-denia] [class*='segment'][aria-selected='true'],body[data-dsh-denia] [class*='tab'][aria-selected='true']{background-image:linear-gradient(135deg,rgba(232,165,191,0.15),rgba(155,107,216,0.15))}
@keyframes denia-tacet-spin{to{transform:rotate(360deg)}}
body[data-dsh-denia] [class*='spinner']{border-top-color:var(--denia-purple);border-bottom-color:var(--denia-pink);box-shadow:0 0 15px rgba(155,107,216,0.5);animation:denia-tacet-spin 1s linear infinite}

/* === NEW-SESSION HERO (upstream's welcome text, rendered as our own node) === */
body[data-dsh-denia] [data-skin-chrome='hero-welcome']{position:fixed;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;text-align:center;pointer-events:none;z-index:5;transition:left 0.25s ease,top 0.25s ease}
body[data-dsh-denia] .dn-hero-title{font-size:32px;font-weight:700;background:linear-gradient(135deg,var(--denia-pink),var(--denia-purple));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
body[data-dsh-denia] .dn-hero-sub{font-size:14px;opacity:0.5;margin-top:4px}
body[data-dsh-denia] .dn-hero-hint{font-size:15px;opacity:0.7;margin-top:12px;font-style:italic}

/* === MESSAGE FRAME — one box per reply ===
   Every chat row of a Turn is framed, with the flow gap collapsed and the border
   drawn only on the first/last row, so a multi-step reply reads as one card. */
/* Geometry is applied to every chat row while the frame is on, never to the tagged
   rows themselves: tagging a row must not change its box, or the chat jumps ~10px
   every time a new thinking step streams in. */
body[data-dsh-denia][data-denia-msg-frame='on'] :is([data-chat-flow-kind],[data-turn-process-member]):not([data-chat-flow-kind='user']):not([data-chat-flow-kind='steering']):not([data-chat-flow-kind='turn-process']):not([data-chat-group-key]):not([data-step-process]){
	padding:6px 12px;
	box-sizing:border-box;
	margin-top:0!important;
}
body[data-dsh-denia][data-denia-msg-frame='on'] [data-denia-msg]{
	background-color:var(--denia-msg-fill,rgba(253,245,248,0.68));
	/* Frame is painted with inset shadows only: no border, no padding change. */
	border:none;
	border-radius:0;
	box-shadow:none;
	transition:none!important;
}
body[data-dsh-denia][data-denia-msg-frame='on'] [data-denia-msg-first]{
	border-radius:12px 12px 0 0;
	box-shadow:inset 0 1px 0 rgba(155,107,216,0.25),inset 1px 0 0 rgba(155,107,216,0.25),inset -1px 0 0 rgba(155,107,216,0.25);
}
body[data-dsh-denia][data-denia-msg-frame='on'] [data-denia-msg-last]{
	border-radius:0 0 12px 12px;
	box-shadow:inset 0 -1px 0 rgba(155,107,216,0.25),inset 1px 0 0 rgba(155,107,216,0.25),inset -1px 0 0 rgba(155,107,216,0.25);
}
body[data-dsh-denia][data-denia-msg-frame='on'] [data-denia-msg-first][data-denia-msg-last]{
	border-radius:12px;
	box-shadow:inset 0 0 0 1px rgba(155,107,216,0.25);
}
body[data-dsh-denia][data-denia-msg-frame='on'][data-ds-dark-theme] [data-denia-msg]{background-color:var(--denia-msg-fill,rgba(26,15,46,0.68))}
body[data-dsh-denia][data-denia-msg-frame='on'][data-ds-dark-theme] [data-denia-msg-first]{box-shadow:inset 0 1px 0 rgba(180,154,232,0.25),inset 1px 0 0 rgba(180,154,232,0.25),inset -1px 0 0 rgba(180,154,232,0.25)}
body[data-dsh-denia][data-denia-msg-frame='on'][data-ds-dark-theme] [data-denia-msg-last]{box-shadow:inset 0 -1px 0 rgba(180,154,232,0.25),inset 1px 0 0 rgba(180,154,232,0.25),inset -1px 0 0 rgba(180,154,232,0.25)}
body[data-dsh-denia][data-denia-msg-frame='on'][data-ds-dark-theme] [data-denia-msg-first][data-denia-msg-last]{box-shadow:inset 0 0 0 1px rgba(180,154,232,0.25)}
body[data-dsh-denia][data-denia-msg-frame='on'][data-ds-dark-theme] [data-denia-msg-first]{border-top-color:rgba(180,154,232,0.25)}
body[data-dsh-denia][data-denia-msg-frame='on'][data-ds-dark-theme] [data-denia-msg-last]{border-bottom-color:rgba(180,154,232,0.25)}

/* === MESSAGE ACTIONS — the copy/share/usage row stays visible === */
body[data-dsh-denia] [data-actions-reveal='hover'] [class*='_actions']{opacity:1!important}

/* === MESSAGE TEXT COLOR === */
body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg]{color:#5D3A8E}
body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] p{color:#5D3A8E}
body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] a{color:#9B6BD8;text-decoration-color:rgba(155,107,216,0.4)}
body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] strong,body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] em,body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] b{color:#C05A7E}
body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] code{color:#4A7BB8;background:rgba(160,196,232,0.16)}
body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] pre{background:rgba(160,196,232,0.1);border:1px solid rgba(160,196,232,0.22);border-left:3px solid #C5A468}
body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] pre code{color:#3E68A0;background:transparent}
body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] blockquote{color:#766A92;background:rgba(232,165,191,0.08);border-left:3px solid #E8A5BF}
body[data-dsh-denia][data-denia-msg-color='on'] [data-denia-msg] li::marker{color:#9B6BD8}
body[data-dsh-denia][data-denia-msg-color='on'][data-ds-dark-theme] [data-denia-msg]{color:#E6C8F2}
body[data-dsh-denia][data-denia-msg-color='on'][data-ds-dark-theme] [data-denia-msg] p{color:#E6C8F2}
body[data-dsh-denia][data-denia-msg-color='on'][data-ds-dark-theme] [data-denia-msg] a{color:#B0A4F0}
body[data-dsh-denia][data-denia-msg-color='on'][data-ds-dark-theme] [data-denia-msg] strong,body[data-dsh-denia][data-denia-msg-color='on'][data-ds-dark-theme] [data-denia-msg] em,body[data-dsh-denia][data-denia-msg-color='on'][data-ds-dark-theme] [data-denia-msg] b{color:#F0A8C8}
body[data-dsh-denia][data-denia-msg-color='on'][data-ds-dark-theme] [data-denia-msg] code{color:#A0C4E8;background:rgba(160,196,232,0.14)}
body[data-dsh-denia][data-denia-msg-color='on'][data-ds-dark-theme] [data-denia-msg] blockquote{color:#CCD8EC;background:rgba(232,165,191,0.06);border-left:3px solid #E8A5BF}

/* === PET === */
body[data-dsh-denia] .dn-pet{position:fixed;z-index:1200;display:block;width:var(--denia-chibi-size,110px);height:auto;user-select:none;-webkit-user-select:none;touch-action:none;pointer-events:auto;filter:drop-shadow(0 8px 18px rgba(45,27,78,0.22));transition:filter 0.2s ease}
body[data-dsh-denia] .dn-pet[data-dragging='true']{cursor:grabbing;filter:drop-shadow(0 14px 26px rgba(45,27,78,0.32)) brightness(1.04)}
body[data-dsh-denia] .dn-pet[data-locked='true']{cursor:default}
body[data-dsh-denia] .dn-pet[data-locked='false']{cursor:grab}

/* === SETTINGS PAGE === */
.dn-page{display:flex;flex-direction:column;gap:16px;padding:2px 2px 28px;max-width:720px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}
.dn-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.dn-head h2{margin:0;font-size:16px;font-weight:600}
.dn-head p{margin:4px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;max-width:52ch}
.dn-actions{display:flex;gap:8px;flex-wrap:wrap}
.dn-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;line-height:1.4;font-family:inherit}
.dn-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dn-btn:disabled{opacity:0.5;cursor:default}
.dn-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:14px 16px}
.dn-card>h3{margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.dn-note{margin:6px 0 0;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dn-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:38px}
.dn-row+.dn-row{border-top:1px solid var(--dsw-alias-border-l1)}
.dn-row-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.dn-row-main>span:first-child{font-size:13px}
.dn-hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dn-control{display:flex;align-items:center;gap:10px;flex:0 0 auto}
.dn-switch{position:relative;width:38px;height:22px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-border-l1);padding:0;cursor:pointer;flex:0 0 auto;transition:background 0.18s ease,border-color 0.18s ease}
.dn-switch[aria-checked='true']{background:var(--dsw-alias-brand-primary);border-color:transparent}
.dn-switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.25);transition:transform 0.18s ease}
.dn-switch[aria-checked='true']::after{transform:translateX(16px)}
.dn-switch:disabled{opacity:0.5;cursor:not-allowed}
.dn-slider{width:180px;height:18px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.dn-value{width:58px;text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);font-size:12px}
.dn-file{display:none}
`.trim();

		function applyCssVars() {
			if (typeof document === "undefined") return;
			const body = document.body;
			if (!body || !body.hasAttribute("data-dsh-denia")) return;
			const s = store.settings;
			const root = document.documentElement.style;
			const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);
			root.setProperty("--denia-content-width", num(s.contentWidth, 780) + "px");
			root.setProperty("--denia-char-height", num(s.charHeight, 55) + "vh");
			root.setProperty("--denia-char-offset", num(s.charOffsetX, 0) + "px");
			root.setProperty("--denia-chibi-size", num(s.chibiSize, 110) + "px");
			root.setProperty("--denia-bg-opacity", String(num(s.bgOpacity, 100) / 100));
			root.setProperty("--denia-bg-blur", num(s.bgBlur, 4) + "px");
			const msgAlpha = Math.min(1, Math.max(0.05, num(s.msgOpacity, 68) / 100));
			root.setProperty("--denia-msg-opacity", String(msgAlpha));
			root.setProperty("--denia-msg-fill", (isDark() ? "rgba(26,15,46," : "rgba(253,245,248,") + msgAlpha + ")");
			body.dataset.deniaMsgFrame = s.msgFrame ? "on" : "off";
			body.dataset.deniaMsgColor = s.msgColor ? "on" : "off";
			body.dataset.deniaBubbles = s.bubbles ? "on" : "off";
			body.dataset.deniaChain = s.chainBorder ? "on" : "off";
			body.dataset.deniaTrim = s.trim ? "on" : "off";
			syncCharacterArt();
			syncBubbleCount();
			syncBubbleSpeed();
		}

		function isDark() {
			return document.body.hasAttribute("data-ds-dark-theme");
		}

		// ═══════════════════════════════════════════════════════════════
		//  IMPERATIVE CHROME — fixed layers + geometry, created once
		// ═══════════════════════════════════════════════════════════════

		const SIDEBAR_SELECTOR = ":is([data-pane='sidebar'], [class*='sidebarCol'])";
		const CENTER_SELECTOR = "[class*='_centerCol']";
		const RIGHTBAR_SELECTOR = "[class*='rightbarCol']";

		const chrome = {
			styleTag: null,
			stage: null,
			scrim: null,
			chain: null,
			topTrim: null,
			bottomTrim: null,
			formTransition: null,
			bgImage: null,
			chars: {},
			bubbles: { front: [], back: [] },
			observers: [],
			listeners: [],
			raf: 0,
			frameRaf: 0,
			lastDark: null,
			lastLabels: 0,
			frameElement: null,
			frameBackground: null,
			hero: null,
		};

		function make(tag, attrs) {
			const el = document.createElement(tag);
			if (attrs) {
				for (const key of Object.keys(attrs)) {
					if (key === "dataset") Object.assign(el.dataset, attrs[key]);
					else el.setAttribute(key, attrs[key]);
				}
			}
			el.dataset.skinOwner = SKIN_OWNER;
			return el;
		}

		function characterSource(form, side) {
			return ASSET + (form === "light" ? "light-" : "dark-") + side + ".webp";
		}

		function createStage() {
			const stage = make("div", { "data-skin-chrome": "stage", "aria-hidden": "true" });
			const bg = document.createElement("img");
			bg.dataset.deniaBgArt = "";
			bg.alt = "";
			bg.decoding = "async";
			bg.draggable = false;
			bg.src = ASSET + (isDark() ? "dark-bg.webp" : "light-bg.webp");
			stage.append(bg);
			chrome.bgImage = bg;

			// Tint sits between the wallpaper and the art: the art keeps upstream's
			// crispness instead of being washed by a full-window glass sheet.
			stage.append(make("div", { "data-skin-chrome": "stage-tint", "aria-hidden": "true" }));

			const back = createBubbleField(15, "back");
			stage.append(back);

			for (const side of ["left", "right"]) {
				for (const form of ["light", "dark"]) {
					const img = document.createElement("img");
					img.dataset.deniaCharacter = side;
					img.dataset.deniaForm = form;
					img.alt = "";
					img.decoding = "async";
					img.draggable = false;
					img.loading = form === (isDark() ? "dark" : "light") ? "eager" : "lazy";
					img.src = characterSource(form, side);
					img.style.display = "none";
					stage.append(img);
					chrome.chars[form + "-" + side] = img;
				}
			}
			return stage;
		}

		function createBubbleField(count, kind) {
			const field = make("div", {
				"data-skin-chrome": kind === "front" ? "bubble-field" : "bubble-field-inner",
				"aria-hidden": "true",
			});
			if (kind === "back") {
				field.style.position = "absolute";
				field.style.inset = "0";
				field.style.overflow = "hidden";
			}
			const made = [];
			for (let i = 0; i < count; i += 1) {
				const bubble = document.createElement("span");
				if (kind === "front") bubble.dataset.deniaBubble = "";
				else bubble.dataset.deniaBubbleBg = "";
				const size = kind === "front" ? 20 + Math.random() * 60 : 8 + Math.random() * 22;
				const duration = kind === "front" ? 12 + Math.random() * 20 : 6 + Math.random() * 10;
				bubble.style.width = size.toFixed(1) + "px";
				bubble.style.height = size.toFixed(1) + "px";
				bubble.style.left = (Math.random() * 100).toFixed(2) + "%";
				bubble.dataset.baseDuration = String(duration);
				bubble.style.animationDuration = duration + "s";
				bubble.style.animationDelay = (-Math.random() * duration).toFixed(2) + "s";
				field.append(bubble);
				made.push(bubble);
			}
			chrome.bubbles[kind] = made;
			return field;
		}

		function syncBubbleCount() {
			const s = store.settings;
			const front = chrome.bubbles.front;
			front.forEach((el, index) => {
				el.hidden = index >= s.bubbleCount;
			});
			const back = chrome.bubbles.back;
			back.forEach((el) => {
				el.hidden = !s.bubbles;
			});
		}

		function syncBubbleSpeed() {
			const factor = Math.max(0.3, Math.min(2, store.settings.bubbleSpeed / 100));
			for (const el of chrome.bubbles.front.concat(chrome.bubbles.back)) {
				const base = Number(el.dataset.baseDuration) || 12;
				el.style.animationDuration = (base / factor).toFixed(2) + "s";
			}
		}

		function syncCharacterArt() {
			if (!chrome.bgImage) return;
			const dark = isDark();
			const s = store.settings;
			for (const form of ["light", "dark"]) {
				for (const side of ["left", "right"]) {
					const img = chrome.chars[form + "-" + side];
					if (!img) continue;
					const active = dark === (form === "dark");
					const shown = form === "dark"
						? (side === "left" ? s.darkLeftChar : s.darkRightChar)
						: (side === "left" ? s.lightLeftChar : s.lightRightChar);
					img.style.display = active && shown ? "" : "none";
				}
			}
			const custom = dark ? s.darkBackground : s.lightBackground;
			const next = custom || ASSET + (dark ? "dark-bg.webp" : "light-bg.webp");
			if (chrome.bgSrc !== next) {
				chrome.bgSrc = next;
				chrome.bgImage.src = next;
			}
		}

		function playFormTransition(toDark) {
			const el = chrome.formTransition;
			if (!el) return;
			el.dataset.deniaTransition = toDark ? "erupt" : "awaken";
			el.style.animation = "none";
			void el.offsetWidth;
			el.style.animation = "";
			if (chrome.transitionTimer) clearTimeout(chrome.transitionTimer);
			chrome.transitionTimer = setTimeout(() => {
				delete el.dataset.deniaTransition;
			}, 1700);
		}

		function measure() {
			if (!document.body.hasAttribute("data-dsh-denia")) return;
			const sidebar = document.querySelector(SIDEBAR_SELECTOR);
			const rightbar = document.querySelector(RIGHTBAR_SELECTOR);
			const center = document.querySelector(CENTER_SELECTOR);
			// Keep the ResizeObserver attached to the live columns: the shell can
			// replace these nodes, and a stale target silently stops reporting.
			if (chrome.resizeObserver) {
				for (const [key, el] of [["observedSidebar", sidebar], ["observedRightbar", rightbar], ["observedCenter", center]]) {
					if (chrome[key] === el) continue;
					if (chrome[key]) {
						try { chrome.resizeObserver.unobserve(chrome[key]); } catch {}
					}
					chrome[key] = el || null;
					if (el) {
						try { chrome.resizeObserver.observe(el); } catch {}
					}
				}
			}
			const width = sidebar ? sidebar.getBoundingClientRect().width : 280;
			const style = document.documentElement.style;
			style.setProperty("--denia-sidebar-width", Math.max(0, Math.round(width)) + "px");

			const size = width < 90 ? "rail" : width < 210 ? "narrow" : "full";
			if (document.body.dataset.deniaSidebarSize !== size) document.body.dataset.deniaSidebarSize = size;
			const details = rightbar && rightbar.getBoundingClientRect().width > 4 ? "open" : "closed";
			if (document.body.dataset.deniaDetails !== details) document.body.dataset.deniaDetails = details;

			let inset = 0;
			const overlay = navigator.windowControlsOverlay;
			if (overlay && overlay.visible && typeof overlay.getTitlebarAreaRect === "function") {
				try {
					const rect = overlay.getTitlebarAreaRect();
					inset = Math.max(0, Math.round(window.innerWidth - rect.x - rect.width));
				} catch {
					inset = 0;
				}
			}
			style.setProperty("--denia-trim-right", inset + "px");
			syncSidebarDecorations();
			syncFrameBackground();
			syncHeroWelcome();
		}

		function scheduleMeasure() {
			if (chrome.raf) return;
			chrome.raf = requestAnimationFrame(() => {
				chrome.raf = 0;
				measure();
			});
		}

		function syncSidebarDecorations() {
			const sidebar = document.querySelector(SIDEBAR_SELECTOR);
			if (!sidebar) return;
			const panel = sidebar.querySelector(":scope > div");
			if (panel && !panel.querySelector("[data-skin-chrome='sidebar-corners']")) {
				const corners = make("div", { "data-skin-chrome": "sidebar-corners", "aria-hidden": "true" });
				for (const corner of ["top-left", "top-right", "bottom-right", "bottom-left"]) {
					const span = document.createElement("span");
					span.dataset.skinCorner = corner;
					corners.append(span);
				}
				panel.prepend(corners);
			}
			const settingsSlot = sidebar.querySelector("[data-slot='sidebar.settings']");
			if (settingsSlot) {
				let footer = settingsSlot.parentElement;
				while (footer && footer !== sidebar) {
					if (footer.querySelector("[data-slot='sidebar.footer.action']")) {
						footer.dataset.deniaSidebarFooter = "";
						break;
					}
					footer = footer.parentElement;
				}
			}
		}

		/**
		 * Desktop 0.2 paints an opaque sidebar fill on the layout frame that sits
		 * above the body backdrop. Clearing it is what lets any wallpaper show.
		 */
		function syncFrameBackground() {
			const sidebar = document.querySelector(SIDEBAR_SELECTOR);
			const frame = sidebar ? sidebar.parentElement : null;
			if (!frame || frame === document.body) return;
			if (chrome.frameElement === frame) return;
			if (chrome.frameElement && chrome.frameBackground !== null) {
				chrome.frameElement.style.setProperty("background", chrome.frameBackground);
			}
			chrome.frameElement = frame;
			chrome.frameBackground = frame.style.getPropertyValue("background") || "";
			frame.style.setProperty("background", "transparent");
		}

		// ═══════════════════════════════════════════════════════════════
		//  SCOPED DECORATION PASSES
		// ═══════════════════════════════════════════════════════════════

		let msgSignature = "";

		// Upstream's new-session greeting, kept as an element of our own so nothing
		// touches React-managed text.
		function syncHeroWelcome() {
			const phase = document.querySelector("[data-phase='hero']");
			if (!phase) {
				if (chrome.hero && chrome.hero.parentNode) chrome.hero.remove();
				chrome.hero = null;
				return;
			}
			if (!chrome.hero || chrome.hero.parentNode !== phase) {
				if (chrome.hero && chrome.hero.parentNode) chrome.hero.remove();
				const el = make("div", { "data-skin-chrome": "hero-welcome", "aria-hidden": "true" });
				const line = (className, text) => {
					const node = document.createElement("div");
					node.className = className;
					node.textContent = text;
					return node;
				};
				el.append(
					line("dn-hero-title", "达妮娅"),
					line("dn-hero-sub", "虚质科学课 · 星炬学院"),
					line("dn-hero-hint", "「……你来了啊。要聊什么？」"),
				);
				phase.append(el);
				chrome.hero = el;
				chrome.heroLeft = null;
				chrome.heroTop = null;
			}
			const rect = phase.getBoundingClientRect();
			if (rect.width < 40 || rect.height < 40) return;
			const left = Math.round(rect.left + rect.width / 2);
			const top = Math.round(rect.top + rect.height * 0.15);
			if (chrome.heroLeft !== left) {
				chrome.hero.style.left = left + "px";
				chrome.heroLeft = left;
			}
			if (chrome.heroTop !== top) {
				chrome.hero.style.top = top + "px";
				chrome.heroTop = top;
			}
		}

		function tagMessages() {
			if (document.body.dataset.deniaMsgFrame !== "on") return;
			const view = document.querySelector("[class*='_viewArea']");
			if (!view) return;
			const visible = (el) => !el.hidden && el.getBoundingClientRect().height > 0;
			// The "已完成 / 用时" card and the "执行了命令…" group header are chrome,
			// not the thinking chain: they stay unframed. Only the chain rows
			// (data-turn-process-member) plus the answer text get boxes.
			const isChrome = (el) =>
				el.getAttribute("data-chat-flow-kind") === "turn-process" ||
				el.hasAttribute("data-chat-group-key") ||
				el.hasAttribute("data-step-process");
			const candidates = Array.from(
				view.querySelectorAll("[data-chat-turn][data-chat-flow-kind],[data-turn-process-member]"),
			).filter((el) => visible(el) && !isChrome(el));
			const candidateSet = new Set(candidates);
			const nested = (el) => {
				let parent = el.parentElement;
				while (parent && parent !== view) {
					if (candidateSet.has(parent)) return true;
					parent = parent.parentElement;
				}
				return false;
			};
			let rows = candidates.filter((el) => !nested(el));
			const perRow = rows.length === 0;
			if (perRow) rows = Array.from(view.querySelectorAll("[data-chat-flow-kind]")).filter((el) => visible(el) && !isChrome(el));
			const signature = rows.map((el) => el.getAttribute("data-chat-flow-key") || "").join("|");
			if (signature === msgSignature) return;
			msgSignature = signature;
			const desired = new Map();
			let group = [];
			const flush = () => {
				if (group.length === 0) return;
				const top = group[0].getBoundingClientRect().top;
				const bottom = group[group.length - 1].getBoundingClientRect().bottom;
				if (bottom - top >= 24) {
					group.forEach((el, position) => {
						desired.set(el, { first: position === 0, last: position === group.length - 1 });
					});
				}
				group = [];
			};
			let currentTurn = null;
			let currentPart = null;
			let lastTurn = null;
			let lastPart = "answer";
			for (let index = 0; index < rows.length; index += 1) {
				const row = rows[index];
				const kind = row.getAttribute("data-chat-flow-kind") || "";
				if (kind === "user" || kind === "steering") {
					// The user's own bubble stays unframed and closes the reply above it.
					flush();
					currentTurn = null;
					currentPart = null;
					lastTurn = null;
					lastPart = "answer";
					continue;
				}
				const stamped = row.getAttribute("data-chat-turn");
				const turn = stamped !== null ? stamped : (lastTurn !== null ? lastTurn : "row-" + index);
				let part;
				if (row.hasAttribute("data-turn-process-member")) part = "process";
				else if (kind === "") part = lastPart;
				else part = "answer";
				if (currentTurn !== null && (turn !== currentTurn || part !== currentPart)) flush();
				currentTurn = turn;
				currentPart = part;
				lastTurn = turn;
				lastPart = part;
				group.push(row);
			}
			flush();
			// Apply as a diff: only rows whose state actually changed get touched, so a
			// streaming reply never collapses and re-expands the frame (which is what
			// made the chat jump and then stop following the answer).
			for (const [el, flags] of desired) {
				if (!el.hasAttribute("data-denia-msg")) el.dataset.deniaMsg = "";
				if (flags.first !== el.hasAttribute("data-denia-msg-first")) {
					if (flags.first) el.dataset.deniaMsgFirst = "";
					else el.removeAttribute("data-denia-msg-first");
				}
				if (flags.last !== el.hasAttribute("data-denia-msg-last")) {
					if (flags.last) el.dataset.deniaMsgLast = "";
					else el.removeAttribute("data-denia-msg-last");
				}
			}
			for (const el of document.querySelectorAll("[data-denia-msg]")) {
				if (desired.has(el)) continue;
				delete el.dataset.deniaMsg;
				delete el.dataset.deniaMsgFirst;
				delete el.dataset.deniaMsgLast;
			}
		}

		function clearMessageTags() {
			msgSignature = "";
			document.querySelectorAll("[data-denia-msg]").forEach((el) => {
				delete el.dataset.deniaMsg;
				delete el.dataset.deniaMsgFirst;
				delete el.dataset.deniaMsgLast;
			});
		}

		function decorateThemeLabels() {
			const buttons = document.querySelectorAll("[class*='theme'] button,[class*='appearance'] button,button[class*='theme']");
			for (const el of buttons) {
				const text = (el.textContent || "").trim().toLowerCase();
				if (text.indexOf("浅色") >= 0 || text === "light") el.setAttribute("data-denia-theme-label", "light");
				else if (text.indexOf("深色") >= 0 || text === "dark") el.setAttribute("data-denia-theme-label", "dark");
			}
		}

		// ═══════════════════════════════════════════════════════════════
		//  INSTALL / DISPOSE
		// ═══════════════════════════════════════════════════════════════

		function install() {
			const body = document.body;
			chrome.observers = [];
			chrome.listeners = [];
			const previous = {
				title: document.title,
				themeColor: null,
			};
			const meta = document.head.querySelector("meta[name=\"theme-color\"]");
			if (meta) {
				previous.themeColor = { el: meta, content: meta.content };
				meta.content = SKIN_SYSTEM_CHROME_COLOR;
			}

			const styleTag = document.createElement("style");
			styleTag.dataset.skinOwner = SKIN_OWNER;
			styleTag.dataset.pluginCss = "@dsh-external/dsh-client-ui-skin-denia-rewrite/denia.css";
			styleTag.textContent = css;
			document.head.append(styleTag);
			chrome.styleTag = styleTag;

			body.dataset.dshDenia = "";
			document.title = SKIN_TITLE;

			chrome.stage = createStage();
			chrome.chain = make("div", { "data-skin-chrome": "chain-border", "aria-hidden": "true" });
			chrome.chain.style.backgroundImage = "url(" + ASSET + "chain.svg)";
			chrome.topTrim = make("div", { "data-skin-chrome": "top-trim", "aria-hidden": "true" });
			chrome.bottomTrim = make("div", { "data-skin-chrome": "bottom-trim", "aria-hidden": "true" });
			const frontField = createBubbleField(40, "front");
			chrome.formTransition = make("div", { "data-skin-chrome": "form-transition", "aria-hidden": "true" });

			body.append(chrome.stage, chrome.chain, frontField, chrome.topTrim, chrome.bottomTrim, chrome.formTransition);
			// Keep exact references: teardown removes these nodes and nothing else,
			// so it can never touch a React-owned node or a newer instance.
			chrome.nodes = [chrome.stage, chrome.chain, frontField, chrome.topTrim, chrome.bottomTrim, chrome.formTransition];

			applyCssVars();
			measure();

			const themeObserver = new MutationObserver(() => {
				const dark = isDark();
				if (dark === chrome.lastDark) return;
				chrome.lastDark = dark;
				applyCssVars();
				playFormTransition(dark);
			});
			themeObserver.observe(body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
			chrome.observers.push(themeObserver);
			chrome.lastDark = isDark();
			applyCssVars();

			const onResize = () => scheduleMeasure();
			window.addEventListener("resize", onResize, { passive: true });
			chrome.listeners.push(() => window.removeEventListener("resize", onResize));
			// Dragging the column splitter ends with pointerup; measure once more then
			// so the chain border lands on the final divider position.
			window.addEventListener("pointerup", onResize, { passive: true, capture: true });
			chrome.listeners.push(() => window.removeEventListener("pointerup", onResize, { capture: true }));
			const overlay = navigator.windowControlsOverlay;
			if (overlay && typeof overlay.addEventListener === "function") {
				overlay.addEventListener("geometrychange", onResize);
				chrome.listeners.push(() => overlay.removeEventListener("geometrychange", onResize));
			}

			const resizeObserver = new ResizeObserver(() => scheduleMeasure());
			chrome.resizeObserver = resizeObserver;
			chrome.observers.push(resizeObserver);

			// The shell mounts columns asynchronously; one deferred re-measure is
			// enough and it dies with the skin.
			chrome.retryTimer = setTimeout(() => scheduleMeasure(), 400);

			// One coalesced pass per frame; each pass is cheap and scoped.
			const onMutations = () => {
				if (chrome.frameRaf) return;
				chrome.frameRaf = requestAnimationFrame(() => {
					chrome.frameRaf = 0;
					tagMessages();
					syncHeroWelcome();
					if (document.querySelector(SIDEBAR_SELECTOR) !== chrome.observedSidebar) scheduleMeasure();
					const now = performance.now();
					if (now - chrome.lastLabels > 500) {
						chrome.lastLabels = now;
						decorateThemeLabels();
					}
				});
			};
			const frameObserver = new MutationObserver(onMutations);
			frameObserver.observe(body, { childList: true, subtree: true });
			chrome.observers.push(frameObserver);

			chrome.unsubscribe = subscribe(() => {
				applyCssVars();
				if (store.settings.msgFrame) tagMessages();
				else clearMessageTags();
			});

			return function dispose() {
				// Every teardown step is isolated: a throw here would escape into the
				// client loader, and an exception during React's commit phase unmounts
				// the whole application (blank page).
				const safe = (step) => {
					try {
						step();
					} catch (error) {
						console.warn("[denia] dispose step failed:", error);
					}
				};
				safe(() => { if (chrome.retryTimer) clearTimeout(chrome.retryTimer); });
				safe(() => { if (chrome.transitionTimer) clearTimeout(chrome.transitionTimer); });
				safe(() => { if (chrome.raf) cancelAnimationFrame(chrome.raf); });
				safe(() => { if (chrome.frameRaf) cancelAnimationFrame(chrome.frameRaf); });
				safe(() => { if (chrome.unsubscribe) chrome.unsubscribe(); });
				safe(() => { for (const observer of chrome.observers) observer.disconnect(); });
				safe(() => { for (const off of chrome.listeners) off(); });
				safe(() => clearMessageTags());
				safe(() => {
					if (chrome.frameElement && chrome.frameBackground !== null) {
						chrome.frameElement.style.setProperty("background", chrome.frameBackground);
					}
					chrome.frameElement = null;
				});
				// Detach only the nodes created here, and do it after React's commit
				// so teardown can never yank a node out from under a rendering tree.
				safe(() => {
					const nodes = chrome.nodes || [];
					setTimeout(() => {
						for (const node of nodes) {
							try {
								if (node && node.parentNode) node.parentNode.removeChild(node);
							} catch (error) {
								console.warn("[denia] node detach failed:", error);
							}
						}
					}, 0);
				});
				// The pet is React-owned; hide it instead of detaching it.
				safe(() => {
					document.querySelectorAll(".dn-pet").forEach((el) => {
						el.style.display = "none";
					});
				});
				safe(() => {
					document.querySelectorAll("[data-denia-theme-label]").forEach((el) => el.removeAttribute("data-denia-theme-label"));
					document.querySelectorAll("[data-denia-sidebar-footer]").forEach((el) => delete el.dataset.deniaSidebarFooter);
				});
				safe(() => {
					if (chrome.hero && chrome.hero.parentNode) chrome.hero.remove();
					chrome.hero = null;
				});
				safe(() => styleTag.remove());
				safe(() => delete body.dataset.dshDenia);
				safe(() => {
					for (const key of ["deniaMsgFrame", "deniaMsgColor", "deniaBubbles", "deniaChain", "deniaTrim", "deniaSidebarSize", "deniaDetails"]) {
						delete body.dataset[key];
					}
				});
				safe(() => {
					for (const key of ["--denia-content-width", "--denia-char-height", "--denia-char-offset", "--denia-chibi-size", "--denia-bg-opacity", "--denia-bg-blur", "--denia-msg-opacity", "--denia-msg-fill", "--denia-sidebar-width", "--denia-titlebar-height", "--denia-trim-right"]) {
						document.documentElement.style.removeProperty(key);
					}
				});
				safe(() => { document.title = previous.title; });
				safe(() => { if (previous.themeColor) previous.themeColor.el.content = previous.themeColor.content; });
				chrome.styleTag = null;
				chrome.stage = null;
				chrome.chars = {};
				chrome.bubbles = { front: [], back: [] };
				chrome.bgImage = null;
			};
		}

		// ═══════════════════════════════════════════════════════════════
		//  TITLE BAR WORDMARK (inline SVG — tiny, no request)
		// ═══════════════════════════════════════════════════════════════


		// ═══════════════════════════════════════════════════════════════
		//  REACT BINDINGS
		// ═══════════════════════════════════════════════════════════════

		function useSkin() {
			const [, force] = useState(0);
			useEffect(() => subscribe(() => force((n) => n + 1)), []);
			return {
				settings: store.settings,
				lockPet: store.settings.petLocked || store.configLockPet,
				save: (patch) => setSettings(patch),
			};
		}

		function useForm() {
			const [dark, setDark] = useState(() => typeof document !== "undefined" && document.body.hasAttribute("data-ds-dark-theme"));
			useEffect(() => {
				const observer = new MutationObserver(() => setDark(document.body.hasAttribute("data-ds-dark-theme")));
				observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
				return () => observer.disconnect();
			}, []);
			return dark ? "dark" : "light";
		}

		function Switch(props) {
			return h("button", {
				type: "button",
				className: "dn-switch",
				role: "switch",
				"aria-checked": props.checked ? "true" : "false",
				"aria-label": props.label,
				disabled: props.disabled,
				onClick: () => {
					if (!props.disabled) props.onChange(!props.checked);
				},
			});
		}

		function Row(props) {
			return h("div", { className: "dn-row" },
				h("div", { className: "dn-row-main" },
					h("span", null, props.label),
					props.hint ? h("span", { className: "dn-hint" }, props.hint) : null,
				),
				h("div", { className: "dn-control" }, props.children),
			);
		}

		function Card(props) {
			return h("section", { className: "dn-card" },
				props.title ? h("h3", null, props.title) : null,
				props.note ? h("p", { className: "dn-note" }, props.note) : null,
				props.children,
			);
		}

		function SliderRow(props) {
			const value = Math.round(props.value);
			return h(Row, { label: props.label, hint: props.hint },
				h("input", {
					className: "dn-slider",
					type: "range",
					min: props.min,
					max: props.max,
					step: props.step || 1,
					value,
					"aria-label": props.label,
					onChange: (event) => props.onChange(Number(event.target.value)),
				}),
				h("span", { className: "dn-value" }, props.format ? props.format(value) : String(value)),
			);
		}

		// ═══════════════════════════════════════════════════════════════
		//  PET — draggable in the frame overlay, position persisted
		// ═══════════════════════════════════════════════════════════════

		const DRAG_THRESHOLD = 5;
		const KEEP_VISIBLE = 24;

		function clampPet(x, y, width, height) {
			return {
				x: Math.min(Math.max(x, KEEP_VISIBLE - width), window.innerWidth - KEEP_VISIBLE),
				y: Math.min(Math.max(y, 0), window.innerHeight - KEEP_VISIBLE),
			};
		}

		function PetCard() {
			const { settings, lockPet } = useSkin();
			const form = useForm();
			const ref = useRef(null);
			const drag = useRef(null);
			const shown = settings.petVisible && (form === "dark" ? settings.darkChibi : settings.lightChibi);

			// Keep a stored position inside the viewport after a resize.
			useEffect(() => {
				if (settings.petX === null || settings.petY === null) return undefined;
				const onResize = () => {
					const next = clampPet(settings.petX, settings.petY, settings.chibiSize, settings.chibiSize);
					if (next.x !== settings.petX || next.y !== settings.petY) setSettings({ petX: next.x, petY: next.y }, { silent: true });
				};
				window.addEventListener("resize", onResize, { passive: true });
				return () => window.removeEventListener("resize", onResize);
			}, [settings.petX, settings.petY, settings.chibiSize]);

			useEffect(() => {
				const el = ref.current;
				if (!el) return undefined;
				el.dataset.locked = lockPet ? "true" : "false";
				if (lockPet) return undefined;

				let state = null;
				let justDraggedUntil = 0;
				const onDown = (event) => {
					if (event.button !== 0) return;
					const rect = el.getBoundingClientRect();
					state = {
						id: event.pointerId,
						startX: event.clientX,
						startY: event.clientY,
						originX: rect.left,
						originY: rect.top,
						x: rect.left,
						y: rect.top,
						dragging: false,
					};
					el.setPointerCapture(event.pointerId);
					event.preventDefault();
				};
				const onMove = (event) => {
					if (!state || event.pointerId !== state.id) return;
					const dx = event.clientX - state.startX;
					const dy = event.clientY - state.startY;
					if (!state.dragging) {
						if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
						state.dragging = true;
						el.dataset.dragging = "true";
					}
					const next = clampPet(state.originX + dx, state.originY + dy, el.offsetWidth, el.offsetHeight);
					state.x = next.x;
					state.y = next.y;
					// Direct style writes: no React render per pointer event.
					el.style.left = next.x + "px";
					el.style.top = next.y + "px";
					el.style.right = "auto";
					el.style.bottom = "auto";
				};
				const finish = (event) => {
					if (!state) return;
					const wasDragging = state.dragging;
					const x = state.x;
					const y = state.y;
					state = null;
					delete el.dataset.dragging;
					if (event && el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
					if (wasDragging) {
						justDraggedUntil = performance.now() + 100;
						setSettings({ petX: Math.round(x), petY: Math.round(y) });
					}
				};
				const onUp = (event) => finish(event);
				// Capture can be lost to an OS gesture; a window-level mouseup still
				// commits the move instead of leaving the pet mid-drag.
				const onWindowUp = (event) => {
					if (state && state.dragging) finish({ pointerId: state.id, clientX: event.clientX, clientY: event.clientY });
				};

				el.addEventListener("pointerdown", onDown);
				el.addEventListener("pointermove", onMove);
				el.addEventListener("pointerup", onUp);
				el.addEventListener("pointercancel", onUp);
				window.addEventListener("mouseup", onWindowUp);
				return () => {
					el.removeEventListener("pointerdown", onDown);
					el.removeEventListener("pointermove", onMove);
					el.removeEventListener("pointerup", onUp);
					el.removeEventListener("pointercancel", onUp);
					window.removeEventListener("mouseup", onWindowUp);
				};
			}, [lockPet, settings.chibiSize]);

			if (!shown) return null;
			const style = {};
			if (settings.petX !== null && settings.petY !== null) {
				style.left = settings.petX + "px";
				style.top = settings.petY + "px";
			} else {
				// Default anchor: right of the left character, above the composer.
				style.left = "calc(var(--denia-sidebar-width, 280px) + 9vw)";
				style.top = "calc(var(--denia-char-height, 55vh) * 0.62)";
			}
			return h("img", {
				ref,
				className: "dn-pet",
				alt: "",
				draggable: false,
				title: lockPet ? "位置已锁定（设置 → 达妮娅主题 可解锁）" : "按住拖动可移动位置",
				"data-locked": lockPet ? "true" : "false",
				src: ASSET + (form === "dark" ? "dark-chibi.gif" : "light-chibi.gif"),
				style,
				onDragStart: (event) => event.preventDefault(),
			});
		}

		// ═══════════════════════════════════════════════════════════════
		//  SETTINGS PAGE
		// ═══════════════════════════════════════════════════════════════

		function readFileAsCompressedDataUrl(file, targetRatio) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onerror = () => reject(reader.error || new Error("read failed"));
				reader.onload = () => {
					const source = String(reader.result || "");
					if (!file.type.startsWith("image/") || file.type === "image/gif") {
						resolve(source);
						return;
					}
					const image = new Image();
					image.onerror = () => resolve(source);
					image.onload = () => {
						const ratio = targetRatio || image.width / image.height;
						let width = image.width;
						let height = image.height;
						if (width / height > ratio) width = Math.round(height * ratio);
						else height = Math.round(width / ratio);
						const max = 1920;
						const scale = Math.min(1, max / Math.max(width, height));
						const canvas = document.createElement("canvas");
						canvas.width = Math.max(1, Math.round(width * scale));
						canvas.height = Math.max(1, Math.round(height * scale));
						const context = canvas.getContext("2d");
						if (!context) {
							resolve(source);
							return;
						}
						context.drawImage(
							image,
							Math.round((image.width - width) / 2),
							Math.round((image.height - height) / 2),
							width,
							height,
							0,
							0,
							canvas.width,
							canvas.height,
						);
						try {
							const out = canvas.toDataURL("image/jpeg", 0.85);
							resolve(out.length < source.length ? out : source);
						} catch {
							resolve(source);
						}
					};
					image.src = source;
				};
				reader.readAsDataURL(file);
			});
		}

		function BackgroundRow(props) {
			const inputRef = useRef(null);
			const [busy, setBusy] = useState(false);
			return h(Row, { label: props.label, hint: props.value ? "已使用自定义背景" : "使用皮肤内置背景" },
				h("input", {
					ref: inputRef,
					className: "dn-file",
					type: "file",
					accept: "image/png,image/jpeg,image/webp,image/gif",
					onChange: (event) => {
						const file = event.target.files && event.target.files[0];
						event.target.value = "";
						if (!file) return;
						setBusy(true);
						readFileAsCompressedDataUrl(file, window.innerWidth / window.innerHeight)
							.then((dataUrl) => props.onChange(dataUrl))
							.catch((error) => console.warn("[denia] background:", error))
							.finally(() => setBusy(false));
					},
				}),
				h("button", { type: "button", className: "dn-btn", disabled: busy, onClick: () => inputRef.current && inputRef.current.click() }, busy ? "处理中…" : "上传"),
				props.value ? h("button", { type: "button", className: "dn-btn", onClick: () => props.onChange(null) }, "清除") : null,
			);
		}

		function SettingsPage() {
			const { settings: s, save } = useSkin();
			const dark = useForm() === "dark";
			return h("div", { className: "dn-page" },
				h("div", { className: "dn-head" },
					h("div", null,
						h("h2", null, "达妮娅 · 虚无之泡"),
						h("p", null, "鸣潮主题皮肤 v" + SKIN_VERSION + "：双形态、侧边立绘、玻璃卡片、泡泡与锁链。改动即时生效并保存在当前 profile。"),
					),
					h("div", { className: "dn-actions" },
						h("button", {
							type: "button",
							className: "dn-btn",
							onClick: () => {
								const patch = Object.assign({}, DEFAULTS);
								// Keep the user's own art and the pet's placement on reset.
								patch.lightBackground = s.lightBackground;
								patch.darkBackground = s.darkBackground;
								patch.petX = s.petX;
								patch.petY = s.petY;
								save(patch);
							},
						}, "恢复默认"),
					),
				),

				h(Card, { title: "当前形态 · " + (dark ? "幻灭之形（暗色）" : "布景之形（亮色）"), note: "每种形态独立记住自己的背景与立绘。" },
					h(Row, { label: "左立绘" }, h(Switch, { checked: dark ? s.darkLeftChar : s.lightLeftChar, label: "左立绘", onChange: (v) => save(dark ? { darkLeftChar: v } : { lightLeftChar: v }) })),
					h(Row, { label: "右立绘" }, h(Switch, { checked: dark ? s.darkRightChar : s.lightRightChar, label: "右立绘", onChange: (v) => save(dark ? { darkRightChar: v } : { lightRightChar: v }) })),
					h(Row, { label: "Q版桌宠", hint: "可在页面上直接拖动" }, h(Switch, { checked: dark ? s.darkChibi : s.lightChibi, label: "Q版桌宠", onChange: (v) => save(dark ? { darkChibi: v } : { lightChibi: v }) })),
					h(BackgroundRow, { label: "背景图", value: dark ? s.darkBackground : s.lightBackground, onChange: (v) => save(dark ? { darkBackground: v } : { lightBackground: v }) }),
				),

				h(Card, { title: "布局" },
					h(SliderRow, { label: "对话宽度", min: 500, max: 1000, value: s.contentWidth, format: (v) => v + "px", onChange: (v) => save({ contentWidth: v }) }),
					h(SliderRow, { label: "立绘高度", min: 30, max: 80, value: s.charHeight, format: (v) => v + "vh", onChange: (v) => save({ charHeight: v }) }),
					h(SliderRow, { label: "立绘水平偏移", min: -50, max: 50, value: s.charOffsetX, format: (v) => v + "px", onChange: (v) => save({ charOffsetX: v }) }),
					h(SliderRow, { label: "背景不透明度", min: 20, max: 100, value: s.bgOpacity, format: (v) => v + "%", onChange: (v) => save({ bgOpacity: v }) }),
					h(SliderRow, { label: "背景模糊", min: 0, max: 12, value: s.bgBlur, format: (v) => v + "px", onChange: (v) => save({ bgBlur: v }) }),
				),

				h(Card, { title: "效果" },
					h(Row, { label: "泡泡粒子场" }, h(Switch, { checked: s.bubbles, label: "泡泡粒子场", onChange: (v) => save({ bubbles: v }) })),
					h(SliderRow, { label: "泡泡数量", min: 5, max: 40, value: s.bubbleCount, onChange: (v) => save({ bubbleCount: v }) }),
					h(SliderRow, { label: "泡泡速度", min: 30, max: 200, value: s.bubbleSpeed, format: (v) => v + "%", onChange: (v) => save({ bubbleSpeed: v }) }),
					h(Row, { label: "锁链边框" }, h(Switch, { checked: s.chainBorder, label: "锁链边框", onChange: (v) => save({ chainBorder: v }) })),
					h(Row, { label: "装饰条" }, h(Switch, { checked: s.trim, label: "装饰条", onChange: (v) => save({ trim: v }) })),
				),

				h(Card, { title: "消息", note: "文本框只作用于 AI 输出，不会框住你的输入。" },
					h(Row, { label: "消息文本框" }, h(Switch, { checked: s.msgFrame, label: "消息文本框", onChange: (v) => save({ msgFrame: v }) })),
					h(SliderRow, { label: "文本框不透明度", min: 20, max: 100, value: s.msgOpacity, format: (v) => v + "%", onChange: (v) => save({ msgOpacity: v }) }),
					h(Row, { label: "消息文字配色" }, h(Switch, { checked: s.msgColor, label: "消息文字配色", onChange: (v) => save({ msgColor: v }) })),
				),

				h(Card, { title: "桌宠", note: "默认可直接拖动；锁定后位置固定，不会再被误拖。" },
					h(Row, { label: "显示桌宠" }, h(Switch, { checked: s.petVisible, label: "显示桌宠", onChange: (v) => save({ petVisible: v }) })),
					h(SliderRow, { label: "桌宠大小", min: 60, max: 240, value: s.chibiSize, format: (v) => v + "px", onChange: (v) => save({ chibiSize: v }) }),
					h(Row, {
						label: "锁定位置",
						hint: store.configLockPet ? "已由 cordis.patch.yml 的 lockPet 锁定" : "锁定时不可拖动",
					}, h(Switch, {
						checked: s.petLocked || store.configLockPet,
						disabled: store.configLockPet,
						label: "锁定位置",
						onChange: (v) => save({ petLocked: v }),
					})),
					h(Row, { label: "重置位置" },
						h("button", { type: "button", className: "dn-btn", onClick: () => save({ petX: null, petY: null }) }, "回到默认位置"),
					),
				),

				store.error ? h("div", { className: "dn-note" }, "保存失败：" + store.error) : null,
			);
		}

		// ═══════════════════════════════════════════════════════════════
		//  APPLY
		// ═══════════════════════════════════════════════════════════════

		function apply(ctx) {
			ctx.effect(() => {
				loadSettings();
				return install();
			});

			ctx.slots.inject("shell.overlay", function* () {
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "denia-pet",
					order: 1200,
				}, PetCard);
			});

			ctx.slots.inject("settings.section", function* () {
				yield ctx.slots.register({
					name: "settings.section",
					id: "denia",
					order: 32,
					label: () => (String(navigator.language || "").toLowerCase().startsWith("zh") ? "达妮娅主题" : "Denia Theme"),
				}, SettingsPage);
			});
		}

		return { inject: ["slots"], apply };
	},
});
