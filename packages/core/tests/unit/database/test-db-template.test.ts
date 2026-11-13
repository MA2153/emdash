import type { Kysely } from "kysely";
import { sql } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "../../../src/database/migrations/runner.js";
import {
	createTestDatabase,
	setupTestDatabase,
	teardownTestDatabase,
} from "../../utils/test-db.js";

async function describeDatabase(db: Kysely<any>) {
	const { rows: schema } = await sql<{ type: string; name: string; tbl_name: string; sql: string }>`
		SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name
	`.execute(db);

	const tables: Record<string, unknown[]> = {};
	for (const { name } of schema.filter((o) => o.type === "table")) {
		const { rows: columns } = await sql<{ name: string }>`
			SELECT name FROM pragma_table_info(${name})
		`.execute(db);
		const { rows } = await sql<{ row: string }>`
			SELECT ${sql.join(
				columns.map((c) => sql`typeof(${sql.ref(c.name)}) || ':' || quote(${sql.ref(c.name)})`),
				sql` || ',' || `,
			)} AS row
			FROM ${sql.table(name)}
		`.execute(db);
		tables[name] = rows.map((r) => r.row).toSorted();
	}

	const { rows: pragmas } = await sql`
		SELECT
			(SELECT user_version FROM pragma_user_version) AS user_version,
			(SELECT application_id FROM pragma_application_id) AS application_id,
			(SELECT foreign_keys FROM pragma_foreign_keys) AS foreign_keys
	`.execute(db);

	return { schema, tables, pragmas };
}

const TIMESTAMP = /'\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?Z?'/g;

/** The template's rows were written when it was built, not when the test ran. */
function withoutTimestamps(description: Awaited<ReturnType<typeof describeDatabase>>) {
	return {
		...description,
		tables: Object.fromEntries(
			Object.entries(description.tables).map(([name, rows]) => [
				name,
				rows.map((row) => String(row).replace(TIMESTAMP, "'<timestamp>'")),
			]),
		),
	};
}

describe("setupTestDatabase", () => {
	const dbs: Kysely<any>[] = [];

	afterEach(async () => {
		await Promise.all(dbs.splice(0).map((db) => teardownTestDatabase(db)));
	});

	it("matches a database migrated from scratch", async () => {
		const migrated = createTestDatabase();
		dbs.push(migrated);
		await runMigrations(migrated);
		const restored = await setupTestDatabase();
		dbs.push(restored);

		const expected = await describeDatabase(migrated);
		const actual = await describeDatabase(restored);

		expect(withoutTimestamps(actual)).toEqual(withoutTimestamps(expected));
	});

	it("reports every migration as applied", async () => {
		const restored = await setupTestDatabase();
		dbs.push(restored);

		await expect(runMigrations(restored)).resolves.toEqual({ applied: [] });
	});
});
