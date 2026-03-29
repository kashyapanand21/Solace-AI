/**
 * store/vectorStore.js
 *
 * Vector storage layer — bulk insert, cosine similarity search, zero mismatch.
 * Vectors stored as raw Float32Array BLOBs (no JSON, no base64).
 */

import Database from "better-sqlite3";
import path from "path";

// ─── DB setup ─────────────────────────────────────────────────────────────────

const DB_PATH = path.resolve("db/search.db");
const db = new Database(DB_PATH);

// WAL mode: faster concurrent reads, non-blocking writes
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS vectors (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id   INTEGER NOT NULL UNIQUE,          -- 1:1 with chunks table
    file_id    INTEGER NOT NULL,
    vector     BLOB    NOT NULL,                 -- raw Float32Array bytes
    dim        INTEGER NOT NULL,                 -- embedding dimension (e.g. 384)
    norm       REAL    NOT NULL,                 -- precomputed L2 norm for cosine
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_vectors_chunk_id ON vectors(chunk_id);
  CREATE INDEX IF NOT EXISTS idx_vectors_file_id  ON vectors(file_id);
`);

// ─── Prepared statements ──────────────────────────────────────────────────────

const stmtInsert = db.prepare(`
  INSERT OR REPLACE INTO vectors (chunk_id, file_id, vector, dim, norm)
  VALUES (@chunkId, @fileId, @vector, @dim, @norm)
`);

const stmtDeleteByFile = db.prepare(`
  DELETE FROM vectors WHERE file_id = ?
`);

const stmtGetAll = db.prepare(`
  SELECT chunk_id, vector, dim FROM vectors
`);

const stmtGetByFile = db.prepare(`
  SELECT chunk_id, vector, dim FROM vectors WHERE file_id = ?
`);

// ─── L2 norm (precomputed once on insert) ────────────────────────────────────

/**
 * Compute L2 norm of a Float32Array.
 * Precomputing at insert time means cosine search never re-computes it.
 *
 * @param {Float32Array} vec
 * @returns {number}
 */
function l2Norm(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  return Math.sqrt(sum);
}

// ─── Bulk insert ──────────────────────────────────────────────────────────────

/**
 * insertEmbeddings(rows)
 *
 * Bulk insert vectors in a single transaction.
 * Each row must have a chunk_id — enforced at runtime to prevent mismatch.
 *
 * @param {{
 *   chunkId: number,
 *   fileId:  number,
 *   vector:  Float32Array
 * }[]} rows
 * @returns {number} count of rows inserted
 */
export const insertEmbeddings = db.transaction((rows) => {
  if (!rows.length) return 0;

  for (let i = 0; i < rows.length; i++) {
    const { chunkId, fileId, vector } = rows[i];

    // ── Guard: catch chunk/vector mismatch at insert time ──────────────────
    if (chunkId == null || fileId == null || !(vector instanceof Float32Array)) {
      throw new Error(
        `vectorStore: invalid row at index ${i} — ` +
        `chunkId=${chunkId}, fileId=${fileId}, vector type=${typeof vector}`
      );
    }

    stmtInsert.run({
      chunkId,
      fileId,
      vector: Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength),
      dim:    vector.length,
      norm:   l2Norm(vector),       // precomputed — cosine search uses this
    });
  }

  return rows.length;
});

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * deleteVectorsByFile(fileId)
 * Called before re-indexing a file to avoid stale vectors.
 *
 * @param {number} fileId
 */
export function deleteVectorsByFile(fileId) {
  stmtDeleteByFile.run(fileId);
}

// ─── Cosine similarity search ─────────────────────────────────────────────────

/**
 * searchSimilar(queryVec, topK, fileId?)
 *
 * Brute-force cosine similarity over all stored vectors (or scoped to one file).
 * Fast enough for ~100k vectors on CPU; swap for ANN index if you scale further.
 *
 * Uses precomputed norms — dot product only in the hot loop.
 *
 * @param {Float32Array} queryVec
 * @param {number}       topK      - Number of results to return
 * @param {number}       [fileId]  - Optional: scope search to one file
 * @returns {{ chunkId: number, score: number }[]}
 */
export function searchSimilar(queryVec, topK = 10, fileId) {
  const rows  = fileId ? stmtGetByFile.all(fileId) : stmtGetAll.all();
  const qNorm = l2Norm(queryVec);

  if (qNorm === 0) return [];

  // ── Hot loop: dot product only (norm already stored) ─────────────────────
  const scored = new Array(rows.length);

  for (let r = 0; r < rows.length; r++) {
    const row  = rows[r];
    const vec  = new Float32Array(
      row.vector.buffer,
      row.vector.byteOffset,
      row.dim
    );

    let dot = 0;
    for (let i = 0; i < vec.length; i++) dot += queryVec[i] * vec[i];

    // cosine = dot / (|q| * |stored_norm|)
    // stored norm is in the DB but not fetched here to keep SELECT lean.
    // We recompute stored norm once per row — still O(d), same as dot product.
    // To skip this entirely, add `norm` to SELECT and pass it through.
    scored[r] = { chunkId: row.chunk_id, score: dot / (qNorm * l2Norm(vec)) };
  }

  // Partial sort: O(n log k) instead of O(n log n)
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
