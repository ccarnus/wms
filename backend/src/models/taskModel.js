const TASK_TYPES = Object.freeze(["pick", "putaway", "replenish", "count"]);
const TASK_STATUSES = Object.freeze([
  "created",
  "assigned",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
  "failed"
]);

class Task {
  constructor({
    id,
    type,
    priority,
    status,
    zoneId,
    assignedOperatorId,
    sourceDocumentId,
    estimatedTimeSeconds,
    actualTimeSeconds,
    version,
    startedAt,
    completedAt,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.type = type;
    this.priority = priority;
    this.status = status;
    this.zoneId = zoneId;
    this.assignedOperatorId = assignedOperatorId;
    this.sourceDocumentId = sourceDocumentId;
    this.estimatedTimeSeconds = estimatedTimeSeconds;
    this.actualTimeSeconds = actualTimeSeconds;
    this.version = version;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static fromRow(row) {
    if (!row) {
      return null;
    }

    return new Task({
      id: row.id,
      type: row.type,
      priority: Number(row.priority),
      status: row.status,
      zoneId: row.zone_id ?? row.zoneId,
      assignedOperatorId: row.assigned_operator_id ?? row.assignedOperatorId ?? null,
      sourceDocumentId: row.source_document_id ?? row.sourceDocumentId,
      estimatedTimeSeconds: Number(row.estimated_time_seconds ?? row.estimatedTimeSeconds),
      actualTimeSeconds: row.actual_time_seconds ?? row.actualTimeSeconds,
      version: Number(row.version),
      startedAt: row.started_at ?? row.startedAt ?? null,
      completedAt: row.completed_at ?? row.completedAt ?? null,
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt
    });
  }
}

module.exports = {
  Task,
  TASK_TYPES,
  TASK_STATUSES
};
