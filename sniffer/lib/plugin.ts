import { type Session, type SessionEvents } from "./sniffer";
import { EventEmitter } from "./utils/emit-mod";

/**
 * Proxy to `Session` that only exists for the lifetime of the user plugin.
 */
export class SessionProxy extends EventEmitter<SessionEvents> {
	constructor(private session: Session) {
		super();
	}

	// tbc connection proxy
	get main() {
		return this.session.main;
	}
	get bulle() {
		return this.session.bulle;
	}
	get active() {
		return this.session.active;
	}
	
}

export interface UserPlugin {
	eventNewSession?: (session: SessionProxy) => void;
}
