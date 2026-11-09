import io, re

F = 'src/auth/taskRoutes.ts'
s = io.open(F, encoding='utf-8', newline='').read()


def rep(old, new, count=1):
    global s
    assert s.count(old) == count, f'{count}x missing: {old[:90]!r} found={s.count(old)}'
    s = s.replace(old, new)


n = len(re.findall(r'DATE_FORMAT\(', s))
s = re.sub(r"DATE_FORMAT\((.*?), '%Y-%m-%d'\)", r"TO_CHAR(\1, 'YYYY-MM-DD')", s)
print('DATE_FORMAT replaced:', n)

rep('(SELECT GROUP_CONCAT(td.depends_on_task_id) FROM task_dependencies td WHERE td.task_id = t.id)',
    "(SELECT string_agg(td.depends_on_task_id::TEXT, ',') FROM task_dependencies td WHERE td.task_id = t.id)",
    2)
rep('const updates = {};', 'const updates: any = {};')
rep('AND id IN ($2)', 'AND id = ANY($2)', 2)
rep('}) {\napp.get(\'/api/tasks/my-tasks\'',
    '}: any) {\n  const qmarks = (text: string): string => {\n    let i = 0;\n    return text.replace(/\\?/g, () => `$${++i}`);\n  };\napp.get(\'/api/tasks/my-tasks\'')
rep('const { rows: tasks } = await pool.query(query, params);',
    'const { rows: tasks } = await pool.query(qmarks(query), params);', 2)
rep('const { rows: rows } = await pool.query(query, params);',
    'const { rows: rows } = await pool.query(qmarks(query), params);')
rep('await pool.getConnection()', 'await pool.connect()', 2)
rep("await connection.beginTransaction();", "await connection.query('BEGIN');", 2)
rep('await connection.commit();', "await connection.query('COMMIT');", 2)
rep('await connection.rollback();', "await connection.query('ROLLBACK');", 2)
rep('updateKeys.map((key) => `\\`${key}\\` = ?`).join',
    'updateKeys.map((key, i) => `"${key}" = $${i + 1}`).join')
rep('`UPDATE tasks SET ${assignments} WHERE id = ?`,',
    '`UPDATE tasks SET ${assignments} WHERE id = $${updateKeys.length + 1}`,')
rep("`UPDATE taskassignments SET status = ?, completed_at = ${updates.status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL'} WHERE task_id = ?`,",
    "`UPDATE taskassignments SET status = $1, completed_at = ${updates.status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL'} WHERE task_id = $2`,")
rep("'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES $1',\n            [dependencyIds.map((id) => [taskId, id])]",
    "`INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ${dependencyIds.map((_, i) => `($1, $${i + 2})`).join(', ')}`,\n            [taskId, ...dependencyIds]")
rep("'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES $1',\n        [dependencyIds.map((id) => [taskId, id])]",
    "`INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ${dependencyIds.map((_, i) => `($1, $${i + 2})`).join(', ')}`,\n        [taskId, ...dependencyIds]")
rep("'INSERT INTO gantt_projects (organization_id, title, description, owner_id, start_date, end_date, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',",
    "'INSERT INTO gantt_projects (organization_id, title, description, owner_id, start_date, end_date, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',")
rep("'INSERT INTO task_comments (task_id, user_id, message, parent_id) VALUES ($1, $2, $3, $4)',",
    "'INSERT INTO task_comments (task_id, user_id, message, parent_id) VALUES ($1, $2, $3, $4) RETURNING id',")
rep("'INSERT INTO tasks (organization_id, document_id, title, description, start_date, due_date, priority, created_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',",
    "'INSERT INTO tasks (organization_id, document_id, title, description, start_date, due_date, priority, created_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',")
rep("'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',",
    "'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',")
rep('result.insertId', 'result[0]?.id', 5)
rep('const { rows: result } = await pool.query(\n      \'UPDATE gantt_projects',
    'const result: any = await pool.query(\n      \'UPDATE gantt_projects')
rep('const { rows: result } = await pool.query(\n      \'DELETE FROM gantt_projects',
    'const result: any = await pool.query(\n      \'DELETE FROM gantt_projects')
rep('result.affectedRows', 'result.rowCount', 2)

io.open(F, 'w', encoding='utf-8', newline='').write(s)
print('taskRoutes fixed')
