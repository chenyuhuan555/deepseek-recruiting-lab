"""In-memory teaching example; no model calls, persistence or account permissions."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Criterion:
    id: str
    text: str
    kind: str
    quote: str


@dataclass(frozen=True)
class Revision:
    from_version: int
    source_text: str
    confirmed_by: str
    previous_criteria: tuple[Criterion, ...]
    removed_ids: tuple[str, ...]


@dataclass(frozen=True)
class Job:
    id: str
    version: int
    criteria: tuple[Criterion, ...]
    history: tuple[Revision, ...] = ()


def apply_change(job: Job, *, expected_version: int, source_text: str,
                 updates: tuple[Criterion, ...], remove_ids: tuple[str, ...],
                 confirmed_by: str) -> Job:
    """Apply a reviewed patch to a trusted snapshot, preserving untouched conditions."""
    if expected_version != job.version:
        raise ValueError('stale job version')
    if not confirmed_by.strip() or not source_text.strip():
        raise ValueError('reviewer and source text are required')
    keys = [item.id for item in updates]
    if len(set(keys)) != len(keys) or set(keys) & set(remove_ids):
        raise ValueError('duplicate or conflicting changes')
    current = {item.id: item for item in job.criteria}
    if set(remove_ids) - current.keys():
        raise ValueError('cannot remove an unknown criterion')
    for item in updates:
        if not item.id.strip() or not item.text.strip():
            raise ValueError('criterion id and text are required')
        if item.kind not in {'required', 'preferred', 'not_required', 'unconfirmed'}:
            raise ValueError('unsupported criterion kind')
        if not item.quote.strip() or item.quote not in source_text:
            raise ValueError('quote must occur in the supplied source')
    for key in remove_ids:
        del current[key]
    current.update((item.id, item) for item in updates)
    revision = Revision(job.version, source_text, confirmed_by, job.criteria, remove_ids)
    return Job(job.id, job.version + 1, tuple(current.values()), job.history + (revision,))


@dataclass(frozen=True)
class Memory:
    id: str
    text: str
    scope: str
    owner_id: str
    confirmed_by: str
    expires_on: date | None


def select_memories(memories: tuple[Memory, ...], *, job_id: str, client_id: str,
                    recruiter_id: str, today: date) -> tuple[Memory, ...]:
    """Select contextual suggestions; never turn them into hard job requirements."""
    owners = {'job': job_id, 'client': client_id, 'recruiter': recruiter_id}
    return tuple(memory for memory in memories
                 if memory.scope in owners
                 and memory.owner_id == owners[memory.scope]
                 and memory.confirmed_by.strip()
                 and (memory.expires_on is None or memory.expires_on >= today))
