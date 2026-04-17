"use client";

import { useMemo, useState, useTransition } from "react";
import { PenSquare, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/app/dashboard/roles/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Modal({ title, description, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        </div>
        <div className="p-4">{children}</div>
        <div className="flex justify-end border-t border-zinc-200 px-4 py-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RolesCrudClient({ roles = [], initError = "" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(initError);

  const selectedRole = useMemo(() => {
    if (!modal?.roleId) {
      return null;
    }
    return roles.find((role) => role.id === modal.roleId) || null;
  }, [modal, roles]);

  function submitWithAction(action, formData) {
    setMessage("");
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        setMessage(result.error);
        return;
      }
      setModal(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>CRUD Role</CardTitle>
          <CardDescription>Kelola master role dari submenu user ke role.</CardDescription>
        </div>
        <Button type="button" onClick={() => setModal({ type: "create" })}>
          <Plus />
          Tambah Role
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-2 py-3">No</th>
                <th className="px-2 py-3">Nama</th>
                <th className="px-2 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role, index) => (
                <tr key={role.id} className="border-b border-zinc-100">
                  <td className="px-2 py-3 text-zinc-500">{index + 1}</td>
                  <td className="px-2 py-3 font-medium text-zinc-900">{role.name}</td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" type="button" onClick={() => setModal({ type: "edit", roleId: role.id })}>
                        <PenSquare />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        type="button"
                        onClick={() => setModal({ type: "delete", roleId: role.id })}
                      >
                        <Trash2 />
                        Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-zinc-500" colSpan={3}>
                    Belum ada data role.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>

      {modal?.type === "create" ? (
        <Modal title="Tambah Role" description="Tambahkan master role baru." onClose={() => setModal(null)}>
          <form
            className="space-y-3 max-h-[70vh] overflow-y-auto"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(createRoleAction, new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="create-role-name">Nama Role</Label>
              <Input id="create-role-name" name="name" required />
            </div>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} type="submit">
              Simpan Role
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "edit" && selectedRole ? (
        <Modal title="Edit Role" description="Perbarui data role." onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(updateRoleAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={String(selectedRole.id)} />
            <div className="space-y-2">
              <Label htmlFor="edit-role-name">Nama Role</Label>
              <Input id="edit-role-name" name="name" defaultValue={selectedRole.name} required />
            </div>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} type="submit">
              Update Role
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "delete" && selectedRole ? (
        <Modal title="Hapus Role" description="Aksi ini tidak dapat dibatalkan." onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(deleteRoleAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={String(selectedRole.id)} />
            <p className="text-sm text-zinc-700">Yakin ingin menghapus role {selectedRole.name}?</p>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} variant="destructive" type="submit">
              Ya, Hapus Role
            </Button>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}
