#!/usr/bin/env node
// 任务状态机回归测试：状态转移合法性 + CAS 并发锁边界。
// 覆盖 update-target-task-state.mjs 的两处硬化：
//   1) 非法状态转移必须被硬拦截（禁止跳步、done 非终态但只能退一格到 doing）。
//   2) --expected-revision 传空串时不得静默跳过 CAS（并发锁不可被空值绕过）。
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptPath = path.join(repoRoot, "tools", "update-target-task-state.mjs");

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function run(root, ...extra) {
  return spawnSync(process.execPath, [scriptPath, root, "--json", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function parseJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Expected JSON output, got:\n${result.stdout}\n${result.stderr}`);
  }
}

// 构造一个带任务胶囊的最小合法目标项目，初始状态由入参给定。
function makeTarget(base, name, initialStatus) {
  const root = path.join(base, name);
  fs.mkdirSync(root, { recursive: true });
  const mapped = {
    productSpec: ["需求文档.md", "# 需求\n"],
    devPlan: ["开发计划.md", "# 计划\n"],
    currentExecution: ["plans/执行光标.md", "# 执行光标\n"],
    manualAcceptance: ["验收记录.md", "# 验收记录\n"],
    interfaceContracts: ["接口契约.md", "# 接口契约\n"],
    projectProfile: ["项目画像.md", "# 项目画像\n"],
    constitutionDesign: ["宪法设计.md", "# 宪法设计\n"],
    documentIndex: ["文档索引.md", "# 文档索引\n"],
  };
  for (const [, [file, content]] of Object.entries(mapped)) writeFile(path.join(root, file), content);
  const capsule = "plans/任务/2026-07-16-demo";
  writeFile(
    path.join(root, capsule, "任务状态.json"),
    `${JSON.stringify({ schemaVersion: 2, phase: "P1", task: "T1", status: initialStatus, checkpoint: "init", nextStep: "go", manualAcceptanceRef: "", revision: "" }, null, 2)}\n`,
  );
  writeFile(
    path.join(root, ".vibe-docs.json"),
    JSON.stringify(
      {
        schemaVersion: 2,
        ...Object.fromEntries(Object.entries(mapped).map(([role, [file]]) => [role, file])),
        documentIndex: "文档索引.md",
        documents: Object.entries(mapped).map(([role, [file, content]]) => ({
          role,
          path: file,
          owner: `test:${role}`,
          authority: ["currentExecution", "documentIndex"].includes(role) ? "projection" : "source",
          contentHash: `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`,
          estimatedTokens: Math.ceil(content.length / 4),
          dependsOn: [],
          sections: [],
        })),
        loadPolicy: { always: ["documentIndex"], never: [] },
        taskContext: { enabled: true, taskCapsulesRoot: "plans/任务", currentTaskCapsule: capsule },
      },
      null,
      2,
    ),
  );
  return { root, capsule };
}

function readStatus(root, capsule) {
  return JSON.parse(fs.readFileSync(path.join(root, capsule, "任务状态.json"), "utf8"));
}

function update(root, status, ...extra) {
  return run(root, "--status", status, "--phase", "P1", "--task", "T1", "--checkpoint", "cp", "--next", "nx", "--write", ...extra);
}

let tmpRoot = "";
try {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-state-machine-"));

  // ---- 合法转移：逐级推进必须放行 ----
  {
    const { root, capsule } = makeTarget(tmpRoot, "legal-todo-doing", "todo");
    const r = update(root, "doing");
    assert.equal(r.status, 0, `todo→doing 应放行: ${r.stderr || r.stdout}`);
    assert.equal(readStatus(root, capsule).status, "doing");
  }
  {
    const { root } = makeTarget(tmpRoot, "legal-doing-done", "doing");
    assert.equal(update(root, "done").status, 0, "doing→done 应放行");
  }
  {
    const { root } = makeTarget(tmpRoot, "legal-doing-blocked", "doing");
    assert.equal(update(root, "blocked").status, 0, "doing→blocked 应放行");
  }
  {
    const { root } = makeTarget(tmpRoot, "legal-blocked-doing", "blocked");
    assert.equal(update(root, "doing").status, 0, "blocked→doing 应放行");
  }
  {
    // done 非终态：允许退一格返工到 doing。
    const { root } = makeTarget(tmpRoot, "legal-done-doing", "done");
    assert.equal(update(root, "doing").status, 0, "done→doing 重开应放行");
  }
  {
    // 自转移：doing→doing 用于打多个进度点，必须放行。
    const { root } = makeTarget(tmpRoot, "legal-self", "doing");
    assert.equal(update(root, "doing").status, 0, "doing→doing 自转移应放行");
  }

  // ---- 非法转移：必须硬拦截（非零退出），且状态不被改写 ----
  const illegal = [
    ["todo", "done", "禁止零执行完成"],
    ["todo", "blocked", "未开始不得直接阻塞，须先进 doing"],
    ["blocked", "done", "卡住不得跳过 doing 直接完成"],
    ["done", "todo", "已完成不得倒回从未开始"],
    ["done", "blocked", "已完成不得直接跳阻塞"],
    ["blocked", "todo", "不得倒回 todo"],
    ["doing", "todo", "不得倒回 todo"],
  ];
  for (const [from, to, why] of illegal) {
    const { root, capsule } = makeTarget(tmpRoot, `illegal-${from}-${to}`, from);
    const r = update(root, to);
    assert.notEqual(r.status, 0, `非法转移 ${from}→${to} 必须被拒(${why}): 却放行了`);
    assert.equal(readStatus(root, capsule).status, from, `非法转移被拒后原状态必须保持 ${from}`);
  }

  // ---- 自转移：blocked→blocked、done→done 幂等重复标记应放行 ----
  {
    const { root } = makeTarget(tmpRoot, "self-blocked", "blocked");
    assert.equal(update(root, "blocked").status, 0, "blocked→blocked 自转移应放行");
  }
  {
    const { root } = makeTarget(tmpRoot, "self-done", "done");
    assert.equal(update(root, "done").status, 0, "done→done 自转移应放行");
  }

  // ---- CAS 空串缝：--expected-revision "" 不得静默跳过并发锁 ----
  {
    const { root, capsule } = makeTarget(tmpRoot, "cas-empty-string", "doing");
    // 空串必须被当作"已声明要做乐观锁但令牌无效"而拒绝，不能因 falsy 短路静默放行覆盖。
    // 先做一次合法更新让 revision 落地为非空。
    const first = update(root, "blocked");
    assert.equal(first.status, 0, first.stderr);
    const rev = readStatus(root, capsule).revision;
    assert.match(rev, /^sha256:/u, "首次更新后 revision 应非空");
    // 现在带空串 expected-revision 再更新：必须被拒绝（空串不是有效乐观锁令牌），
    // 且必须是 revision conflict（而非碰巧因别的原因失败）。
    const withEmpty = update(root, "doing", "--expected-revision", "");
    assert.notEqual(withEmpty.status, 0, "--expected-revision \"\" 不得静默跳过 CAS");
    assert.match(`${withEmpty.stdout}${withEmpty.stderr}`, /revision conflict/u, "空串必须触发 revision conflict");

    // 正向用例1：传入正确 revision，CAS 通过，转移放行（blocked→doing 合法）。
    const withCorrect = update(root, "doing", "--expected-revision", rev);
    assert.equal(withCorrect.status, 0, `正确 revision 应通过 CAS: ${withCorrect.stderr}`);
    // 正向用例2：完全不传 --expected-revision，跳过 CAS，正常更新（不误伤）。
    const rev2 = readStatus(root, capsule).revision;
    const noFlag = update(root, "blocked");
    assert.equal(noFlag.status, 0, `不传 --expected-revision 应跳过 CAS 正常更新: ${noFlag.stderr}`);
    assert.notEqual(readStatus(root, capsule).revision, rev2, "更新后 revision 应变化");
  }

  // ---- legacy state 分支必须保留、清除并限制 blocker/doneWhen ----
  {
    const { root, capsule } = makeTarget(tmpRoot, "legacy-notes", "doing");
    const withNotes = update(root, "doing", "--blocker", "当前阻塞", "--done-when", "通过测试");
    assert.equal(withNotes.status, 0, "legacy state 应接受 blocker/doneWhen");
    assert.equal(readStatus(root, capsule).blocker, "当前阻塞");
    assert.equal(readStatus(root, capsule).doneWhen, "通过测试");

    const preserved = update(root, "doing");
    assert.equal(preserved.status, 0, "未传 notes 时旧值应保留");
    assert.equal(readStatus(root, capsule).blocker, "当前阻塞");
    assert.equal(readStatus(root, capsule).doneWhen, "通过测试");

    const cleared = update(root, "doing", "--blocker", "", "--done-when", "");
    assert.equal(cleared.status, 0, "显式空串应清除旧值");
    assert.equal(readStatus(root, capsule).blocker, "");
    assert.equal(readStatus(root, capsule).doneWhen, "");
  }
  {
    const { root } = makeTarget(tmpRoot, "legacy-note-byte-limit", "doing");
    const tooLongBlocker = update(root, "doing", "--blocker", "知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知");
    assert.notEqual(tooLongBlocker.status, 0, "blocker 超过 2000 UTF-8 bytes 必须拒绝");
    const tooLongDoneWhen = update(root, "doing", "--done-when", "知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知知");
    assert.notEqual(tooLongDoneWhen.status, 0, "doneWhen 超过 2000 UTF-8 bytes 必须拒绝");
  }

  console.log("Task state machine transition + CAS + legacy note tests passed");
} finally {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
}
