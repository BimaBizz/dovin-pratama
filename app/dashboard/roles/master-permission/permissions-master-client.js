"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveMasterPermissionAction } from "@/app/dashboard/roles/master-permission/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function flattenPermissionRows(items = []) {
  const rows = [];

  for (const item of items) {
    if (item.type === "link" && item.permission?.key) {
      rows.push({
        key: item.permission.key,
        label: item.label,
        href: item.href,
        viewMinPriority: item.permission.viewMinPriority,
        createMinPriority: item.permission.crudMinPriority?.create,
        updateMinPriority: item.permission.crudMinPriority?.update,
        deleteMinPriority: item.permission.crudMinPriority?.delete,
      });
    }

    if (item.type === "group") {
      for (const link of item.links || []) {
        if (!link.permission?.key) {
          continue;
        }

        rows.push({
          key: link.permission.key,
          label: link.label,
          href: link.href,
          viewMinPriority: link.permission.viewMinPriority,
          createMinPriority: link.permission.crudMinPriority?.create,
          updateMinPriority: link.permission.crudMinPriority?.update,
          deleteMinPriority: link.permission.crudMinPriority?.delete,
        });
      }
    }
  }

  return rows;
}

function toNumber(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function buildConfigFromState(baseConfig, rolePriority, permissionRows) {
  const permissionMap = new Map(permissionRows.map((row) => [row.key, row]));

  const items = (baseConfig.items || []).map((item) => {
    if (item.type === "link" && item.permission?.key) {
      const row = permissionMap.get(item.permission.key);

      if (!row) {
        return item;
      }

      return {
        ...item,
        permission: {
          ...item.permission,
          viewMinPriority: row.viewMinPriority,
          crudMinPriority: {
            create: row.createMinPriority,
            update: row.updateMinPriority,
            delete: row.deleteMinPriority,
          },
        },
      };
    }

    if (item.type === "group") {
      return {
        ...item,
        links: (item.links || []).map((link) => {
          if (!link.permission?.key) {
            return link;
          }

          const row = permissionMap.get(link.permission.key);
          if (!row) {
            return link;
          }

          return {
            ...link,
            permission: {
              ...link.permission,
              viewMinPriority: row.viewMinPriority,
              crudMinPriority: {
                create: row.createMinPriority,
                update: row.updateMinPriority,
                delete: row.deleteMinPriority,
              },
            },
          };
        }),
      };
    }

    return item;
  });

  return {
    rolePriority,
    items,
  };
}

export default function MasterPermissionClient({
  initialConfig,
  canManage,
  viewerRole,
  viewerPriority,
  maxPriority,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [rolePriority, setRolePriority] = useState(() => ({ ...(initialConfig?.rolePriority || {}) }));
  const [permissionRows, setPermissionRows] = useState(() => flattenPermissionRows(initialConfig?.items || []));

  const sortedRoles = useMemo(
    () => Object.keys(rolePriority).sort((a, b) => a.localeCompare(b)),
    [rolePriority]
  );

  function updateRolePriority(role, value) {
    setRolePriority((previous) => ({
      ...previous,
      [role]: value,
    }));
  }

  function updatePermissionRow(key, field, value) {
    setPermissionRows((previous) =>
      previous.map((row) =>
        row.key === key
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!canManage) {
      setMessage("Role Anda tidak memiliki hak mengubah master permission.");
      return;
    }

    const normalizedRolePriority = {};

    for (const role of sortedRoles) {
      const parsed = toNumber(rolePriority[role]);

      if (parsed === null) {
        setMessage(`Priority untuk role ${role} harus angka >= 0.`);
        return;
      }

      normalizedRolePriority[role] = parsed;
    }

    const normalizedRows = [];

    for (const row of permissionRows) {
      const viewMinPriority = toNumber(row.viewMinPriority);
      const createMinPriority = toNumber(row.createMinPriority);
      const updateMinPriority = toNumber(row.updateMinPriority);
      const deleteMinPriority = toNumber(row.deleteMinPriority);

      if (
        viewMinPriority === null ||
        createMinPriority === null ||
        updateMinPriority === null ||
        deleteMinPriority === null
      ) {
        setMessage(`Semua threshold di halaman ${row.label} harus angka >= 0.`);
        return;
      }

      normalizedRows.push({
        ...row,
        viewMinPriority,
        createMinPriority,
        updateMinPriority,
        deleteMinPriority,
      });
    }

    const nextConfig = buildConfigFromState(initialConfig, normalizedRolePriority, normalizedRows);
    const formData = new FormData();
    formData.set("configJson", JSON.stringify(nextConfig));

    setMessage("");

    startTransition(async () => {
      const result = await saveMasterPermissionAction(formData);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage("Master permission berhasil disimpan ke database.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Master Permission</CardTitle>
          <CardDescription>
            Atur prioritas role dan visibility/CRUD tiap halaman dari satu tempat. Konfigurasi disimpan di database agar berlaku tanpa deploy ulang.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Role aktif: {viewerRole}</Badge>
            <Badge variant="outline">Priority Anda: {viewerPriority}</Badge>
            <Badge variant="outline">Priority Tertinggi: {maxPriority}</Badge>
            <Badge variant={canManage ? "default" : "secondary"}>{canManage ? "Boleh Edit" : "Read Only"}</Badge>
          </div>
          {!canManage ? (
            <p className="text-zinc-600">
              Hanya role dengan prioritas tertinggi yang dapat melakukan perubahan konfigurasi.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Prioritas Role</CardTitle>
            <CardDescription>Semakin tinggi angka, semakin tinggi kewenangan role.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedRoles.map((role) => (
                <div key={role} className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">{role}</label>
                  <Input
                    type="number"
                    min={0}
                    value={String(rolePriority[role])}
                    disabled={!canManage}
                    onChange={(event) => updateRolePriority(role, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matrix Permission Halaman</CardTitle>
            <CardDescription>Atur threshold minimal priority untuk akses View, Create, Update, Delete.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-4xl text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="px-2 py-3">Key</th>
                    <th className="px-2 py-3">Halaman</th>
                    <th className="px-2 py-3">Path</th>
                    <th className="px-2 py-3">View</th>
                    <th className="px-2 py-3">Create</th>
                    <th className="px-2 py-3">Update</th>
                    <th className="px-2 py-3">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.map((row) => (
                    <tr key={row.key} className="border-b border-zinc-100">
                      <td className="px-2 py-2 font-medium text-zinc-900">{row.key}</td>
                      <td className="px-2 py-2 text-zinc-700">{row.label}</td>
                      <td className="px-2 py-2 text-zinc-500">{row.href}</td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={String(row.viewMinPriority)}
                          disabled={!canManage}
                          onChange={(event) => updatePermissionRow(row.key, "viewMinPriority", event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={String(row.createMinPriority)}
                          disabled={!canManage}
                          onChange={(event) => updatePermissionRow(row.key, "createMinPriority", event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={String(row.updateMinPriority)}
                          disabled={!canManage}
                          onChange={(event) => updatePermissionRow(row.key, "updateMinPriority", event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={String(row.deleteMinPriority)}
                          disabled={!canManage}
                          onChange={(event) => updatePermissionRow(row.key, "deleteMinPriority", event.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {message ? <p className="text-sm text-zinc-700">{message}</p> : null}

        <Button type="submit" disabled={pending || !canManage}>
          Simpan Master Permission
        </Button>
      </form>
    </div>
  );
}
