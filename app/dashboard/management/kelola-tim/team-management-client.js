"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PenSquare, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { createTeamAction, deleteTeamAction, updateTeamAction } from "@/app/dashboard/management/kelola-tim/actions";
import { TEAM_LEADER_ROLE } from "@/app/dashboard/management/kelola-tim/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function Modal({ title, description, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white shadow-xl">
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

function getUserDisplayName(user) {
  return user.fullName || user.email;
}

export default function TeamManagementClient({
  teams = [],
  leaderCandidates = [],
  memberCandidates = [],
  teamUsage = [],
  pagination,
  search = "",
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
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  const selectedTeam = useMemo(() => {
    if (!modal?.teamId) {
      return null;
    }

    return teams.find((team) => team.id === modal.teamId) || null;
  }, [modal, teams]);

  const usageByTeamId = useMemo(() => {
    const map = new Map();

    for (const team of teamUsage) {
      map.set(team.id, {
        leaderId: team.leaderId,
        memberIds: team.members.map((member) => member.userId),
      });
    }

    return map;
  }, [teamUsage]);

  const globallyUsedUserIds = useMemo(() => {
    const leaderIds = new Set();
    const memberIds = new Set();

    for (const team of teamUsage) {
      leaderIds.add(team.leaderId);
      for (const member of team.members) {
        memberIds.add(member.userId);
      }
    }

    return { leaderIds, memberIds };
  }, [teamUsage]);

  const availableCreateLeaders = useMemo(() => {
    return leaderCandidates.filter(
      (candidate) =>
        !globallyUsedUserIds.leaderIds.has(candidate.id) &&
        !globallyUsedUserIds.memberIds.has(candidate.id)
    );
  }, [leaderCandidates, globallyUsedUserIds]);

  const availableCreateMembers = useMemo(() => {
    if (!selectedLeaderId) {
      return [];
    }

    return memberCandidates.filter(
      (candidate) =>
        candidate.id !== selectedLeaderId &&
        !globallyUsedUserIds.leaderIds.has(candidate.id) &&
        !globallyUsedUserIds.memberIds.has(candidate.id)
    );
  }, [memberCandidates, selectedLeaderId, globallyUsedUserIds]);

  const availableEditLeaders = useMemo(() => {
    if (!selectedTeam || modal?.type !== "edit") {
      return [];
    }

    const currentUsage = usageByTeamId.get(selectedTeam.id) || { leaderId: "", memberIds: [] };
    const currentMemberIds = new Set(currentUsage.memberIds);

    return leaderCandidates.filter((candidate) => {
      if (candidate.id === currentUsage.leaderId) {
        return true;
      }

      return (
        !globallyUsedUserIds.leaderIds.has(candidate.id) &&
        !globallyUsedUserIds.memberIds.has(candidate.id) &&
        !currentMemberIds.has(candidate.id)
      );
    });
  }, [selectedTeam, modal, usageByTeamId, leaderCandidates, globallyUsedUserIds]);

  const availableEditMembers = useMemo(() => {
    if (!selectedTeam || modal?.type !== "edit" || !selectedLeaderId) {
      return [];
    }

    const currentUsage = usageByTeamId.get(selectedTeam.id) || { leaderId: "", memberIds: [] };
    const currentMemberIds = new Set(currentUsage.memberIds);

    return memberCandidates.filter((candidate) => {
      if (candidate.id === selectedLeaderId) {
        return false;
      }

      if (currentMemberIds.has(candidate.id)) {
        return true;
      }

      return (
        !globallyUsedUserIds.leaderIds.has(candidate.id) &&
        !globallyUsedUserIds.memberIds.has(candidate.id)
      );
    });
  }, [selectedTeam, modal, selectedLeaderId, usageByTeamId, memberCandidates, globallyUsedUserIds]);

  const startNumber = pagination ? (pagination.currentPage - 1) * pagination.pageSize + 1 : 1;

  function submitWithAction(action, formData) {
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

  function closeModal() {
    setModal(null);
    setSelectedLeaderId("");
    setSelectedMemberIds([]);
  }

  function openCreateModal() {
    setMessage("");
    setSelectedLeaderId("");
    setSelectedMemberIds([]);
    setModal({ type: "create" });
  }

  function openEditModal(team) {
    setMessage("");
    setSelectedLeaderId(team.leader.id);
    setSelectedMemberIds(team.members.map((member) => member.userId));
    setModal({ type: "edit", teamId: team.id });
  }

  function handleLeaderChange(nextLeaderId) {
    setSelectedLeaderId(nextLeaderId);
    setSelectedMemberIds((previous) => previous.filter((memberId) => memberId !== nextLeaderId));
  }

  function handleMemberToggle(userId, checked) {
    setSelectedMemberIds((previous) => {
      if (checked) {
        return previous.includes(userId) ? previous : [...previous, userId];
      }

      return previous.filter((id) => id !== userId);
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
          <CardTitle>Kelola Tim</CardTitle>
          <CardDescription>
            Buat, edit, dan hapus tim. Leader wajib role {TEAM_LEADER_ROLE} dan user tidak bisa dipakai dua kali di tim berbeda.
          </CardDescription>
        </div>
        {canCreate ? (
          <Button type="button" onClick={openCreateModal}>
            <Plus />
            Buat Tim
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearchSubmit}>
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Cari tim, leader, atau anggota..."
            className="sm:max-w-sm"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Leader tersedia: <span className="font-semibold">{availableCreateLeaders.length}</span>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Anggota tersedia: <span className="font-semibold">{memberCandidates.filter((user) => !globallyUsedUserIds.leaderIds.has(user.id) && !globallyUsedUserIds.memberIds.has(user.id)).length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-2 py-3">No</th>
                <th className="px-2 py-3">Nama Tim</th>
                <th className="px-2 py-3">Leader</th>
                <th className="px-2 py-3">Jumlah Anggota</th>
                <th className="px-2 py-3">Anggota Tim</th>
                <th className="px-2 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, index) => (
                <tr key={team.id} className="border-b border-zinc-100">
                  <td className="px-2 py-3 text-zinc-500">{startNumber + index}</td>
                  <td className="px-2 py-3 font-medium text-zinc-900">{team.name}</td>
                  <td className="px-2 py-3 text-zinc-700">{getUserDisplayName(team.leader)}</td>
                  <td className="px-2 py-3 text-zinc-700">{team.members.length}</td>
                  <td className="px-2 py-3 text-zinc-700">
                    {team.members.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {team.members.map((member) => (
                          <Badge key={member.userId} variant="primary" className="text-xs">
                            {getUserDisplayName(member.user)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="ml-2">-</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="outline" type="button" onClick={() => openEditModal(team)}>
                          <PenSquare />
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          type="button"
                          onClick={() => setModal({ type: "delete", teamId: team.id })}
                        >
                          <Trash2 />
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {teams.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-zinc-500" colSpan={6}>
                    Belum ada tim.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600">
              Menampilkan {teams.length === 0 ? 0 : startNumber} - {startNumber + teams.length - 1} dari {pagination.totalTeams} data
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pagination.currentPage <= 1}
                onClick={() => router.push(buildPageHref(search, Math.max(pagination.currentPage - 1, 1)))}
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
                onClick={() => router.push(buildPageHref(search, pagination.currentPage + 1))}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        ) : null}

        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </CardContent>

      {modal?.type === "create" && canCreate ? (
        <Modal
          title="Buat Tim"
          description="Pilih leader, lalu pilih anggota tim (minimal 1 user)."
          onClose={closeModal}
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(createTeamAction, new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="create-team-name">Nama Tim</Label>
              <Input id="create-team-name" name="name" placeholder="Contoh: Tim Area Barat" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-team-leader">Leader Tim</Label>
              <select
                id="create-team-leader"
                name="leaderId"
                required
                disabled={availableCreateLeaders.length === 0}
                value={selectedLeaderId}
                onChange={(event) => handleLeaderChange(event.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Pilih leader tim</option>
                {availableCreateLeaders.map((user) => (
                  <option key={user.id} value={user.id}>
                    {getUserDisplayName(user)} ({user.email})
                  </option>
                ))}
              </select>
              {availableCreateLeaders.length === 0 ? (
                <p className="text-xs text-zinc-500">Tidak ada leader tersedia.</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Anggota Tim</Label>
              {!selectedLeaderId ? (
                <p className="text-xs text-zinc-500">Pilih leader tim terlebih dahulu.</p>
              ) : availableCreateMembers.length === 0 ? (
                <p className="text-xs text-zinc-500">Tidak ada anggota tersedia untuk dipilih.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-zinc-200 p-3">
                  {availableCreateMembers.map((member) => (
                    <label key={member.id} className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        name="memberIds"
                        value={member.id}
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={(event) => handleMemberToggle(member.id, event.target.checked)}
                        className="h-4 w-4"
                      />
                      <span>
                        {getUserDisplayName(member)} ({member.role})
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {selectedLeaderId && selectedMemberIds.length === 0 ? (
                <p className="text-xs text-zinc-500">Pilih minimal 1 anggota tim.</p>
              ) : null}
            </div>

            {message ? <p className="text-sm text-red-600">{message}</p> : null}

            <Button
              className="w-full"
              disabled={pending || !selectedLeaderId || selectedMemberIds.length === 0}
              type="submit"
            >
              Simpan Tim
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "edit" && selectedTeam && canUpdate ? (
        <Modal title="Edit Tim" description="Perbarui nama tim, leader, dan anggota tim." onClose={closeModal}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(updateTeamAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={selectedTeam.id} />

            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Nama Tim</Label>
              <Input id="edit-team-name" name="name" defaultValue={selectedTeam.name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-team-leader">Leader Tim</Label>
              <select
                id="edit-team-leader"
                name="leaderId"
                required
                value={selectedLeaderId}
                onChange={(event) => handleLeaderChange(event.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
              >
                <option value="">Pilih leader tim</option>
                {availableEditLeaders.map((user) => (
                  <option key={user.id} value={user.id}>
                    {getUserDisplayName(user)} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Anggota Tim</Label>
              {!selectedLeaderId ? (
                <p className="text-xs text-zinc-500">Pilih leader tim terlebih dahulu.</p>
              ) : availableEditMembers.length === 0 ? (
                <p className="text-xs text-zinc-500">Tidak ada anggota tersedia untuk dipilih.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-zinc-200 p-3">
                  {availableEditMembers.map((member) => (
                    <label key={member.id} className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        name="memberIds"
                        value={member.id}
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={(event) => handleMemberToggle(member.id, event.target.checked)}
                        className="h-4 w-4"
                      />
                      <span>
                        {getUserDisplayName(member)} ({member.role})
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {selectedLeaderId && selectedMemberIds.length === 0 ? (
                <p className="text-xs text-zinc-500">Pilih minimal 1 anggota tim.</p>
              ) : null}
            </div>

            {message ? <p className="text-sm text-red-600">{message}</p> : null}

            <Button
              className="w-full"
              disabled={pending || !selectedLeaderId || selectedMemberIds.length === 0}
              type="submit"
            >
              Update Tim
            </Button>
          </form>
        </Modal>
      ) : null}

      {modal?.type === "delete" && selectedTeam && canDelete ? (
        <Modal title="Hapus Tim" description="Leader dan anggota tim akan kembali tersedia." onClose={closeModal}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitWithAction(deleteTeamAction, new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={selectedTeam.id} />
            <p className="text-sm text-zinc-700">Yakin ingin menghapus tim {selectedTeam.name}?</p>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button className="w-full" disabled={pending} variant="destructive" type="submit">
              Ya, Hapus Tim
            </Button>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}
