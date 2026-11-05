CREATE TABLE job_versions (
  job_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, version)
);
--> statement-breakpoint
CREATE TABLE task_states (
  job_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  task_id TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (job_id, version, task_id),
  FOREIGN KEY (job_id, version) REFERENCES job_versions(job_id, version)
);
--> statement-breakpoint
CREATE TABLE evidence_reviews (
  job_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  PRIMARY KEY (job_id, evidence_id),
  FOREIGN KEY (job_id, version) REFERENCES job_versions(job_id, version)
);
