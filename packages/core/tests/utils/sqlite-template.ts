import type { Kysely } from "kysely";
import { sql } from "kysely";

interface SchemaObject {
	type: string;
	name: string;
	sql: string;
}

function quoteIdentifier(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

/**
 * Serialize a SQLite database into one script that recreates its schema and
 * rows. Values go through SQLite's `quote()`, so storage classes survive
 * (a REAL 1.0 stays REAL, blobs stay blobs).
 *
 * Rows load before indexes and triggers exist and with foreign keys off, so
 * insertion order and trigger side effects don't matter.
 */
export async function dumpSqliteDatabase(db: Kysely<any>): Promise<string> {
	const { rows: objects } = await sql<SchemaObject>`
		SELECT type, name, sql FROM sqlite_master
		WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
		ORDER BY rowid
	`.execute(db);

	const virtual = objects.find((o) => /^CREATE\s+VIRTUAL\s+TABLE/i.test(o.sql));
	if (virtual) {
		throw new Error(`Cannot dump virtual table ${virtual.name}`);
	}

	const tables = objects.filter((o) => o.type === "table");
	const statements = tables.map((t) => t.sql);

	for (const table of tables) {
		const { rows: columns } = await sql<{ name: string }>`
			SELECT name FROM pragma_table_info(${table.name})
		`.execute(db);
		const { rows } = await sql<{ row: string }>`
			SELECT ${sql.join(
				columns.map((c) => sql`quote(${sql.ref(c.name)})`),
				sql` || ',' || `,
			)} AS row
			FROM ${sql.table(table.name)}
		`.execute(db);
		if (rows.length === 0) continue;
		const columnList = columns.map((c) => quoteIdentifier(c.name)).join(", ");
		for (const { row } of rows) {
			statements.push(`INSERT INTO ${quoteIdentifier(table.name)} (${columnList}) VALUES (${row})`);
		}
	}

	statements.push(...objects.filter((o) => o.type !== "table").map((o) => o.sql));

	return [
		"PRAGMA foreign_keys = OFF",
		"BEGIN",
		...statements,
		"COMMIT",
		"PRAGMA foreign_keys = ON",
		"",
	].join(";\n");
}
