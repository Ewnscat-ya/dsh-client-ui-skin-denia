import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const name = "@dsh-external/dsh-client-ui-skin-denia";
const inject = ["webServer"];
const SETTINGS_ROUTE = "/api/dsh-denia/palette-settings";
const SETTINGS_DIR = "dsh-client-ui-skin-denia";
const SETTINGS_FILE = "palette-settings.json";
const MAX_BODY_BYTES = 15 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 7 * 1024 * 1024;
const BOOLEAN_KEYS = [
	"lightLeftChar", "lightRightChar", "lightChibi",
	"darkLeftChar", "darkRightChar", "darkChibi",
	"msgFrame", "msgColor", "bubbles", "chainBorder", "trim"
];
const NUMBER_RANGES = {
	contentWidth: [500, 1000],
	charHeight: [30, 80],
	charOffsetX: [-50, 50],
	chibiSize: [60, 240],
	chibiOffsetY: [-420, 300],
	bgOpacity: [20, 100],
	msgOpacity: [20, 100],
	bubbleCount: [5, 40],
	bubbleSpeed: [30, 200]
};

function profileName() {
	const profile = process.env.DSH_DESKTOP_PROFILE;
	return profile && /^[A-Za-z0-9_-]+$/.test(profile) ? profile : "web";
}

function profileDir() {
	return join(process.env.DSH_HOME || join(homedir(), ".dsh"), "profiles", profileName());
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
		"content-length": String(data.length)
	});
	res.end(data);
}

function isBackground(value) {
	if (value === null) return true;
	return typeof value === "string" && /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value) && Buffer.byteLength(value, "utf8") <= MAX_BACKGROUND_BYTES;
}

function sanitizeSettings(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const clean = {};
	for (const key of BOOLEAN_KEYS) {
		if (typeof value[key] === "boolean") clean[key] = value[key];
	}
	for (const [key, range] of Object.entries(NUMBER_RANGES)) {
		if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < range[0] || value[key] > range[1]) continue;
		clean[key] = value[key];
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
	const path = settingsPath();
	const dir = join(profileDir(), "data", SETTINGS_DIR);
	mkdirSync(dir, { recursive: true });
	const temporary = path + ".tmp";
	writeFileSync(temporary, JSON.stringify(clean), "utf8");
	try { renameSync(temporary, path); } catch {
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

async function handleSettingsRoute(req, res) {
	if (!isLoopback(req)) {
		res.writeHead(403);
		res.end("forbidden");
		return;
	}
	if (req.method === "GET") {
		sendJson(res, 200, { ok: true, settings: readSettings() });
		return;
	}
	if (req.method !== "PUT") {
		res.writeHead(405, { allow: "GET, PUT" });
		res.end();
		return;
	}
	try {
		const parsed = JSON.parse(await readBody(req));
		const settings = writeSettings(parsed && parsed.settings);
		sendJson(res, 200, { ok: true, settings });
	} catch (error) {
		sendJson(res, 400, { ok: false, message: String((error && error.message) || error) });
	}
}

function apply(ctx) {
	return ctx.webServer.register({
		kind: "exact",
		path: SETTINGS_ROUTE,
		handler: handleSettingsRoute
	});
}

export { apply, inject, name };
