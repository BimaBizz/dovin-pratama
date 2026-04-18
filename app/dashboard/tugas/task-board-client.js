"use client";

import { useMemo, useState, useTransition } from "react";

import { createTaskAction, deleteTaskAction, moveTaskAction, updateTaskAction } from "@/app/dashboard/tugas/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const COLUMN_DEFS = [
  { key: "TODO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "DONE", label: "Done" },
];

function formatDateLabel(dateText) {
  if (!dateText) {
    return "-";
  }

  return new Date(`${dateText}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function TaskBoardClient({
  tasks = [],
  assignableUsers = [],
  currentUser,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}) {
  const [pending, startTransition] = useTransition();
  const [taskList, setTaskList] = useState(tasks);
  const [dragTaskId, setDragTaskId] = useState("");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [message, setMessage] = useState("");

  const tasksByColumn = useMemo(() => {
    return COLUMN_DEFS.reduce((accumulator, column) => {
      accumulator[column.key] = taskList.filter((task) => task.status === column.key);
      return accumulator;
    }, {});
  }, [taskList]);

  function handleCreateTask(event) {
    event.preventDefault();

    if (!canCreate) {
      setMessage("Anda tidak memiliki akses membuat tugas.");
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setMessage("");
      const result = await createTaskAction(formData);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      window.location.reload();
    });
  }

  function handleDrop(columnKey) {
    if (!dragTaskId || !canUpdate) {
      return;
    }

    const draggedTask = taskList.find((task) => task.id === dragTaskId);
    if (!draggedTask || draggedTask.status === columnKey) {
      setDragTaskId("");
      return;
    }

    setTaskList((previous) =>
      previous.map((task) => (task.id === dragTaskId ? { ...task, status: columnKey } : task))
    );

    const payload = new FormData();
    payload.set("taskId", dragTaskId);
    payload.set("nextStatus", columnKey);

    startTransition(async () => {
      const result = await moveTaskAction(payload);

      if (result?.error) {
        setMessage(result.error);
        setTaskList(tasks);
      }
    });

    setDragTaskId("");
  }

  function handleDeleteTask(taskId) {
    if (!canDelete) {
      setMessage("Anda tidak memiliki akses menghapus tugas.");
      return;
    }

    const payload = new FormData();
    payload.set("taskId", taskId);

    startTransition(async () => {
      const result = await deleteTaskAction(payload);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setTaskList((previous) => previous.filter((task) => task.id !== taskId));
    });
  }

  function startEditTask(task) {
    setEditingTaskId(task.id);
    setMessage("");
  }

  function cancelEditTask() {
    setEditingTaskId("");
  }

  function handleUpdateTask(event, taskId) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    formData.set("taskId", taskId);

    startTransition(async () => {
      const result = await updateTaskAction(formData);

      if (result?.error) {
        setMessage(result.error);
        return;
      }

      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Board Tugas</CardTitle>
          <CardDescription>
            User hanya dapat memberi tugas kepada role dengan priority yang sama atau lebih rendah.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
            <Badge variant="outline">Role: {currentUser.role}</Badge>
            <Badge variant="outline">Priority: {currentUser.priority}</Badge>
          </div>

          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateTask}>
            <Input name="title" placeholder="Judul tugas" required disabled={!canCreate || pending} />
            <select
              name="assignedToId"
              required
              disabled={!canCreate || pending}
              className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">Pilih penerima tugas</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role} · P{user.priority})
                </option>
              ))}
            </select>
            <Input name="dueDate" type="date" disabled={!canCreate || pending} />
            <Input name="description" placeholder="Deskripsi singkat (opsional)" disabled={!canCreate || pending} />
            <div className="md:col-span-2">
              <Button type="submit" disabled={!canCreate || pending}>
                {pending ? "Menyimpan..." : "Buat Tugas"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMN_DEFS.map((column) => (
          <Card
            key={column.key}
            className="min-h-90"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(column.key)}
          >
            <CardHeader>
              <CardTitle className="text-base">{column.label}</CardTitle>
              <CardDescription>{tasksByColumn[column.key]?.length || 0} tugas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(tasksByColumn[column.key] || []).map((task) => (
                <article
                  key={task.id}
                  draggable={canUpdate}
                  onDragStart={() => setDragTaskId(task.id)}
                  className="cursor-grab rounded-md border border-zinc-200 bg-zinc-50 p-3 active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">{task.title}</h3>
                    <div className="flex items-center gap-1">
                      {canUpdate && currentUser.priority >= task.assignedBy.priority ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => startEditTask(task)}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {task.description ? <p className="mt-1 text-xs text-zinc-600">{task.description}</p> : null}

                  <div className="mt-2 space-y-1 text-xs text-zinc-600">
                    <p>Penerima: {task.assignedTo.name}</p>
                    <p>Pemberi: {task.assignedBy.name}</p>
                    <p>Deadline: {formatDateLabel(task.dueDate)}</p>
                  </div>

                  {editingTaskId === task.id ? (
                    <form className="mt-3 space-y-2" onSubmit={(event) => handleUpdateTask(event, task.id)}>
                      <Input name="title" defaultValue={task.title} required disabled={pending} />
                      <Input name="description" defaultValue={task.description || ""} disabled={pending} placeholder="Deskripsi" />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          name="assignedToId"
                          defaultValue={task.assignedTo.id}
                          className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                          disabled={pending}
                        >
                          {assignableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.role} · P{user.priority})
                            </option>
                          ))}
                        </select>
                        <select
                          name="status"
                          defaultValue={task.status}
                          className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                          disabled={pending}
                        >
                          {COLUMN_DEFS.map((statusOption) => (
                            <option key={statusOption.key} value={statusOption.key}>
                              {statusOption.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input name="dueDate" type="date" defaultValue={task.dueDate || ""} disabled={pending} />
                      <div className="flex items-center gap-2">
                        <Button type="submit" className="h-8 px-3 text-xs" disabled={pending}>
                          {pending ? "Menyimpan..." : "Simpan"}
                        </Button>
                        <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={cancelEditTask} disabled={pending}>
                          Batal
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </article>
              ))}

              {(tasksByColumn[column.key] || []).length === 0 ? (
                <p className="rounded-md border border-dashed border-zinc-200 p-3 text-xs text-zinc-500">
                  Belum ada tugas.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {message ? <p className="text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
