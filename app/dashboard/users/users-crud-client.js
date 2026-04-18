"use client";

import { useMemo, useState, useTransition } from "react";
import { PenSquare, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { createUserAction, deleteUserAction, updateUserAction } from "@/app/dashboard/users/actions";
import { Badge } from "@/components/ui/badge";
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
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        <div className="flex justify-end border-t border-zinc-200 px-4 py-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}

function buildPageHref(search, page) {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `?${query}` : "?";
}

function formatDate(date) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(date));
}

const documentFields = [
  { key: "ktp", label: "KTP" },
  { key: "kk", label: "KK" },
  { key: "ijazah", label: "Ijasah" },
  { key: "skck", label: "SKCK" },
];

const MAX_DOCUMENT_SIZE_BYTES = 2 * 1024 * 1024;

function renderDocumentLink(userId, docType, path, name) {
  if (!path) {
    return <span className="text-zinc-400">-</span>;
  }

  const fileName = name || path.split("/").pop() || "Dokumen";
  const href = `/api/dashboard/users/${userId}/documents/${docType}`;

  return (
    <a className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700" href={href} target="_blank" rel="noreferrer">
      {fileName}
    </a>
  );
}

function DocumentUploadFields({ prefix, existingDocument, userId }) {
  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-900">Dokumen</p>
        <p className="mt-1 text-xs text-zinc-500">Format PDF/JPG/PNG, maksimal 2 MB per file.</p>
      </div>
      {documentFields.map((field) => {
        const currentName = existingDocument ? existingDocument[`${field.key}Name`] : null;
        const currentPath = existingDocument ? existingDocument[`${field.key}Path`] : null;

        return (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`${prefix}-${field.key}`}>{field.label}</Label>
            {currentPath && userId ? (
              <p className="text-xs text-zinc-500">
                Saat ini: {renderDocumentLink(userId, field.key, currentPath, currentName)}
              </p>
            ) : null}
            <Input id={`${prefix}-${field.key}`} name={field.key} type="file" accept=".pdf,.jpg,.jpeg,.png" />
          </div>
        );
      })}
    </div>
  );
}

export default function UsersCrudClient({
  users,
  roleOptions = [],
  initError = "",
  pagination,
  search = "",
  viewerPriority = 0,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(initError);
  const [searchValue, setSearchValue] = useState(() => search);

  const canSubmitRole = roleOptions.length > 0;

  const selectedUser = useMemo(() => {
    if (!modal?.userId) {
      return null;
    }
    return users.find((user) => user.id === modal.userId) || null;
  }, [modal, users]);

  const editRoleOptions = useMemo(() => {
    return roleOptions;
  }, [roleOptions]);

  const startNumber = pagination ? (pagination.currentPage - 1) * pagination.pageSize + 1 : 1;

  function submitWithAction(action, formData) {
    for (const field of documentFields) {
      const file = formData.get(field.key);
      if (file && typeof file === "object" && "size" in file && file.size > MAX_DOCUMENT_SIZE_BYTES) {
        setMessage(`${field.label} maksimal 2 MB.`);
        return;
      }
    }

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

    router.push(params.toString() ? `?${params.toString()}` : "?");
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>CRUD User</CardTitle>
          <CardDescription>Kelola data user menggunakan popup create, update, dan delete.</CardDescription>
        </div>
        {canCreate ? (
          <Button type="button" onClick={() => setModal({ type: "create" })}>
            <Plus />
            Tambah User
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <form className="mb-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSearchSubmit}>
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Cari nama, email, role, alamat..."
            className="sm:max-w-sm"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-2 py-3">No</th>
                <th className="px-2 py-3">Nama Lengkap</th>
                <th className="px-2 py-3">Email</th>
                <th className="px-2 py-3">Tempat Lahir</th>
                <th className="px-2 py-3">Tanggal Lahir</th>
                <th className="px-2 py-3">Alamat</th>
                <th className="px-2 py-3">Role</th>
                <th className="px-2 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.id} className="border-b border-zinc-100">
                  <td className="px-2 py-3 text-zinc-500">{startNumber + index}</td>
                  <td className="px-2 py-3 font-medium text-zinc-900">{user.fullName || "-"}</td>
                  <td className="px-2 py-3 font-medium text-zinc-900">{user.email}</td>
                  <td className="px-2 py-3 text-zinc-700">{user.birthPlace || "-"}</td>
                  <td className="px-2 py-3 text-zinc-700">{formatDate(user.birthDate)}</td>
                  <td className="px-2 py-3 text-zinc-700">{user.address || "-"}</td>
                  <td className="px-2 py-3">
                    <Badge variant={user.role === "SUPERUSER" ? "default" : "secondary"}>{user.role}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            disabled={user.priority > viewerPriority}
                            onClick={() => {
                              if (user.priority > viewerPriority) {
                                return;
                              }

                              setModal({ type: "edit", userId: user.id });
                            }}
                          >
                          <PenSquare />
                            {user.priority > viewerPriority ? "Tidak Bisa Diedit" : "Edit"}
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          type="button"
                          disabled={user.role === "SUPERUSER"}
                          onClick={() => setModal({ type: "delete", userId: user.id })}
                        >
                          <Trash2 />
                          {user.role === "SUPERUSER" ? "Tidak Bisa Dihapus" : "Hapus"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600">
              Menampilkan {users.length === 0 ? 0 : startNumber} - {startNumber + users.length - 1} dari {pagination.totalUsers} data
            </p>
            <div className="flex items-center gap-2">
                <Button type="button" variant="outline" disabled={pagination.currentPage <= 1} onClick={() => router.push(buildPageHref(search, Math.max(pagination.currentPage - 1, 1)))}>
                  Sebelumnya
                </Button>
              <span className="text-sm text-zinc-600">
                Halaman {pagination.currentPage} dari {pagination.totalPages}
              </span>
                <Button type="button" variant="outline" disabled={pagination.currentPage >= pagination.totalPages} onClick={() => router.push(buildPageHref(search, pagination.currentPage + 1))}>
                  Berikutnya
                </Button>
            </div>
          </div>
        ) : null}

        {/* <div className="mt-6 border-t border-zinc-200 pt-6">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-zinc-900">Tabel Dokumen User</h3>
            <p className="text-sm text-zinc-500">Dokumen terikat ke UUID user agar tidak tertukar antar akun.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-2 py-3">No</th>
                  <th className="px-2 py-3">Nama</th>
                  <th className="px-2 py-3">KTP</th>
                  <th className="px-2 py-3">KK</th>
                  <th className="px-2 py-3">Ijasah</th>
                  <th className="px-2 py-3">SKCK</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={`${user.id}-documents`} className="border-b border-zinc-100">
                    <td className="px-2 py-3 text-zinc-500">{startNumber + index}</td>
                    <td className="px-2 py-3 font-medium text-zinc-900">{user.fullName || user.email}</td>
                    <td className="px-2 py-3">{renderDocumentLink(user.id, "ktp", user.userDocument?.ktpPath, user.userDocument?.ktpName)}</td>
                    <td className="px-2 py-3">{renderDocumentLink(user.id, "kk", user.userDocument?.kkPath, user.userDocument?.kkName)}</td>
                    <td className="px-2 py-3">{renderDocumentLink(user.id, "ijazah", user.userDocument?.ijazahPath, user.userDocument?.ijazahName)}</td>
                    <td className="px-2 py-3">{renderDocumentLink(user.id, "skck", user.userDocument?.skckPath, user.userDocument?.skckName)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div> */}
      </CardContent>

      {modal?.type === "create" && canCreate ? (
        <Modal title="Tambah User" description="Buat akun user baru." onClose={() => setModal(null)}>
          <form
            className="space-y-4"
            encType="multipart/form-data"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(createUserAction, new FormData(event.currentTarget));
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="create-full-name">Nama Lengkap</Label>
                  <Input id="create-full-name" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-birth-place">Tempat Lahir</Label>
                  <Input id="create-birth-place" name="birthPlace" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-birth-date">Tanggal Lahir</Label>
                  <Input id="create-birth-date" name="birthDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-address">Alamat</Label>
                  <textarea
                    id="create-address"
                    name="address"
                    required
                    className="min-h-28 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input id="create-email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">Password</Label>
                  <Input id="create-password" name="password" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-role">Role</Label>
                  <select
                    id="create-role"
                    name="role"
                    defaultValue={roleOptions[0] || ""}
                    disabled={!canSubmitRole}
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                  >
                    {canSubmitRole ? (
                      roleOptions.map((roleName) => (
                        <option key={roleName} value={roleName}>
                          {roleName}
                        </option>
                      ))
                    ) : (
                      <option value="">Role belum tersedia</option>
                    )}
                  </select>
                </div>
              </div>
              <DocumentUploadFields prefix="create-document" />
            </div>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending || !canSubmitRole} type="submit">
              Simpan User
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "edit" && selectedUser && canUpdate ? (
        <Modal title="Edit User" description="Perbarui email, role, atau password user." onClose={() => setModal(null)}>
          <form
            className="space-y-4"
            encType="multipart/form-data"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(updateUserAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={String(selectedUser.id)} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-full-name">Nama Lengkap</Label>
                  <Input id="edit-full-name" name="fullName" defaultValue={selectedUser.fullName || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-birth-place">Tempat Lahir</Label>
                  <Input id="edit-birth-place" name="birthPlace" defaultValue={selectedUser.birthPlace || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-birth-date">Tanggal Lahir</Label>
                  <Input
                    id="edit-birth-date"
                    name="birthDate"
                    type="date"
                    defaultValue={selectedUser.birthDate ? new Date(selectedUser.birthDate).toISOString().slice(0, 10) : ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Alamat</Label>
                  <Input id="edit-address" name="address" defaultValue={selectedUser.address || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" name="email" type="email" defaultValue={selectedUser.email} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Password Baru (opsional)</Label>
                  <Input id="edit-password" name="password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <select
                    id="edit-role"
                    name="role"
                    defaultValue={selectedUser.role}
                    disabled={editRoleOptions.length === 0}
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                  >
                    {editRoleOptions.length > 0 ? (
                      editRoleOptions.map((roleName) => (
                        <option key={roleName} value={roleName}>
                          {roleName}
                        </option>
                      ))
                    ) : (
                      <option value={selectedUser.role}>{selectedUser.role}</option>
                    )}
                  </select>
                </div>
              </div>
              <DocumentUploadFields prefix="edit-document" existingDocument={selectedUser.userDocument} userId={selectedUser.id} />
            </div>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending || editRoleOptions.length === 0} type="submit">
              Update User
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "delete" && selectedUser && canDelete ? (
        <Modal title="Hapus User" description="Aksi ini tidak dapat dibatalkan." onClose={() => setModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(deleteUserAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={String(selectedUser.id)} />
            <p className="text-sm text-zinc-700">Yakin ingin menghapus user {selectedUser.email}?</p>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} variant="destructive" type="submit">
              Ya, Hapus User
            </Button>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}
