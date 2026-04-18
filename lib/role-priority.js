import { getAccessControlConfig } from "@/lib/access-control-config";

export async function getRolePriorityMap() {
  const config = await getAccessControlConfig();
  return config?.rolePriority || {};
}

export function getRolePriority(rolePriorityMap, role) {
  const normalizedRole = String(role || "").trim().toUpperCase();
  return Number(rolePriorityMap?.[normalizedRole] || 0);
}

export function canAssignRole(rolePriorityMap, assignerRole, assigneeRole) {
  return getRolePriority(rolePriorityMap, assignerRole) >= getRolePriority(rolePriorityMap, assigneeRole);
}