import TaskBoardClient from "@/app/dashboard/tugas/task-board-client";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getRolePriority, getRolePriorityMap } from "@/lib/role-priority";

export const metadata = {
  title: "Tugas",
  description: "Kanban tugas dengan drag and drop",
};

function formatDateOnly(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function normalizeTask(task) {
  const rolePriorityMap = task.__rolePriorityMap;

  return {
    id: task.id,
    title: task.title,
    description: task.description || "",
    status: task.status,
    dueDate: formatDateOnly(task.dueDate),
    createdAt: task.createdAt.toISOString(),
    assignedBy: {
      id: task.assignedBy.id,
      name: task.assignedBy.fullName || task.assignedBy.email,
      role: task.assignedBy.role,
      priority: getRolePriority(rolePriorityMap, task.assignedBy.role),
    },
    assignedTo: {
      id: task.assignedTo.id,
      name: task.assignedTo.fullName || task.assignedTo.email,
      role: task.assignedTo.role,
      priority: getRolePriority(rolePriorityMap, task.assignedTo.role),
    },
  };
}

export default async function TugasPage() {
  const { session, evaluator } = await requirePagePermission("tasks", "view");

  const rolePriorityMap = await getRolePriorityMap();
  const viewerPriority = getRolePriority(rolePriorityMap, session.user.role);

  const users = await prisma.user.findMany({
    where: {
      role: {
        not: "SUPERUSER",
      },
    },
    orderBy: [{ fullName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  });

  const assignableUsers = users
    .filter((user) => getRolePriority(rolePriorityMap, user.role) <= viewerPriority)
    .map((user) => ({
      id: user.id,
      name: user.fullName || user.email,
      email: user.email,
      role: user.role,
      priority: getRolePriority(rolePriorityMap, user.role),
    }));

  const tasks = await prisma.task.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      dueDate: true,
      createdAt: true,
      assignedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  const visibleTasks = tasks.filter((task) => {
    const assigneePriority = getRolePriority(rolePriorityMap, task.assignedTo.role);
    const isTaskOwner = task.assignedBy.id === session.user.id || task.assignedTo.id === session.user.id;

    return isTaskOwner || assigneePriority <= viewerPriority;
  });

  return (
    <TaskBoardClient
      tasks={visibleTasks.map((task) => normalizeTask({ ...task, __rolePriorityMap: rolePriorityMap }))}
      assignableUsers={assignableUsers}
      currentUser={{
        id: session.user.id,
        role: session.user.role,
        priority: viewerPriority,
      }}
      canCreate={evaluator.canCrud("tasks", "create")}
      canUpdate={evaluator.canCrud("tasks", "update")}
      canDelete={evaluator.canCrud("tasks", "delete")}
    />
  );
}
