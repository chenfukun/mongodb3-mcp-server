import { z } from "zod";
import { EJSON } from "bson";
import { ConnectionManager } from "../connectionManager.js";
import type { ToolResult } from "../types.js";
import type { ServerConfig } from "../types.js";
import type { Document } from "mongodb";

// ─── find ────────────────────────────────────────────────────────────────────

export const FindArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .default({})
    .describe("Query filter matching db.collection.find() syntax"),
  projection: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Projection document"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of documents to return"),
  sort: z
    .record(z.string(), z.number())
    .optional()
    .describe("Sort document, e.g. { field: 1 } for ascending"),
});

export async function findTool(
  args: z.infer<typeof FindArgs>,
  connManager: ConnectionManager,
  config: ServerConfig
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  const effectiveLimit = Math.min(
    args.limit ?? 10,
    config.maxDocumentsPerQuery
  );

  const filter = EJSON.deserialize(args.filter as Document) as Document;
  let cursor = coll.find(filter);
  if (args.projection) cursor = cursor.project(EJSON.deserialize(args.projection as Document) as Document);
  if (args.sort) cursor = cursor.sort(args.sort as Record<string, 1 | -1>);
  cursor = cursor.limit(effectiveLimit);

  const documents = await cursor.toArray();

  const description = `Found ${documents.length} document(s) in "${args.database}.${args.collection}".`;
  return {
    content: [
      { type: "text", text: description },
      ...(documents.length > 0
        ? [{ type: "text" as const, text: EJSON.stringify(documents, undefined, 2) }]
        : []),
    ],
  };
}

// ─── aggregate ───────────────────────────────────────────────────────────────

export const AggregateArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  pipeline: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Aggregation pipeline stages"),
});

export async function aggregateTool(
  args: z.infer<typeof AggregateArgs>,
  connManager: ConnectionManager,
  config: ServerConfig
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  // MongoDB 3.6 supports aggregation pipeline
  const pipeline = args.pipeline.map(
    (stage) => EJSON.deserialize(stage as Document) as Document
  );
  const cursor = coll.aggregate(pipeline);
  const documents: Document[] = [];
  let count = 0;
  for await (const doc of cursor) {
    if (count >= config.maxDocumentsPerQuery) break;
    documents.push(doc);
    count++;
  }

  return {
    content: [
      {
        type: "text",
        text: `Aggregation returned ${documents.length} document(s) from "${args.database}.${args.collection}".`,
      },
      ...(documents.length > 0
        ? [{ type: "text" as const, text: EJSON.stringify(documents, undefined, 2) }]
        : []),
    ],
  };
}

// ─── aggregate-db ────────────────────────────────────────────────────────────

export const AggregateDBArgs = z.object({
  database: z.string().describe("Database name"),
  pipeline: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Aggregation pipeline stages to run at the database level"),
});

export async function aggregateDBTool(
  args: z.infer<typeof AggregateDBArgs>,
  connManager: ConnectionManager,
  config: ServerConfig
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);

  // Database-level aggregate (MongoDB 3.6+)
  const pipeline = args.pipeline.map(
    (stage) => EJSON.deserialize(stage as Document) as Document
  );
  const cursor = db.aggregate(pipeline);
  const documents: Document[] = [];
  let count = 0;
  for await (const doc of cursor) {
    if (count >= config.maxDocumentsPerQuery) break;
    documents.push(doc);
    count++;
  }

  return {
    content: [
      {
        type: "text",
        text: `Database-level aggregation returned ${documents.length} document(s) from "${args.database}".`,
      },
      ...(documents.length > 0
        ? [{ type: "text" as const, text: EJSON.stringify(documents, undefined, 2) }]
        : []),
    ],
  };
}

// ─── count ───────────────────────────────────────────────────────────────────

export const CountArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  query: z
    .record(z.string(), z.unknown())
    .optional()
    .default({})
    .describe("Optional filter for counting documents"),
});

export async function countTool(
  args: z.infer<typeof CountArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  const query = EJSON.deserialize(args.query as Document) as Document;
  // Use countDocuments which works on MongoDB 3.6+
  const count = await coll.countDocuments(query);

  return {
    content: [
      {
        type: "text",
        text: `Found ${count} document(s) in "${args.collection}"${args.query && Object.keys(args.query).length > 0 ? " matching the query" : ""}.`,
      },
    ],
  };
}

// ─── explain ─────────────────────────────────────────────────────────────────

export const ExplainArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  method: z
    .enum(["find", "aggregate", "count"])
    .describe("The method to explain"),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Filter for find/count explain"),
  pipeline: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe("Pipeline for aggregate explain"),
  verbosity: z
    .enum(["queryPlanner", "executionStats", "allPlansExecution"])
    .optional()
    .default("queryPlanner")
    .describe("Explain verbosity level"),
});

export async function explainTool(
  args: z.infer<typeof ExplainArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);

  let explainCommand: Document;

  switch (args.method) {
    case "find":
      explainCommand = {
        explain: {
          find: args.collection,
          filter: EJSON.deserialize((args.filter ?? {}) as Document) as Document,
        },
        verbosity: args.verbosity,
      };
      break;
    case "aggregate":
      explainCommand = {
        explain: {
          aggregate: args.collection,
          pipeline: (args.pipeline ?? []).map(
            (stage) => EJSON.deserialize(stage as Document) as Document
          ),
          cursor: {},
        },
        verbosity: args.verbosity,
      };
      break;
    case "count":
      explainCommand = {
        explain: {
          count: args.collection,
          query: EJSON.deserialize((args.filter ?? {}) as Document) as Document,
        },
        verbosity: args.verbosity,
      };
      break;
  }

  const result = await db.command(explainCommand);

  return {
    content: [
      {
        type: "text",
        text: `Explain result for ${args.method} on "${args.database}.${args.collection}" (verbosity: ${args.verbosity}):`,
      },
      { type: "text", text: JSON.stringify(result, null, 2) },
    ],
  };
}
