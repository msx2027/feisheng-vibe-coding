#!/usr/bin/env node
// 计划执行光标状态机回归测试：转移合法性 + 原子写。
// 覆盖 plan-state.ps1 的两处硬化：
//   1) 动作间的状态转移必须校验（禁止跳步；done 只能退一格重开；idle 只能 start）。
//   2) 写状态文件用"临时文件 + 原子改名"，中途失败不得把 CURRENT-EXECUTION 截成空/半截。
// 需要 PowerShell（pwsh 或 powershell）。若两者都不可用则跳过（退出码 0）。
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptPath = path.join(repoRoot, "tools", "plan-state.ps1");

function resolvePwsh() {
  for (const exe of ["pwsh", "powershell"]) {
    const probe = spawnSync(exe, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"], { encoding: "utf8" });
    if (probe.status === 0) return exe;
  }
  return null;
}

const pwsh = resolvePwsh();
if (!pwsh) {
  console.log("Plan state transition tests skipped: no PowerShell available");
  process.exit(0);
}

function runAction(root, action, extra = []) {
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Action", action, "-Root", root, "-Json", ...extra];
  return spawnSync(pwsh, args, { cwd: repoRoot, encoding: "utf8" });
}

// 从命令 JSON 输出解析 status（比正则读 Markdown 文件更可靠）。
function statusFromResult(result) {
  try {
    return JSON.parse(result.stdout).status;
  } catch {
    return "<unparseable>";
  }
}

// 建一个最小项目：DEV-PLAN.md 索引一个计划明细文件 + plans 目录。
// plan-state.ps1 要求 PlanFile 必须被 DEV-PLAN.md 以 plans/*.md 形式引用。
function makeRoot(base, name) {
  const root = path.join(base, name);
  fs.mkdirSync(path.join(root, "plans"), { recursive: true });
  fs.writeFileSync(path.join(root, "plans", "phase-1.md"), "# 计划明细\n- 任务 T1\n", "utf8");
  // PlanFile 索引只从 "## Detail Index" / "## 补充计划文档索引" section 内提取。
  fs.writeFileSync(path.join(root, "DEV-PLAN.md"), "# 开发计划\n\n## Detail Index\n\n- plans/phase-1.md\n", "utf8");
  return root;
}

const startArgs = ["-Phase", "P1", "-TaskId", "T1", "-TaskTitle", "首个任务", "-PlanFile", "plans/phase-1.md", "-Checkpoint", "起步", "-NextStep", "继续"];

function statusOf(root) {
  const statePath = path.join(root, "plans", "CURRENT-EXECUTION.md");
  if (!fs.existsSync(statePath)) return "<none>";
  const text = fs.readFileSync(statePath, "utf8");
  // 状态文件格式为 "- **Status**: doing"。
  const m = text.match(/\*\*Status\*\*[^\S\r\n]*[:：][^\S\r\n]*(idle|doing|blocked|done)/u);
  return m ? m[1] : "<unknown>";
}

let tmpRoot = "";
let failed = false;
function check(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); failed = true; }
}

try {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plan-state-txn-"));

  // ---- 合法：idle → start(doing) → checkpoint → done ----
  {
    const root = makeRoot(tmpRoot, "legal-flow");
    check(runAction(root, "start", startArgs).status === 0, "idle→start 应放行");
    check(statusOf(root) === "doing", `start 后应为 doing，实为 ${statusOf(root)}`);
    check(runAction(root, "checkpoint", ["-Checkpoint", "进度1"]).status === 0, "doing 上 checkpoint 应放行");
    check(runAction(root, "done").status === 0, "doing→done 应放行");
    check(statusOf(root) === "done", `done 后应为 done，实为 ${statusOf(root)}`);
  }

  // ---- 合法：doing → blocked → start(重回 doing) ----
  {
    const root = makeRoot(tmpRoot, "legal-block-resume");
    runAction(root, "start", startArgs);
    check(runAction(root, "blocked").status === 0, "doing→blocked 应放行");
    check(runAction(root, "start", startArgs).status === 0, "blocked→start(回 doing) 应放行");
  }

  // ---- 合法：done → start(返工重开到 doing) ----
  {
    const root = makeRoot(tmpRoot, "legal-reopen");
    runAction(root, "start", startArgs);
    runAction(root, "done");
    check(runAction(root, "start", startArgs).status === 0, "done→start(重开) 应放行");
    check(statusOf(root) === "doing", "重开后应为 doing");
  }

  // ---- 非法：idle 直接 done（零执行完成）----
  {
    const root = makeRoot(tmpRoot, "illegal-idle-done");
    const r = runAction(root, "done");
    check(r.status !== 0, "idle→done 必须被拒（零执行完成）");
  }

  // ---- 非法：idle 直接 blocked ----
  {
    const root = makeRoot(tmpRoot, "illegal-idle-blocked");
    check(runAction(root, "blocked").status !== 0, "idle→blocked 必须被拒");
  }

  // ---- 非法：blocked 直接 done（跳过回 doing）----
  {
    const root = makeRoot(tmpRoot, "illegal-blocked-done");
    runAction(root, "start", startArgs);
    runAction(root, "blocked");
    const r = runAction(root, "done");
    check(r.status !== 0, "blocked→done 必须被拒（须先回 doing）");
    check(statusOf(root) === "blocked", "被拒后状态应保持 blocked");
  }

  // ---- 非法：done 直接 blocked ----
  {
    const root = makeRoot(tmpRoot, "illegal-done-blocked");
    runAction(root, "start", startArgs);
    runAction(root, "done");
    check(runAction(root, "blocked").status !== 0, "done→blocked 必须被拒");
  }

  // ---- 合法：自转移 blocked→blocked、done→done（幂等重复标记，与 ① 对齐）----
  {
    const root = makeRoot(tmpRoot, "self-blocked");
    runAction(root, "start", startArgs);
    runAction(root, "blocked");
    check(runAction(root, "blocked").status === 0, "blocked→blocked 自转移应放行");
    check(statusOf(root) === "blocked", "自转移后应仍为 blocked");
  }
  {
    const root = makeRoot(tmpRoot, "self-done");
    runAction(root, "start", startArgs);
    runAction(root, "done");
    check(runAction(root, "done").status === 0, "done→done 自转移应放行");
    check(statusOf(root) === "done", "自转移后应仍为 done");
  }

  // ---- 原子写：状态文件写入后完整可解析，且不残留临时文件 ----
  // 真正的原子性由"临时文件写满 + Move-Item 改名"保证。这里除了校验内容完整，
  // 还断言 plans 目录不残留 *.tmp —— 若有人回退成直接 WriteAllText（无临时文件），
  // 该守卫不会失败，但配合 finally 清理断言可捕捉临时文件泄漏这一实现回归信号。
  {
    const root = makeRoot(tmpRoot, "atomic-write");
    // 反复写入多次，模拟多轮 checkpoint，确保每轮都干净替换、无残留。
    check(runAction(root, "start", startArgs).status === 0, "start 应成功");
    for (let i = 0; i < 3; i += 1) {
      check(runAction(root, "checkpoint", ["-Checkpoint", `进度${i}`]).status === 0, `checkpoint#${i} 应成功`);
    }
    const statePath = path.join(root, "plans", "CURRENT-EXECUTION.md");
    const content = fs.readFileSync(statePath, "utf8");
    check(content.length > 0, "写入后状态文件不得为空");
    check(/\*\*Status\*\*/u.test(content), "状态文件应含 Status 字段");
    const leftovers = fs.readdirSync(path.join(root, "plans")).filter((f) => f.endsWith(".tmp"));
    check(leftovers.length === 0, `不得残留临时文件，实际残留: ${leftovers.join(", ")}`);
  }

  if (failed) { console.error("Plan state transition tests FAILED"); process.exit(1); }
  console.log("Plan state transition + atomic write tests passed");
} finally {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
}
