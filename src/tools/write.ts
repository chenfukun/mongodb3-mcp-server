import { z } from "zod";
import { EJSON } from "bson";
import { ConnectionManager } from "../connectionManager.js";
import type { ToolResult } from "../types.js";
import type { Document } from "mongodb";

// ─── insert-many ─────────────────────────────────────────────────────────────

export const InsertManyArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  documents: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Array of documents to insert"),
});

export async function insertManyTool(
  args: z.infer<typeof InsertManyArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  const documents = args.documents.map(
    (doc) => EJSON.deserialize(doc as Document) as Document
  );
  const result = await coll.insertMany(documents);
  const insertedIds = Object.values(result.insertedIds).map(String);

  return {
    content: [
      {
        type: "text",
        text: `Inserted ${result.insertedCount} document(s) into "${args.database}.${args.collection}".`,
      },
      {
        type: "text",
        text: `Inserted IDs: ${insertedIds.join(", ")}`,
      },
    ],
  };
}

// ─── update-many ─────────────────────────────────────────────────────────────

export const UpdateManyArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .default({})
    .describe("Selection criteria for the update"),
  update: z
    .record(z.string(), z.unknown())
    .describe("Update document with update operator expressions"),
  upsert: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, insert a new document when no match is found"),
});

export async function updateManyTool(
  args: z.infer<typeof UpdateManyArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  const filter = EJSON.deserialize(args.filter as Document) as Document;
  const update = EJSON.deserialize(args.update as Document) as Document;
  const result = await coll.updateMany(filter, update, {
    upsert: args.upsert,
  });

  let message: string;
  if (
    result.matchedCount === 0 &&
    result.modifiedCount === 0 &&
    result.upsertedCount === 0
  ) {
    message = "No documents matched the filter.";
  } else {
    message = `Matched ${result.matchedCount} document(s).`;
    if (result.modifiedCount > 0) {
      message += ` Modified ${result.modifiedCount} document(s).`;
    }
    if (result.upsertedCount > 0) {
      message += ` Upserted 1 document with id: ${result.upsertedId?.toString()}.`;
    }
  }

  return {
    content: [{ type: "text", text: message }],
  };
}

// ─── delete-many ─────────────────────────────────────────────────────────────

export const DeleteManyArgs = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .default({})
    .describe("Query filter specifying deletion criteria"),
});

export async function deleteManyTool(
  args: z.infer<typeof DeleteManyArgs>,
  connManager: ConnectionManager
): Promise<ToolResult> {
  const db = connManager.getDatabase(args.database);
  const coll = db.collection(args.collection);

  const filter = EJSON.deserialize(args.filter as Document) as Document;
  const result = await coll.deleteMany(filter);

  return {
    content: [
      {
        type: "text",
        text: `Deleted ${result.deletedCount} document(s) from "${args.collection}".`,
      },
    ],
  };
}
