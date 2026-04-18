import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import defaultConfig from "@/app/dashboard/sidebar-links.json";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";

const DEFAULT_SINGLETON_KEY = "GLOBAL";
const SIDEBAR_CONFIG_PATH = path.join(process.cwd(), "app/dashboard/sidebar-links.json");

function cloneValue(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function getPermissionKey(item) {
  return String(item?.permission?.key || "").trim();
}

function mergePermission(defaultPermission, storedPermission = {}) {
  return {
    ...cloneValue(defaultPermission),
    ...cloneValue(storedPermission),
    crudMinPriority: {
      ...(defaultPermission?.crudMinPriority || {}),
      ...(storedPermission?.crudMinPriority || {}),
    },
  };
}

function mergeSidebarItems(defaultItems = [], storedItems = []) {
  const storedById = new Map(storedItems.map((item) => [item.id, item]));
  const merged = [];

  for (const defaultItem of defaultItems) {
    const storedItem = storedById.get(defaultItem.id);

    if (!storedItem) {
      merged.push(cloneValue(defaultItem));
      continue;
    }

    if (defaultItem.type === "group") {
      const storedLinks = Array.isArray(storedItem.links) ? storedItem.links : [];
      const storedLinksByKey = new Map(storedLinks.map((link) => [getPermissionKey(link) || link.href, link]));

      merged.push({
        ...cloneValue(defaultItem),
        label: storedItem.label ?? defaultItem.label,
        icon: storedItem.icon ?? defaultItem.icon,
        links: (defaultItem.links || []).map((defaultLink) => {
          const storedLink = storedLinksByKey.get(getPermissionKey(defaultLink) || defaultLink.href);

          if (!storedLink) {
            return cloneValue(defaultLink);
          }

          return {
            ...cloneValue(defaultLink),
            ...cloneValue(storedLink),
            permission: mergePermission(defaultLink.permission, storedLink.permission),
          };
        }),
      });

      continue;
    }

    merged.push({
      ...cloneValue(defaultItem),
      label: storedItem.label ?? defaultItem.label,
      icon: storedItem.icon ?? defaultItem.icon,
      href: storedItem.href ?? defaultItem.href,
      permission: mergePermission(defaultItem.permission, storedItem.permission),
    });
  }

  for (const storedItem of storedItems) {
    if (!defaultItems.some((item) => item.id === storedItem.id)) {
      merged.push(cloneValue(storedItem));
    }
  }

  return merged;
}

function mergeAccessControlConfigs(defaultConfig, storedConfig) {
  if (!storedConfig || typeof storedConfig !== "object") {
    return cloneValue(defaultConfig);
  }

  return {
    rolePriority: {
      ...(defaultConfig.rolePriority || {}),
      ...(storedConfig.rolePriority || {}),
    },
    items: mergeSidebarItems(defaultConfig.items || [], storedConfig.items || []),
  };
}

function normalizeNumber(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function validatePermission(permission, keyTracker) {
  if (!permission || typeof permission !== "object") {
    return { error: "Setiap halaman wajib memiliki konfigurasi permission." };
  }

  const key = String(permission.key || "").trim();
  if (!key) {
    return { error: "Key permission halaman wajib diisi." };
  }

  if (keyTracker.has(key)) {
    return { error: `Key permission duplikat: ${key}` };
  }

  keyTracker.add(key);

  const viewMinPriority = normalizeNumber(permission.viewMinPriority);
  if (viewMinPriority === null) {
    return { error: `viewMinPriority untuk ${key} harus angka >= 0.` };
  }

  const crud = permission.crudMinPriority || {};
  for (const action of ["create", "update", "delete"]) {
    const threshold = normalizeNumber(crud[action]);
    if (threshold === null) {
      return { error: `crudMinPriority.${action} untuk ${key} harus angka >= 0.` };
    }
  }

  return { success: true };
}

export function validateAccessControlConfig(config) {
  if (!config || typeof config !== "object") {
    return { error: "Konfigurasi ACL harus berupa object JSON." };
  }

  const rolePriority = config.rolePriority;
  if (!rolePriority || typeof rolePriority !== "object" || Array.isArray(rolePriority)) {
    return { error: "rolePriority wajib object key-value." };
  }

  const roleEntries = Object.entries(rolePriority);
  if (roleEntries.length === 0) {
    return { error: "rolePriority minimal berisi 1 role." };
  }

  for (const [roleName, priority] of roleEntries) {
    if (!String(roleName || "").trim()) {
      return { error: "Nama role pada rolePriority tidak boleh kosong." };
    }

    if (normalizeNumber(priority) === null) {
      return { error: `Priority role ${roleName} harus angka >= 0.` };
    }
  }

  if (!Array.isArray(config.items)) {
    return { error: "items wajib berupa array." };
  }

  const keyTracker = new Set();

  for (const item of config.items) {
    if (!item || typeof item !== "object") {
      return { error: "Semua item sidebar harus object." };
    }

    const type = String(item.type || "").trim();

    if (!["link", "group", "placeholder"].includes(type)) {
      return { error: `Tipe sidebar tidak valid: ${type}` };
    }

    if (type === "link") {
      const result = validatePermission(item.permission, keyTracker);
      if (result.error) {
        return result;
      }
    }

    if (type === "group") {
      if (!Array.isArray(item.links)) {
        return { error: `Group ${item.id || item.label || "(tanpa id)"} wajib punya links array.` };
      }

      for (const link of item.links) {
        const href = String(link?.href || "").trim();
        if (!href) {
          return { error: "Setiap link group wajib punya href." };
        }

        const result = validatePermission(link.permission, keyTracker);
        if (result.error) {
          return result;
        }
      }
    }
  }

  return { success: true };
}

export function normalizeAccessControlConfig(config) {
  const rolePriority = Object.entries(config.rolePriority || {}).reduce((accumulator, [role, priority]) => {
    const normalizedRole = String(role || "").trim().toUpperCase();
    const normalizedPriority = normalizeNumber(priority);

    if (normalizedRole && normalizedPriority !== null) {
      accumulator[normalizedRole] = normalizedPriority;
    }

    return accumulator;
  }, {});

  return {
    rolePriority,
    items: cloneValue(Array.isArray(config.items) ? config.items : []),
  };
}

export function getDefaultAccessControlConfig() {
  return cloneValue(defaultConfig);
}

async function readSidebarJsonConfig() {
  try {
    const raw = await readFile(SIDEBAR_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object") {
      return parsed;
    }

    return getDefaultAccessControlConfig();
  } catch {
    return getDefaultAccessControlConfig();
  }
}

async function syncSidebarJsonConfig(config) {
  try {
    const nextJson = `${JSON.stringify(config, null, 2)}\n`;
    const currentJson = await readFile(SIDEBAR_CONFIG_PATH, "utf8").catch(() => "");

    if (currentJson === nextJson) {
      return;
    }

    await writeFile(SIDEBAR_CONFIG_PATH, nextJson, "utf8");
  } catch {
    // Best-effort sync only. Runtime behavior keeps using DB-backed config.
  }
}

export async function getAccessControlConfig() {
  noStore();

  const fallback = await readSidebarJsonConfig();
  const delegate = prisma.accessControlConfig;

  if (!delegate?.findUnique) {
    return fallback;
  }

  try {
    const row = await delegate.findUnique({
      where: { singletonKey: DEFAULT_SINGLETON_KEY },
      select: { config: true },
    });

    if (!row?.config || typeof row.config !== "object") {
      return fallback;
    }

    const normalized = normalizeAccessControlConfig(mergeAccessControlConfigs(fallback, row.config));
    const validation = validateAccessControlConfig(normalized);

    if (validation.error) {
      return fallback;
    }

    await syncSidebarJsonConfig(normalized);

    return normalized;
  } catch {
    return fallback;
  }
}

export async function saveAccessControlConfig({ config, updatedByUserId = null }) {
  const validation = validateAccessControlConfig(config);
  if (validation.error) {
    return { error: validation.error };
  }

  const delegate = prisma.accessControlConfig;
  if (!delegate?.upsert) {
    return {
      error: "Model AccessControlConfig belum siap. Jalankan: npm run prisma:generate && npm run prisma:push",
    };
  }

  const normalized = normalizeAccessControlConfig(config);

  try {
    await delegate.upsert({
      where: { singletonKey: DEFAULT_SINGLETON_KEY },
      update: {
        config: normalized,
        updatedByUserId,
      },
      create: {
        singletonKey: DEFAULT_SINGLETON_KEY,
        config: normalized,
        updatedByUserId,
      },
    });

    const fallback = await readSidebarJsonConfig();
    const mergedForJson = normalizeAccessControlConfig(mergeAccessControlConfigs(fallback, normalized));
    await syncSidebarJsonConfig(mergedForJson);

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Gagal menyimpan konfigurasi access control.",
    };
  }
}
