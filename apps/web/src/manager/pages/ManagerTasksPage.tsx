import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Trash2,
  Cpu,
  User,
  Calendar,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { tasksApi, equipmentApi, getSocket } from "@/lib/api";
import type { TaskDTO, TaskPriority, TaskStatus, CreateTaskInput } from "@man-u-ai/shared";

export function ManagerTasksPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [equipmentId, setEquipmentId] = useState("");
  const [shift, setShift] = useState("Morning");
  const [formError, setFormError] = useState("");

  // 1. Fetch Shift Tasks
  const {
    data: tasksResp,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["manager-tasks"],
    queryFn: async () => {
      const res = await tasksApi.list();
      if (res.data && "data" in res.data) {
        return res.data.data;
      }
      return [];
    },
    refetchInterval: 15_000,
  });

  const tasks: TaskDTO[] = tasksResp || [];

  // 2. Fetch Equipment for dropdown
  const { data: equipmentResp } = useQuery({
    queryKey: ["equipment-for-tasks"],
    queryFn: async () => {
      const res = await equipmentApi.list();
      return res.data?.data || [];
    },
  });
  const equipmentList: any[] = equipmentResp || [];

  // 3. Real-time updates via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTaskChange = () => {
      queryClient.invalidateQueries({ queryKey: ["manager-tasks"] });
    };

    socket.on("task:created", handleTaskChange);
    socket.on("task:updated", handleTaskChange);

    return () => {
      socket.off("task:created", handleTaskChange);
      socket.off("task:updated", handleTaskChange);
    };
  }, [queryClient]);

  // 4. Mutations
  const createTaskMutation = useMutation({
    mutationFn: (newTask: CreateTaskInput) => tasksApi.create(newTask),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-tasks"] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || "Failed to dispatch task.");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-tasks"] });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setEquipmentId("");
    setShift("Morning");
    setFormError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFormError("Title and description are required.");
      return;
    }

    const selectedEq = equipmentList.find((eq) => eq.id === equipmentId);

    createTaskMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      priority,
      equipmentId: equipmentId || undefined,
      equipmentName: selectedEq?.name,
      shift,
      assignedTo: "all",
      assignedToName: "All Field Engineers",
    });
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    return true;
  });

  // Summary counts
  const totalCount = tasks.length;
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Flame size={12} className="text-rose-400 animate-pulse" />
            Critical
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle size={12} className="text-amber-400" />
            High
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-zinc-700/50 text-zinc-400 border border-zinc-600/40">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 size={13} />
            Completed
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Clock size={13} className="animate-spin text-sky-400" />
            In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock size={13} />
            Pending Dispatch
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-canvas p-4 md:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ClipboardList className="text-primary w-6 h-6" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink font-serif">
              Shift Tasks & Floor Dispatch
            </h1>
            <span className="badge-primary text-2xs">Manager Control</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Assign shift tasks and maintenance directives. Tasks are immediately synchronized with all engineer mobile devices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="btn-secondary p-2.5"
            title="Refresh Tasks"
            disabled={isRefetching}
          >
            <RefreshCw size={15} className={isRefetching ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium shadow-md shadow-primary/20"
          >
            <Plus size={16} />
            Dispatch New Task
          </button>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-surface-1 border border-hairline rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-subtle uppercase tracking-wider font-semibold">Total Floor Tasks</p>
            <p className="text-2xl font-bold text-ink mt-1">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Layers size={20} />
          </div>
        </div>

        <div className="card bg-surface-1 border border-hairline rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-subtle uppercase tracking-wider font-semibold">Pending Floor</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{pendingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Clock size={20} />
          </div>
        </div>

        <div className="card bg-surface-1 border border-hairline rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-subtle uppercase tracking-wider font-semibold">In Progress</p>
            <p className="text-2xl font-bold text-sky-400 mt-1">{inProgressCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
            <Sparkles size={20} />
          </div>
        </div>

        <div className="card bg-surface-1 border border-hairline rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-subtle uppercase tracking-wider font-semibold">Completed Today</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{completedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card bg-surface-1 border border-hairline rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-ink-subtle">Status Filter:</span>
          {["all", "pending", "in_progress", "completed"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? "bg-primary text-white"
                  : "bg-surface-2 text-ink-subtle hover:text-ink"
              }`}
            >
              {st === "all" ? "All Tasks" : st === "in_progress" ? "In Progress" : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink-subtle">Priority:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-surface-2 border border-hairline text-ink text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-ink-subtle">
          <Loader2 className="animate-spin w-8 h-8 text-primary mb-3" />
          <p className="text-sm">Loading shift tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="card bg-surface-1 border border-hairline rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <ClipboardList className="w-12 h-12 text-ink-subtle mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-ink">No tasks found</h3>
          <p className="text-xs text-ink-subtle max-w-sm mt-1 mb-4">
            There are currently no tasks matching the selected filters. Dispatch a new task for floor engineers.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary text-xs px-3.5 py-1.5"
          >
            + Dispatch Shift Task
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="card bg-surface-1 border border-hairline hover:border-hairline-bright rounded-xl p-5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(task.priority)}
                    {task.shift && (
                      <span className="text-3xs text-ink-subtle bg-surface-2 px-2 py-0.5 rounded border border-hairline">
                        {task.shift} Shift
                      </span>
                    )}
                  </div>
                  {getStatusBadge(task.status)}
                </div>

                <h3 className="text-base font-bold text-ink mb-1.5 leading-snug">
                  {task.title}
                </h3>
                <p className="text-xs text-ink-subtle line-clamp-3 mb-4 leading-relaxed">
                  {task.description}
                </p>

                {task.equipmentName && (
                  <div className="flex items-center gap-1.5 text-xs text-primary mb-3 bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 w-fit">
                    <Cpu size={13} />
                    <span className="font-medium">{task.equipmentName}</span>
                  </div>
                )}

                {task.completionNotes && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 mb-3">
                    <span className="font-semibold block mb-0.5">Floor Completion Log:</span>
                    {task.completionNotes}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-hairline flex items-center justify-between mt-auto">
                <div className="flex flex-col text-3xs text-ink-subtle">
                  <span className="flex items-center gap-1">
                    <User size={11} /> {task.createdByName || "Operations Manager"}
                  </span>
                  <span className="flex items-center gap-1 mt-0.5">
                    <Calendar size={11} /> {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {task.status === "pending" && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: task.id, status: "in_progress" })}
                      className="px-2 py-1 rounded text-3xs font-medium bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-colors"
                      title="Mark In Progress"
                    >
                      Start
                    </button>
                  )}
                  {task.status !== "completed" && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: task.id, status: "completed" })}
                      className="px-2 py-1 rounded text-3xs font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                      title="Mark Completed"
                    >
                      Done
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this floor task?")) {
                        deleteTaskMutation.mutate(task.id);
                      }
                    }}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Task"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dispatch Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-surface-1 border border-hairline rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/20 text-primary">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">Dispatch Shift Task</h3>
                  <p className="text-2xs text-ink-subtle">Floor engineers will receive this task immediately.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-ink-subtle hover:text-ink text-sm p-1.5"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Task Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Inspect Compressor Valve C-04"
                  className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Detailed Instructions <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide precise inspection criteria, target metrics, or safety steps..."
                  className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-primary"
                  >
                    <option value="low">Low (Standard)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical (Immediate)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Shift</label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-primary"
                  >
                    <option value="Morning">Morning Shift</option>
                    <option value="Afternoon">Afternoon Shift</option>
                    <option value="Night">Night Shift</option>
                    <option value="All Shifts">All Shifts</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Target Machine / Equipment (Optional)
                </label>
                <select
                  value={equipmentId}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-primary"
                >
                  <option value="">-- General Plant Task --</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.model || eq.type || eq.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTaskMutation.isPending}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-xs font-semibold"
                >
                  {createTaskMutation.isPending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Dispatching...
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Dispatch to Floor
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
