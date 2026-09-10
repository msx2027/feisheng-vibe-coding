#!/usr/bin/env node
// 事务/日志引擎回归测试：崩溃恢复、CAS 冲突、未完成事务拦截、recover 幂等。
// 这是多个状态机共用的原子性落盘骨架，此前几乎没有直接测试（见状态机稳定性审计）。
// 本测试只锁定既有行为，不改变实现；并发文件锁属后续可选项，不在此覆盖范围。
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  commitTargetTransaction,
  recoverTargetTransaction,
  readTargetText,
  sha256,
} from "./target-doc-transaction.mjs";

const JOURNAL = ".vibe-txn.json";

function makeRoot(seed) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "txn-engine-"));
  for (const [file, content] of Object.entries(seed)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content, "utf8");
  }
  return root;
}

function b64(value) {
  return value === null ? null : Buffer.from(value, "utf8").toString("base64");
}

// 手工构造一个"进行到一半"的 journal，模拟进程在写完部分文件后被杀死。
function craftInFlightJournal(root, ops) {
  const journal = {
    schemaVersion: 1,
    kind: "test",
    createdAt: new Date().toISOString(),
    status: "applying",
    operations: ops.map((op) => ({
      file: op.file,
      beforeBase64: b64(op.before),
      afterBase64: b64(op.after),
      beforeHash: op.before === null ? null : sha256(op.before),
      afterHash: op.after === null ? null : sha256(op.after),
    })),
  };
  fs.writeFileSync(path.join(root, JOURNAL), `${JSON.stringify(journal, null, 2)}\n`, "utf8");
}

test("正常提交后 journal 被清除、内容落盘", () => {
  const root = makeRoot({ "a.txt": "a0", "b.txt": "b0" });
  try {
    const result = commitTargetTransaction(root, {
      journalPath: JOURNAL,
      operations: [
        { file: "a.txt", content: "a1", expectedContent: "a0" },
        { file: "b.txt", content: "b1", expectedContent: "b0" },
      ],
    });
    assert.deepEqual(result.changed.sort(), ["a.txt", "b.txt"]);
    assert.equal(readTargetText(root, "a.txt"), "a1");
    assert.equal(readTargetText(root, "b.txt"), "b1");
    assert.equal(readTargetText(root, JOURNAL), null, "提交成功后 journal 必须被删除");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("崩溃恢复：写了一半被杀死，recover 把已写文件回滚到 before", () => {
  const root = makeRoot({ "a.txt": "a0", "b.txt": "b0" });
  try {
    // 模拟：journal 已落盘，A 已被写成 a1（applied），B 还没写（仍是 b0）。
    craftInFlightJournal(root, [
      { file: "a.txt", before: "a0", after: "a1" },
      { file: "b.txt", before: "b0", after: "b1" },
    ]);
    fs.writeFileSync(path.join(root, "a.txt"), "a1", "utf8");

    const res = recoverTargetTransaction(root, JOURNAL);
    assert.equal(res.recovered, true);
    assert.equal(readTargetText(root, "a.txt"), "a0", "已写入的 A 必须回滚到 before");
    assert.equal(readTargetText(root, "b.txt"), "b0", "未写入的 B 保持 before");
    assert.equal(readTargetText(root, JOURNAL), null, "恢复后 journal 必须被删除");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("崩溃恢复：新建文件的事务，recover 删除半途建出的文件", () => {
  const root = makeRoot({ "keep.txt": "k0" });
  try {
    // before 为 null 表示该文件本不存在（本次事务才新建）。
    craftInFlightJournal(root, [{ file: "new.txt", before: null, after: "n1" }]);
    fs.writeFileSync(path.join(root, "new.txt"), "n1", "utf8");

    const res = recoverTargetTransaction(root, JOURNAL);
    assert.equal(res.recovered, true);
    assert.equal(fs.existsSync(path.join(root, "new.txt")), false, "新建文件必须被回滚删除");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("recover 冲突：磁盘内容既非 before 也非 after 时报错，不静默改写", () => {
  const root = makeRoot({ "a.txt": "a0" });
  try {
    craftInFlightJournal(root, [{ file: "a.txt", before: "a0", after: "a1" }]);
    // 外部把文件改成了完全无关的第三种内容。
    fs.writeFileSync(path.join(root, "a.txt"), "MANUAL-EDIT", "utf8");
    assert.throws(() => recoverTargetTransaction(root, JOURNAL), /recover conflict/u);
    // 冲突后不得改写用户内容，journal 也应保留供人工介入。
    assert.equal(readTargetText(root, "a.txt"), "MANUAL-EDIT");
    assert.notEqual(readTargetText(root, JOURNAL), null, "冲突时 journal 必须保留");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("recover 幂等：无 journal 时安全返回 journal-missing", () => {
  const root = makeRoot({ "a.txt": "a0" });
  try {
    const res = recoverTargetTransaction(root, JOURNAL);
    assert.equal(res.recovered, false);
    assert.equal(res.reason, "journal-missing");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CAS 冲突：计划后目标被外部改动，提交必须整体失败且不留部分写入", () => {
  const root = makeRoot({ "a.txt": "a0", "b.txt": "b0" });
  try {
    // expectedContent 与磁盘真实内容不符 —— 模拟计划快照过期。
    assert.throws(
      () =>
        commitTargetTransaction(root, {
          journalPath: JOURNAL,
          operations: [
            { file: "a.txt", content: "a1", expectedContent: "STALE" },
            { file: "b.txt", content: "b1", expectedContent: "b0" },
          ],
        }),
      /target changed after planning/u,
    );
    assert.equal(readTargetText(root, "a.txt"), "a0", "CAS 冲突时不得写入任何文件");
    assert.equal(readTargetText(root, "b.txt"), "b0");
    assert.equal(readTargetText(root, JOURNAL), null, "计划阶段失败不得留下 journal");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("未完成事务拦截：journal 存在时新提交被拒绝，提示先 recover", () => {
  const root = makeRoot({ "a.txt": "a0" });
  try {
    craftInFlightJournal(root, [{ file: "a.txt", before: "a0", after: "a1" }]);
    assert.throws(
      () =>
        commitTargetTransaction(root, {
          journalPath: JOURNAL,
          operations: [{ file: "a.txt", content: "a2", expectedContent: "a0" }],
        }),
      /unfinished transaction exists/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
