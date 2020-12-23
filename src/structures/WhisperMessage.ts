import { Message, Player } from ".";
import Client from "../client";

/** Represents a whisper message. */
export default class WhisperMessage extends Message {
	/**
	 * The player name who sent to them.
	 */
	sentTo: string;
	community: number;

	constructor(
		client: Client,
		author: Player,
		community: number,
		sentTo: string,
		content: string
	) {
		super(client, author, content);
		this.sentTo = sentTo;
		this.community = community;
	}

	/**
	 * Reply the author with a whisper message
	 *
	 * @example
	 * ```js
	 * client.on('whisper', (message) => {
	 * 	if (client.nickname == message.author)
	 * 		return;
	 * 	message.reply('Hello');
	 * }
	 * ```
	 */
	reply(message: string) {
		this.client.sendWhisper(this.author.nickname, `${message}`);
	}
}
