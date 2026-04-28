import { z } from "zod";
import { EJSON } from "bson";
import { ConnectionManager } from "../connectionManager.js";
import type { ToolResult } from "../types.js";
import type { Document } from "mongodb";

// ─── list-databases ──────────────────────────────────────────────────────────

export const ListDatabasesArgs = z.object({});

export async function listDatabasesTool(
  _args: z.infer<typeof ListDatabasesArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const client = connManager.getClient();
  const adminDb = client.db("admin");

  // nameOnly: true skips calculating sizeOnDisk, which is faster
  const result = await adminDb.command({ listDatabases: 1, nameOnly: true });
  const databases = (result.databases as Array<{ name: string }>).map(
    (db) => db.name
  );

  return {
    content: [
      {
        type: "text",
        text: `Found ${databases.length} database(s):`,
      },
      { type: "text", text: JSON.stringify(databases, null, 2) },
    ],
  };
}

// ─── list-collections ────────────────────────────────────────────────────────

export const ListCollectionsArgs = z.object({
  database: z.string().describe("Database name"),
});

export async function listCollectionsTool(
  args: z.infer<typeof ListCollectionsArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => ({ name: c.name }));

  if (names.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `Found 0 collections in database "${args.database}". Use "create-collection" to create one.`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Found ${names.length} collection(s) in database "${args.database}":`,
      },
      { type: "text", text: JSON.stringify(names, null, 2) },
    ],
  };
}

// ─── collection-indexes ──────────────────────────────────────────────────────

export const CollectionIndexesArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
});

export async function collectionIndexesTool(
  args: z.infer<typeof CollectionIndexesArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  try {
    const indexes = await coll.indexes();
    const simplified = indexes.map((idx) => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique ?? false,
    }));

    return {
      content: [
        {
          type: "text",
          text: `Found ${simplified.length} index(es) on "${args.database}.${args.collection}":`,
        },
        { type: "text", text: JSON.stringify(simplified, null, 2) },
      ],
    };
  } catch (error: unknown) {
    const err = error as { codeName?: string };
    if (err.codeName === "NamespaceNotFound") {
      return {
        content: [
          {
            type: "text",
            text: `Collection "${args.database}.${args.collection}" does not exist.`,
          },
        ],
        isError: true,
      };
    }
    throw error;
  }
}

// ─── collection-schema ───────────────────────────────────────────────────────

export const CollectionSchemaArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  sampleSize: z
    .number()
    .optional()
    .default(1)
    .describe("Number of recent documents to sample for schema inference"),
});

/**
 * Infer schema by sampling the most recently inserted documents.
 * Uses $natural: -1 sort to get the latest documents, which better
 * reflects the current schema when fields evolve over time.
 * Works on MongoDB 3.6+.
 */
export async function collectionSchemaTool(
  args: z.infer<typeof CollectionSchemaArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  // Fetch the most recently inserted documents using $natural sort (MongoDB 3.6+)
  const documents = await coll
    .find({})
    .sort({ $natural: -1 })
    .limit(args.sampleSize)
    .toArray();

  if (documents.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `Could not infer schema for "${args.database}.${args.collection}". The collection may not exist or is empty.`,
        },
      ],
    };
  }

  // Simple schema inference: collect field names and their types
  const schema: Record<string, Set<string>> = {};

  function inferType(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (value instanceof Date) return "date";
    if (typeof value === "object" && value !== null) {
      const proto = Object.getPrototypeOf(value);
      const constructorName = proto?.constructor?.name;
      if (constructorName === "ObjectId") return "objectId";
      if (constructorName === "Decimal128") return "decimal128";
      if (constructorName === "Long") return "long";
      if (constructorName === "Binary") return "binary";
      return "object";
    }
    return typeof value;
  }

  function processDocument(doc: Document, prefix: string = "") {
    for (const [key, value] of Object.entries(doc)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (!schema[fullKey]) {
        schema[fullKey] = new Set();
      }
      schema[fullKey].add(inferType(value));

      // Recurse into nested objects (but not arrays or special BSON types)
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value)?.constructor?.name === "Object"
      ) {
        processDocument(value as Document, fullKey);
      }
    }
  }

  for (const doc of documents) {
    processDocument(doc);
  }

  // Convert sets to arrays for serialization
  const schemaResult: Record<string, string[]> = {};
  for (const [key, types] of Object.entries(schema)) {
    schemaResult[key] = Array.from(types);
  }

  return {
    content: [
      {
        type: "text",
        text: `Inferred schema for "${args.database}.${args.collection}" from ${documents.length} sampled document(s). Found ${Object.keys(schemaResult).length} field(s):`,
      },
      { type: "text", text: JSON.stringify(schemaResult, null, 2) },
    ],
  };
}

// ─── collection-storage-size ─────────────────────────────────────────────────

export const CollectionStorageSizeArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
});

export async function collectionStorageSizeTool(
  args: z.infer<typeof CollectionStorageSizeArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);

  try {
    // collStats command works on MongoDB 3.6+
    const result = await db.command({ collStats: args.collection, scale: 1 });
    const sizeBytes = result.storageSize as number;
    const { value, units } = formatSize(sizeBytes);

    return {
      content: [
        {
          type: "text",
          text: `The storage size of "${args.database}.${args.collection}" is ${value.toFixed(2)} ${units}.`,
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
            text: `Collection "${args.database}.${args.collection}" does not exist.`,
          },
        ],
        isError: true,
      };
    }
    throw error;
  }
}

function formatSize(bytes: number): { value: number; units: string } {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  if (bytes > gb) return { value: bytes / gb, units: "GB" };
  if (bytes > mb) return { value: bytes / mb, units: "MB" };
  if (bytes > kb) return { value: bytes / kb, units: "KB" };
  return { value: bytes, units: "bytes" };
}

// ─── db-stats ────────────────────────────────────────────────────────────────

export const DbStatsArgs = z.object({
  database: z.string().describe("Database name"),
});

export async function dbStatsTool(
  args: z.infer<typeof DbStatsArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const result = await db.command({ dbStats: 1, scale: 1 });

  return {
    content: [
      {
        type: "text",
        text: `Statistics for database "${args.database}":`,
      },
      { type: "text", text: EJSON.stringify(result, undefined, 2) },
    ],
  };
}

// ─── mongodb-logs ────────────────────────────────────────────────────────────

export const LogsArgs = z.object({
  type: z
    .enum(["global", "startupWarnings"])
    .optional()
    .default("global")
    .describe("Log type: global or startupWarnings"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1024)
    .optional()
    .default(50)
    .describe("Maximum number of log entries to return"),
});

export async function logsTool(
  args: z.infer<typeof LogsArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const client = connManager.getClient();
  const adminDb = client.db("admin");

  const result = await adminDb.command({ getLog: args.type });
  const logs = (result.log as string[])
    .slice(0, args.limit)
    .map((l) => l.trimEnd());

  let message = `Found ${result.totalLinesWritten} log message(s)`;
  if (result.totalLinesWritten > args.limit) {
    message += ` (showing first ${args.limit})`;
  }

  return {
    content: [
      { type: "text", text: message },
      { type: "text", text: logs.join("\n") },
    ],
  };
}
