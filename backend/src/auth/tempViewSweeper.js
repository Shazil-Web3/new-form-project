/**
 * @file tempViewSweeper.js
 * Automatically checks and reverts expired temporary_view users back to their previous_role.
 */

async function revertExpiredTemporaryUsers(pool) {
  if (!pool) return 0;
  try {
    const [expiredUsers] = await pool.execute(
      `SELECT id, email, role, previous_role, temp_view_document_id
       FROM users
       WHERE (role = 'temporary_view' OR role = 'temp_view')
         AND access_expires_at IS NOT NULL
         AND access_expires_at <= NOW()`
    );

    if (expiredUsers && expiredUsers.length > 0) {
      for (const u of expiredUsers) {
        const restoredRole = u.previous_role || 'viewer';

        // Inactivate temporary document permission if document was assigned
        if (u.temp_view_document_id) {
          try {
            await pool.execute(
              `UPDATE documentpermissions
               SET status = 'inactive'
               WHERE document_id = ? AND user_id = ? AND permission_type = 'viewer'`,
              [u.temp_view_document_id, u.id]
            );
          } catch (permErr) {
            console.warn(`Failed to inactivate doc perms for user ${u.id}:`, permErr.message);
          }
        }

        // Revert user role back to their previous_role and reset temporary columns
        await pool.execute(
          `UPDATE users
           SET role = ?,
               previous_role = NULL,
               temp_view_document_id = NULL,
               temp_view_extra_hours = 0,
               temp_view_expires_at = NULL,
               access_expires_at = NULL
           WHERE id = ?`,
          [restoredRole, u.id]
        );

        console.log(`⏱️ [TempView Reversion] User ${u.email} (ID: ${u.id}) expired. Reverted role from temporary_view back to '${restoredRole}'.`);
      }
      return expiredUsers.length;
    }
    return 0;
  } catch (err) {
    console.error('Error in revertExpiredTemporaryUsers:', err);
    return 0;
  }
}

module.exports = {
  revertExpiredTemporaryUsers
};
