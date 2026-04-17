import { redirect } from "next/navigation";

import { getAccessControlConfig } from "@/lib/access-control-config";
import { requireAuthenticatedUser } from "@/lib/auth";

const DEFAULT_PRIORITY = 0;

function flattenPermissionLinks(items = []) {
  const links = [];

  for (const item of items) {
    if (item.type === "link") {
      links.push(item);
      continue;
    }

    if (item.type === "group") {
      for (const link of item.links || []) {
        links.push(link);
      }
    }
  }

  return links;
}

export async function getPermissionEvaluator(role) {
  const config = await getAccessControlConfig();
  const rolePriorityMap = config?.rolePriority || {};
  const normalizedRole = String(role || "").trim().toUpperCase();
  const rolePriority = rolePriorityMap[normalizedRole] ?? DEFAULT_PRIORITY;
  const maxPriority = Math.max(DEFAULT_PRIORITY, ...Object.values(rolePriorityMap).map((value) => Number(value) || 0));
  const links = flattenPermissionLinks(config?.items || []);

  const permissionByKey = links.reduce((accumulator, link) => {
    const key = String(link?.permission?.key || "").trim();

    if (key) {
      accumulator.set(key, link.permission);
    }

    return accumulator;
  }, new Map());

  function hasPagePermission(pageKey, action = "view") {
    if (pageKey === "permissions-master" && rolePriority === maxPriority) {
      return true;
    }

    const permission = permissionByKey.get(pageKey);

    if (!permission) {
      return false;
    }

    if (action === "view") {
      return rolePriority >= Number(permission.viewMinPriority ?? Number.MAX_SAFE_INTEGER);
    }

    const threshold = permission?.crudMinPriority?.[action];

    if (typeof threshold !== "number") {
      return false;
    }

    return rolePriority >= threshold;
  }

  function getSidebarItems() {
    return (config?.items || [])
      .filter((item) => {
        if (item.type === "link") {
          const key = item.permission?.key;
          return key ? hasPagePermission(key, "view") : true;
        }

        if (item.type === "group") {
          return (item.links || []).some((link) => {
            const key = link.permission?.key;
            return key ? hasPagePermission(key, "view") : true;
          });
        }

        return true;
      })
      .map((item) => {
        if (item.type !== "group") {
          return item;
        }

        return {
          ...item,
          links: (item.links || []).filter((link) => {
            const key = link.permission?.key;
            return key ? hasPagePermission(key, "view") : true;
          }),
        };
      });
  }

  return {
    config,
    rolePriority,
    maxPriority,
    isHighestPriority: rolePriority === maxPriority,
    hasPagePermission,
    canView: (pageKey) => hasPagePermission(pageKey, "view"),
    canCrud: (pageKey, action) => hasPagePermission(pageKey, action),
    getSidebarItems,
  };
}

export async function requirePagePermission(pageKey, action = "view") {
  const session = await requireAuthenticatedUser();
  const evaluator = await getPermissionEvaluator(session.user.role);

  const isAllowed = action === "view"
    ? evaluator.canView(pageKey)
    : evaluator.canCrud(pageKey, action);

  if (!isAllowed) {
    redirect("/dashboard");
  }

  return { session, evaluator };
}
