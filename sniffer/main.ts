import { watch } from "chokidar";
import { SessionEvents, Sniffer, type Session } from "./lib/sniffer";
import { SessionProxy, type UserPlugin } from "./lib/plugin";

import SegfaultHandler from "segfault-raub";
SegfaultHandler.setLogPath("crash.log");
SegfaultHandler.setSignal(SegfaultHandler.EXCEPTION_ALL, true);

(async () => {
	const activeSessions: Set<Session> = new Set();
	const activeSessionProxies: Set<SessionProxy> = new Set();
	let userPlugin: UserPlugin | undefined;

	const sniffer = new Sniffer();
	await sniffer.start();
	sniffer.on("error", (e) => console.error(e));

	function addSessionProxy(session: Session) {
		const sessionProxy = new SessionProxy(session);
		sessionProxy.on("error", (e) => console.error(e));
		sessionProxy.once("closed", () => {
			sessionProxy.removeAllListeners();
			activeSessionProxies.delete(sessionProxy);
		});
		activeSessionProxies.add(sessionProxy);
		userPlugin?.eventNewSession?.(sessionProxy);
	}

	sniffer.on("newSession", (session) => {
		session.on("closed", () => {
			activeSessions.delete(session);
		});
		activeSessions.add(session);
		addSessionProxy(session);
	});

	function loadUserPlugin() {
		activeSessionProxies.forEach((s) => s.close());
		//activeSessionProxies.clear();

		try {
			const decache = (moduleName: string) => {
				moduleName = require.resolve(moduleName);
				console.log(moduleName);
				delete require.cache[moduleName];
			};
			decache("./user-plugin");
			const pluginModule = require("./user-plugin");
			userPlugin = pluginModule.default as UserPlugin;
		} catch (e) {
			console.error("Error in loading plugin", e);
			return false;
		}

		if (!userPlugin?.eventNewSession) {
			console.warn("Notice: eventNewSession is null");
		}

		activeSessions.forEach((s) => addSessionProxy(s));
		return true;
	}

	const watcher = watch("./user-plugin.ts", {
		//ignored: (path, stats) => !!(stats?.isFile())
		persistent: false,
	});

	watcher.on("change", (path, stats) => {
		console.log(`Reloading plugin (${path}, ${stats.size}).`);
		const startTime = performance.now();
		loadUserPlugin();
		console.log(`Plugin reloaded in (${performance.now() - startTime}).`);
	});

	loadUserPlugin();
	console.log("Plugin loaded.");

	process.on("SIGINT", () => {
		// close watcher when Ctrl-C is pressed
		console.log("Closing watcher...");
		watcher.close();

		process.exit(0);
	});
})();
