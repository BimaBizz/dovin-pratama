"use client";

import Link from "next/link";
import { PenSquare, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createSparepartAction, deleteSparepartAction, updateSparepartAction } from "@/app/dashboard/sparepart/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Modal({ title, description, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        <div className="flex justify-end border-t border-zinc-200 px-4 py-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}

function SparepartFormFields({ mode, sparepart }) {
  const defaultQuantity = sparepart ? String(sparepart.quantity) : "0";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-name`}>Nama Sparepart</Label>
          <Input id={`${mode}-name`} name="name" required defaultValue={sparepart?.name || ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${mode}-location`}>Lokasi</Label>
          <Input id={`${mode}-location`} name="location" required defaultValue={sparepart?.location || ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${mode}-quantity`}>Jumlah Barang</Label>
          <Input id={`${mode}-quantity`} name="quantity" type="number" min={0} step={1} required defaultValue={defaultQuantity} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-description`}>Deskripsi</Label>
          <textarea
            id={`${mode}-description`}
            name="description"
            defaultValue={sparepart?.description || ""}
            className="min-h-32 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${mode}-images`}>Upload Gambar (maksimal 3)</Label>
          <Input id={`${mode}-images`} name="images" type="file" accept="image/*" multiple />
        </div>
      </div>
    </div>
  );
}

export default function SparepartCardClient({ spareparts = [], initError = "" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(initError);
  const [removedImageIds, setRemovedImageIds] = useState([]);

  const selectedSparepart = useMemo(() => {
    if (!modal?.sparepartId) {
      return null;
    }

    return spareparts.find((item) => item.id === modal.sparepartId) || null;
  }, [modal, spareparts]);

  function closeModal() {
    setModal(null);
    setRemovedImageIds([]);
  }

  function submitAction(action, formData) {
    setMessage("");

    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      closeModal();
      router.refresh();
    });
  }

  function toggleRemovedImage(imageId) {
    setRemovedImageIds((previous) => {
      if (previous.includes(imageId)) {
        return previous.filter((item) => item !== imageId);
      }

      return [...previous, imageId];
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Sparepart</CardTitle>
            <CardDescription>Kelola data sparepart dengan tampilan card. Klik card untuk lihat detail sparepart.</CardDescription>
          </div>
          <Button type="button" onClick={() => setModal({ type: "create" })}>
            <Plus />
            Tambah Sparepart
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {spareparts.map((sparepart) => (
              <article key={sparepart.id} className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
                <Link href={`/dashboard/management/sparepart/${sparepart.id}`} className="block">
                  <div className="h-44 bg-zinc-100">
                    {sparepart.firstImageUrl ? (
                      <img src={sparepart.firstImageUrl} alt={sparepart.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">Belum ada gambar</div>
                    )}
                  </div>

                  <div className="space-y-2 p-4">
                    <h3 className="line-clamp-1 text-base font-semibold text-zinc-900">{sparepart.name}</h3>
                    <p className="text-sm text-zinc-600">Lokasi: {sparepart.location}</p>
                    <p className="text-sm font-medium text-zinc-800">Jumlah: {sparepart.quantity}</p>
                  </div>
                </Link>

                <div className="flex gap-2 border-t border-zinc-200 p-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRemovedImageIds([]);
                      setModal({ type: "edit", sparepartId: sparepart.id });
                    }}
                    className="flex-1"
                  >
                    <PenSquare />
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => setModal({ type: "delete", sparepartId: sparepart.id })} className="flex-1">
                    <Trash2 />
                    Hapus
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {spareparts.length === 0 ? <p className="text-sm text-zinc-500">Belum ada data sparepart.</p> : null}
          {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
        </CardContent>
      </Card>

      {modal?.type === "create" ? (
        <Modal title="Tambah Sparepart" description="Isi data sparepart dan upload maksimal 3 gambar." onClose={closeModal}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitAction(createSparepartAction, new FormData(event.currentTarget));
            }}
          >
            <SparepartFormFields mode="create" />
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              Simpan Sparepart
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "edit" && selectedSparepart ? (
        <Modal title="Edit Sparepart" description="Perbarui data sparepart dan atur gambar yang ingin dihapus." onClose={closeModal}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              removedImageIds.forEach((imageId) => formData.append("removeImageIds", imageId));
              submitAction(updateSparepartAction, formData);
            }}
          >
            <input type="hidden" name="id" value={selectedSparepart.id} />
            <SparepartFormFields mode="edit" sparepart={selectedSparepart} />

            <div className="space-y-2 rounded-md border border-zinc-200 p-3">
              <p className="text-sm font-semibold text-zinc-900">Gambar Saat Ini</p>
              {selectedSparepart.imageItems.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedSparepart.imageItems.map((image) => (
                    <label key={image.id} className="flex items-center gap-3 rounded-md border border-zinc-200 p-2 text-sm">
                      <img src={image.url} alt={image.fileName} className="h-14 w-14 rounded object-cover" />
                      <span className="flex-1 truncate">{image.fileName}</span>
                      <input
                        type="checkbox"
                        checked={removedImageIds.includes(image.id)}
                        onChange={() => toggleRemovedImage(image.id)}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Belum ada gambar tersimpan.</p>
              )}
              <p className="text-xs text-zinc-500">Checklist untuk menandai gambar yang akan dihapus saat update.</p>
            </div>

            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              Update Sparepart
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "delete" && selectedSparepart ? (
        <Modal title="Hapus Sparepart" description="Aksi ini akan menghapus data sparepart beserta semua gambarnya." onClose={closeModal}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitAction(deleteSparepartAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={selectedSparepart.id} />
            <p className="text-sm text-zinc-700">Yakin ingin menghapus sparepart {selectedSparepart.name}?</p>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button type="submit" variant="destructive" className="w-full" disabled={pending}>
              Ya, Hapus Sparepart
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
