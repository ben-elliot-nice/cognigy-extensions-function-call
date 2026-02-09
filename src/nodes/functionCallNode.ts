import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";

export interface IFunctionCallNodeParams extends INodeFunctionBaseParams {
	config: {
		functionName: string;
		payload: any;
		outputStorageType: string;
		outputStoragePath: string;
	};
}

export const functionCallNode = createNodeDescriptor({
	type: "functionCall",
	defaultLabel: "Function Call",
	summary: "Execute a function with input/output validation through flow calls",
	fields: [
		{
			key: "functionName",
			label: "Function Name",
			type: "cognigyText",
			description: "The name/identifier of the function to execute",
			params: {
				required: true
			}
		},
		{
			key: "payload",
			label: "Payload",
			type: "json",
			description: "Input data to pass to the function",
			params: {
				required: false
			}
		},
		{
			key: "outputStorageType",
			label: "Output Storage Type",
			type: "select",
			defaultValue: "input",
			description: "Where to store the function's result",
			params: {
				options: [
					{ label: "Input", value: "input" },
					{ label: "Context", value: "context" }
				],
				required: true
			}
		},
		{
			key: "outputStoragePath",
			label: "Output Storage Path",
			type: "cognigyText",
			description: "The exact data path where output should be stored (e.g., 'data.myOutput' or 'myContextKey')",
			params: {
				required: true
			}
		}
	],
	sections: [
		{
			key: "functionSettings",
			label: "Function Settings",
			defaultCollapsed: false,
			fields: ["functionName", "payload"]
		},
		{
			key: "outputSettings",
			label: "Output Settings",
			defaultCollapsed: false,
			fields: ["outputStorageType", "outputStoragePath"]
		}
	],
	form: [
		{ type: "section", key: "functionSettings" },
		{ type: "section", key: "outputSettings" }
	],
	preview: {
		type: "text",
		key: "functionName"
	},
	function: async ({ cognigy, config }: IFunctionCallNodeParams) => {
		const { api } = cognigy;
		const { functionName, payload, outputStorageType, outputStoragePath } = config;

		// Validate required fields
		if (!functionName) {
			throw new Error("Function Name is required");
		}
		if (!outputStoragePath) {
			throw new Error("Output Storage Path is required");
		}

		// Structure the function call data on input
		const functionCallData = {
			functionName,
			payload: payload || {},
			output: {
				storageType: outputStorageType,
				path: outputStoragePath
			}
		};

		// Store on input for the called flow to access
		// @ts-ignore
		api.addToInput("functionCall", functionCallData);

		// Execute the flow - the called flow will handle routing, validation, and output storage
		// Note: The actual flow execution should be configured by the user connecting this node
		// to an Execute Flow node, or this can be extended to call executeFlow directly
		api.log("info", `Function call prepared for: ${functionName}`);
	}
});
