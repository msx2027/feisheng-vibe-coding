#!/usr/bin/env node
// 发布布局入口（2026-09-29 补装）：宪法受管块承诺的刷新指令是
// `node <skills-root>/tools/init-target-runtime.mjs <target-root> --skills-root <skills-root> --write`，
// 而工具本体已迁移至 skills/event/experience-elevator/tools/。本启动器以 realpath 定位本体后
// 子进程转发——本体带 isMain 守卫（realpath(argv[1]) 必须等于 realpath(本体)），不能 re-export，
// 只能 spawn（EXP-216：软链路径调用会静默跳过主流程）。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const self = fs.realpathSync(fileURLToPath(import.meta.url));
const tool = path.resolve(
  path.dirname(self),
  "..",
  "skills",
  "event",
  "experience-elevator",
  "tools",
  "init-target-runtime.mjs",
);
if (!fs.existsSync(tool)) {
  console.error(`[FAIL] 工具本体不存在: ${tool}`);
  process.exit(2);
}
const child = spawnSync(process.execPath, [tool, ...process.argv.slice(2)], { stdio: "inherit" });
if (child.error) {
  console.error(`[FAIL] ${child.error.message}`);
  process.exit(2);
}
process.exit(child.status ?? 1);
