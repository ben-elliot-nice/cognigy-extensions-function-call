# Function Call Extension - Requirements

## Overview
This extension provides a custom node that encapsulates function execution through flow calls, with built-in input/output validation and data management.

## Problem Statement
- Common functions exist but need proper input/output validation
- The out-of-the-box "Execute Flow" node does not provide input data handling
- Need a single action that can validate inputs, execute functions, and handle outputs

## Solution
A custom node that wraps `api.executeFlow()` and provides:
1. **Function selection** - Choose which function to call
2. **Payload management** - Pass input data to the function
3. **Output storage** - Define where results should be stored

## Node Parameters

### 1. `functionName`
- **Type**: Text/Select
- **Description**: The name/identifier of the function to execute
- **Usage**: Used to route the flow to the appropriate function

### 2. `payload`
- **Type**: Object/JSON
- **Description**: Input data to pass to the function
- **Usage**: Placed on the `input` data object for the called flow

### 3. `outputStorage`
- **Type**: Text (path expression)
- **Description**: Where to store the function's result
- **Usage**: Location in the context/data where the output should be saved

## Execution Flow

1. **Node triggers** → Extracts `functionName`, `payload`, and `outputStorage`
2. **Prepare input data** → Places payload on the `input` object
3. **Execute flow** → Calls `api.executeFlow()` with prepared data
4. **Called flow handles**:
   - Routes to selected function based on `functionName`
   - Validates input data (raises error if malformed)
   - Executes the function
   - Stores result in the specified `outputStorage` location
5. **Return control** → Flow returns to continue execution

## Benefits
- **Single node abstraction** - All function call logic in one place
- **Built-in validation** - Input validation handled in the called flow
- **Error handling** - Malformed inputs raise errors immediately
- **Flexible storage** - Output can be stored anywhere in the context
- **Reusable** - Common pattern for all function calls
