import { createExtension } from "@cognigy/extension-tools";

/* import all nodes */
import { functionCallNode } from "./nodes/functionCallNode";

export default createExtension({
	nodes: [
		functionCallNode
	],

	connections: [],

	options: {
		label: "Function Call"
	}
});
