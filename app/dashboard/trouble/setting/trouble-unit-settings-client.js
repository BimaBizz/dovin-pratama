"use client";

import { useMemo, useState, useTransition } from "react";
import { PenSquare, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { createTroubleUnitAction, deleteTroubleUnitAction, updateTroubleUnitAction } from "@/app/dashboard/trouble/setting/actions";
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

export default function TroubleUnitSettingsClient({ units = [], initError = "", canCreate = true, canUpdate = true, canDelete = true }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(initError);

  const selectedUnit = useMemo(() => {
    if (!modal?.unitId) {
      return null;
    }

    return units.find((unit) => unit.id === modal.unitId) || null;
  }, [modal, units]);

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
          <CardTitle>Setting Unit</CardTitle>
          <CardDescription>Tambahkan daftar nama unit yang akan dipilih pada data trouble.</CardDescription>
        </div>
        {canCreate ? (
          <Button type="button" onClick={() => setModal({ type: "create" })}>
            <Plus />
            Tambah Unit
          </Button>
        ) : null}
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-2 py-3">No</th>
                <th className="px-2 py-3">Nama Unit</th>
                <th className="px-2 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit, index) => (
                <tr key={unit.id} className="border-b border-zinc-100">
                  <td className="px-2 py-3 text-zinc-500">{index + 1}</td>
                  <td className="px-2 py-3 font-medium text-zinc-900">{unit.name}</td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="outline" type="button" onClick={() => setModal({ type: "edit", unitId: unit.id })}>
                          <PenSquare />
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="destructive" type="button" onClick={() => setModal({ type: "delete", unitId: unit.id })}>
                          <Trash2 />
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {units.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-zinc-500" colSpan={3}>
                    Belum ada unit.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {message ? <p className="mt-4 text-sm text-red-600">{message}</p> : null}
      </CardContent>

      {modal?.type === "create" && canCreate ? (
        <Modal title="Tambah Unit" description="Masukkan nama unit baru." onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(createTroubleUnitAction, new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="create-unit-name">Nama Unit</Label>
              <Input id="create-unit-name" name="name" required />
            </div>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} type="submit">
              Simpan Unit
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "edit" && selectedUnit && canUpdate ? (
        <Modal title="Edit Unit" description="Perbarui nama unit." onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(updateTroubleUnitAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={String(selectedUnit.id)} />
            <div className="space-y-2">
              <Label htmlFor="edit-unit-name">Nama Unit</Label>
              <Input id="edit-unit-name" name="name" defaultValue={selectedUnit.name} required />
            </div>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} type="submit">
              Update Unit
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "delete" && selectedUnit && canDelete ? (
        <Modal title="Hapus Unit" description="Unit yang masih dipakai data trouble tidak dapat dihapus." onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(deleteTroubleUnitAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={String(selectedUnit.id)} />
            <p className="text-sm text-zinc-700">Yakin ingin menghapus unit {selectedUnit.name}?</p>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} variant="destructive" type="submit">
              Ya, Hapus Unit
            </Button>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}