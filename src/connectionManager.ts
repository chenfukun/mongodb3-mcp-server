import { MongoClient, Db } from "mongodb";

/**
 * Manages the MongoDB connection lifecycle.
 * Uses mongodb driver v4.x which supports MongoDB 3.6+.
 */
export class ConnectionManager {
  private client: MongoClient | null = null;
  private connectionString: string | null = null;

  get isConnected(): boolean {
    return this.client !== null;
  }

  get currentConnectionString(): string | null {
    return this.connectionString;
  }

  /**
   * Connect to a MongoDB instance.
   * mongodb driver 4.x supports MongoDB server 3.6+.
   */
  async connect(connectionString: string): Promise<void> {
    // Disconnect existing connection if any
    if (this.client) {
      await this.disconnect();
    }

    this.client = new MongoClient(connectionString, {
      // Options compatible with MongoDB 3.6
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });

    await this.client.connect();
    this.connectionString = connectionString;
  }

  /**
   * Disconnect from the current MongoDB instance.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors
      }
      this.client = null;
      this.connectionString = null;
    }
  }

  /**
   * Get the MongoClient instance. Throws if not connected.
   */
  getClient(): MongoClient {
    if (!this.client) {
      throw new Error(
        "Not connected to MongoDB. Use the 'connect' tool first."
      );
    }
    return this.client;
  }

  /**
   * Get a Db instance for the given database name.
   */
  getDatabase(dbName: string): Db {
    return this.getClient().db(dbName);
  }
}
