import { createExtension } from "@cognigy/extension-tools";

/* import all nodes */
import { functionCallNode } from "./nodes/functionCallNode";

/* import all connections */
import { cognigyApiConnection } from "./connections/cognigyApiConnection";

export default createExtension({
	nodes: [
		functionCallNode
	],

	connections: [
		cognigyApiConnection
	],

	options: {
		label: "Function Call"
	}
});
