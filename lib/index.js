import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const name = "@dsh-external/dsh-client-ui-skin-denia-rewrite";
const inject = ["webServer"];

const SETTINGS_ROUTE = "/api/dsh-denia-rewrite/palette-settings";
const ASSETS_ROUTE = "/api/dsh-denia-rewrite/assets";
const SETTINGS_DIR = "dsh-client-ui-skin-denia-rewrite";
const SETTINGS_FILE = "palette-settings.json";
const MAX_BODY_BYTES = 15 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 7 * 1024 * 1024;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;

const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ASSET_DIR = join(PACKAGE_DIR, "assets");

const BOOLEAN_KEYS = [
	"lightLeftChar", "lightRightChar", "lightChibi",
	"darkLeftChar", "darkRightChar", "darkChibi",
	"msgFrame", "msgColor", "bubbles", "chainBorder", "trim",
	"petLocked", "petVisible",
];

const NUMBER_RANGES = {
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
	petX: [-8000, 8000],
	petY: [-8000, 8000],
};

/**
 * Resolve the profile directory without trusting env alone.
 *
 * The desktop Host launches a profile by argv, so a plugin process can see no
 * DSH_PROFILE_DIR at all — that bug sent palette settings to profiles/web while
 * the plugin itself ran from profiles/desktop. The package's own location is the
 * authoritative hint when it is available:
 * <profile>/node_modules/<pkg>/lib/index.js.
 */
function profileDir() {
	if (process.env.DSH_PROFILE_DIR) return process.env.DSH_PROFILE_DIR;
	const parts = PACKAGE_DIR.split(/[\\/]/);
	const at = parts.lastIndexOf("node_modules");
	if (at > 0) {
		const candidate = parts.slice(0, at).join("/") || "/";
		if (existsSync(candidate)) return candidate;
	}
	const profile = process.env.DSH_PROFILE || process.env.DSH_DESKTOP_PROFILE;
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	const safe = profile && /^[A-Za-z0-9_-]+$/.test(profile) ? profile : "web";
	return join(home, "profiles", safe);
}

function settingsPath() {
	return join(profileDir(), "data", SETTINGS_DIR, SETTINGS_FILE);
}

function isLoopback(req) {
	const address = req.socket && req.socket.remoteAddress;
	return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function sendJson(res, status, value) {
	const data = Buffer.from(JSON.stringify(value), "utf8");
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"content-length": String(data.length),
	});
	res.end(data);
}

function isBackground(value) {
	if (value === null) return true;
	return typeof value === "string"
		&& /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value)
		&& Buffer.byteLength(value, "utf8") <= MAX_BACKGROUND_BYTES;
}

function sanitizeSettings(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const clean = {};
	for (const key of BOOLEAN_KEYS) {
		if (typeof value[key] === "boolean") clean[key] = value[key];
	}
	for (const [key, range] of Object.entries(NUMBER_RANGES)) {
		const next = value[key];
		if (next === null) {
			// petX / petY null means "use the default anchor".
			if (key === "petX" || key === "petY") clean[key] = null;
			continue;
		}
		if (typeof next !== "number" || !Number.isFinite(next) || next < range[0] || next > range[1]) continue;
		clean[key] = Math.round(next * 100) / 100;
	}
	for (const key of ["lightBackground", "darkBackground"]) {
		if (isBackground(value[key])) clean[key] = value[key];
	}
	return clean;
}

function readSettings() {
	const path = settingsPath();
	if (!existsSync(path)) return {};
	try {
		return sanitizeSettings(JSON.parse(readFileSync(path, "utf8"))) || {};
	} catch {
		return {};
	}
}

function writeSettings(settings) {
	const clean = sanitizeSettings(settings);
	if (clean === null) throw new Error("invalid settings");
	const dir = join(profileDir(), "data", SETTINGS_DIR);
	mkdirSync(dir, { recursive: true });
	const path = settingsPath();
	const temporary = path + ".tmp";
	writeFileSync(temporary, JSON.stringify(clean), "utf8");
	try {
		renameSync(temporary, path);
	} catch {
		rmSync(path, { force: true });
		renameSync(temporary, path);
	}
	return clean;
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				req.destroy();
				reject(new Error("payload too large"));
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}

// ── static art assets ─────────────────────────────────────────────────────
// Art ships as files instead of inline data URIs: the client bundle drops from
// ~2.4 MB of base64 to a few tens of KB, the browser decodes images off the main
// thread and only loads the form it shows, and a 304 keeps repeat loads free.

const MIME = {
	".webp": "image/webp",
	".gif": "image/gif",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".svg": "image/svg+xml",
};

const assetCache = new Map();

function assetFile(requested) {
	// One path segment, no traversal, no hidden files, known extension only.
	const leaf = String(requested || "").split("?")[0];
	if (!/^[A-Za-z0-9._-]+$/.test(leaf) || leaf.startsWith(".")) return null;
	if (!MIME[extname(leaf).toLowerCase()]) return null;
	const path = join(ASSET_DIR, leaf);
	if (!existsSync(path)) return null;
	const info = statSync(path);
	if (!info.isFile() || info.size === 0 || info.size > MAX_ASSET_BYTES) return null;
	return { path, info };
}

function readAsset(path, info) {
	const cached = assetCache.get(path);
	if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached;
	const bytes = readFileSync(path);
	const entry = {
		mtimeMs: info.mtimeMs,
		size: info.size,
		bytes,
		etag: `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`,
	};
	assetCache.set(path, entry);
	return entry;
}

function handleAssetRoute(req, res) {
	if (req.method !== "GET" && req.method !== "HEAD") {
		res.writeHead(405, { allow: "GET, HEAD" });
		res.end();
		return;
	}
	const url = req.url || "";
	const requested = url.startsWith(ASSETS_ROUTE) ? url.slice(ASSETS_ROUTE.length).replace(/^\/+/, "") : "";
	const found = assetFile(requested);
	if (!found) {
		res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
		res.end("not found");
		return;
	}
	let entry;
	try {
		entry = readAsset(found.path, found.info);
	} catch {
		res.writeHead(500);
		res.end();
		return;
	}
	if (req.headers["if-none-match"] === entry.etag) {
		res.writeHead(304, { etag: entry.etag, "cache-control": "no-cache" });
		res.end();
		return;
	}
	res.writeHead(200, {
		"content-type": MIME[extname(found.path).toLowerCase()],
		"content-length": String(entry.bytes.length),
		"cache-control": "no-cache",
		etag: entry.etag,
		"x-content-type-options": "nosniff",
	});
	if (req.method === "HEAD") res.end();
	else res.end(entry.bytes);
}

function settingsPayload(config) {
	return {
		ok: true,
		settings: readSettings(),
		config: { lockPet: Boolean(config && config.lockPet === true) },
		version: "2.0.0",
	};
}

async function handleSettingsRoute(req, res, config) {
	if (req.method === "GET") {
		sendJson(res, 200, settingsPayload(config));
		return;
	}
	if (req.method !== "PUT") {
		res.writeHead(405, { allow: "GET, PUT" });
		res.end();
		return;
	}
	// Writes stay loopback-only: a body can carry multi-megabyte images.
	if (!isLoopback(req)) {
		sendJson(res, 403, { ok: false, message: "forbidden" });
		return;
	}
	try {
		const parsed = JSON.parse(await readBody(req));
		const settings = writeSettings(parsed && parsed.settings);
		sendJson(res, 200, { ok: true, settings, config: { lockPet: Boolean(config && config.lockPet === true) } });
	} catch (error) {
		sendJson(res, 400, { ok: false, message: String((error && error.message) || error) });
	}
}

function apply(ctx, config) {
	// Routes are registered as a tracked effect so disabling the plugin really
	// releases them. A bare register() leaks the route into the running host,
	// and a leaked exact route makes the next skin's registration throw — which
	// is exactly how an earlier version ended up serving a stale settings
	// payload and silently losing its asset route.
	ctx.effect(() => {
		const disposers = [];
		try {
			disposers.push(ctx.webServer.register({
				kind: "exact",
				path: SETTINGS_ROUTE,
				handler: (req, res) => handleSettingsRoute(req, res, config),
			}));
		} catch (error) {
			console.warn("[denia] settings route not registered:", String((error && error.message) || error));
		}
		try {
			disposers.push(ctx.webServer.register({
				kind: "prefix",
				path: ASSETS_ROUTE,
				handler: handleAssetRoute,
			}));
		} catch (error) {
			console.warn("[denia] asset route not registered:", String((error && error.message) || error));
		}
		return () => {
			for (const dispose of disposers) {
				try {
					dispose();
				} catch {
					/* already gone */
				}
			}
		};
	}, "denia: settings + art routes");
}

export { apply, inject, name };
