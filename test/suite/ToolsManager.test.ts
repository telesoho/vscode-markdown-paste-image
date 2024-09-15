import * as assert from "assert";
import { ToolsManager } from "../../src/ToolsManager";
import { ChatCompletionTool } from "openai/resources/chat/completions";

// Defines a Mocha test suite to group tests of similar kind together
suite("ToolsManager Tests", () => {
  let toolsManager: ToolsManager;

  setup(() => {
    toolsManager = new ToolsManager();
  });

  test("registerTool should add a new tool", () => {
    const toolName = "test_tool";
    const toolFunc = () => ({ result: "success" });
    const toolDescription = "A test tool";
    const toolParameters = { type: "object", properties: {} };

    toolsManager.registerTool(
      toolName,
      toolFunc,
      toolDescription,
      toolParameters
    );

    const tools = toolsManager.getToolsForOpenAI();
    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].function.name, toolName);
    assert.strictEqual(tools[0].function.description, toolDescription);
    assert.deepStrictEqual(tools[0].function.parameters, toolParameters);
  });

  test("executeTool should call the registered tool function", () => {
    const toolName = "test_tool";
    const toolFunc = (args: any) => ({ result: args.input });
    const toolDescription = "A test tool";
    const toolParameters = { type: "object", properties: {} };

    toolsManager.registerTool(
      toolName,
      toolFunc,
      toolDescription,
      toolParameters
    );

    const result = toolsManager.executeTool(toolName, { input: "test" });
    assert.strictEqual(result, JSON.stringify({ result: "test" }));
  });

  test("executeTool should return null for unregistered tool", () => {
    const result = toolsManager.executeTool("nonexistent_tool", {});
    assert.strictEqual(result, null);
  });

  test("getToolsForOpenAI should return correct format", () => {
    const toolName = "test_tool";
    const toolFunc = () => ({});
    const toolDescription = "A test tool";
    const toolParameters = {
      type: "object",
      properties: { arg: { type: "string" } },
    };

    toolsManager.registerTool(
      toolName,
      toolFunc,
      toolDescription,
      toolParameters
    );

    const tools = toolsManager.getToolsForOpenAI();
    assert.strictEqual(tools.length, 1);
    assert.deepStrictEqual(tools[0], {
      type: "function",
      function: {
        name: toolName,
        description: toolDescription,
        parameters: toolParameters,
      },
    });
  });

  test("registerDefaultTools should register the weather tool", () => {
    toolsManager.registerDefaultTools();
    const tools = toolsManager.getToolsForOpenAI();
    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].function.name, "get_current_weather");
  });

  test("registerTool should overwrite existing tool with same name", () => {
    const toolName = "test_tool";
    const toolFunc1 = () => ({ result: "original" });
    const toolFunc2 = () => ({ result: "overwritten" });
    const toolDescription = "A test tool";
    const toolParameters = { type: "object", properties: {} };

    toolsManager.registerTool(
      toolName,
      toolFunc1,
      toolDescription,
      toolParameters
    );
    toolsManager.registerTool(
      toolName,
      toolFunc2,
      toolDescription,
      toolParameters
    );

    const result = toolsManager.executeTool(toolName, {});
    assert.strictEqual(result, JSON.stringify({ result: "overwritten" }));
  });

  test("executeTool should handle errors in tool function", () => {
    const toolName = "error_tool";
    const toolFunc = () => {
      throw new Error("Test error");
    };
    const toolDescription = "A tool that throws an error";
    const toolParameters = { type: "object", properties: {} };

    toolsManager.registerTool(
      toolName,
      toolFunc,
      toolDescription,
      toolParameters
    );

    const result = toolsManager.executeTool(toolName, {});
    assert.strictEqual(result, null);
  });

  test("getToolsForOpenAI should return empty array when no tools are registered", () => {
    const tools = toolsManager.getToolsForOpenAI();
    assert.strictEqual(tools.length, 0);
  });

  test("registerTool should handle complex parameter structures", () => {
    const toolName = "complex_tool";
    const toolFunc = () => ({});
    const toolDescription = "A tool with complex parameters";
    const toolParameters = {
      type: "object",
      properties: {
        stringArg: { type: "string" },
        numberArg: { type: "number" },
        booleanArg: { type: "boolean" },
        arrayArg: {
          type: "array",
          items: { type: "string" },
        },
        objectArg: {
          type: "object",
          properties: {
            nestedProp: { type: "string" },
          },
        },
      },
      required: ["stringArg", "numberArg"],
    };

    toolsManager.registerTool(
      toolName,
      toolFunc,
      toolDescription,
      toolParameters
    );

    const tools = toolsManager.getToolsForOpenAI();
    assert.strictEqual(tools.length, 1);
    assert.deepStrictEqual(tools[0].function.parameters, toolParameters);
  });
});
