# Transformice.js (WIP)

NodeJs Client for Transformice with full Typescript support.

## Development

Clone the repository:

```
git clone https://github.com/SuspiciousLookingOwl/transformice.js
```

Install dependencies:

```
npm i
```

Watch and compile files:

```
npm run dev
```

## Example

```js
const { Client } = require("transformice.js");

const client = new Client();

client.on("roomMessage", (message) => {
	if (client.nickname == message.author.nickname) return;
	client.sendRoomMessage(message.author.look);
});

client.run("tfm_id", "token", "username", "password", Client.enums.languages.en, "room_name");
```
