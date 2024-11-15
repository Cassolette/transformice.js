import { watch } from "fs";



const watcher = watch("./user-plugin.ts", (event, filename) => {
	if (filename !== "user-plugin.ts") return;

	console.log(`Detected ${event} in ${filename}`);
});

process.on("SIGINT", () => {
	// close watcher when Ctrl-C is pressed
	console.log("Closing watcher...");
	watcher.close();

	process.exit(0);
});
