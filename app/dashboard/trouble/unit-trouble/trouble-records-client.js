"use client";

import { useMemo, useState, useTransition } from "react";
import { PenSquare, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { createTroubleRecordAction, deleteTroubleRecordAction, updateTroubleRecordAction } from "@/app/dashboard/trouble/unit-trouble/actions";
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

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

function buildPageHref(search, month, page) {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }

  if (month) {
    params.set("month", month);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `?${query}` : "?";
}

function buildScopedHref({ search, month, format }) {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }

  if (month) {
    params.set("month", month);
  }

  if (format) {
    params.set("format", format);
  }

  return `/api/dashboard/trouble/unit-trouble/export?${params.toString()}`;
}

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export default function TroubleRecordsClient({
  records = [],
  unitOptions = [],
  pagination,
  search = "",
  month = getCurrentMonthKey(),
  initError = "",
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(initError);
  const [searchValue, setSearchValue] = useState(search);
  const [monthValue, setMonthValue] = useState(month);

  const selectedRecord = useMemo(() => {
    if (!modal?.recordId) {
      return null;
    }

    return records.find((record) => record.id === modal.recordId) || null;
  }, [modal, records]);

  const startNumber = pagination ? (pagination.currentPage - 1) * pagination.pageSize + 1 : 1;

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

  function handleSearchSubmit(event) {
    event.preventDefault();

    const params = new URLSearchParams();
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    }

    if (monthValue.trim()) {
      params.set("month", monthValue.trim());
    }

    router.push(params.toString() ? `?${params.toString()}` : "?");
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Unit Trouble</CardTitle>
          <CardDescription>Kelola data trouble per unit. Durasi dihitung otomatis dari waktu off dan on.</CardDescription>
        </div>
        {canCreate ? (
          <Button type="button" disabled={unitOptions.length === 0} onClick={() => setModal({ type: "create" })}>
            <Plus />
            Tambah Data
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="flex flex-col gap-3 lg:flex-row lg:items-end" onSubmit={handleSearchSubmit}>
          <div className="space-y-1 lg:max-w-sm lg:flex-1">
            <Label htmlFor="filter-month">Bulan</Label>
            <Input id="filter-month" type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} />
          </div>
          <div className="space-y-1 lg:max-w-sm lg:flex-1">
            <Label htmlFor="filter-search">Pencarian</Label>
            <Input
              id="filter-search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Cari unit atau keterangan..."
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Tampilkan
            </Button>
            <Button asChild type="button" variant="outline" className="hidden sm:inline-flex">
              <a href={buildScopedHref({ search: searchValue.trim(), month: monthValue.trim(), format: "excel" })} target="_blank" rel="noreferrer">
                Export Excel
              </a>
            </Button>
            <Button asChild type="button" variant="outline" className="hidden sm:inline-flex">
              <a href={buildScopedHref({ search: searchValue.trim(), month: monthValue.trim(), format: "pdf" })} target="_blank" rel="noreferrer">
                Export PDF
              </a>
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap gap-2 sm:hidden">
          <Button asChild type="button" variant="outline">
            <a href={buildScopedHref({ search: searchValue.trim(), month: monthValue.trim(), format: "excel" })} target="_blank" rel="noreferrer">
              Export Excel
            </a>
          </Button>
          <Button asChild type="button" variant="outline">
            <a href={buildScopedHref({ search: searchValue.trim(), month: monthValue.trim(), format: "pdf" })} target="_blank" rel="noreferrer">
              Export PDF
            </a>
          </Button>
        </div>

        {unitOptions.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Belum ada unit. Tambahkan dulu di halaman Setting agar bisa membuat data trouble.
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-2 py-3">No</th>
                <th className="px-2 py-3">Nama Unit</th>
                <th className="px-2 py-3">Tanggal</th>
                <th className="px-2 py-3">Waktu Off</th>
                <th className="px-2 py-3">Waktu On</th>
                <th className="px-2 py-3">Durasi (Menit)</th>
                <th className="px-2 py-3">Keterangan</th>
                <th className="px-2 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={record.id} className="border-b border-zinc-100">
                  <td className="px-2 py-3 text-zinc-500">{startNumber + index}</td>
                  <td className="px-2 py-3 font-medium text-zinc-900">{record.unit?.name || "-"}</td>
                  <td className="px-2 py-3 text-zinc-700">{formatDate(record.troubleDate)}</td>
                  <td className="px-2 py-3 text-zinc-700">{record.timeOff || "-"}</td>
                  <td className="px-2 py-3 text-zinc-700">{record.timeOn || "-"}</td>
                  <td className="px-2 py-3 text-zinc-700">{record.durationMinutes}</td>
                  <td className="px-2 py-3 text-zinc-700">{record.note || "-"}</td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="outline" type="button" onClick={() => setModal({ type: "edit", recordId: record.id })}>
                          <PenSquare />
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="destructive" type="button" onClick={() => setModal({ type: "delete", recordId: record.id })}>
                          <Trash2 />
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-zinc-500" colSpan={8}>
                    Belum ada data trouble.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600">
              Menampilkan {records.length === 0 ? 0 : startNumber} - {startNumber + records.length - 1} dari {pagination.totalRecords} data
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pagination.currentPage <= 1}
                onClick={() => router.push(buildPageHref(search, monthValue, Math.max(pagination.currentPage - 1, 1)))}
              >
                Sebelumnya
              </Button>
              <span className="text-sm text-zinc-600">
                Halaman {pagination.currentPage} dari {pagination.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={pagination.currentPage >= pagination.totalPages}
                onClick={() => router.push(buildPageHref(search, monthValue, pagination.currentPage + 1))}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        ) : null}

        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </CardContent>

      {modal?.type === "create" && canCreate ? (
        <Modal title="Tambah Data Trouble" description="Masukkan unit, tanggal, waktu off/on, dan keterangan." onClose={() => setModal(null)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(createTroubleRecordAction, new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="create-unit">Nama Unit</Label>
              <select id="create-unit" name="unitId" required className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm" defaultValue="">
                <option value="" disabled>
                  Pilih unit
                </option>
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-date">Tanggal</Label>
                <Input id="create-date" name="troubleDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-time-off">Waktu Off</Label>
                <Input id="create-time-off" name="timeOff" type="time" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-time-on">Waktu On</Label>
                <Input id="create-time-on" name="timeOn" type="time" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-note">Keterangan</Label>
              <textarea id="create-note" name="note" className="min-h-28 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400" />
            </div>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending || unitOptions.length === 0} type="submit">
              Simpan Data
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "edit" && selectedRecord && canUpdate ? (
        <Modal title="Edit Data Trouble" description="Perbarui data trouble unit." onClose={() => setModal(null)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(updateTroubleRecordAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={String(selectedRecord.id)} />
            <div className="space-y-2">
              <Label htmlFor="edit-unit">Nama Unit</Label>
              <select id="edit-unit" name="unitId" required className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm" defaultValue={selectedRecord.unitId}>
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Tanggal</Label>
                <Input id="edit-date" name="troubleDate" type="date" defaultValue={String(selectedRecord.troubleDate).slice(0, 10)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time-off">Waktu Off</Label>
                <Input id="edit-time-off" name="timeOff" type="time" defaultValue={selectedRecord.timeOff} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time-on">Waktu On</Label>
                <Input id="edit-time-on" name="timeOn" type="time" defaultValue={selectedRecord.timeOn} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Keterangan</Label>
              <textarea id="edit-note" name="note" defaultValue={selectedRecord.note || ""} className="min-h-28 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400" />
            </div>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} type="submit">
              Update Data
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "delete" && selectedRecord && canDelete ? (
        <Modal title="Hapus Data Trouble" description="Aksi ini tidak dapat dibatalkan." onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(deleteTroubleRecordAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={String(selectedRecord.id)} />
            <p className="text-sm text-zinc-700">Yakin ingin menghapus data trouble unit {selectedRecord.unit?.name || "-"}?</p>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} variant="destructive" type="submit">
              Ya, Hapus Data
            </Button>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}