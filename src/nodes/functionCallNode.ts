import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { IExecuteFlowNodeConfig } from "@cognigy/extension-tools/build/interfaces/executeFlow";

export interface ICognigyApiConnection {
	apiUrl: string;
	apiKey: string;
	projectId: string;
}

export interface IFunctionCallNodeParams extends INodeFunctionBaseParams {
	config: {
		connection: ICognigyApiConnection;
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
			key: "connection",
			label: "Cognigy API Connection",
			type: "connection",
			description: "Connection to Cognigy API for fetching flows",
			params: {
				connectionType: "cognigy-api"
			}
		},
		{
			key: "flowId",
			label: "Flow",
			type: "select",
			description: "Select the flow to execute",
			optionsResolver: {
				dependencies: ["connection"],
				resolverFunction: async (params: any) => {
					const { api, config } = params;

					// Try to get connection from config first, fallback to root params
					const connection = config?.connection || params?.connection;

					if (!connection || !connection.apiUrl || !connection.apiKey || !connection.projectId) {
						return [];
					}

					try {
						// Fetch flows with pagination support
						let allFlows: any[] = [];
						let skip = 0;
						const limit = 100;
						let hasMore = true;

						while (hasMore) {
							const response = await api.httpRequest({
								method: "GET",
								url: `${connection.apiUrl}/v2.0/flows`,
								headers: {
									"X-API-Key": connection.apiKey,
									"Accept": "application/json",
									"Content-Type": "application/json"
								},
								params: {
									limit,
									skip,
									projectId: connection.projectId
								}
							});

							// Handle HAL+JSON format: _embedded.flows
							if (response.data && response.data._embedded && response.data._embedded.flows) {
								const flows = response.data._embedded.flows.map((flow: any) => {
									// Extract flow ID from _links.self.href
									const href = flow._links?.self?.href || "";
									const flowId = href.split('/').pop() || flow.properties?.referenceId;

									return {
										_id: flowId,
										name: flow.properties?.name,
										referenceId: flow.properties?.referenceId
									};
								});

								allFlows = allFlows.concat(flows);
								hasMore = response.data._links?.next !== undefined;
								skip += limit;
							} else {
								hasMore = false;
							}
						}

						// Map flows to options array
						return allFlows.map((flow: any) => ({
							label: flow.name || flow._id,
							value: flow._id
						}));
					} catch (error) {
						console.error("Failed to fetch flows:", error);
						return [];
					}
				}
			}
		},
		{
			key: "flowNodeId",
			label: "Flow Node",
			type: "select",
			description: "Select the entry point node in the target flow",
			optionsResolver: {
				dependencies: ["connection", "flowId"],
				resolverFunction: async (params: any) => {
					const { api, config } = params;

					// Try to get connection from config first, fallback to root params
					const connection = config?.connection || params?.connection;
					const flowId = config?.flowId || params?.flowId;

					if (!connection || !connection.apiUrl || !connection.apiKey || !flowId) {
						return [];
					}

					try {
						// Fetch nodes with pagination support
						let allNodes: any[] = [];
						let skip = 0;
						const limit = 100;
						let hasMore = true;

						while (hasMore) {
							const response = await api.httpRequest({
								method: "GET",
								url: `${connection.apiUrl}/v2.0/flows/${flowId}/chart/nodes`,
								headers: {
									"X-API-Key": connection.apiKey,
									"Accept": "application/json",
									"Content-Type": "application/json"
								},
								params: {
									limit,
									skip
								}
							});

							if (response.data && response.data.items) {
								allNodes = allNodes.concat(response.data.items);
								hasMore = response.data.nextCursor !== null;
								skip += limit;
							} else {
								hasMore = false;
							}
						}

						// Filter to only entry point nodes and map to options
						return allNodes
							.filter((node: any) => node.isEntryPoint === true)
							.map((node: any) => ({
								label: `${node.label || node.type} (${node._id})`,
								value: node._id
							}));
					} catch (error) {
						console.error("Failed to fetch flow nodes:", error);
						return [];
					}
				}
			}
		},
		{
			key: "functionName",
			label: "Function Name",
			type: "cognigyText",
			description: "The name/identifier of the function to execute"
		},
		{
			key: "payload",
			label: "Payload",
			type: "json",
			description: "Input data to pass to the function"
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
				]
			}
		},
		{
			key: "outputStoragePath",
			label: "Output Storage Path",
			type: "cognigyText",
			description: "The exact data path where output should be stored (e.g., 'data.myOutput' or 'myContextKey')"
		}
	],
	sections: [
		{
			key: "connectionSettings",
			label: "Connection",
			defaultCollapsed: false,
			fields: ["connection"]
		},
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
		{ type: "section", key: "connectionSettings" },
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
