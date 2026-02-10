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
					console.log("[FLOW RESOLVER] Started", { paramsKeys: Object.keys(params) });
					const { api, config } = params;

					console.log("[FLOW RESOLVER] config", config);
					console.log("[FLOW RESOLVER] root params", params);

					// Try to get connection from config first, fallback to root params
					const connection = config?.connection || params?.connection;
					console.log("[FLOW RESOLVER] connection extracted", { connection, hasConnection: !!connection });

					if (!connection) {
						console.log("[FLOW RESOLVER] No connection found, returning empty");
						return [];
					}
					if (!connection.apiUrl) {
						console.log("[FLOW RESOLVER] Missing apiUrl");
						return [];
					}
					if (!connection.apiKey) {
						console.log("[FLOW RESOLVER] Missing apiKey");
						return [];
					}
					if (!connection.projectId) {
						console.log("[FLOW RESOLVER] Missing projectId");
						return [];
					}

					console.log("[FLOW RESOLVER] All connection data present", {
						apiUrl: connection.apiUrl,
						hasApiKey: !!connection.apiKey,
						projectId: connection.projectId
					});

					try {
						// Fetch flows with pagination support
						let allFlows: any[] = [];
						let skip = 0;
						const limit = 100;
						let hasMore = true;
						let pageCount = 0;

						while (hasMore) {
							pageCount++;
							console.log(`[FLOW RESOLVER] Fetching page ${pageCount}`, { skip, limit });

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

							console.log("[FLOW RESOLVER] API response", {
								status: response.status,
								hasData: !!response.data,
								dataKeys: response.data ? Object.keys(response.data) : null
							});

							console.log("[FLOW RESOLVER] FULL RESPONSE DATA", JSON.stringify(response.data, null, 2));

							// Handle different response formats
							if (response.data && response.data._embedded && response.data._embedded.flows) {
								// HAL+JSON format with _embedded.flows
								const flows = response.data._embedded.flows.map((flow: any) => {
									// Use referenceId for executeFlow API
									return {
										_id: flow._id,
										name: flow.properties?.name,
										referenceId: flow.properties?.referenceId
									};
								});

								console.log(`[FLOW RESOLVER] Page ${pageCount}: found ${flows.length} flows (HAL+JSON format)`);
								allFlows = allFlows.concat(flows);
								hasMore = response.data._links?.next !== undefined;
								skip += limit;
							} else if (response.data && response.data.items) {
								// Direct items format
								const flows = response.data.items.map((flow: any) => ({
									_id: flow._id || flow.id,
									name: flow.name || flow._id,
									referenceId: flow.referenceId
								}));

								console.log(`[FLOW RESOLVER] Page ${pageCount}: found ${flows.length} flows (items format)`);
								allFlows = allFlows.concat(flows);
								hasMore = response.data.nextCursor !== null;
								skip += limit;
							} else {
								console.log("[FLOW RESOLVER] No _embedded.flows or items in response, stopping pagination");
								console.log("[FLOW RESOLVER] Response structure unknown:", JSON.stringify(response.data, null, 2).substring(0, 500));
								hasMore = false;
							}
						}

						console.log(`[FLOW RESOLVER] Total flows fetched: ${allFlows.length}`);

						// Map flows to options array - store both _id and referenceId
						const options = allFlows.map((flow: any) => ({
							label: flow.name || flow._id,
							value: JSON.stringify({
								_id: flow._id,
								referenceId: flow.referenceId
							})
						}));

						console.log("[FLOW RESOLVER] Returning options", options.map(o => ({ label: o.label, value: o.value })));
						return options;
					} catch (error) {
						console.error("[FLOW RESOLVER] Error fetching flows:", error);
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
					console.log("[NODE RESOLVER] Started", { paramsKeys: Object.keys(params) });
					const { api, config } = params;

					console.log("[NODE RESOLVER] config", config);
					console.log("[NODE RESOLVER] root params", params);

					// Try to get connection from config first, fallback to root params
					const connection = config?.connection || params?.connection;
					let flowId = config?.flowId || params?.flowId;

					console.log("[NODE RESOLVER] Extracted data", {
						hasConnection: !!connection,
						hasFlowId: !!flowId,
						flowId
					});

					// Parse flowId to get _id (for API calls) and referenceId (for executeFlow)
					let flowInternalId = flowId;
					try {
						const parsed = JSON.parse(flowId);
						if (parsed._id) {
							flowInternalId = parsed._id;
							console.log("[NODE RESOLVER] Parsed flow _id from JSON", { flowInternalId });
						}
					} catch (e) {
						// flowId is not JSON, use as-is
						console.log("[NODE RESOLVER] flowId is not JSON, using as-is");
					}

					if (!connection || !connection.apiUrl || !connection.apiKey || !flowInternalId) {
						console.log("[NODE RESOLVER] Missing required data, returning empty");
						return [];
					}

					console.log("[NODE RESOLVER] Fetching nodes for flow", { flowInternalId });

					try {
						// Fetch nodes with pagination support
						let allNodes: any[] = [];
						let skip = 0;
						const limit = 100;
						let hasMore = true;
						let pageCount = 0;

						while (hasMore) {
							pageCount++;
							console.log(`[NODE RESOLVER] Fetching page ${pageCount}`, { skip, limit });

							const response = await api.httpRequest({
								method: "GET",
								url: `${connection.apiUrl}/v2.0/flows/${flowInternalId}/chart/nodes`,
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

							console.log("[NODE RESOLVER] API response", {
								status: response.status,
								hasData: !!response.data,
								dataKeys: response.data ? Object.keys(response.data) : null
							});

							if (response.data && response.data.items) {
								console.log(`[NODE RESOLVER] Page ${pageCount}: found ${response.data.items.length} nodes`);
								allNodes = allNodes.concat(response.data.items);
								hasMore = response.data.nextCursor !== null;
								skip += limit;
							} else {
								console.log("[NODE RESOLVER] No items in response, stopping pagination");
								hasMore = false;
							}
						}

						console.log(`[NODE RESOLVER] Total nodes fetched: ${allNodes.length}`);

						const entryPoints = allNodes.filter((node: any) => node.isEntryPoint === true);
						console.log(`[NODE RESOLVER] Entry points found: ${entryPoints.length}`);

						// Filter to only entry point nodes and map to options - use referenceId
						const options = entryPoints.map((node: any) => ({
							label: `${node.label || node.type} (${node._id})`,
							value: JSON.stringify({
								_id: node._id,
								referenceId: node.referenceId
							})
						}));

						console.log("[NODE RESOLVER] Returning options", options.map(o => ({ label: o.label, value: o.value })));
						return options;
					} catch (error) {
						console.error("[NODE RESOLVER] Error fetching nodes:", error);
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
		console.log("[NODE EXECUTION] Function Call node executing");

		const { api } = cognigy;
		const { connection, flowId, flowNodeId, functionName, payload, outputStorageType, outputStoragePath } = config;

		console.log("[NODE EXECUTION] Config", {
			hasConnection: !!connection,
			flowId,
			flowNodeId,
			functionName,
			hasPayload: !!payload,
			outputStorageType,
			outputStoragePath
		});

		// Parse flowId to get referenceId for executeFlow
		let flowReferenceId = flowId;
		try {
			const parsed = JSON.parse(flowId);
			if (parsed.referenceId) {
				flowReferenceId = parsed.referenceId;
				console.log("[NODE EXECUTION] Parsed flow referenceId from JSON", { flowReferenceId });
			}
		} catch (e) {
			console.log("[NODE EXECUTION] flowId is not JSON, using as-is");
		}

		// Parse flowNodeId to get referenceId for executeFlow
		let nodeReferenceId = flowNodeId;
		try {
			const parsed = JSON.parse(flowNodeId);
			if (parsed.referenceId) {
				nodeReferenceId = parsed.referenceId;
				console.log("[NODE EXECUTION] Parsed node referenceId from JSON", { nodeReferenceId });
			}
		} catch (e) {
			console.log("[NODE EXECUTION] flowNodeId is not JSON, using as-is");
		}

		console.log("[NODE EXECUTION] Using referenceIds for executeFlow", { flowReferenceId, nodeReferenceId });

		// Structure the function call data on input
		const functionCallData = {
			functionName,
			payload: payload || {},
			output: {
				storageType: outputStorageType,
				path: outputStoragePath
			}
		};

		console.log("[NODE EXECUTION] Preparing functionCallData", functionCallData);

		// Store on input for the called flow to access
		// @ts-ignore
		api.addToInput("functionCall", functionCallData);
		console.log("[NODE EXECUTION] Stored functionCallData in input");

		// Use referenceIds for executeFlow API
		const executeConfig: IExecuteFlowNodeConfig = {
			flowNode: {
				flow: flowReferenceId,
				node: nodeReferenceId
			}
		};

		console.log("[NODE EXECUTION] Executing flow with referenceIds", { flowReferenceId, nodeReferenceId });
		api.log("info", `Executing function call: ${functionName} -> Flow: ${flowReferenceId}, Node: ${nodeReferenceId}`);
		await api.executeFlow(executeConfig);
		console.log("[NODE EXECUTION] Flow execution completed");
	}
});
