import { z } from "zod";
import { ConnectionManager } from "../connectionManager.js";
import type { ToolResult } from "../types.js";
import type { Document } from "mongodb";

// ─── create-collection ───────────────────────────────────────────────────────

export const CreateCollectionArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name to create"),
});

export async function createCollectionTool(
  args: z.infer<typeof CreateCollectionArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  await db.createCollection(args.collection);

  return {
    content: [
      {
        type: "text",
        text: `Collection "${args.collection}" created in database "${args.database}".`,
      },
    ],
  };
}

// ─── drop-collection ─────────────────────────────────────────────────────────

export const DropCollectionArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name to drop"),
});

export async function dropCollectionTool(
  args: z.infer<typeof DropCollectionArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const result = await db.dropCollection(args.collection);

  return {
    content: [
      {
        type: "text",
        text: `${result ? "Successfully dropped" : "Failed to drop"} collection "${args.collection}" from database "${args.database}".`,
      },
    ],
  };
}

// ─── drop-database ───────────────────────────────────────────────────────────

export const DropDatabaseArgs = z.object({
  database: z.string().describe("Database name to drop"),
});

export async function dropDatabaseTool(
  args: z.infer<typeof DropDatabaseArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const result = await db.dropDatabase();

  return {
    content: [
      {
        type: "text",
        text: `${result ? "Successfully dropped" : "Failed to drop"} database "${args.database}".`,
      },
    ],
  };
}

// ─── rename-collection ───────────────────────────────────────────────────────

export const RenameCollectionArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Current collection name"),
  newName: z.string().describe("New name for the collection"),
  dropTarget: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, drops the target collection if it already exists"),
});

export async function renameCollectionTool(
  args: z.infer<typeof RenameCollectionArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);

  try {
    const coll = db.collection(args.collection);
    const renamed = await coll.rename(args.newName, {
      dropTarget: args.dropTarget,
    });

    return {
      content: [
        {
          type: "text",
          text: `Collection "${args.collection}" renamed to "${renamed.collectionName}" in database "${args.database}".`,
        },
      ],
    };
  } catch (error: unknown) {
    const err = error as { codeName?: string };
    if (err.codeName === "NamespaceNotFound") {
      return {
        content: [
          {
            type: "text",
            text: `Cannot rename "${args.database}.${args.collection}" because it does not exist.`,
          },
        ],
        isError: true,
      };
    }
    if (err.codeName === "NamespaceExists") {
      return {
        content: [
          {
            type: "text",
            text: `Cannot rename to "${args.newName}" because it already exists. Set dropTarget to true to overwrite.`,
          },
        ],
        isError: true,
      };
    }
    throw error;
  }
}

// ─── create-index ────────────────────────────────────────────────────────────

export const CreateIndexArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  keys: z
    .record(z.string(), z.union([z.number(), z.string()]))
    .describe(
      "Index key specification, e.g. { field: 1 } for ascending, { field: -1 } for descending, { field: 'text' } for text index"
    ),
  name: z.string().optional().describe("Optional name for the index"),
  unique: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, creates a unique index"),
  sparse: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, creates a sparse index"),
});

export async function createIndexTool(
  args: z.infer<typeof CreateIndexArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  const indexName = await coll.createIndex(args.keys as Document, {
    name: args.name,
    unique: args.unique,
    sparse: args.sparse,
  });

  return {
    content: [
      {
        type: "text",
        text: `Created index "${indexName}" on "${args.database}.${args.collection}".`,
      },
    ],
  };
}

// ─── drop-index ──────────────────────────────────────────────────────────────

export const DropIndexArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  indexName: z.string().describe("Name of the index to drop"),
});

export async function dropIndexTool(
  args: z.infer<typeof DropIndexArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  await coll.dropIndex(args.indexName);

  return {
    content: [
      {
        type: "text",
        text: `Dropped index "${args.indexName}" from "${args.database}.${args.collection}".`,
      },
    ],
  };
}
