# Magical sql operator

Always use the `sql` template for this project.
All database queries MUST be written with `sql`.
Do not use Drizzle query builder helpers (select/insert/update/delete builders).

This section defines rules for using Drizzle ORM `sql` safely and correctly.

---

Rule 1: Purpose

Use `sql` for every database operation in this project.
`sql` allows writing raw SQL in a safe and typed way.
Never use string concatenation for SQL.

---

Rule 2: Import source (mandatory)

Always import `sql` from `@modlearn/db/orm`.
Do not import `sql` from `drizzle-orm` or any other package.

Use it as a tagged template:
sql`select ...`

Dynamic values must be injected using template placeholders.
Drizzle converts them into parameters ($1, $2, etc).

---

Rule 3: Basic usage

Use `sql` as a tagged template:
sql`select ...`

Dynamic values must be injected using template placeholders.
Drizzle converts them into parameters ($1, $2, etc).

Rule 4: Parameter safety

All dynamic values passed into `sql` are parameterized.
This prevents SQL injection.
Never manually escape values.

---

Rule 5: Type annotation

Use `sql<T>` to define the expected TypeScript type.
This does not affect runtime behavior.
It only helps with type safety.

Example:
sql<number>`count(*)`

---

Rule 6: Mapping results

Use `.mapWith()` to map database values to JS types.
This is useful for dates, numbers, or custom parsing.

---

Rule 7: Aliasing

Use `.as('alias_name')` to name computed fields.
This is required when selecting custom SQL expressions.

---

Rule 8: Raw SQL text

Use `sql.raw()` only when needed.
This injects SQL as-is.
No escaping or parameterization happens.

Only use `sql.raw()` for trusted static SQL.

---

Rule 9: Combining SQL chunks

Use helpers when building dynamic SQL:

- sql.join(list, separator)
- sql.fromList(list)
- sql.append(chunk)
- sql.empty()

Never build SQL with string concatenation.

---

Rule 10: Usage in queries

`sql` can be used in:
- SELECT
- WHERE
- ORDER BY
- GROUP BY
- HAVING

It works anywhere Drizzle accepts SQL expressions.

---

Rule 11: Query output

To inspect generated SQL:
Use dialect.sqlToQuery(sql)

This returns:
- SQL string
- parameters array

---

Rule 12: Table and column references

Always pass tables and columns as Drizzle references.
Do not manually quote identifiers.
