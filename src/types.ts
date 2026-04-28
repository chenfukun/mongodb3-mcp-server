import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Configuration for the MongoDB 3.x MCP Server.
 */
export interface ServerConfig {
  /** MongoDB connection string */
  connectionString?: string;
  /** Read-only mode: disables all write/delete operations */
  readOnly: boolean;
  /** Maximum number of documents returned per query */
  maxDocumentsPerQuery: number;
}

/**
 * Re-export CallToolResult as ToolResult for convenience.
 * This ensures our tools return the exact type the MCP SDK expects.
 */
export type ToolResult = CallToolResult;
