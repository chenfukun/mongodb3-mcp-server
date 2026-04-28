# mongodb3-mcp-server

A lightweight MCP (Model Context Protocol) server for MongoDB, compatible with **MongoDB 3.6.18+**.

Uses `mongodb` driver v4.x which officially supports MongoDB 3.6+.

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run (stdio transport)
MDB_MCP_CONNECTION_STRING="mongodb://localhost:27017" node dist/index.js
```

## MCP Client Configuration

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "node",
      "args": ["/path/to/mongodb3-mcp-server/dist/index.js"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb://localhost:27017"
      }
    }
  }
}
```

### Enable Write Mode

By default, the server runs in **read-only mode** for safety. To enable write/delete operations, explicitly set `MDB_MCP_READ_ONLY` to `false` or pass `--writable`:

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "node",
      "args": ["/path/to/mongodb3-mcp-server/dist/index.js", "--writable"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb://localhost:27017"
      }
    }
  }
}
```

Or via environment variable:

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "node",
      "args": ["/path/to/mongodb3-mcp-server/dist/index.js"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb://localhost:27017",
        "MDB_MCP_READ_ONLY": "false"
      }
    }
  }
}
```

## Configuration

| Environment Variable / CLI Flag | Default | Description |
|---|---|---|
| `MDB_MCP_CONNECTION_STRING` / `--connectionString` | - | MongoDB connection string |
| `MDB_MCP_READ_ONLY` / `--writable` | `true` (read-only) | Set `MDB_MCP_READ_ONLY=false` or pass `--writable` to enable write operations |
| `MDB_MCP_MAX_DOCUMENTS_PER_QUERY` / `--maxDocumentsPerQuery` | `100` | Max documents per query |

## Supported Tools (23 tools)

### Connection (2)
| Tool | Description |
|---|---|
| `connect` | Connect to a MongoDB instance |
| `switch-connection` | Switch to a different connection |

### Read (5)
| Tool | Description |
|---|---|
| `find` | Query documents in a collection |
| `aggregate` | Run aggregation pipeline on a collection |
| `aggregate-db` | Run aggregation pipeline at database level |
| `count` | Count documents with optional filter |
| `explain` | Get execution plan for find/aggregate/count |

### Metadata (7)
| Tool | Description |
|---|---|
| `list-databases` | List all database names (uses `nameOnly` for efficiency) |
| `list-collections` | List collections in a database |
| `collection-indexes` | List indexes on a collection |
| `collection-schema` | Infer schema by sampling documents |
| `collection-storage-size` | Get collection storage size |
| `db-stats` | Get database statistics |
| `mongodb-logs` | Get recent mongod log entries |

### Write (requires `--writable` or `MDB_MCP_READ_ONLY=false`) (3)
| Tool | Description |
|---|---|
| `insert-many` | Insert documents into a collection |
| `update-many` | Update documents matching a filter |
| `delete-many` | Delete documents matching a filter |

### Manage (requires `--writable` or `MDB_MCP_READ_ONLY=false`) (6)
| Tool | Description |
|---|---|
| `create-collection` | Create a new collection |
| `drop-collection` | Drop a collection |
| `drop-database` | Drop a database |
| `rename-collection` | Rename a collection |
| `create-index` | Create an index |
| `drop-index` | Drop an index |

### Resources
| Resource | URI | Description |
|---|---|---|
| `config` | `config://config` | Server configuration (redacted) |

## MongoDB 3.6 Compatibility

This server uses `mongodb` driver v4.17.x which officially supports MongoDB 3.6+. All tools use commands and operations available in MongoDB 3.6:

- `find`, `aggregate`, `count` — core query operations
- `$sample` aggregation stage for schema inference
- `collStats`, `dbStats`, `getLog` admin commands
- `createIndexes`, `dropIndexes` index management
- `listDatabases`, `listCollections` metadata commands
- `insert`, `update`, `delete` write operations

No features requiring MongoDB 4.0+ (like transactions or `$merge`) are used.
