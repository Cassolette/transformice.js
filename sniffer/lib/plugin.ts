import { type Session, type SessionEvents } from "./sniffer";
import { TypedEmitter } from "./utils/typed-emitter";

/**
 * Proxy to `Session` that only exists for the lifetime of the user plugin.
 */
export class SessionProxy extends TypedEmitter<SessionEvents> {
	constructor(private session: Session) {
		super({ captureRejections: true });
	}

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
