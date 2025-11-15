// server.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

// ----- DB POOL -----
const pool = new Pool({
  host: process.env.PGHOST || process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "postgres",
});

// маленький helper
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res;
  } finally {
    client.release();
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// ----- HEALTH -----
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// ===========================
// ORGS CRUD
// ===========================

app.get("/orgs", async (_req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM organizations ORDER BY id ASC"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get("/orgs/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM organizations WHERE id = $1",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "org not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post("/orgs", async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const { rows } = await query(
      "INSERT INTO organizations (name, description) VALUES ($1,$2) RETURNING *",
      [name, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.put("/orgs/:id", async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const { rows } = await query(
      "UPDATE organizations SET name = COALESCE($1,name), description = COALESCE($2,description) WHERE id = $3 RETURNING *",
      [name || null, description || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "org not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.delete("/orgs/:id", async (req, res, next) => {
  try {
    const { rowCount } = await query(
      "DELETE FROM organizations WHERE id = $1",
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: "org not found" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ===========================
// INVENTORIES CRUD
// ===========================

app.get("/inventories", async (_req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM inventories ORDER BY id ASC"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get("/inventories/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM inventories WHERE id = $1",
      [req.params.id]
    );
    if (!rows[0])
      return res.status(404).json({ error: "inventory not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post("/inventories", async (req, res, next) => {
  try {
    const { organization_id, name, description, variables } = req.body;
    if (!organization_id || !name) {
      return res
        .status(400)
        .json({ error: "organization_id and name are required" });
    }
    const varsJson =
      variables && typeof variables === "object"
        ? JSON.stringify(variables)
        : "{}";
    const { rows } = await query(
      "INSERT INTO inventories (organization_id, name, description, variables) VALUES ($1,$2,$3,$4::jsonb) RETURNING *",
      [organization_id, name, description || null, varsJson]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.put("/inventories/:id", async (req, res, next) => {
  try {
    const { name, description, variables } = req.body;
    const varsJson =
      variables && typeof variables === "object"
        ? JSON.stringify(variables)
        : null;
    const { rows } = await query(
      "UPDATE inventories SET name = COALESCE($1,name), description = COALESCE($2,description), variables = COALESCE($3::jsonb,variables) WHERE id = $4 RETURNING *",
      [name || null, description || null, varsJson, req.params.id]
    );
    if (!rows[0])
      return res.status(404).json({ error: "inventory not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.delete("/inventories/:id", async (req, res, next) => {
  try {
    const { rowCount } = await query(
      "DELETE FROM inventories WHERE id = $1",
      [req.params.id]
    );
    if (!rowCount)
      return res.status(404).json({ error: "inventory not found" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ===========================
// PLAYBOOKS CRUD + RUN
// ===========================

app.get("/playbooks", async (_req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM playbooks ORDER BY id ASC"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get("/playbooks/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM playbooks WHERE id = $1",
      [req.params.id]
    );
    if (!rows[0])
      return res.status(404).json({ error: "playbook not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post("/playbooks", async (req, res, next) => {
  try {
    const { organization_id, name, description, content } = req.body;
    if (!organization_id || !name || !content) {
      return res
        .status(400)
        .json({ error: "organization_id, name and content are required" });
    }
    const { rows } = await query(
      "INSERT INTO playbooks (organization_id, name, description, content) VALUES ($1,$2,$3,$4) RETURNING *",
      [organization_id, name, description || null, content]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.put("/playbooks/:id", async (req, res, next) => {
  try {
    const { name, description, content } = req.body;
    const { rows } = await query(
      "UPDATE playbooks SET name = COALESCE($1,name), description = COALESCE($2,description), content = COALESCE($3,content) WHERE id = $4 RETURNING *",
      [name || null, description || null, content || null, req.params.id]
    );
    if (!rows[0])
      return res.status(404).json({ error: "playbook not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.delete("/playbooks/:id", async (req, res, next) => {
  try {
    const { rowCount } = await query(
      "DELETE FROM playbooks WHERE id = $1",
      [req.params.id]
    );
    if (!rowCount)
      return res.status(404).json({ error: "playbook not found" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});


app.post("/playbooks/:id/run", async (req, res, next) => {
  try {
    const playbookId = Number(req.params.id);
    const { inventory_id, organization_id, extra_vars } = req.body || {};

    const pbRes = await query(
      "SELECT * FROM playbooks WHERE id = $1",
      [playbookId]
    );
    const playbook = pbRes.rows[0];
    if (!playbook)
      return res.status(404).json({ error: "playbook not found" });

    const orgId = organization_id || playbook.organization_id;

    const extraVarsJson =
      extra_vars && typeof extra_vars === "object"
        ? JSON.stringify(extra_vars)
        : "{}";

    const now = new Date();
    const result = {
      summary: "Simulated run completed successfully",
      changed: 1,
      failed: 0,
      ok: 3,
    };

    const { rows } = await query(
      "INSERT INTO jobs (organization_id, playbook_id, inventory_id, status, started_at, finished_at, extra_vars, result) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) RETURNING *",
      [
        orgId,
        playbookId,
        inventory_id || null,
        "successful",
        now,
        now,
        extraVarsJson,
        JSON.stringify(result),
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});


app.get("/jobs", async (_req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM jobs ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get("/jobs/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM jobs WHERE id = $1",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "job not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error("Error:", err);
  res
    .status(500)
    .json({ error: "internal_error", details: err.message || String(err) });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`AAP simulator listening on port ${port}`);
});
