
import("over-the-wire").then(({ default: jsdocToTs }) => {
	jsdocToTs({
		package: "over-the-wire",
		output: require("fs").writeFileSync,
		ignore: ["node_modules", "ilib"],
		importMap: {
			"over-the-wire": "over-the-wire"
		},
		outputPath: "./aa",
	});
});
