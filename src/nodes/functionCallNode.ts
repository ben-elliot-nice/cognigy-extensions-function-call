import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { IExecuteFlowNodeConfig } from "@cognigy/extension-tools/build/interfaces/executeFlow";

export interface IFunctionCallNodeParams extends INodeFunctionBaseParams {
	config: {
		flowId: string;
		flowNodeId: string;
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
			key: "flowId",
			label: "Flow ID",
			type: "cognigyText",
			description: "The ID of the flow to execute",
			params: {
				required: true
			}
		},
		{
			key: "flowNodeId",
			label: "Flow Node ID",
			type: "cognigyText",
			description: "The ID of the node to start execution at in the target flow",
			params: {
				required: true
			}
		},
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
			key: "flowSettings",
			label: "Flow Settings",
			defaultCollapsed: false,
			fields: ["flowId", "flowNodeId"]
		},
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
		{ type: "section", key: "flowSettings" },
		{ type: "section", key: "functionSettings" },
		{ type: "section", key: "outputSettings" }
	],
	preview: {
		type: "text",
		key: "functionName"
	},
	function: async ({ cognigy, config }: IFunctionCallNodeParams) => {
		const { api } = cognigy;
		const { flowId, flowNodeId, functionName, payload, outputStorageType, outputStoragePath } = config;

		// Validate required fields
		if (!flowId) {
			throw new Error("Flow ID is required");
		}
		if (!flowNodeId) {
			throw new Error("Flow Node ID is required");
		}
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

		// Execute the flow with the configured flow and node
		const executeConfig: IExecuteFlowNodeConfig = {
			flowNode: {
				flow: flowId,
				node: flowNodeId
			}
		};

		api.log("info", `Executing function call: ${functionName} -> Flow: ${flowId}, Node: ${flowNodeId}`);
		await api.executeFlow(executeConfig);
	}
});
