#!/usr/bin/env node
// Depends on: tools/check-ui-reuse.mjs
// UI 复用门禁的正则口径回归：临时视觉属性只拦硬编码裸值，走设计 token 的写法必须放行。

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runUiReuseCheck } from "./check-ui-reuse.mjs";

/** 在临时目录里造一个只含单个 CSS 文件的前端结构，返回根目录路径。 */
function makeFixture(cssBody) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ui-reuse-"));
  // 必须落在门禁认定的页面层（src/pages 等）下，否则临时视觉属性规则不会生效。
  const dir = path.join(root, "src", "pages");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "Panel.module.css"), cssBody, "utf8");
  return root;
}

function tempVisualIssues(cssBody) {
  const root = makeFixture(cssBody);
  try {
    const result = runUiReuseCheck({ root, all: true, quiet: true });
    return result.issues.filter((issue) => issue.includes("临时圆角"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("走设计 token 的圆角与阴影不算临时硬编码", () => {
  const issues = tempVisualIssues(
    [
      ".panel {",
      "  border-radius: var(--radius-panel);",
      "  box-shadow: 0 var(--shadow-y-xl) var(--shadow-blur-xl) var(--slip-shadow);",
      "}",
      ".compact {",
      "  border-radius:var(--radius-sm);",
      "}",
    ].join("\n"),
  );
  assert.deepEqual(issues, [], `token 写法被误判为临时硬编码：${issues.join(" / ")}`);
});

test("硬编码裸值的圆角与阴影仍然被拦住", () => {
  const issues = tempVisualIssues(
    [".panel {", "  border-radius: 12px;", "  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);", "}"].join("\n"),
  );
  assert.equal(issues.length, 2, `硬编码裸值漏拦，实际命中 ${issues.length} 条`);
});

test("以 0 起头、其余取 token 的阴影算合规写法", () => {
  // 项目里最常见的阴影写法：位移和模糊半径取 token，只有无单位的 0 是字面量。
  const issues = tempVisualIssues(
    [".card {", "  box-shadow: 0 var(--shadow-y-xl) var(--shadow-blur-xl) var(--slip-shadow);", "}"].join("\n"),
  );
  assert.deepEqual(issues, [], `token 阴影被误判：${issues.join(" / ")}`);
});

test("注释里出现 var( 不能替硬编码打掩护", () => {
  // 「先硬编码、注释里记着以后换 token」正是本规则要拦的欠账写法，
  // 判据若只看整行有没有 var(，这类写法会被静默放行。
  const issues = tempVisualIssues(
    [".p {", "  border-radius: 12px /* TODO var(--radius-panel) */;", "}"].join("\n"),
  );
  assert.equal(issues.length, 1, `注释掩护未被识破，实际命中 ${issues.length} 条`);
});

test("单条声明内混着裸值仍然被拦住", () => {
  // 一部分取 token、一部分写死同样是硬编码欠账，不能因为出现了 var( 就整条放行。
  const issues = tempVisualIssues(
    [".p {", "  border-radius: var(--radius-panel) 12px 12px 8px;", "}"].join("\n"),
  );
  assert.equal(issues.length, 1, `混合声明漏拦，实际命中 ${issues.length} 条`);
});

test("新视口单位与逻辑单位的硬编码同样被拦住", () => {
  // 单位清单漏一个就是一条静默绕过路径，动态视口单位（dvh/svh/lvh）已是常用写法。
  const issues = tempVisualIssues(
    [
      ".a { border-radius: 5dvh; }",
      ".b { border-radius: 5svh; }",
      ".c { border-radius: 5lvw; }",
      ".d { box-shadow: 0 1rlh 2cap #000; }",
    ].join("\n"),
  );
  assert.equal(issues.length, 4, `新单位漏拦，实际命中 ${issues.length} 条`);
});

test("var 的 fallback 兜底值不算硬编码", () => {
  // fallback 是 token 缺失时的降级兜底，属于合理写法，不作为硬编码欠账计入。
  const issues = tempVisualIssues(
    [".a { border-radius: var(--radius-panel, 8px); }", ".b { border-radius: var(--a, var(--b, 8px)); }"].join("\n"),
  );
  assert.deepEqual(issues, [], `fallback 被误判：${issues.join(" / ")}`);
});

test("重置与继承关键字不算硬编码视觉值", () => {
  // none / 0 / inherit 这类重置写法没有对应 token 可复用，硬拦只会逼出无意义的豁免。
  const issues = tempVisualIssues(
    [
      ".reset {",
      "  box-shadow: none;",
      "  border-radius: 0;",
      "}",
      ".inherited {",
      "  border-radius: inherit;",
      "  box-shadow: unset;",
      "}",
    ].join("\n"),
  );
  assert.deepEqual(issues, [], `重置关键字被误判：${issues.join(" / ")}`);
});

test("同一行内的 token 不为相邻声明的硬编码打掩护", () => {
  // 前瞻用 [^;{}]* 限定在单条声明内，避免 token 声明放行掉同行的裸值声明。
  const issues = tempVisualIssues(
    [".mixed {", "  border-radius: 8px; box-shadow: 0 0 0 var(--ring);", "}"].join("\n"),
  );
  assert.equal(issues.length, 1, `混合行判定异常，实际命中 ${issues.length} 条`);
});

test("跨多行书写的全 token 阴影算合规写法", () => {
  // 多层阴影常拆成多行：属性名单独一行，token 在后续行。逐行扫描看不到值，需按声明合并判断。
  const issues = tempVisualIssues(
    [
      ".rail {",
      "  box-shadow:",
      "    0 var(--shadow-y-hairline) 0 var(--glass-sheen) inset,",
      "    0 var(--shadow-y-lg) var(--shadow-blur-lg) var(--slip-shadow);",
      "}",
    ].join("\n"),
  );
  assert.deepEqual(issues, [], `多行 token 阴影被误判：${issues.join(" / ")}`);
});

test("阴影里颜色走 token 但位移写死仍算硬编码", () => {
  // 阴影的远近与虚实同属设计语言，写死后一样改不动；项目既然有 shadow-y / shadow-blur
  // 这类 token，就不该给「只把颜色 token 化」留口子。
  const issues = tempVisualIssues(
    [".rail {", "  box-shadow: 0 18px 42px var(--slip-shadow);", "}"].join("\n"),
  );
  assert.equal(issues.length, 1, `位移写死漏拦，实际命中 ${issues.length} 条`);
});

test("注释行不吞下一条声明，allow-next-line 豁免仍然生效", () => {
  // 多行合并只能用于「属性名单独一行」的续行场景；若注释行也向后合并，
  // 报警会落在注释行上，与 allow-next-line 豁免的目标行错位，导致豁免失效。
  const issues = tempVisualIssues(
    [
      ".badge {",
      "  /* vibe-ui-allow-next-line: 状态图标必须保持正圆，复用 CSS 原生圆形语义。 */",
      "  border-radius: 50%;",
      "}",
    ].join("\n"),
  );
  assert.deepEqual(issues, [], `豁免失效：${issues.join(" / ")}`);
});

test("跨多行书写的硬编码阴影仍然被拦住", () => {
  const issues = tempVisualIssues(
    [".rail {", "  box-shadow:", "    0 1px 0 #ffffff inset,", "    0 18px 42px rgba(0, 0, 0, 0.2);", "}"].join("\n"),
  );
  assert.equal(issues.length, 1, `多行硬编码阴影漏拦，实际命中 ${issues.length} 条`);
});
