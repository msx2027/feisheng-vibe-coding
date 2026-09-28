#!/usr/bin/env python3
"""Regression tests for Studio Mode fresh-task evidence contracts."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from live_evidence_isolation import build_allowed_inputs, input_manifest_digest
from runtime_identity import source_revision, source_runtime_digest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/evaluate_studio_live_behavior.py"
CASES = ROOT / "tests/studio-live-behavior-cases.json"
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def isolation_manifest(revision: str, runtime_digest: str) -> dict[str, Any]:
    allowed_inputs = build_allowed_inputs("codex")
    return {
        "schema": "sliver-live-evidence-isolation/v1",
        "environment": "github_hosted_ephemeral",
        "workspace_origin": "versioned_synthetic_fixture",
        "source_revision": revision,
        "runtime_digest": runtime_digest,
        "producer": {
            "kind": "github_actions",
            "repository": "example/sliver-vibe-coding",
            "workflow_path": ".github/workflows/external-live-evidence.yml",
            "run_id": "123456",
        },
        "isolated_home": True,
        "isolated_runtime_home": True,
        "user_config_loaded": False,
        "user_rules_loaded": False,
        "global_memory_mounted": False,
        "global_skills_mounted": False,
        "plugins_enabled": False,
        "session_history_mounted": False,
        "personal_projects_mounted": False,
        "allowed_inputs": allowed_inputs,
        "input_manifest_sha256": input_manifest_digest(allowed_inputs),
        "external_authorization_ref": "github-actions-environment:live-evidence",
        "privacy_scan_status": "passed",
        "cleanup_status": "complete",
    }


class StudioLiveContractsTest(unittest.TestCase):
    def run_evaluator(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", "-B", str(SCRIPT), *args],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def make_trace(
        self,
        case: dict[str, Any],
        start: datetime,
        authorization_refs: dict[str, str],
    ) -> list[dict[str, Any]]:
        trace: list[dict[str, Any]] = []
        created: list[tuple[str, str]] = []
        thread_rooms: dict[str, str] = {}
        create_count = 0
        fork_count = 0
        wait_count = 0
        send_count = 0
        handoff_operation_id = ""
        latest_cursors: dict[tuple[str, str], str] = {}
        for index, tool_name in enumerate(case["expected_tool_sequence"]):
            event_start = start + timedelta(seconds=index + 1)
            target_thread_id = "director"
            target_host_id = "local"
            effect = "project_resolved"
            if tool_name == "create_thread":
                create_count += 1
                target_thread_id = f"{case['id']}-room-{create_count}"
                target_host_id = f"{case['id']}-host-{create_count}"
                created.append((target_thread_id, target_host_id))
                thread_rooms[target_thread_id] = f"{case['id']}-task-card-{create_count}"
                effect = "room_created"
            elif tool_name == "wait_threads":
                if case["id"] == "confirmed-independent-review-rework-loop":
                    target_thread_id, target_host_id = created[
                        wait_count % len(created)
                    ]
                else:
                    target_thread_id, target_host_id = created[
                        min(wait_count, len(created) - 1)
                    ]
                wait_count += 1
                effect = "room_progress_observed"
            elif tool_name == "fork_thread":
                fork_count += 1
                target_thread_id, target_host_id = created[-1]
                effect = "room_forked"
            elif tool_name == "send_message_to_thread":
                send_count += 1
                if case["id"] == "confirmed-codex-host-operation-effects":
                    target_thread_id, target_host_id = created[-1]
                    effect = "thread_message_sent"
                else:
                    target_thread_id, target_host_id = created[
                        min(send_count - 1, len(created) - 1)
                    ]
                    effect = "rework_sent" if send_count == 1 else "rereview_sent"
            elif tool_name == "handoff_thread":
                target_thread_id, target_host_id = created[-1]
                effect = "thread_handoff_started"
            elif tool_name == "get_handoff_status":
                target_thread_id, target_host_id = created[-1]
                effect = "thread_handoff_status_observed"
            elif tool_name == "set_thread_archived":
                target_thread_id, target_host_id = created[-1]
                effect = "thread_archived"
            room_ref = thread_rooms.get(
                target_thread_id,
                f"{case['id']}-director-operation",
            )
            if tool_name == "fork_thread":
                room_ref = f"{case['id']}-task-card-{create_count + fork_count}"
            request_args: dict[str, Any] = {}
            response_result: dict[str, Any] = {"status": "success"}
            effective_starting_state: dict[str, Any] = {}
            room_contract: dict[str, Any] = {}
            if tool_name == "create_thread":
                writer = case["id"] == "frontend-backend-confirmed-parallel"
                role = (
                    "reviewer"
                    if case["id"]
                    in {
                        "confirmed-independent-review-rework-loop",
                        "confirmed-promptless-receive-review-integration",
                        "confirmed-closure-room-disposition",
                    }
                    and create_count == 2
                    else "producer"
                )
                environment = "worktree" if writer else "local"
                return_method = "reviewed_patch" if writer else "none"
                revision = source_revision(ROOT)
                requested_environment: dict[str, Any] = {"type": environment}
                effective_starting_state = {
                    "kind": "working_tree" if writer else "local_shared_checkout",
                    "revision": revision,
                }
                if writer:
                    requested_environment["startingState"] = {"type": "working-tree"}
                allowed_paths = [f"src/{create_count}/"]
                forbidden_paths = [".git/", "shared-contracts/"]
                room_contract = {
                    "task_card_id": room_ref,
                    "role": role,
                    "write_mode": "writer" if writer else "read_only",
                    "environment": environment,
                    "source_revision": revision,
                    "return_method": return_method,
                    "return_authorization_ref": None,
                    "allowed_paths": allowed_paths,
                    "forbidden_paths": forbidden_paths,
                }
                request_args = {
                    "target": {
                        "type": "project",
                        "projectId": "project-from-list-projects",
                        "environment": requested_environment,
                    },
                    "prompt": (
                        f"Task card {room_ref}. Source revision {revision}. "
                        f"Write mode {'writer' if writer else 'read_only'}. "
                        f"Environment {environment}. Return method {return_method}. "
                        f"Allowed paths {', '.join(allowed_paths)}. "
                        f"Forbidden paths {', '.join(forbidden_paths)}. "
                        "Follow the complete approved contract before reporting status."
                    ),
                }
                response_result = {
                    "threadId": target_thread_id,
                    "hostId": target_host_id,
                }
            elif tool_name == "wait_threads":
                room_key = (target_thread_id, target_host_id)
                target = {
                    "threadId": target_thread_id,
                    "hostId": target_host_id,
                }
                request_args = {
                    "targets": [target],
                    "timeoutMs": 30000,
                }
                if room_key in latest_cursors:
                    target["afterCursor"] = latest_cursors[room_key]
                next_cursor = f"cursor-{index}"
                decision = "PASS"
                if case["id"] == "confirmed-independent-review-rework-loop":
                    decision = [
                        "READY_FOR_REVIEW",
                        "REWORK",
                        "READY_FOR_REVIEW",
                        "PASS",
                    ][wait_count - 1]
                elif case["id"] == "confirmed-promptless-receive-review-integration":
                    decision = "READY_FOR_REVIEW" if wait_count == 1 else "PASS"
                elif case["id"] == "frontend-backend-confirmed-parallel":
                    decision = "READY_FOR_REVIEW"
                response_result = {
                    "timedOut": False,
                    "wake": {
                        "reason": "completed",
                        "threadId": target_thread_id,
                        "hostId": target_host_id,
                    },
                    "polls": [
                        {
                            "schemaVersion": 1,
                            "cursor": next_cursor,
                            "revision": wait_count,
                            "changed": True,
                            "thread": {
                                "id": target_thread_id,
                                "hostId": target_host_id,
                                "status": {"type": "completed"},
                            },
                            "latestTurn": {
                                "status": "completed",
                                "completedAt": int(event_start.timestamp()),
                            },
                            "latestAssistantMessage": {
                                "id": f"message-{index}",
                                "text": f"{decision}: bounded evidence returned.",
                            },
                        }
                    ],
                    "errors": [],
                }
                latest_cursors[room_key] = next_cursor
            elif tool_name == "send_message_to_thread":
                request_args = {
                    "threadId": target_thread_id,
                    "hostId": target_host_id,
                    "prompt": "Apply the exact failed gate and return new evidence.",
                }
                response_result = {"status": "sent"}
            elif tool_name == "fork_thread":
                child_thread = f"{case['id']}-fork-{fork_count}"
                request_args = {
                    "threadId": target_thread_id,
                    "environment": {"type": "same-directory"},
                }
                response_result = {"threadId": child_thread}
                created.append((child_thread, target_host_id))
                thread_rooms[child_thread] = room_ref
            elif tool_name == "handoff_thread":
                handoff_operation_id = f"{case['id']}-handoff-1"
                request_args = {
                    "threadId": target_thread_id,
                    "destinationHostId": "local",
                }
                response_result = {
                    "operationId": handoff_operation_id,
                    "revision": 1,
                }
            elif tool_name == "get_handoff_status":
                request_args = {
                    "operationId": handoff_operation_id,
                    "afterRevision": 1,
                    "waitMs": 30000,
                }
                response_result = {
                    "status": "completed",
                    "revision": 2,
                }
            elif tool_name == "set_thread_archived":
                request_args = {
                    "threadId": target_thread_id,
                    "hostId": target_host_id,
                    "archived": True,
                }
                response_result = {"archived": True}
            elif tool_name == "list_projects":
                response_result = {
                    "projects": [{"projectId": "project-from-list-projects"}]
                }
            trace.append(
                {
                    "event_id": f"{case['id']}-tool-{index + 1}",
                    "tool_name": tool_name,
                    "status": "success",
                    "started_at": event_start.isoformat(),
                    "completed_at": (event_start + timedelta(milliseconds=100)).isoformat(),
                    "target_thread_id": target_thread_id,
                    "target_host_id": target_host_id,
                    "room_ref": room_ref,
                    "request_args": request_args,
                    "response_result": response_result,
                    "request_summary": f"Execute approved Studio operation {tool_name}",
                    "response_summary": f"Observed successful Studio effect {effect}",
                    "authorization_ref": authorization_refs.get(
                        tool_name,
                        authorization_refs["default"],
                    ),
                    "effect": effect,
                    "effective_starting_state": effective_starting_state,
                    "room_contract": room_contract,
                }
            )
        if case["expected_confirmed"] and trace:
            writer_room_refs = [
                event["room_ref"]
                for event in trace
                if event["tool_name"] == "create_thread"
                and event["room_contract"].get("write_mode") == "writer"
            ]
            for gate_index, writer_room_ref in enumerate(writer_room_refs, start=1):
                gate_time = start + timedelta(seconds=18 + gate_index)
                trace.append(
                    {
                        "event_id": f"{case['id']}-return-gate-{gate_index}",
                        "tool_name": "exec_command",
                        "status": "success",
                        "started_at": gate_time.isoformat(),
                        "completed_at": (gate_time + timedelta(milliseconds=100)).isoformat(),
                        "target_thread_id": "director",
                        "target_host_id": "local",
                        "room_ref": "director",
                        "request_args": {
                            "cmd": f"verify-return --room {writer_room_ref} --dry-apply"
                        },
                        "response_result": {"exit_code": 0, "output": "verified"},
                        "request_summary": "Verify reviewed return artifact and dry apply",
                        "response_summary": "Return artifact verification passed",
                        "authorization_ref": authorization_refs["default"],
                        "effect": "local_gate_executed",
                        "effective_starting_state": {},
                        "room_contract": {},
                    }
                )
            gate_time = start + timedelta(seconds=24)
            trace.append(
                {
                    "event_id": f"{case['id']}-integration-gate",
                    "tool_name": "exec_command",
                    "status": "success",
                    "started_at": gate_time.isoformat(),
                    "completed_at": (gate_time + timedelta(milliseconds=100)).isoformat(),
                    "target_thread_id": "director",
                    "target_host_id": "local",
                    "room_ref": "director",
                    "request_args": {"cmd": "run-combined-integration-gate --fresh"},
                    "response_result": {"exit_code": 0, "output": "combined gate passed\nintegrated_revision=" + "a" * 40},
                    "request_summary": "Run fresh combined integration acceptance gate",
                    "response_summary": "Combined integration gate passed successfully",
                    "authorization_ref": authorization_refs["default"],
                    "effect": "local_gate_executed",
                    "effective_starting_state": {},
                    "room_contract": {},
                }
            )
        return trace

    def make_director_trace(
        self,
        case: dict[str, Any],
        start: datetime,
        thread_trace: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        trace: list[dict[str, Any]] = []
        if case["expected_confirmed"]:
            trace.append(
                {
                    "event_id": f"{case['id']}-plan-materialized",
                    "event_kind": "plan_materialized",
                    "timestamp": (start + timedelta(milliseconds=500)).isoformat(),
                    "room_ref": "director",
                    "thread_event_ref": None,
                    "transcript_event_ref": None,
                    "phase": "plan",
                    "details": {"status": "materialized"},
                }
            )
        writer_rooms = [
            event["room_ref"]
            for event in thread_trace
            if event["tool_name"] == "create_thread"
            and event["status"] == "success"
            and event["room_contract"].get("write_mode") == "writer"
        ]
        review_refs: dict[str, str] = {}
        writer_wait_refs: dict[str, str] = {}
        return_refs: list[str] = []
        first_producer_room = next(
            (
                event["room_ref"]
                for event in thread_trace
                if event["tool_name"] == "create_thread"
                and event["room_contract"].get("role") == "producer"
            ),
            "",
        )
        for event in thread_trace:
            trace.append(
                {
                    "event_id": f"director-{event['event_id']}",
                    "event_kind": "host_tool",
                    "timestamp": event["completed_at"],
                    "room_ref": event["room_ref"],
                    "thread_event_ref": event["event_id"],
                    "transcript_event_ref": None,
                    "phase": "host_operation",
                    "details": {"tool_name": event["tool_name"]},
                }
            )
            if (
                event["tool_name"] == "wait_threads"
                and event["status"] == "success"
                and event["response_result"].get("wake") is not None
            ):
                poll = next(
                    poll
                    for poll in event["response_result"]["polls"]
                    if poll["thread"]["id"] == event["target_thread_id"]
                    and poll["thread"]["hostId"] == event["target_host_id"]
                )
                decision = poll["latestAssistantMessage"]["text"].split(":", 1)[0]
                handled_time = datetime.fromisoformat(event["completed_at"]) + timedelta(
                    milliseconds=1
                )
                trace.append(
                    {
                        "event_id": f"handled-{event['event_id']}",
                        "event_kind": "room_result_handled",
                        "timestamp": handled_time.isoformat(),
                        "room_ref": event["room_ref"],
                        "thread_event_ref": event["event_id"],
                        "transcript_event_ref": None,
                        "phase": "review",
                        "details": {"decision": decision},
                    }
                )
                if event["room_ref"] in writer_rooms:
                    writer_wait_refs[event["room_ref"]] = event["event_id"]
                elif (
                    case["id"] in {"confirmed-independent-review-rework-loop", "confirmed-promptless-receive-review-integration", "confirmed-closure-room-disposition"}
                    and event["room_ref"].endswith("task-card-2")
                ):
                    trace.append(
                        {
                            "event_id": f"reviewed-{event['event_id']}",
                            "event_kind": "review_completed",
                            "timestamp": (handled_time + timedelta(milliseconds=1)).isoformat(),
                            "room_ref": first_producer_room,
                            "thread_event_ref": None,
                            "transcript_event_ref": None,
                            "phase": "independent_review",
                            "details": {
                                "producer_room_ref": first_producer_room,
                                "reviewer_ref": event["room_ref"],
                                "verdict": decision,
                                "source_wait_ref": event["event_id"],
                            },
                        }
                    )
            if event["tool_name"] == "exec_command" and "return-gate" in event["event_id"]:
                writer_index = int(event["event_id"].rsplit("-", 1)[1]) - 1
                writer_room = writer_rooms[writer_index]
                review_event_id = f"reviewed-{writer_wait_refs[writer_room]}"
                review_refs[writer_room] = review_event_id
                trace.append(
                    {
                        "event_id": review_event_id,
                        "event_kind": "review_completed",
                        "timestamp": (
                            datetime.fromisoformat(event["completed_at"])
                            + timedelta(milliseconds=1)
                        ).isoformat(),
                        "room_ref": writer_room,
                        "thread_event_ref": None,
                        "transcript_event_ref": None,
                        "phase": "independent_review",
                        "details": {
                            "producer_room_ref": writer_room,
                            "reviewer_ref": "director",
                            "verdict": "PASS",
                            "source_wait_ref": writer_wait_refs[writer_room],
                            "review_tool_ref": event["event_id"],
                        },
                    }
                )
                return_event_id = f"{case['id']}-return-verified-{writer_index + 1}"
                return_refs.append(return_event_id)
                trace.append(
                    {
                        "event_id": return_event_id,
                        "event_kind": "return_verified",
                        "timestamp": (
                            datetime.fromisoformat(event["completed_at"])
                            + timedelta(milliseconds=2)
                        ).isoformat(),
                        "room_ref": writer_room,
                        "thread_event_ref": None,
                        "transcript_event_ref": None,
                        "phase": "return_verification",
                        "details": {
                            "reviewer_ref": "director",
                            "review_evidence_ref": review_refs[writer_room],
                            "verification_tool_ref": event["event_id"],
                            "return_method": "reviewed_patch",
                            "artifact_path": f"returns/{writer_room}.patch",
                            "artifact_sha256": hashlib.sha256(
                                writer_room.encode("utf-8")
                            ).hexdigest(),
                            "base_revision": source_revision(ROOT),
                            "destination_drift": "clear",
                            "dry_apply_status": "passed",
                        },
                    }
                )
            if event["tool_name"] == "exec_command" and "integration-gate" in event["event_id"]:
                trace.append(
                    {
                        "event_id": f"{case['id']}-integration-completed",
                        "event_kind": "integration_completed",
                        "timestamp": (
                            datetime.fromisoformat(event["completed_at"])
                            + timedelta(milliseconds=1)
                        ).isoformat(),
                        "room_ref": "director",
                        "thread_event_ref": None,
                        "transcript_event_ref": None,
                        "phase": "integration",
                        "details": {
                            "gate_tool_ref": event["event_id"],
                            "return_event_refs": list(return_refs),
                        },
                    }
                )
        return trace

    def make_valid_results(self, directory: Path) -> Path:
        cases = json.loads(CASES.read_text(encoding="utf-8"))["cases"]
        now = datetime.now(timezone.utc)
        generated_at = now.isoformat()
        raw_cases: list[dict[str, Any]] = []
        judged_cases: list[dict[str, Any]] = []
        for index, case in enumerate(cases):
            start = now - timedelta(minutes=20 - index)
            system_ref = f"{case['id']}-system"
            user_ref = f"{case['id']}-user"
            confirmation_ref = f"{case['id']}-confirmation" if case["expected_confirmed"] else user_ref
            transcript = [
                {
                    "event_id": system_ref,
                    "role": "system",
                    "timestamp": start.isoformat(),
                    "content": "Selected sliver-vibe-coding with Studio host contract.",
                },
                {
                    "event_id": user_ref,
                    "role": "user",
                    "timestamp": (start + timedelta(milliseconds=100)).isoformat(),
                    "content": case["initial_user"],
                },
            ]
            if case["expected_confirmed"]:
                transcript.append(
                    {
                        "event_id": confirmation_ref,
                        "role": "user",
                        "timestamp": (start + timedelta(milliseconds=200)).isoformat(),
                        "content": "确认按已展示的精确拓扑、owner、环境和验收链创建这些任务。",
                    }
                )
            operation_authorizations = {
                "default": confirmation_ref,
            }
            separately_authorized = (
                (
                    "fork_thread",
                    "确认从已完成的原任务 fork 一个只读复核任务。",
                ),
                (
                    "handoff_thread",
                    "确认把已列明的复核任务切换到指定本机工作树环境。",
                ),
                (
                    "set_thread_archived",
                    "确认在观察到终态后归档这个可丢弃复核任务。",
                ),
            )
            for offset, (tool_name, content) in enumerate(
                separately_authorized,
                start=3,
            ):
                if tool_name in case["expected_tool_sequence"]:
                    event_id = f"{case['id']}-{tool_name}-authorization"
                    transcript.append(
                        {
                            "event_id": event_id,
                            "role": "user",
                            "timestamp": (
                                start + timedelta(milliseconds=offset * 100)
                            ).isoformat(),
                            "content": content,
                        }
                    )
                    operation_authorizations[tool_name] = event_id
            final_output = f"Studio decision: {case['expected_decision']}; evidence recorded."
            transcript.append(
                {
                    "event_id": f"{case['id']}-assistant",
                    "role": "assistant",
                    "timestamp": (start + timedelta(seconds=30)).isoformat(),
                    "content": final_output,
                }
            )
            planned_writer = case["id"] not in {
                "confirmed-independent-review-rework-loop",
                "confirmed-codex-host-operation-effects",
                "confirmed-promptless-receive-review-integration",
                "confirmed-closure-room-disposition",
            }
            planned_rooms = [
                {
                    "room_ref": f"{case['id']}-task-card-{item + 1}",
                    "role": (
                        "reviewer"
                        if case["id"]
                        in {
                            "confirmed-independent-review-rework-loop",
                            "confirmed-promptless-receive-review-integration",
                            "confirmed-codex-host-operation-effects",
                            "confirmed-closure-room-disposition",
                        }
                        and item == 1
                        else "producer"
                    ),
                    "deliverable": f"Bounded deliverable {item + 1}",
                    "write_mode": "writer" if planned_writer else "read_only",
                    "environment": "worktree" if planned_writer else "local",
                    "starting_state": (
                        "working_tree" if planned_writer else "local_shared_checkout"
                    ),
                    "source_revision": source_revision(ROOT),
                    "return_method": "reviewed_patch" if planned_writer else "none",
                }
                for item in range(case["minimum_planned_rooms"])
            ]
            recommendation_card = {
                "decision": case["expected_decision"],
                "reasons": ["Current truth and owner analysis completed"],
                "parallel_nodes": ["Only evidence-backed disjoint nodes"],
                "serial_nodes": ["Contract and integration gates"],
                "owner_contract": "one owner, one writer",
                "rooms": planned_rooms,
                "environment": "local read-only or isolated worktree according to the case",
                "acceptance_chain": "producer -> reviewer -> director integration",
                "risks": ["No unapproved external or Git effect"],
            }
            if case["expected_confirmed"]:
                plan_status = "materialized"
            elif case["expected_decision"] == "recommend_studio":
                plan_status = "proposed"
            else:
                plan_status = "not_required"
            thread_trace = self.make_trace(
                case,
                start,
                operation_authorizations,
            )
            if case["expected_confirmed"] and thread_trace:
                disposition_ref = f"{case['id']}-disposition-confirmation"
                # Acceptance and disposition authorization happen after integration.
                transcript[:] = [event for event in transcript
                                 if event["event_id"] != operation_authorizations.get("set_thread_archived")]
                transcript.append({"event_id": disposition_ref, "role": "user",
                                   "timestamp": (start + timedelta(seconds=26)).isoformat(),
                                   "content": "集成结果验收通过，确认逐房处置清单；一次性任务归档，可能返工任务保留。"})
                transcript.sort(key=lambda event: event["timestamp"])
                for event in thread_trace:
                    if event["tool_name"] == "set_thread_archived":
                        event["started_at"] = (start + timedelta(seconds=27)).isoformat()
                        event["completed_at"] = (start + timedelta(seconds=27, milliseconds=100)).isoformat()
                        event["authorization_ref"] = disposition_ref
                thread_trace.sort(key=lambda event: event["started_at"])
            raw_case = {
                "case_id": case["id"],
                "initial_user": case["initial_user"],
                "session": {
                    "thread_id": f"director-{case['id']}",
                    "host_id": f"host-{case['id']}",
                    "started_at": start.isoformat(),
                    "ended_at": (start + timedelta(seconds=31)).isoformat(),
                },
                "decision": case["expected_decision"],
                "user_confirmation": {
                    "required": case["expected_decision"] == "recommend_studio",
                    "confirmed": case["expected_confirmed"],
                    "evidence_ref": confirmation_ref,
                    "case_id": case["id"],
                    "room_refs": [
                        room["room_ref"]
                        for room in recommendation_card["rooms"]
                    ],
                },
                "recommendation_card": recommendation_card,
                "plan_owner": {
                    "path": (
                        f"plans/{case['id']}.md"
                        if plan_status != "not_required"
                        else ""
                    ),
                    "status": plan_status,
                    "materialized_at": (
                        (start + timedelta(milliseconds=500)).isoformat()
                        if plan_status == "materialized"
                        else None
                    ),
                    "confirmation_ref": confirmation_ref,
                    "case_id": case["id"],
                    "room_refs": [
                        room["room_ref"]
                        for room in recommendation_card["rooms"]
                    ],
                },
                "transcript": transcript,
                "thread_trace": thread_trace,
                "director_trace": self.make_director_trace(
                    case,
                    start,
                    thread_trace,
                ),
                "director_trace_scope": "host_and_transcript_events",
                "final_output": final_output,
            }
            if case["expected_confirmed"] and thread_trace:
                archived = {event["room_ref"] for event in thread_trace
                            if event["tool_name"] == "set_thread_archived"}
                raw_case["director_trace"].append({
                    "event_id": f"{case['id']}-dispositions",
                    "event_kind": "room_dispositions_confirmed",
                    "timestamp": (start + timedelta(seconds=26, milliseconds=100)).isoformat(),
                    "room_ref": "director", "thread_event_ref": None,
                    "transcript_event_ref": disposition_ref, "phase": "closure",
                    "details": {"rooms": [
                        {"room_ref": room["room_ref"],
                         "disposition": "one_off" if room["room_ref"] in archived else "likely_rework"}
                        for room in planned_rooms]},
                })
                raw_case["director_trace"].sort(key=lambda event: event["timestamp"])
            evidence_refs = [f"session:{raw_case['session']['thread_id']}"]
            if raw_case["thread_trace"]:
                evidence_refs.append(raw_case["thread_trace"][0]["event_id"])
            judge = {
                "status": "pass",
                "reason": "Review checked the direct raw transcript and thread-tool evidence.",
                "rubric_version": "studio-execution/v4",
                "reviewer_identity": {
                    "kind": "independent_process",
                    "model": "judge-model",
                    "run_id": "studio-live-judge-run",
                },
                "raw_case_sha256": hashlib.sha256(
                    json.dumps(
                        raw_case,
                        ensure_ascii=False,
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf-8")
                ).hexdigest(),
                "required_behavior_results": {
                    behavior: {"passed": True, "evidence_refs": evidence_refs}
                    for behavior in case["required_behaviors"]
                },
                "forbidden_behavior_results": {
                    behavior: {"observed": False, "evidence_refs": evidence_refs}
                    for behavior in case["forbidden_behaviors"]
                },
            }
            raw_cases.append(raw_case)
            judged_cases.append({**deepcopy(raw_case), "judge": judge})

        revision = source_revision(ROOT)
        runtime_digest = source_runtime_digest(ROOT, "codex")
        runner_isolation = isolation_manifest(revision, runtime_digest)
        raw_results = {
            "schema": "sliver-studio-live-raw-results/v4",
            "run_id": "studio-live-run",
            "runtime_target": "codex",
            "runtime_digest": runtime_digest,
            "source_revision": revision,
            "platform": "codex-test-host",
            "model": "subject-model",
            "generated_at": generated_at,
            "runner_isolation": runner_isolation,
            "cases": raw_cases,
        }
        raw_path = directory / "studio-raw-results.json"
        raw_path.write_text(json.dumps(raw_results, ensure_ascii=False), encoding="utf-8")
        payload = {
            "schema": "sliver-studio-live-results/v4",
            "run_id": "studio-live-run",
            "skill_version": VERSION,
            "runtime_target": "codex",
            "runtime_digest": runtime_digest,
            "source_revision": revision,
            "platform": "codex-test-host",
            "model": "subject-model",
            "generated_at": generated_at,
            "fresh_session": True,
            "runner_isolation": runner_isolation,
            "raw_result_path": raw_path.name,
            "rubric_version": "studio-execution/v4",
            "cases": judged_cases,
        }
        results = directory / "studio-results.json"
        results.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return results

    def mutate_results(
        self,
        results: Path,
        callback: Callable[[dict[str, Any], dict[str, Any]], None],
    ) -> None:
        payload = json.loads(results.read_text(encoding="utf-8"))
        raw_path = results.parent / payload["raw_result_path"]
        raw = json.loads(raw_path.read_text(encoding="utf-8"))
        callback(payload, raw)
        raw_by_id = {case["case_id"]: case for case in raw["cases"]}
        for reviewed in payload["cases"]:
            raw_case = raw_by_id.get(reviewed["case_id"])
            if raw_case is not None:
                reviewed["judge"]["raw_case_sha256"] = hashlib.sha256(
                    json.dumps(
                        raw_case,
                        ensure_ascii=False,
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf-8")
                ).hexdigest()
        raw_path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
        results.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    def test_contract_only_passes_without_live_claim(self) -> None:
        result = self.run_evaluator("--contract-only")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("live task behavior not executed", result.stdout)

    def test_missing_results_is_unverified(self) -> None:
        result = self.run_evaluator()
        self.assertEqual(result.returncode, 2)
        self.assertIn("UNVERIFIED", result.stdout)

    def test_complete_direct_evidence_passes(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            result = self.run_evaluator("--results", str(self.make_valid_results(Path(raw))))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        expected_count = len(json.loads(CASES.read_text(encoding="utf-8"))["cases"])
        self.assertIn(f"{expected_count} fresh-task cases", result.stdout)

    def test_closure_requires_complete_confirmed_dispositions(self) -> None:
        mutations = {
            "missing": "Studio closure lacks confirmed room dispositions",
            "omitted_room": "disposition requires every room exactly once",
            "early_confirmation": "disposition requires post-integration user confirmation",
            "early_archive": "archive lacks confirmed room disposition",
            "archive_rework": "archive lacks confirmed room disposition",
        }
        for kind, error in mutations.items():
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as raw:
                results = self.make_valid_results(Path(raw))

                def mutate(payload, artifact):
                    for collection in (payload["cases"], artifact["cases"]):
                        case = next(c for c in collection if c["case_id"] == "confirmed-closure-room-disposition")
                        event = next(e for e in case["director_trace"] if e["event_kind"] == "room_dispositions_confirmed")
                        if kind == "missing":
                            case["director_trace"].remove(event)
                        elif kind == "omitted_room":
                            event["details"]["rooms"].pop()
                        elif kind == "early_confirmation":
                            event["transcript_event_ref"] = case["user_confirmation"]["evidence_ref"]
                        elif kind == "archive_rework":
                            for row in event["details"]["rooms"]:
                                row["disposition"] = "likely_rework"
                        else:
                            archive = next(e for e in case["thread_trace"] if e["tool_name"] == "set_thread_archived")
                            archive["started_at"] = (datetime.fromisoformat(event["timestamp"]) - timedelta(milliseconds=1)).isoformat()

                self.mutate_results(results, mutate)
                result = self.run_evaluator("--results", str(results))
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertIn(error, result.stdout)

    def test_unresolved_read_only_producer_cannot_close(self) -> None:
        for decision in ("NEEDS_USER_DECISION", "BLOCKED", "REWORK"):
            with self.subTest(decision=decision), tempfile.TemporaryDirectory() as raw:
                results = self.make_valid_results(Path(raw))

                def mutate(payload, artifact):
                    for collection in (payload["cases"], artifact["cases"]):
                        case = next(c for c in collection if c["case_id"] == "confirmed-closure-room-disposition")
                        wait = next(e for e in case["thread_trace"] if e["tool_name"] == "wait_threads")
                        wait["response_result"]["polls"][0]["latestAssistantMessage"]["text"] = decision + ": unresolved result"
                        handled = next(e for e in case["director_trace"] if e["event_kind"] == "room_result_handled" and e["thread_event_ref"] == wait["event_id"])
                        handled["details"]["decision"] = decision

                self.mutate_results(results, mutate)
                result = self.run_evaluator("--results", str(results))
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("closure has unresolved room result", result.stdout)

    def test_reusable_disposition_binds_retained_context(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload, artifact):
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(c for c in collection if c["case_id"] == "confirmed-closure-room-disposition")
                    event = next(e for e in case["director_trace"] if e["event_kind"] == "room_dispositions_confirmed")
                    row = next(r for r in event["details"]["rooms"] if r["disposition"] == "one_off")
                    creation = next(e for e in case["thread_trace"] if e["tool_name"] == "create_thread" and e["room_ref"] == row["room_ref"])
                    row["disposition"] = "reusable_context"
                    row["context"] = {"thread_id": creation["target_thread_id"], "host_id": creation["target_host_id"],
                                      "integrated_revision": "a" * 40, "plan_path": case["plan_owner"]["path"],
                                      "deliverable": "Independent review history and accepted decisions"}

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
            self.assertEqual(result.returncode, 0, result.stdout)

            def remove_context(payload, artifact):
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(c for c in collection if c["case_id"] == "confirmed-closure-room-disposition")
                    event = next(e for e in case["director_trace"] if e["event_kind"] == "room_dispositions_confirmed")
                    next(r for r in event["details"]["rooms"] if r["disposition"] == "reusable_context")["context"]["thread_id"] = "wrong-task"

            self.mutate_results(results, remove_context)
            result = self.run_evaluator("--results", str(results))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("reusable room context identity is invalid", result.stdout)

    def test_live_corpus_requires_topology_family_coverage(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            cases = json.loads(CASES.read_text(encoding="utf-8"))
            cases["cases"][0].pop("topology_family")
            mutated = directory / "studio-cases.json"
            mutated.write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")
            result = self.run_evaluator("--contract-only", "--cases", str(mutated))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("topology_family", result.stdout)

    def test_recommendation_requires_every_safety_gate(self) -> None:
        mutations = (
            ("contracts", "unstable", "unstable contract"),
            ("write_surface_isolation", "unknown", "write-surface isolation"),
            ("writer_ownership", "shared", "unique writer ownership"),
            ("acceptance", "self_reported", "independent acceptance"),
            ("coordination_benefit", "unknown", "coordination benefit"),
        )
        for field, invalid_value, expected_message in mutations:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as raw:
                directory = Path(raw)
                cases = json.loads(CASES.read_text(encoding="utf-8"))
                cases["cases"][0]["context"][field] = invalid_value
                mutated = directory / "studio-cases.json"
                mutated.write_text(
                    json.dumps(cases, ensure_ascii=False),
                    encoding="utf-8",
                )
                result = self.run_evaluator(
                    "--contract-only",
                    "--cases",
                    str(mutated),
                )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(expected_message, result.stdout)

    def test_wrong_runtime_digest_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            payload["runtime_digest"] = "0" * 64
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("exact source runtime candidate", result.stdout)

    def test_normal_user_environment_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                payload["runner_isolation"]["global_memory_mounted"] = True
                artifact["runner_isolation"]["global_memory_mounted"] = True

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("global_memory_mounted must be false", result.stdout)

    def test_raw_isolation_manifest_must_match_reviewed_results(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(_payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                artifact["runner_isolation"]["producer"]["run_id"] = "654321"

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("runner_isolation does not match", result.stdout)

    def test_unconfirmed_create_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(item for item in collection if item["case_id"] == "ui-pipeline-recommend-before-confirmation")
                    case["thread_trace"].append(
                        {
                            "event_id": "illegal-create",
                            "tool_name": "create_thread",
                            "status": "success",
                            "started_at": case["session"]["started_at"],
                            "completed_at": case["session"]["ended_at"],
                            "target_thread_id": "illegal-room",
                            "target_host_id": "local",
                            "room_ref": "illegal-task-card",
                            "request_args": {},
                            "response_result": {},
                            "request_summary": "Created without confirmed topology",
                            "response_summary": "This event must be rejected",
                            "authorization_ref": case["user_confirmation"]["evidence_ref"],
                            "effect": "room_created",
                            "effective_starting_state": {},
                            "room_contract": {},
                        }
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("without explicit confirmation", result.stdout)

    def test_negative_case_cannot_create_rooms(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(item for item in collection if item["case_id"] == "single-module-do-not-recommend")
                    case["user_confirmation"]["confirmed"] = True
                    case["thread_trace"].append(
                        {
                            "event_id": "extra-create",
                            "tool_name": "create_thread",
                            "status": "success",
                            "started_at": case["session"]["started_at"],
                            "completed_at": case["session"]["ended_at"],
                            "target_thread_id": "extra-room",
                            "target_host_id": "local",
                            "room_ref": "extra-task-card",
                            "request_args": {},
                            "response_result": {},
                            "request_summary": "Created despite negative recommendation",
                            "response_summary": "This event exceeds the case maximum",
                            "authorization_ref": case["user_confirmation"]["evidence_ref"],
                            "effect": "room_created",
                            "effective_starting_state": {},
                            "room_contract": {},
                        }
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("confirmation state differs from case contract", result.stdout)

    def test_recommendation_card_must_list_planned_rooms_before_creation(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(item for item in collection if item["case_id"] == "ui-pipeline-recommend-before-confirmation")
                    case["recommendation_card"]["rooms"] = []

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("omits planned rooms", result.stdout)

    def test_rework_sequence_is_required(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(item for item in collection if item["case_id"] == "confirmed-independent-review-rework-loop")
                    case["thread_trace"] = [
                        event for event in case["thread_trace"]
                        if event["tool_name"] != "send_message_to_thread"
                    ]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("required tool sequence", result.stdout)

    def test_send_message_must_use_real_prompt_parameter(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"]
                        == "confirmed-independent-review-rework-loop"
                    )
                    event = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "send_message_to_thread"
                    )
                    event["request_args"]["message"] = event["request_args"].pop(
                        "prompt"
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("send_message_to_thread must use prompt", result.stdout)

    def test_mutating_host_operation_requires_separate_user_authorization(self) -> None:
        for tool_name in ("fork_thread", "handoff_thread", "set_thread_archived"):
            with self.subTest(tool_name=tool_name), tempfile.TemporaryDirectory() as raw:
                results = self.make_valid_results(Path(raw))

                def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                    for collection in (payload["cases"], artifact["cases"]):
                        case = next(
                            item
                            for item in collection
                            if item["case_id"]
                            == "confirmed-codex-host-operation-effects"
                        )
                        event = next(
                            item
                            for item in case["thread_trace"]
                            if item["tool_name"] == tool_name
                        )
                        event["authorization_ref"] = case["user_confirmation"][
                            "evidence_ref"
                        ]

                self.mutate_results(results, mutate)
                result = self.run_evaluator("--results", str(results))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                f"{tool_name} requires separate user authorization",
                result.stdout,
            )

    def test_tool_effect_must_match_real_operation(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    wait = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "wait_threads"
                    )
                    wait["effect"] = "room_created"

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("effect does not match wait_threads", result.stdout)

    def test_handoff_dispatch_requires_terminal_status_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "confirmed-codex-host-operation-effects"
                    )
                    case["thread_trace"] = [
                        event
                        for event in case["thread_trace"]
                        if event["tool_name"] != "get_handoff_status"
                    ]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("handoff_thread completion was not observed", result.stdout)

    def test_archive_requires_observed_terminal_state(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "confirmed-codex-host-operation-effects"
                    )
                    archive_index = next(
                        index
                        for index, item in enumerate(case["thread_trace"])
                        if item["tool_name"] == "set_thread_archived"
                    )
                    case["thread_trace"] = [
                        event
                        for index, event in enumerate(case["thread_trace"])
                        if not (
                            event["tool_name"] == "wait_threads"
                            and index < archive_index
                            and event["target_thread_id"]
                            == case["thread_trace"][archive_index][
                                "target_thread_id"
                            ]
                        )
                    ]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "set_thread_archived requires observed terminal state",
            result.stdout,
        )

    def test_writer_room_cannot_use_shared_local_checkout(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    event = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    )
                    event["room_contract"]["environment"] = "local"
                    event["request_args"]["target"]["environment"] = {"type": "local"}
                    event["effective_starting_state"] = {
                        "kind": "local_shared_checkout",
                        "revision": event["room_contract"]["source_revision"],
                    }

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("writer room must use a worktree", result.stdout)

    def test_writer_rooms_cannot_overlap_allowed_paths(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    creates = [
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    ]
                    replacements = ("src/shared/", "src/shared/api/")
                    for event, replacement in zip(creates, replacements):
                        previous = event["room_contract"]["allowed_paths"][0]
                        event["room_contract"]["allowed_paths"] = [replacement]
                        event["request_args"]["prompt"] = event["request_args"][
                            "prompt"
                        ].replace(previous, replacement)

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("writer allowed_paths overlap", result.stdout)

    def test_effective_starting_revision_must_match_task_card(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    event = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    )
                    event["effective_starting_state"]["revision"] = "git:" + "0" * 40 + ":clean"

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("differs from room source revision", result.stdout)

    def test_writer_room_revision_must_match_release_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                stale_revision = "git:" + "0" * 40 + ":clean"
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    event = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    )
                    old_revision = event["room_contract"]["source_revision"]
                    event["room_contract"]["source_revision"] = stale_revision
                    event["effective_starting_state"]["revision"] = stale_revision
                    event["request_args"]["prompt"] = event["request_args"]["prompt"].replace(
                        old_revision,
                        stale_revision,
                    )
                    room = next(
                        item
                        for item in case["recommendation_card"]["rooms"]
                        if item["room_ref"] == event["room_ref"]
                    )
                    room["source_revision"] = stale_revision

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "writer room source revision differs from release candidate",
            result.stdout,
        )

    def test_wait_must_cover_every_created_room(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    waits = [
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "wait_threads"
                    ]
                    waits[1]["target_thread_id"] = waits[0]["target_thread_id"]
                    waits[1]["target_host_id"] = waits[0]["target_host_id"]
                    waits[1]["request_args"]["targets"] = deepcopy(
                        waits[0]["request_args"]["targets"]
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("wait_threads did not cover every created room", result.stdout)

    def test_active_room_requires_bounded_positive_wait(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    first_room = next(
                        event["target_thread_id"]
                        for event in case["thread_trace"]
                        if event["tool_name"] == "create_thread"
                    )
                    for event in case["thread_trace"]:
                        if (
                            event["tool_name"] == "wait_threads"
                            and event["target_thread_id"] == first_room
                        ):
                            event["request_args"]["timeoutMs"] = 0

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("bounded positive wait", result.stdout)

    def test_rework_must_return_to_original_producer_room(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "confirmed-independent-review-rework-loop"
                    )
                    creates = [
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    ]
                    sends = [
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "send_message_to_thread"
                    ]
                    sends[0]["target_thread_id"] = creates[1]["target_thread_id"]
                    sends[0]["target_host_id"] = creates[1]["target_host_id"]
                    sends[0]["request_args"]["threadId"] = creates[1][
                        "target_thread_id"
                    ]
                    sends[0]["request_args"]["hostId"] = creates[1]["target_host_id"]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("rework must return to the original producer room", result.stdout)

    def test_rereview_must_return_to_original_reviewer_room(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "confirmed-independent-review-rework-loop"
                    )
                    creates = [
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    ]
                    sends = [
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "send_message_to_thread"
                    ]
                    sends[1]["target_thread_id"] = creates[0]["target_thread_id"]
                    sends[1]["target_host_id"] = creates[0]["target_host_id"]
                    sends[1]["request_args"]["threadId"] = creates[0][
                        "target_thread_id"
                    ]
                    sends[1]["request_args"]["hostId"] = creates[0]["target_host_id"]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("re-review must return to the original reviewer room", result.stdout)

    def test_writer_room_requires_reviewed_return_method(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    event = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    )
                    event["room_contract"]["return_method"] = "none"
                    event["request_args"]["prompt"] = event["request_args"]["prompt"].replace(
                        "reviewed_patch",
                        "none",
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("lacks a reviewed return method", result.stdout)

    def test_git_return_method_requires_separate_user_authorization(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    event = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    )
                    event["room_contract"]["return_method"] = "authorized_git_commit"
                    event["room_contract"]["return_authorization_ref"] = case[
                        "user_confirmation"
                    ]["evidence_ref"]
                    case["recommendation_card"]["rooms"][0][
                        "return_method"
                    ] = "authorized_git_commit"
                    event["request_args"]["prompt"] = event["request_args"]["prompt"].replace(
                        "reviewed_patch",
                        "authorized_git_commit",
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("lacks separate user authorization", result.stdout)

    def test_user_confirmation_must_bind_exact_room_refs(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    case["user_confirmation"]["room_refs"] = [
                        "unconfirmed-room"
                    ]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("room_refs differ from the recommendation", result.stdout)

    def test_create_thread_room_must_be_in_confirmed_recommendation(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    event = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    )
                    event["room_ref"] = "unapproved-extra-room"
                    event["room_contract"]["task_card_id"] = "unapproved-extra-room"
                    event["request_args"]["prompt"] = event["request_args"]["prompt"].replace(
                        "frontend-backend-confirmed-parallel-task-card-1",
                        "unapproved-extra-room",
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("absent from the confirmed recommendation", result.stdout)

    def test_create_thread_must_occur_after_user_confirmation(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    confirmation_ref = case["user_confirmation"]["evidence_ref"]
                    confirmation = next(
                        item
                        for item in case["transcript"]
                        if item["event_id"] == confirmation_ref
                    )
                    confirmation["timestamp"] = case["session"]["ended_at"]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("occurred before user confirmation", result.stdout)

    def test_create_thread_project_must_come_from_list_projects(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    event = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    )
                    event["request_args"]["target"]["projectId"] = "invented-project-id"

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("was not returned by list_projects", result.stdout)

    def test_failed_create_thread_does_not_satisfy_room_count(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    event = next(
                        item
                        for item in case["thread_trace"]
                        if item["tool_name"] == "create_thread"
                    )
                    event["status"] = "error"
                    event["response_result"] = {"error": "worktree creation failed"}

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("create_thread count", result.stdout)

    def test_reused_director_session_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                reused = payload["cases"][0]["session"]["thread_id"]
                payload["cases"][1]["session"]["thread_id"] = reused
                artifact["cases"][1]["session"]["thread_id"] = reused

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("fresh-task evidence reused", result.stdout)

    def test_director_activity_trace_is_required(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    case.pop("director_trace")

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("director_trace", result.stdout)

    def test_user_reminder_cannot_trigger_completed_room_review(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"]
                        == "confirmed-independent-review-rework-loop"
                    )
                    case["director_trace"] = [
                        {
                            "event_id": "user-reminded-director",
                            "event_kind": "user_completion_reminder",
                            "timestamp": case["session"]["ended_at"],
                            "room_ref": (
                                "confirmed-independent-review-rework-loop-"
                                "task-card-1"
                            ),
                            "thread_event_ref": None,
                            "transcript_event_ref": case["user_confirmation"][
                                "evidence_ref"
                            ],
                            "phase": "awaiting_review",
                            "details": {"reason": "user had to prompt for pickup"},
                        }
                    ]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("user reminder", result.stdout)

    def test_rework_wait_must_advance_the_saved_cursor(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"]
                        == "confirmed-independent-review-rework-loop"
                    )
                    producer = next(
                        event
                        for event in case["thread_trace"]
                        if event["tool_name"] == "create_thread"
                    )
                    waits = [
                        event
                        for event in case["thread_trace"]
                        if event["tool_name"] == "wait_threads"
                        and event["target_thread_id"]
                        == producer["target_thread_id"]
                    ]
                    stale_cursor = waits[0]["response_result"]["polls"][0]["cursor"]
                    waits[-1]["request_args"]["targets"][0]["afterCursor"] = stale_cursor
                    waits[-1]["response_result"]["polls"][0]["cursor"] = stale_cursor

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cursor did not advance", result.stdout)

    def test_subagent_activity_cannot_count_as_a_studio_room(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    case["director_trace"] = [
                        {
                            "event_id": "hidden-subagent-work",
                            "event_kind": "subagent_activity",
                            "timestamp": case["session"]["ended_at"],
                            "room_ref": case["recommendation_card"]["rooms"][0][
                                "room_ref"
                            ],
                            "thread_event_ref": None,
                            "transcript_event_ref": None,
                            "phase": "room_execution",
                            "details": {"claimed_role": "studio_room"},
                        }
                    ]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("subagent", result.stdout)

    def test_cursor_shared_checkout_cannot_count_as_a_studio_room(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    case["director_trace"] = [
                        {
                            "event_id": "cursor-shared-checkout-work",
                            "event_kind": "cursor_activity",
                            "timestamp": case["session"]["ended_at"],
                            "room_ref": case["recommendation_card"]["rooms"][0][
                                "room_ref"
                            ],
                            "thread_event_ref": None,
                            "transcript_event_ref": None,
                            "phase": "room_execution",
                            "details": {
                                "claimed_role": "studio_room",
                                "checkout": "director_shared_checkout",
                            },
                        }
                    ]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Cursor", result.stdout)

    def test_actionable_result_blocks_unrelated_local_activity(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"]
                        == "confirmed-promptless-receive-review-integration"
                    )
                    handled_index = next(
                        index
                        for index, event in enumerate(case["director_trace"])
                        if event["event_kind"] == "room_result_handled"
                    )
                    handled = case["director_trace"][handled_index]
                    observed = case["director_trace"][handled_index - 1]
                    case["director_trace"].insert(
                        handled_index,
                        {
                            "event_id": "unrelated-preview-work",
                            "event_kind": "local_activity",
                            "timestamp": (
                                datetime.fromisoformat(observed["timestamp"])
                                + timedelta(microseconds=500)
                            ).isoformat(),
                            "room_ref": "director",
                            "thread_event_ref": None,
                            "transcript_event_ref": None,
                            "phase": "preview",
                            "details": {"action": "continued unrelated preview"},
                        },
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("before unrelated director activity", result.stdout)

    def test_confirmed_studio_requires_materialized_plan_owner(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    case["plan_owner"]["status"] = "proposed"
                    case["plan_owner"]["materialized_at"] = None

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("plan was not materialized", result.stdout)

    def test_writer_return_must_be_verified_before_integration(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    case["director_trace"] = [
                        event
                        for event in case["director_trace"]
                        if event["event_kind"] != "return_verified"
                    ]

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("reviewed writer return was not verified", result.stdout)

    def test_compaction_recovery_must_snapshot_before_other_work(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    case["director_trace"].insert(
                        1,
                        {
                            "event_id": "compaction-recovered",
                            "event_kind": "compaction_recovered",
                            "timestamp": (
                                datetime.fromisoformat(
                                    case["director_trace"][0]["timestamp"]
                                )
                                + timedelta(milliseconds=1)
                            ).isoformat(),
                            "room_ref": "director",
                            "thread_event_ref": None,
                            "transcript_event_ref": None,
                            "phase": "recovery",
                            "details": {"capsule": "loaded"},
                        },
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("first action after compaction recovery", result.stdout)

    def test_user_message_requires_immediate_room_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    user_event = {
                        "event_id": "mid-run-user-message",
                        "role": "user",
                        "timestamp": (
                            datetime.fromisoformat(case["session"]["started_at"])
                            + timedelta(seconds=4, milliseconds=500)
                        ).isoformat(),
                        "content": "继续推进，并先确认房间有没有新结果。",
                    }
                    case["transcript"].append(user_event)
                    case["transcript"].sort(key=lambda event: event["timestamp"])
                    first_handled_index = next(
                        index
                        for index, event in enumerate(case["director_trace"])
                        if event["event_kind"] == "room_result_handled"
                    )
                    case["director_trace"].insert(
                        first_handled_index + 1,
                        {
                            "event_id": "director-mid-run-user-message",
                            "event_kind": "user_message",
                            "timestamp": user_event["timestamp"],
                            "room_ref": "director",
                            "thread_event_ref": None,
                            "transcript_event_ref": user_event["event_id"],
                            "phase": "monitoring",
                            "details": {"action": "new user message"},
                        },
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("first action after user message", result.stdout)

    def test_post_creation_user_message_cannot_be_omitted_from_activity_trace(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    case["transcript"].insert(
                        -1,
                        {
                            "event_id": "untraced-user-message",
                            "role": "user",
                            "timestamp": (
                                datetime.fromisoformat(case["session"]["started_at"])
                                + timedelta(seconds=6)
                            ).isoformat(),
                            "content": "任务有结果了吗？",
                        },
                    )

                    case["transcript"].sort(key=lambda event: event["timestamp"])

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("omits a post-creation user message", result.stdout)

    def test_integration_must_be_the_final_director_action(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    integration = case["director_trace"][-1]
                    case["director_trace"].append(
                        {
                            "event_id": "post-integration-local-work",
                            "event_kind": "local_activity",
                            "timestamp": (
                                datetime.fromisoformat(integration["timestamp"])
                                + timedelta(milliseconds=1)
                            ).isoformat(),
                            "room_ref": "director",
                            "thread_event_ref": None,
                            "transcript_event_ref": None,
                            "phase": "unrelated_work",
                            "details": {"action": "continued after integration"},
                        }
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("integration completion is not the final", result.stdout)

    def test_real_wait_threads_multi_target_response_shape_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    waits = [
                        event
                        for event in case["thread_trace"]
                        if event["tool_name"] == "wait_threads"
                    ]
                    first, second = waits
                    first_target = first["request_args"]["targets"][0]
                    second_target = second["request_args"]["targets"][0]
                    first["request_args"] = {
                        "targets": [first_target, deepcopy(second_target)],
                        "timeoutMs": 30000,
                    }
                    first["response_result"] = {
                        "timedOut": False,
                        "wake": {
                            "reason": "completed",
                            "threadId": first_target["threadId"],
                            "hostId": first_target["hostId"],
                        },
                        "polls": [
                            {
                                "schemaVersion": 1,
                                "cursor": "multi-cursor-1",
                                "revision": 1,
                                "changed": True,
                                "thread": {
                                    "id": first_target["threadId"],
                                    "hostId": first_target["hostId"],
                                    "status": {"type": "completed"},
                                },
                                "latestTurn": {
                                    "status": "completed",
                                    "completedAt": int(
                                        datetime.fromisoformat(first["completed_at"]).timestamp()
                                    ),
                                },
                                "latestAssistantMessage": {
                                    "id": "multi-message-1",
                                    "text": "READY_FOR_REVIEW: bounded evidence returned.",
                                },
                            },
                            {
                                "schemaVersion": 1,
                                "cursor": "multi-cursor-2",
                                "revision": 1,
                                "changed": True,
                                "thread": {
                                    "id": second_target["threadId"],
                                    "hostId": second_target["hostId"],
                                    "status": {"type": "running"},
                                },
                                "latestTurn": {
                                    "status": "running",
                                    "completedAt": None,
                                },
                            },
                        ],
                        "errors": [],
                    }
                    second_target["afterCursor"] = "multi-cursor-2"

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_immediate_snapshot_may_return_an_unchanged_cursor(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "confirmed-promptless-receive-review-integration"
                    )
                    waits = [
                        event
                        for event in case["thread_trace"]
                        if event["tool_name"] == "wait_threads"
                    ]
                    second = waits[-1]
                    target = deepcopy(second["request_args"]["targets"][0])
                    prior_cursor = second["response_result"]["polls"][0]["cursor"]
                    target["afterCursor"] = prior_cursor
                    snapshot = deepcopy(second)
                    snapshot["event_id"] = "unchanged-immediate-snapshot"
                    snapshot["started_at"] = (
                        datetime.fromisoformat(second["completed_at"])
                        + timedelta(seconds=1)
                    ).isoformat()
                    snapshot["completed_at"] = (
                        datetime.fromisoformat(snapshot["started_at"])
                        + timedelta(milliseconds=100)
                    ).isoformat()
                    snapshot["request_args"] = {"targets": [target], "timeoutMs": 0}
                    snapshot["response_result"] = {
                        "timedOut": True,
                        "wake": None,
                        "polls": [
                            {
                                "schemaVersion": 1,
                                "cursor": prior_cursor,
                                "revision": 1,
                                "changed": False,
                                "thread": {
                                    "id": target["threadId"],
                                    "hostId": target["hostId"],
                                    "status": {"type": "running"},
                                },
                                "latestTurn": {
                                    "status": "running",
                                    "completedAt": None,
                                },
                            }
                        ],
                        "errors": [],
                    }
                    integration_gate_index = next(
                        index
                        for index, event in enumerate(case["thread_trace"])
                        if event["tool_name"] == "exec_command"
                    )
                    case["thread_trace"].insert(integration_gate_index, snapshot)
                    integration_director_index = next(
                        index
                        for index, event in enumerate(case["director_trace"])
                        if event.get("thread_event_ref")
                        == case["thread_trace"][integration_gate_index + 1]["event_id"]
                    )
                    case["director_trace"].insert(
                        integration_director_index,
                        {
                            "event_id": "director-unchanged-immediate-snapshot",
                            "event_kind": "host_tool",
                            "timestamp": snapshot["completed_at"],
                            "room_ref": snapshot["room_ref"],
                            "thread_event_ref": snapshot["event_id"],
                            "transcript_event_ref": None,
                            "phase": "host_operation",
                            "details": {"tool_name": "wait_threads"},
                        },
                    )

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_director_trace_completeness_cannot_be_self_certified(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    case["director_trace_complete"] = True

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("director_trace_complete is an unsupported self-claim", result.stdout)

    def test_writer_pass_requires_independent_reviewer_binding(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    for event in case["director_trace"]:
                        if event["event_kind"] == "return_verified":
                            event["details"].pop("reviewer_ref", None)
                            event["details"].pop("review_evidence_ref", None)

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("independent reviewer evidence", result.stdout)

    def test_writer_return_requires_host_bound_verification(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    for event in case["director_trace"]:
                        if event["event_kind"] == "return_verified":
                            event["details"].pop("verification_tool_ref", None)

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("return verification lacks a successful host gate", result.stdout)

    def test_director_review_requires_host_bound_gate(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    for event in case["director_trace"]:
                        if (
                            event["event_kind"] == "review_completed"
                            and event["details"].get("reviewer_ref") == "director"
                        ):
                            event["details"].pop("review_tool_ref", None)

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("director review lacks a successful host gate", result.stdout)

    def test_integration_requires_host_bound_combined_gate(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))

            def mutate(payload: dict[str, Any], artifact: dict[str, Any]) -> None:
                for collection in (payload["cases"], artifact["cases"]):
                    case = next(
                        item
                        for item in collection
                        if item["case_id"] == "frontend-backend-confirmed-parallel"
                    )
                    integration = next(
                        event
                        for event in case["director_trace"]
                        if event["event_kind"] == "integration_completed"
                    )
                    integration["details"].pop("gate_tool_ref", None)

            self.mutate_results(results, mutate)
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("integration lacks a successful combined host gate", result.stdout)

    def test_invalid_raw_result_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_result = results.parent / payload["raw_result_path"]
            raw_result.write_text("{}", encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("raw result schema is unsupported", result.stdout)


if __name__ == "__main__":
    unittest.main()
