#!/usr/bin/env python3
"""Regression tests for UI-design live-evidence validation."""

from __future__ import annotations

import hashlib
import json
import struct
import subprocess
import tempfile
import unittest
import zlib
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

from live_evidence_isolation import build_allowed_inputs, input_manifest_digest
from runtime_identity import source_revision, source_runtime_digest
from runtime_governance_contract import (
    DELIVERY_SHAPE_SCHEMA,
    delivery_shape_pre_lock_digest,
)


ROOT = Path(__file__).resolve().parents[1]
EVALUATOR = ROOT / "scripts/evaluate_ui_design_live_behavior.py"
CASES = ROOT / "tests/ui-design-live-behavior-cases.json"
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def isolation_manifest(revision: str, runtime_digest: str) -> dict[str, object]:
    allowed_inputs = build_allowed_inputs("codex")
    return {
        "schema": "sliver-live-evidence-isolation/v1",
        "environment": "github_hosted_ephemeral",
        "workspace_origin": "versioned_synthetic_fixture",
        "source_revision": revision,
        "runtime_digest": runtime_digest,
        "producer": {"kind": "github_actions", "repository": "example/sliver-vibe-coding", "workflow_path": ".github/workflows/external-live-evidence.yml", "run_id": "123456"},
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


def png_chunk(kind: bytes, data: bytes) -> bytes:
    payload = kind + data
    return (
        struct.pack(">I", len(data))
        + payload
        + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)
    )


def solid_png(width: int, height: int, *, alpha: int = 255) -> bytes:
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    scanline = b"\x00" + bytes((0, 0, 0, alpha)) * width
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(scanline * height))
        + png_chunk(b"IEND", b"")
    )


def structured_contract_png(
    width: int, height: int, *, alpha: int = 255, seed: int = 0
) -> bytes:
    """Build decodable non-placeholder pixels for artifact-contract unit tests only."""
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    rows = []
    for y in range(height):
        row = bytearray(b"\x00")
        for x in range(width):
            row.extend(
                (
                    (x * 17 + seed) % 251,
                    (y * 29 + seed * 3) % 251,
                    ((x + y) * 11 + seed * 7) % 251,
                    alpha,
                )
            )
        rows.append(bytes(row))
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(b"".join(rows)))
        + png_chunk(b"IEND", b"")
    )


class UIDesignLiveContractsTest(unittest.TestCase):
    def run_evaluator(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(["python3", "-B", str(EVALUATOR), *args], cwd=ROOT, text=True, capture_output=True, check=False)

    def make_valid_results(self, directory: Path) -> Path:
        cases = json.loads(CASES.read_text(encoding="utf-8"))["cases"]
        now = datetime.now(timezone.utc).replace(microsecond=0)
        generated_at = now.isoformat()
        judged_cases = []
        raw_cases = []
        for index, case in enumerate(cases):
            session_id = f"fresh-session-{index:02d}"
            start = now - timedelta(minutes=5)
            end = now - timedelta(minutes=1)
            system_id = f"{case['id']}:system"
            user_id = f"{case['id']}:user"
            transcript = [
                {"event_id": system_id, "role": "system", "timestamp": start.isoformat(), "content": "Selected skill sliver-vibe-coding for this fresh session."},
                {"event_id": user_id, "role": "user", "timestamp": (start + timedelta(seconds=1)).isoformat(), "content": case["initial_user"]},
            ]
            requirements = list(case.get("required_tool_evidence") or [
                {"kind": "read", "target": case["fixture"]["path"]}
            ])
            if any(
                kind.startswith("rendered_screenshot")
                for kind in case["required_artifact_kinds"]
            ) and not any(item["kind"] == "render" for item in requirements):
                requirements.append(
                    {
                        "kind": "render",
                        "target": f"synthetic-render:{case['fixture']['path']}",
                    }
                )
            if {
                "reference_screenshot",
                "candidate_screenshot",
            } <= set(case["required_artifact_kinds"]):
                render_count = sum(
                    requirement["kind"] == "render" for requirement in requirements
                )
                if render_count < 2:
                    contracted_render_target = next(
                        requirement["target"]
                        for requirement in requirements
                        if requirement["kind"] == "render"
                    )
                    requirements.append(
                        {
                            "kind": "render",
                            "target": contracted_render_target,
                        }
                    )
            tool_trace = []
            for tool_index in range(max(case["minimum_tool_events"], len(requirements))):
                requirement = requirements[min(tool_index, len(requirements) - 1)]
                event_id = f"{case['id']}:tool-event-{tool_index}"
                call_id = f"{case['id']}:tool-call-{tool_index}"
                transcript.append({"event_id": event_id, "role": "tool", "timestamp": (start + timedelta(seconds=2 + tool_index)).isoformat(), "content": f"{requirement['kind']} evidence captured for {requirement['target']}."})
                tool_trace.append({
                    "tool_call_id": call_id,
                    "tool_name": f"workspace.{requirement['kind']}",
                    "status": "success",
                    "started_at": (start + timedelta(seconds=2 + tool_index)).isoformat(),
                    "completed_at": (start + timedelta(seconds=2 + tool_index, milliseconds=500)).isoformat(),
                    "request_summary": f"Capture {requirement['kind']} evidence at exact target {requirement['target']}",
                    "response_summary": f"Verified exact target {requirement['target']} for case {case['id']}",
                    "evidence_kind": requirement["kind"],
                    "evidence_target": requirement["target"],
                    "transcript_event_ref": event_id,
                })
            final_text = f"Completed the bounded rubric behavior for {case['id']} with linked evidence."
            assistant_id = f"{case['id']}:assistant"
            transcript.append({"event_id": assistant_id, "role": "assistant", "timestamp": end.isoformat(), "content": final_text})

            artifacts = []
            for artifact_index, kind in enumerate(case["required_artifact_kinds"]):
                image_sizes = {
                    "prototype_image": (320, 200),
                    "transparent_asset": (32, 32),
                    "rendered_screenshot": (640, 360),
                    "rendered_screenshot_light": (640, 360),
                    "rendered_screenshot_dark": (640, 360),
                    "rendered_screenshot_mobile": (240, 320),
                    "reference_screenshot": (640, 360),
                    "candidate_screenshot": (640, 360),
                }
                suffix = ".png" if kind in image_sizes else ".txt"
                artifact_path = directory / f"{case['id']}-{kind}{suffix}"
                if kind in image_sizes:
                    width, height = image_sizes[kind]
                    if kind == "transparent_asset":
                        artifact_path.write_bytes(
                            solid_png(width, height, alpha=0)
                        )
                    else:
                        artifact_path.write_bytes(
                            structured_contract_png(
                                width,
                                height,
                                seed=artifact_index + 1,
                            )
                        )
                elif kind == "dom_accessibility_snapshot":
                    artifact_path.write_text(
                        json.dumps(
                            {
                                "schema": "sliver-dom-accessibility-snapshot/v1",
                                "source": f"synthetic browser snapshot for {case['id']}",
                                "nodes": [
                                    {
                                        "role": "button",
                                        "name": "Complete task",
                                        "states": ["enabled", "focusable"],
                                    }
                                ],
                            }
                        ),
                        encoding="utf-8",
                    )
                elif kind == "interaction_trace":
                    artifact_path.write_text(
                        json.dumps(
                            {
                                "schema": "sliver-interaction-trace/v1",
                                "source": f"synthetic browser interaction for {case['id']}",
                                "steps": [
                                    {
                                        "action": "activate the primary action",
                                        "expected": "the bounded result becomes visible",
                                        "observed": "the bounded result became visible",
                                        "status": "passed",
                                    }
                                ],
                            }
                        ),
                        encoding="utf-8",
                    )
                else:
                    artifact_path.write_text(
                        f"real captured {kind} evidence for {case['id']}\n",
                        encoding="utf-8",
                    )
                producing_call = tool_trace[min(artifact_index, len(tool_trace) - 1)]
                if kind.startswith("rendered_screenshot"):
                    producing_call = next(
                        call for call in tool_trace if call["evidence_kind"] == "render"
                    )
                elif kind in {"reference_screenshot", "candidate_screenshot"}:
                    render_calls = [
                        call
                        for call in tool_trace
                        if call["evidence_kind"] == "render"
                    ]
                    producing_call = render_calls[
                        0 if kind == "reference_screenshot" else 1
                    ]
                visual_artifact = kind.startswith("rendered_screenshot") or kind in {
                    "prototype_image",
                    "reference_screenshot",
                    "candidate_screenshot",
                }
                artifacts.append({
                    "artifact_id": f"{case['id']}:artifact-{artifact_index}",
                    "kind": kind,
                    "path": artifact_path.name,
                    "sha256": digest(artifact_path),
                    "tool_call_id": producing_call["tool_call_id"],
                    "evidence_role": (
                        "reference" if kind == "reference_screenshot"
                        else "candidate" if kind == "candidate_screenshot"
                        else "supporting"
                    ),
                    "pair_id": (
                        f"{case['id']}:default-pair"
                        if kind in {"reference_screenshot", "candidate_screenshot"}
                        else "not_applicable"
                    ),
                    "viewport": "desktop-640x360" if visual_artifact else "not_applicable",
                    "state": "default" if visual_artifact else "not_applicable",
                    "theme": "light" if visual_artifact else "not_applicable",
                })
            pre_lock_artifact = next(
                (
                    artifact
                    for artifact in artifacts
                    if artifact["kind"] == "delivery_shape_pre_lock"
                ),
                None,
            )
            acceptance_artifact = next(
                (
                    artifact
                    for artifact in artifacts
                    if artifact["kind"] == "delivery_shape_acceptance"
                ),
                None,
            )
            if pre_lock_artifact is not None and acceptance_artifact is not None:
                pre_lock = {
                    "schema": DELIVERY_SHAPE_SCHEMA,
                    "phase": "pre_implementation",
                    "target_surface": case["id"],
                    "non_mechanical": True,
                    "owner_paths": ["synthetic/ui/Surface.tsx"],
                    "constraint_owner_paths": ["synthetic/ui/tokens.css"],
                    "allowed_regions": ["target-region"],
                    "unchanged_regions": ["navigation"],
                    "proposed_changed_regions": ["target-region"],
                    "user_task": {
                        "primary_user": "synthetic operator",
                        "single_job": "complete the bounded surface task",
                        "success_signal": "the bounded result is visible",
                    },
                    "interaction_model": {
                        "familiar_pattern": "single-surface task completion",
                        "user_objects": ["task result"],
                        "user_actions": ["complete task"],
                        "expected_results": ["the task result becomes visible"],
                        "system_concepts": [
                            {
                                "id": "runner-state",
                                "disposition": "hidden_internal",
                                "user_need": None,
                                "element_ref": None,
                            }
                        ],
                        "deviation": {
                            "status": "conforming",
                            "reason": None,
                            "evidence_refs": [],
                        },
                    },
                    "journey": {
                        "entry": "open the bounded synthetic surface",
                        "preconditions": [],
                        "primary_action": "complete the task",
                        "system_response": "show the bounded result",
                        "success_signal": "the result is visible",
                        "next_action": "leave the completed surface",
                        "boundaries": [
                            {"id": "cancel_back", "status": "applicable", "expected": "leave without applying the result"},
                            {"id": "error_recovery", "status": "applicable", "expected": "retain input and offer retry"},
                            {"id": "refresh_resume", "status": "applicable", "expected": "restore the bounded surface"},
                            {"id": "deep_link", "status": "out_of_scope", "expected": "the synthetic surface has no deep link"},
                            {"id": "role_handoff", "status": "out_of_scope", "expected": "one synthetic operator owns the task"},
                        ],
                    },
                    "stable_reference": {
                        "status": "present",
                        "role": "finished_product",
                        "kind": "rendered_capture",
                        "ref": next(
                            artifact["artifact_id"]
                            for artifact in artifacts
                            if artifact["kind"] == "reference_screenshot"
                        ),
                        "sha256": next(
                            artifact["sha256"]
                            for artifact in artifacts
                            if artifact["kind"] == "reference_screenshot"
                        ),
                    },
                    "introduced_or_changed_elements": [
                        {
                            "id": "primary-action",
                            "kind": "action",
                            "user_need": "complete the bounded task",
                            "source_owner": "synthetic/product-contract.json",
                            "visibility": "primary",
                            "display_condition": "always",
                        }
                    ],
                    "source_schema_projection": {
                        "status": "not_applicable",
                        "fields": [],
                    },
                    "interaction_states": ["default"],
                    "acceptance_requirements": {
                        "affected_viewports": ["desktop-640x360"],
                        "reference_comparison_required": True,
                        "dom_semantics_required": True,
                        "keyboard_required": True,
                    },
                    "acceptance_evidence": None,
                }
                pre_lock_path = directory / pre_lock_artifact["path"]
                pre_lock_path.write_text(json.dumps(pre_lock), encoding="utf-8")
                pre_lock_artifact["sha256"] = digest(pre_lock_path)
                reference_artifact = next(
                    artifact
                    for artifact in artifacts
                    if artifact["kind"] == "reference_screenshot"
                )
                candidate_artifact = next(
                    artifact
                    for artifact in artifacts
                    if artifact["kind"] == "candidate_screenshot"
                )
                dom_artifact = next(
                    artifact
                    for artifact in artifacts
                    if artifact["kind"] == "dom_accessibility_snapshot"
                )
                interaction_artifact = next(
                    artifact
                    for artifact in artifacts
                    if artifact["kind"] == "interaction_trace"
                )
                acceptance = deepcopy(pre_lock)
                acceptance.update(
                    phase="acceptance",
                    pre_lock_digest=delivery_shape_pre_lock_digest(pre_lock),
                    source_revision="revision-17",
                    acceptance_evidence={
                        "visual_pairs": [
                            {
                                "pair_id": reference_artifact["pair_id"],
                                "reference_artifact": reference_artifact["artifact_id"],
                                "candidate_artifact": candidate_artifact["artifact_id"],
                                "viewport": reference_artifact["viewport"],
                                "state": reference_artifact["state"],
                                "theme": reference_artifact["theme"],
                            }
                        ],
                        "dom_snapshot_refs": [dom_artifact["artifact_id"]],
                        "interaction_refs": [interaction_artifact["artifact_id"]],
                        "changed_region_refs": [candidate_artifact["artifact_id"]],
                        "unchanged_region_refs": [reference_artifact["artifact_id"]],
                        "independent_review_ref": "judge:independent",
                    },
                )
                acceptance_path = directory / acceptance_artifact["path"]
                acceptance_path.write_text(
                    json.dumps(acceptance), encoding="utf-8"
                )
                acceptance_artifact["sha256"] = digest(acceptance_path)
            raw_case = {
                "case_id": case["id"],
                "fixture": case["fixture"],
                "initial_user": case["initial_user"],
                "skill_selection": {"selected": True, "skill_name": "sliver-vibe-coding", "selected_at": start.isoformat(), "evidence_ref": system_id},
                "session": {"session_id": session_id, "started_at": start.isoformat(), "ended_at": end.isoformat()},
                "transcript": transcript,
                "tool_trace": tool_trace,
                "artifacts": artifacts,
                "final_output": final_text,
            }
            required_behavior_results = {}
            for behavior_index, behavior in enumerate(case["required_behaviors"]):
                evidence_refs = [
                    tool_trace[behavior_index % len(tool_trace)]["tool_call_id"]
                ]
                if artifacts:
                    evidence_refs.append(
                        artifacts[behavior_index % len(artifacts)]["artifact_id"]
                    )
                required_behavior_results[behavior] = {
                    "passed": True,
                    "evidence_refs": evidence_refs,
                }
            judge = {
                "status": "pass",
                "reason": "Independent rubric review verified linked raw transcript, tool, and artifact evidence.",
                "rubric_version": "ui-design-lifecycle/v5",
                "required_behavior_results": required_behavior_results,
                "forbidden_behavior_results": {behavior: {"observed": False, "evidence_refs": [f"session:{session_id}"]} for behavior in case["forbidden_behaviors"]},
            }
            raw_cases.append(raw_case)
            judged_cases.append({**deepcopy(raw_case), "judge": judge})

        runner = {"name": "fixture-live-runner", "version": "1.0.0", "invocation_id": "ui-live-invocation"}
        revision = source_revision(ROOT)
        runtime_digest = source_runtime_digest(ROOT, "codex")
        runner_isolation = isolation_manifest(revision, runtime_digest)
        raw_artifact = {
            "schema": "sliver-ui-design-live-run-artifact/v3",
            "run_id": "ui-live-run",
            "runtime_target": "codex",
            "runtime_digest": runtime_digest,
            "source_revision": revision,
            "platform": "test-platform",
            "model": "subject-model",
            "generated_at": generated_at,
            "runner_isolation": runner_isolation,
            "runner_provenance": runner,
            "cases": raw_cases,
        }
        raw_path = directory / "runner-artifact.json"
        raw_path.write_text(json.dumps(raw_artifact), encoding="utf-8")
        payload = {
            "schema": "sliver-ui-design-live-results/v4",
            "run_id": "ui-live-run",
            "skill_version": VERSION,
            "runtime_target": "codex",
            "runtime_digest": runtime_digest,
            "source_revision": revision,
            "platform": "test-platform",
            "model": "subject-model",
            "generated_at": generated_at,
            "fresh_session": True,
            "runner_isolation": runner_isolation,
            "runner_provenance": {**runner, "artifact_path": raw_path.name, "artifact_sha256": digest(raw_path)},
            "judge_provenance": {"kind": "model", "identity": "independent-judge", "version": "1.0.0", "independent_from_subject": True, "rubric_version": "ui-design-lifecycle/v5", "judged_at": (now - timedelta(seconds=1)).isoformat()},
            "rubric_version": "ui-design-lifecycle/v5",
            "cases": judged_cases,
        }
        results = directory / "results.json"
        results.write_text(json.dumps(payload), encoding="utf-8")
        return results

    def test_contract_only_passes_without_claiming_live_execution(self) -> None:
        result = self.run_evaluator("--contract-only")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("live model behavior not executed", result.stdout)

    def test_complete_hashed_synthetic_contract_fixture_passes(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            result = self.run_evaluator("--results", str(self.make_valid_results(Path(raw))))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("22 fresh-session cases", result.stdout)

    def test_required_behaviors_cannot_all_reuse_one_read_call(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            case = payload["cases"][0]
            first_tool = case["tool_trace"][0]["tool_call_id"]
            for verdict in case["judge"]["required_behavior_results"].values():
                verdict["evidence_refs"] = [first_tool]
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "all required behaviors collapse onto one direct tool event",
            result.stdout,
        )

    def test_reference_and_candidate_context_mismatch_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            case = next(
                item
                for item in payload["cases"]
                if item["case_id"] == "mature-reference-constrains-new-surface"
            )
            candidate = next(
                item for item in case["artifacts"] if item["kind"] == "candidate_screenshot"
            )
            candidate["viewport"] = "mobile-240x320"
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            raw_case = next(
                item
                for item in raw_payload["cases"]
                if item["case_id"] == "mature-reference-constrains-new-surface"
            )
            raw_candidate = next(
                item
                for item in raw_case["artifacts"]
                if item["kind"] == "candidate_screenshot"
            )
            raw_candidate["viewport"] = "mobile-240x320"
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("reference/candidate viewport, state, and theme must match", result.stdout)

    def test_reference_and_candidate_same_capture_bytes_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            case = next(
                item
                for item in payload["cases"]
                if item["case_id"] == "mature-reference-constrains-new-surface"
            )
            reference = next(
                item for item in case["artifacts"] if item["kind"] == "reference_screenshot"
            )
            candidate = next(
                item for item in case["artifacts"] if item["kind"] == "candidate_screenshot"
            )
            (directory / candidate["path"]).write_bytes(
                (directory / reference["path"]).read_bytes()
            )
            candidate["sha256"] = digest(directory / candidate["path"])
            raw_case = next(
                item for item in raw_payload["cases"] if item["case_id"] == case["case_id"]
            )
            raw_candidate = next(
                item
                for item in raw_case["artifacts"]
                if item["artifact_id"] == candidate["artifact_id"]
            )
            raw_candidate["sha256"] = candidate["sha256"]
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be distinct captures", result.stdout)

    def test_reference_and_candidate_same_capture_call_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            case = next(
                item
                for item in payload["cases"]
                if item["case_id"] == "mature-reference-constrains-new-surface"
            )
            reference = next(
                item for item in case["artifacts"] if item["kind"] == "reference_screenshot"
            )
            candidate = next(
                item for item in case["artifacts"] if item["kind"] == "candidate_screenshot"
            )
            candidate["tool_call_id"] = reference["tool_call_id"]
            raw_case = next(
                item for item in raw_payload["cases"] if item["case_id"] == case["case_id"]
            )
            raw_candidate = next(
                item
                for item in raw_case["artifacts"]
                if item["artifact_id"] == candidate["artifact_id"]
            )
            raw_candidate["tool_call_id"] = candidate["tool_call_id"]
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must come from distinct capture calls", result.stdout)

    def test_interaction_trace_must_be_structured_behavior_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            case = next(
                item
                for item in payload["cases"]
                if item["case_id"] == "schema-rich-settings-requires-user-task-reduction"
            )
            trace = next(
                item for item in case["artifacts"] if item["kind"] == "interaction_trace"
            )
            trace_path = directory / trace["path"]
            trace_path.write_text("interaction passed", encoding="utf-8")
            trace["sha256"] = digest(trace_path)
            raw_case = next(
                item for item in raw_payload["cases"] if item["case_id"] == case["case_id"]
            )
            raw_trace = next(
                item
                for item in raw_case["artifacts"]
                if item["artifact_id"] == trace["artifact_id"]
            )
            raw_trace["sha256"] = trace["sha256"]
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid JSON", result.stdout)

    def test_delivery_shape_acceptance_cannot_bind_a_tampered_pre_lock(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            case = next(
                item
                for item in payload["cases"]
                if item["case_id"]
                == "schema-rich-settings-requires-user-task-reduction"
            )
            pre_lock_artifact = next(
                item
                for item in case["artifacts"]
                if item["kind"] == "delivery_shape_pre_lock"
            )
            pre_lock_path = directory / pre_lock_artifact["path"]
            pre_lock = json.loads(pre_lock_path.read_text(encoding="utf-8"))
            pre_lock["user_task"]["single_job"] = "show every available field"
            pre_lock_path.write_text(json.dumps(pre_lock), encoding="utf-8")
            pre_lock_artifact["sha256"] = digest(pre_lock_path)
            raw_case = next(
                item
                for item in raw_payload["cases"]
                if item["case_id"] == case["case_id"]
            )
            raw_pre_lock = next(
                item
                for item in raw_case["artifacts"]
                if item["artifact_id"] == pre_lock_artifact["artifact_id"]
            )
            raw_pre_lock["sha256"] = pre_lock_artifact["sha256"]
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "delivery-shape acceptance does not bind the pre-lock digest",
            result.stdout,
        )

    def test_delivery_shape_acceptance_requires_interaction_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            case = next(
                item
                for item in payload["cases"]
                if item["case_id"]
                == "schema-rich-settings-requires-user-task-reduction"
            )
            interaction_id = next(
                item["artifact_id"]
                for item in case["artifacts"]
                if item["kind"] == "interaction_trace"
            )
            case["artifacts"] = [
                item
                for item in case["artifacts"]
                if item["artifact_id"] != interaction_id
            ]
            raw_case = next(
                item
                for item in raw_payload["cases"]
                if item["case_id"] == case["case_id"]
            )
            raw_case["artifacts"] = [
                item
                for item in raw_case["artifacts"]
                if item["artifact_id"] != interaction_id
            ]
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "missing required artifact kind: interaction_trace",
            result.stdout,
        )

    def test_version_only_candidate_identity_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            payload.pop("runtime_digest")
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("runtime_digest", result.stdout)

    def test_wrong_runtime_candidate_digest_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            payload["runtime_digest"] = "0" * 64
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("exact source runtime candidate", result.stdout)

    def test_reused_session_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            payload["cases"][1]["session"]["session_id"] = payload["cases"][0]["session"]["session_id"]
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("fresh-session evidence reused", result.stdout)

    def test_tampered_runner_artifact_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            (directory / "runner-artifact.json").write_text("{}", encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("runner artifact SHA-256", result.stdout)

    def test_unknown_behavior_evidence_reference_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            first = next(iter(payload["cases"][0]["judge"]["required_behavior_results"].values()))
            first["evidence_refs"] = ["invented-evidence"]
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("behavior cites unknown evidence", result.stdout)

    def test_fail_status_cannot_return_live_success(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            payload["cases"][0]["judge"]["status"] = "fail"
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("live judge status is fail", result.stdout)

    def test_missing_required_artifact_kind_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            payload["cases"][0]["artifacts"] = []
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing required artifact kind", result.stdout)

    def test_text_file_cannot_masquerade_as_image_artifact(self) -> None:
        image_kinds = (
            "prototype_image",
            "transparent_asset",
            "rendered_screenshot",
            "rendered_screenshot_light",
            "rendered_screenshot_dark",
            "rendered_screenshot_mobile",
            "reference_screenshot",
            "candidate_screenshot",
        )
        for kind in image_kinds:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as raw:
                directory = Path(raw)
                results = self.make_valid_results(directory)
                payload = json.loads(results.read_text(encoding="utf-8"))
                raw_path = directory / payload["runner_provenance"]["artifact_path"]
                raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
                image_artifact = next(
                    artifact
                    for case in payload["cases"]
                    for artifact in case["artifacts"]
                    if artifact["kind"] == kind
                )
                image_path = directory / image_artifact["path"]
                image_path.write_text("not an image\n", encoding="utf-8")
                image_artifact["sha256"] = digest(image_path)
                raw_image = next(
                    artifact
                    for case in raw_payload["cases"]
                    for artifact in case["artifacts"]
                    if artifact["artifact_id"] == image_artifact["artifact_id"]
                )
                raw_image["sha256"] = image_artifact["sha256"]
                raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
                payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
                results.write_text(json.dumps(payload), encoding="utf-8")

                result = self.run_evaluator("--results", str(results))

                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"{kind} must be a valid PNG", result.stdout)

    def test_placeholder_sized_png_cannot_masquerade_as_screenshot(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            screenshot = next(
                artifact
                for case in payload["cases"]
                for artifact in case["artifacts"]
                if artifact["kind"] == "rendered_screenshot"
            )
            screenshot_path = directory / screenshot["path"]
            screenshot_path.write_bytes(solid_png(1, 1))
            screenshot["sha256"] = digest(screenshot_path)
            raw_screenshot = next(
                artifact
                for case in raw_payload["cases"]
                for artifact in case["artifacts"]
                if artifact["artifact_id"] == screenshot["artifact_id"]
            )
            raw_screenshot["sha256"] = screenshot["sha256"]
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")

            result = self.run_evaluator("--results", str(results))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be at least 640x360 pixels", result.stdout)

    def test_full_sized_solid_png_cannot_masquerade_as_screenshot(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            screenshot = next(
                artifact
                for case in payload["cases"]
                for artifact in case["artifacts"]
                if artifact["kind"] == "rendered_screenshot"
            )
            screenshot_path = directory / screenshot["path"]
            screenshot_path.write_bytes(solid_png(640, 360))
            screenshot["sha256"] = digest(screenshot_path)
            raw_screenshot = next(
                artifact
                for case in raw_payload["cases"]
                for artifact in case["artifacts"]
                if artifact["artifact_id"] == screenshot["artifact_id"]
            )
            raw_screenshot["sha256"] = screenshot["sha256"]
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")

            result = self.run_evaluator("--results", str(results))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("solid or low-information placeholder", result.stdout)

    def test_generic_tool_summary_without_exact_target_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            results = self.make_valid_results(Path(raw))
            payload = json.loads(results.read_text(encoding="utf-8"))
            event = payload["cases"][0]["tool_trace"][0]
            event.pop("evidence_kind")
            event.pop("evidence_target")
            results.write_text(json.dumps(payload), encoding="utf-8")
            result = self.run_evaluator("--results", str(results))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("evidence_kind", result.stdout)

    def test_rendered_screenshot_must_be_linked_to_a_render_tool_event(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            case = next(
                item
                for item in payload["cases"]
                if item["case_id"] == "non-prototype-floating-table-locks-baseline"
            )
            screenshot = next(
                item for item in case["artifacts"] if item["kind"] == "rendered_screenshot"
            )
            read_call = next(
                item["tool_call_id"]
                for item in case["tool_trace"]
                if item["evidence_kind"] == "read"
            )
            screenshot["tool_call_id"] = read_call
            raw_case = next(
                item
                for item in raw_payload["cases"]
                if item["case_id"] == case["case_id"]
            )
            raw_screenshot = next(
                item
                for item in raw_case["artifacts"]
                if item["artifact_id"] == screenshot["artifact_id"]
            )
            raw_screenshot["tool_call_id"] = read_call
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")

            result = self.run_evaluator("--results", str(results))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("rendered screenshot must come from a render tool event", result.stdout)

    def test_rendered_screenshot_must_use_the_contracted_render_target(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            results = self.make_valid_results(directory)
            payload = json.loads(results.read_text(encoding="utf-8"))
            raw_path = directory / payload["runner_provenance"]["artifact_path"]
            raw_payload = json.loads(raw_path.read_text(encoding="utf-8"))
            case = next(
                item
                for item in payload["cases"]
                if item["case_id"] == "non-prototype-floating-table-locks-baseline"
            )
            screenshot = next(
                item for item in case["artifacts"] if item["kind"] == "rendered_screenshot"
            )
            render_call = next(
                item
                for item in case["tool_trace"]
                if item["tool_call_id"] == screenshot["tool_call_id"]
            )
            render_call["evidence_target"] = "tests/ui-design-live-fixtures/workspaces/table-system/not-the-render-entry.html"
            raw_case = next(
                item
                for item in raw_payload["cases"]
                if item["case_id"] == case["case_id"]
            )
            raw_render_call = next(
                item
                for item in raw_case["tool_trace"]
                if item["tool_call_id"] == screenshot["tool_call_id"]
            )
            raw_render_call["evidence_target"] = render_call["evidence_target"]
            raw_path.write_text(json.dumps(raw_payload), encoding="utf-8")
            payload["runner_provenance"]["artifact_sha256"] = digest(raw_path)
            results.write_text(json.dumps(payload), encoding="utf-8")

            result = self.run_evaluator("--results", str(results))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("contracted render target", result.stdout)


if __name__ == "__main__":
    unittest.main()
