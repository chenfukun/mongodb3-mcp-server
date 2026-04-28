import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConnectionManager } from "./connectionManager.js";
import type { ServerConfig, ToolResult } from "./types.js";

// Tools
import {
  ConnectArgs,
  SwitchConnectionArgs,
  connectTool,
  switchConnectionTool,
} from "./tools/connect.js";
import {
  FindArgs,
  AggregateArgs,
  AggregateDBArgs,
  CountArgs,
  ExplainArgs,
  findTool,
  aggregateTool,
  aggregateDBTool,
  countTool,
  explainTool,
} from "./tools/read.js";
import {
  InsertManyArgs,
  UpdateManyArgs,
  DeleteManyArgs,
  insertManyTool,
  updateManyTool,
  deleteManyTool,
} from "./tools/write.js";
import {
  ListDatabasesArgs,
  ListCollectionsArgs,
  CollectionIndexesArgs,
  CollectionSchemaArgs,
  CollectionStorageSizeArgs,
  DbStatsArgs,
  LogsArgs,
  listDatabasesTool,
  listCollectionsTool,
  collectionIndexesTool,
  collectionSchemaTool,
  collectionStorageSizeTool,
  dbStatsTool,
  logsTool,
} from "./tools/metadata.js";
import {
  CreateCollectionArgs,
  DropCollectionArgs,
  DropDatabaseArgs,
  RenameCollectionArgs,
  CreateIndexArgs,
  DropIndexArgs,
  createCollectionTool,
  dropCollectionTool,
  dropDatabaseTool,
  renameCollectionTool,
  createIndexTool,
  dropIndexTool,
} from "./tools/manage.js";

/** Wrap any error into a ToolResult */
function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Creates and configures the MCP server with all MongoDB tools.
 */
export function createServer(config: ServerConfig) {
  const connManager = new ConnectionManager();

  const server = new McpServer({
    name: "mongodb3-mcp-server",
    version: "1.0.0",
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Connection tools
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "connect",
    "Connect to a MongoDB instance. Use this if no connection has been established yet.",
    ConnectArgs.shape,
    async (args) => {
      try {
        return await connectTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "switch-connection",
    "Switch to a different MongoDB connection.",
    SwitchConnectionArgs.shape,
    async (args) => {
      try {
        return await switchConnectionTool(args, connManager, config.connectionString);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Read tools
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "find",
    "Run a find query against a MongoDB collection",
    FindArgs.shape,
    async (args) => {
      try {
        return await findTool(args, connManager, config);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "aggregate",
    "Run an aggregation pipeline against a MongoDB collection",
    AggregateArgs.shape,
    async (args) => {
      try {
        return await aggregateTool(args, connManager, config);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "aggregate-db",
    "Run an aggregation pipeline at the database level",
    AggregateDBArgs.shape,
    async (args) => {
      try {
        return await aggregateDBTool(args, connManager, config);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "count",
    "Get the number of documents in a collection, with optional filter",
    CountArgs.shape,
    async (args) => {
      try {
        return await countTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "explain",
    "Get the execution plan for a find, aggregate, or count operation",
    ExplainArgs.shape,
    async (args) => {
      try {
        return await explainTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Metadata tools
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "list-databases",
    "List all databases on the MongoDB server",
    ListDatabasesArgs.shape,
    async (args) => {
      try {
        return await listDatabasesTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "list-collections",
    "List all collections in a database",
    ListCollectionsArgs.shape,
    async (args) => {
      try {
        return await listCollectionsTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "collection-indexes",
    "List all indexes on a collection",
    CollectionIndexesArgs.shape,
    async (args) => {
      try {
        return await collectionIndexesTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "collection-schema",
    "Infer the schema of a collection by sampling documents",
    CollectionSchemaArgs.shape,
    async (args) => {
      try {
        return await collectionSchemaTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "collection-storage-size",
    "Get the storage size of a collection",
    CollectionStorageSizeArgs.shape,
    async (args) => {
      try {
        return await collectionStorageSizeTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "db-stats",
    "Get statistics for a database",
    DbStatsArgs.shape,
    async (args) => {
      try {
        return await dbStatsTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  server.tool(
    "mongodb-logs",
    "Get recent mongod log entries",
    LogsArgs.shape,
    async (args) => {
      try {
        return await logsTool(args, connManager);
      } catch (e) {
        return errorResult(e);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Write / Manage tools (disabled in readOnly mode)
  // ═══════════════════════════════════════════════════════════════════════════

  if (!config.readOnly) {
    server.tool(
      "insert-many",
      "Insert an array of documents into a collection",
      InsertManyArgs.shape,
      async (args) => {
        try {
          return await insertManyTool(args, connManager);
        } catch (e) {
          return errorResult(e);
        }
      }
    );

    server.tool(
      "update-many",
      "Update all documents matching a filter",
      UpdateManyArgs.shape,
      async (args) => {
        try {
          return await updateManyTool(args, connManager);
        } catch (e) {
          return errorResult(e);
        }
      }
    );

    server.tool(
      "delete-many",
      "Delete all documents matching a filter",
      DeleteManyArgs.shape,
      async (args) => {
        try {
          return await deleteManyTool(args, connManager);
        } catch (e) {
          return errorResult(e);
        }
      }
    );

    server.tool(
      "create-collection",
      "Create a new collection in a database",
      CreateCollectionArgs.shape,
      async (args) => {
        try {
          return await createCollectionTool(args, connManager);
        } catch (e) {
          return errorResult(e);
        }
      }
    );

    server.tool(
      "drop-collection",
      "Drop a collection and its indexes from a database",
      DropCollectionArgs.shape,
      async (args) => {
        try {
          return await dropCollectionTool(args, connManager);
        } catch (e) {
          return errorResult(e);
        }
      }
    );

    server.tool(
      "drop-database",
      "Drop a database and all its collections",
      DropDatabaseArgs.shape,
      async (args) => {
        try {
          return await dropDatabaseTool(args, connManager);
        } catch (e) {
          return errorResult(e);
        }
      }
    );

    server.tool(
      "rename-collection",
      "Rename a collection in a database",
      RenameCollectionArgs.shape,
      async (args) => {
        try {
          return await renameCollectionTool(args, connManager);
        } catch (e) {
          return errorResult(e);
        }
      }
    );

    server.tool(
      "create-index",
      "Create an index on a collection",
      CreateIndexArgs.shape,
      async (args) => {
        try {
          return await createIndexTool(args, connManager);
        } catch (e) {
          return errorResult(e);
        }
      }
    );

    server.tool(
      "drop-index",
      "Drop an index from a collection",
      DropIndexArgs.shape,
      async (args) => {
        try {
          return await dropIndexTool(args, connManager);
        } catch (e) {
          return errorResult(e);
        }
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Resources
  // ═══════════════════════════════════════════════════════════════════════════

  server.resource("config", "config://config", async () => ({
    contents: [
      {
        uri: "config://config",
        mimeType: "application/json",
        text: JSON.stringify(
          {
            readOnly: config.readOnly,
            maxDocumentsPerQuery: config.maxDocumentsPerQuery,
            connected: connManager.isConnected,
            connectionString: config.connectionString
              ? "***configured***"
              : undefined,
          },
          null,
          2
        ),
      },
    ],
  }));

  return { server, connManager };
}
