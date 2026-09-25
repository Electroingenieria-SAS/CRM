export const systemRoles = [
  'USER',
  'AUXILIAR',
  'LEADER',
  'COORDINATOR',
  'ADMIN',
  'SUPERADMIN',
] as const;

export type SystemRole = (typeof systemRoles)[number];
