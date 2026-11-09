export const hasPermission = (user, permission) => {
  if (user?.isSuperAdmin) return true;
  if (user?.role === 'admin' && (permission === 'access_levels.manage' || permission === 'access_levels.view')) return true;
  if (!user || typeof permission !== 'string') return false;

  const permissions = new Set(Array.isArray(user.permissions) ? user.permissions : []);
  if (permissions.has(permission)) return true;

  const [feature] = permission.split('.');
  return permissions.has(`${feature}.manage`);
};
