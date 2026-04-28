#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import type { ServerConfig } from "./types.js";

/**
 * Parse configuration from environment variables and CLI arguments.
 */
function parseConfig(): ServerConfig {
  const args = process.argv.slice(2);

  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return undefined;
  }

  function hasFlag(name: string): boolean {
    return args.includes(`--${name}`);
  }

  // Connection string: CLI arg > env var > positional arg (if looks like mongodb://)
  let connectionString =
    getArg("connectionString") ??
    process.env.MDB_MCP_CONNECTION_STRING;

  if (!connectionString) {
    const positional = args.find(
      (a) => a.startsWith("mongodb://") || a.startsWith("mongodb+srv://")
    );
    if (positional) connectionString = positional;
  }

  // Default to read-only for safety; use --writable or MDB_MCP_READ_ONLY=false to enable writes
  const readOnly =
    !(hasFlag("writable") || process.env.MDB_MCP_READ_ONLY === "false");

  const maxDocumentsPerQuery = parseInt(
    getArg("maxDocumentsPerQuery") ??
      process.env.MDB_MCP_MAX_DOCUMENTS_PER_QUERY ??
      "100",
    10
  );

  return {
    connectionString,
    readOnly,
    maxDocumentsPerQuery: isNaN(maxDocumentsPerQuery)
      ? 100
      : maxDocumentsPerQuery,
  };
}

async function main() {
  const config = parseConfig();

  console.error(
    `[mongodb3-mcp-server] Starting... readOnly=${config.readOnly}, maxDocs=${config.maxDocumentsPerQuery}`
  );

  if (config.connectionString) {
    console.error("[mongodb3-mcp-server] Connection string configured.");
  } else {
    console.error(
      "[mongodb3-mcp-server] No connection string configured. Use the 'connect' tool to connect."
    );
  }

  const { server, connManager } = createServer(config);

  // Auto-connect if connection string is provided
  if (config.connectionString) {
    try {
      await connManager.connect(config.connectionString);
      console.error("[mongodb3-mcp-server] Auto-connected to MongoDB.");
    } catch (error) {
      console.error(
        `[mongodb3-mcp-server] Auto-connect failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[mongodb3-mcp-server] Server running on stdio.");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.error("[mongodb3-mcp-server] Shutting down...");
    await connManager.disconnect();
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.error("[mongodb3-mcp-server] Shutting down...");
    await connManager.disconnect();
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("[mongodb3-mcp-server] Fatal error:", error);
  process.exit(1);
});
