"use server";

import { revalidatePath } from "next/cache";

import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canAssignRole, getRolePriority, getRolePriorityMap } from "@/lib/role-priority";

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"];

function normalizeTaskStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return TASK_STATUSES.includes(normalized) ? normalized : null;
}

async function validateAssignmentPermission({ assignerRole, assignedToUserId }) {
  const assignedTo = await prisma.user.findUnique({
    where: { id: assignedToUserId },
    select: { id: true, role: true },
  });

  if (!assignedTo) {
    return { error: "User penerima tugas tidak ditemukan." };
  }

  const rolePriorityMap = await getRolePriorityMap();
  if (!canAssignRole(rolePriorityMap, assignerRole, assignedTo.role)) {
    return { error: "Anda hanya dapat memberi tugas ke role dengan priority yang sama atau lebih rendah." };
  }

  return { assignedTo };
}

function parseDueDate(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return undefined;
  }

  return new Date(`${text}T00:00:00.000Z`);
}

export async function createTaskAction(formData) {
  const { session } = await requirePagePermission("tasks", "create");

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const assignedToId = String(formData.get("assignedToId") || "").trim();
  const dueDateRaw = String(formData.get("dueDate") || "").trim();

  if (!title) {
    return { error: "Judul tugas wajib diisi." };
  }

  if (!assignedToId) {
    return { error: "Penerima tugas wajib dipilih." };
  }

  const assignmentPermission = await validateAssignmentPermission({
    assignerRole: session.user.role,
    assignedToUserId: assignedToId,
  });

  if (assignmentPermission.error) {
    return { error: assignmentPermission.error };
  }

  await prisma.task.create({
    data: {
      title,
      description: description || null,
      status: "TODO",
      dueDate: dueDateRaw ? new Date(`${dueDateRaw}T00:00:00.000Z`) : null,
      assignedById: session.user.id,
      assignedToId,
    },
  });

  revalidatePath("/dashboard/tugas");
  return { success: true };
}

export async function moveTaskAction(formData) {
  const { session, evaluator } = await requirePagePermission("tasks", "update");

  const taskId = String(formData.get("taskId") || "").trim();
  const nextStatus = normalizeTaskStatus(formData.get("nextStatus"));

  if (!taskId) {
    return { error: "Task ID tidak valid." };
  }

  if (!nextStatus) {
    return { error: "Status tujuan tidak valid." };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      assignedById: true,
      assignedToId: true,
    },
  });

  if (!task) {
    return { error: "Tugas tidak ditemukan." };
  }

  const canUpdateTask =
    evaluator.isHighestPriority ||
    task.assignedById === session.user.id ||
    task.assignedToId === session.user.id;

  if (!canUpdateTask) {
    return { error: "Anda tidak memiliki akses mengubah status tugas ini." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status: nextStatus },
  });

  revalidatePath("/dashboard/tugas");
  return { success: true };
}

export async function updateTaskAction(formData) {
  const { session } = await requirePagePermission("tasks", "update");

  const taskId = String(formData.get("taskId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const assignedToId = String(formData.get("assignedToId") || "").trim();
  const status = normalizeTaskStatus(formData.get("status"));
  const dueDate = parseDueDate(formData.get("dueDate"));

  if (!taskId) {
    return { error: "Task ID tidak valid." };
  }

  if (!title) {
    return { error: "Judul tugas wajib diisi." };
  }

  if (!assignedToId) {
    return { error: "Penerima tugas wajib dipilih." };
  }

  if (!status) {
    return { error: "Status tugas tidak valid." };
  }

  if (dueDate === undefined) {
    return { error: "Format tanggal deadline tidak valid." };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      assignedBy: {
        select: {
          id: true,
          role: true,
        },
      },
    },
  });

  if (!task) {
    return { error: "Tugas tidak ditemukan." };
  }

  const rolePriorityMap = await getRolePriorityMap();
  const editorPriority = getRolePriority(rolePriorityMap, session.user.role);
  const creatorPriority = getRolePriority(rolePriorityMap, task.assignedBy.role);

  if (editorPriority < creatorPriority) {
    return { error: "Task hanya bisa diedit oleh role dengan priority sama atau lebih tinggi dari pembuat." };
  }

  const assignmentPermission = await validateAssignmentPermission({
    assignerRole: session.user.role,
    assignedToUserId: assignedToId,
  });

  if (assignmentPermission.error) {
    return { error: assignmentPermission.error };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: description || null,
      assignedToId,
      status,
      dueDate,
    },
  });

  revalidatePath("/dashboard/tugas");
  return { success: true };
}

export async function deleteTaskAction(formData) {
  const { session, evaluator } = await requirePagePermission("tasks", "delete");

  const taskId = String(formData.get("taskId") || "").trim();
  if (!taskId) {
    return { error: "Task ID tidak valid." };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      assignedById: true,
    },
  });

  if (!task) {
    return { error: "Tugas tidak ditemukan." };
  }

  if (!evaluator.isHighestPriority && task.assignedById !== session.user.id) {
    return { error: "Hanya pembuat tugas atau role tertinggi yang dapat menghapus tugas." };
  }

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath("/dashboard/tugas");
  return { success: true };
}
