export type ActionType = "FOLLOW_UP" | "REACH_OUT" | "CALLBACK" | "OTHER";
export type ActionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const ACTION_TYPES: ActionType[] = ["FOLLOW_UP", "REACH_OUT", "CALLBACK", "OTHER"];
export const ACTION_STATUSES: ActionStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export interface Action {
  id: string;
  customerId: string;
  callId: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  type: ActionType;
  notes: string | null;
  dueDate: string | null;
  status: ActionStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateActionInput {
  customerId: string;
  callId?: string | null;
  assignedAgentId?: string | null;
  type?: ActionType;
  notes?: string | null;
  dueDate?: string | null;
}

export interface UpdateActionInput {
  assignedAgentId?: string | null;
  type?: ActionType;
  notes?: string | null;
  dueDate?: string | null;
  status?: ActionStatus;
}
