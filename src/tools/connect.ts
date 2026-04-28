import { z } from "zod";
import { ConnectionManager } from "../connectionManager.js";
import type { ToolResult } from "../types.js";

export const ConnectArgs = z.object({
  connectionString: z
    .string()
    .describe(
      "MongoDB connection string (mongodb:// or mongodb+srv:// format)"
    ),
});

export const SwitchConnectionArgs = z.object({
  connectionString: z
    .string()
    .optional()
    .describe(
      "MongoDB connection string to switch to. If not provided, reconnects using the configured connection string."
    ),
});

/**
 * Connect to a MongoDB instance.
 */
export async function connectTool(
  args: z.infer<typeof ConnectArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  await connManager.connect(args.connectionString);
  return {
    content: [{ type: "text", text: "Successfully connected to MongoDB." }],
  };
}

/**
 * Switch to a different MongoDB connection.
 */
export async function switchConnectionTool(
  args: z.infer<typeof SwitchConnectionArgs>,
  connManager: ConnectionManager,
  configConnectionString?: string
): Promise<ToolResult> {
  const connStr = args.connectionString ?? configConnectionString;
  if (!connStr) {
    return {
      content: [
        {
          type: "text",
          text: "No connection string provided and no configured connection string available.",
        },
      ],
      isError: true,
    };
  }
  await connManager.connect(connStr);
  return {
    content: [{ type: "text", text: "Successfully connected to MongoDB." }],
  };
}
