#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REQUIRED_CASE_COLUMNS = [
  "TC-ID",
  "标题",
  "关联需求",
  "Scenario-ID",
  "优先级",
  "测试类型",
  "前置条件",
  "测试数据",
  "步骤",
  "预期结果",
  "是否可自动化",
  "自动化建议",
  "人工验收状态",
  "覆盖状态",
  "变更状态",
];

const TRACE_COLUMNS = [
  "REQ-ID",
  "Requirement Summary",
  "Scenario-ID",
  "Scenario Summary",
  "TC-ID",
  "Test Case Title",
  "Test Type",
  "Priority",
  "Coverage Status",
  "Automation Candidate",
  "Automation Level",
  "Manual Acceptance Status",
  "Change Status",
  "Source",
];

const AUTOMATION_VALUES = new Set(["是", "否", "部分", "yes", "no", "partial", "Y", "N"]);
const MANUAL_VALUES = new Set(["不适用", "待用户验收", "用户已确认", "需回归复验", "N/A", "Pending", "Confirmed", "Regression Needed"]);
const PRIORITY_VALUES = new Set(["P0", "P1", "P2", "P3"]);
const COVERAGE_VALUES = new Set(["covered", "partial", "blocked", "needs clarification", "not applicable"]);
const CHANGE_VALUES = new Set(["new", "unchanged", "revised", "deprecated", "split", "merged"]);
const WEAK_ASSERTION_PATTERNS = [
  /^\s*(验证)?(功能|页面|接口|流程)?(正常|正确|可用|成功|通过|无异常|符合预期)\s*[。.!！]*\s*$/i,
  /^\s*用户可以成功(操作|提交|保存|审批|完成|查看|创建|更新|删除)\s*[。.!！]*\s*$/i,
  /^\s*(操作|提交|保存|审批|查看|创建|更新|删除)(成功|正常|可用)\s*[。.!！]*\s*$/i,
  /^\s*(should work|works as expected|as expected|ok|pass|passed)\s*[。.!！]*\s*$/i,
  /验证功能正常|页面正常显示|接口返回正确|符合预期|用户可以成功操作|should work/i,
];

function parseArgs(argv) {
  const options = {
    casesPath: "",
    tracePath: "",
    json: false,
    selfTest: false,
    requiredTypes: [],
    requiredTypesPerReq: [],
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--trace") {
      options.tracePath = argv[++index] || "";
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--require-types") {
      options.requiredTypes = normalizeList(argv[++index] || "").map((item) => item.toLowerCase());
    } else if (arg === "--require-types-per-req") {
      options.requiredTypesPerReq = normalizeList(argv[++index] || "").map((item) => item.toLowerCase());
    } else if (!arg.startsWith("--") && !options.casesPath) {
      options.casesPath = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cell) => String(cell).trim() !== ""));
}

function toObjects(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = rows[0].map((header) => header.trim());
  const records = rows.slice(1).map((row, rowIndex) => {
    const record = { __row: rowIndex + 2 };
    headers.forEach((header, columnIndex) => {
      record[header] = row[columnIndex] ?? "";
    });
    return record;
  });

  return { headers, records };
}

function normalizeList(value) {
  return String(value || "")
    .split(/[;；,，\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isBlank(value) {
  return String(value || "").trim() === "";
}

function isWeakAssertion(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return WEAK_ASSERTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function pushIssue(issues, severity, message, row = null) {
  issues.push({ severity, message, row });
}

function validateCaseRecords(headers, records, options = {}) {
  const issues = [];
  const seenTcIds = new Set();
  const recordsByReqId = new Map();

  for (const column of REQUIRED_CASE_COLUMNS) {
    if (!headers.includes(column)) {
      pushIssue(issues, "error", `Missing required test case column: ${column}`);
    }
  }

  for (const record of records) {
    const row = record.__row;
    const tcId = String(record["TC-ID"] || "").trim();
    const reqIds = normalizeList(record["关联需求"]);

    if (!/^TC-\d{3,}$/.test(tcId)) {
      pushIssue(issues, "error", `Invalid TC-ID: ${tcId || "<blank>"}`, row);
    } else if (seenTcIds.has(tcId)) {
      pushIssue(issues, "error", `Duplicate TC-ID: ${tcId}`, row);
    } else {
      seenTcIds.add(tcId);
    }

    if (headers.includes("Scenario-ID") && !/^SCN-\d{3,}$/.test(String(record["Scenario-ID"] || "").trim())) {
      pushIssue(issues, "error", `Invalid Scenario-ID: ${record["Scenario-ID"] || "<blank>"}`, row);
    }

    if (reqIds.length === 0) {
      pushIssue(issues, "error", "关联需求 must include at least one REQ-ID", row);
    }

    for (const reqId of reqIds) {
      if (!/^REQ-\d{3,}$/.test(reqId)) {
        pushIssue(issues, "error", `Invalid REQ-ID in 关联需求: ${reqId}`, row);
      } else {
        if (!recordsByReqId.has(reqId)) {
          recordsByReqId.set(reqId, []);
        }
        recordsByReqId.get(reqId).push(record);
      }
    }

    for (const column of REQUIRED_CASE_COLUMNS) {
      if (isBlank(record[column])) {
        pushIssue(issues, "error", `Blank required field: ${column}`, row);
      }
    }

    if (!PRIORITY_VALUES.has(String(record["优先级"] || "").trim())) {
      pushIssue(issues, "error", `优先级 must be P0/P1/P2/P3, got: ${record["优先级"] || "<blank>"}`, row);
    }

    if (!AUTOMATION_VALUES.has(String(record["是否可自动化"] || "").trim())) {
      pushIssue(issues, "error", `是否可自动化 has unsupported value: ${record["是否可自动化"] || "<blank>"}`, row);
    }

    if (!MANUAL_VALUES.has(String(record["人工验收状态"] || "").trim())) {
      pushIssue(issues, "error", `人工验收状态 has unsupported value: ${record["人工验收状态"] || "<blank>"}`, row);
    }

    const coverage = String(record["覆盖状态"] || "").trim().toLowerCase();
    if (!COVERAGE_VALUES.has(coverage)) {
      pushIssue(issues, "error", `覆盖状态 has unsupported value: ${record["覆盖状态"] || "<blank>"}`, row);
    }

    const change = String(record["变更状态"] || "").trim().toLowerCase();
    if (!CHANGE_VALUES.has(change)) {
      pushIssue(issues, "error", `变更状态 has unsupported value: ${record["变更状态"] || "<blank>"}`, row);
    }

    if (isWeakAssertion(record["预期结果"])) {
      pushIssue(issues, "error", `Weak assertion in 预期结果 for ${tcId || "row"}`, row);
    }

    if (String(record["步骤"] || "").trim().length < 10) {
      pushIssue(issues, "warning", `步骤 is very short for ${tcId || "row"}; confirm it is executable`, row);
    }
  }

  const types = new Set(records.flatMap((record) => normalizeList(record["测试类型"]).map((item) => item.toLowerCase())));
  for (const importantType of ["happy path", "negative path"]) {
    if (!types.has(importantType)) {
      pushIssue(issues, "warning", `Suite has no ${importantType} test case`);
    }
  }

  for (const requiredType of options.requiredTypes || []) {
    if (!types.has(requiredType)) {
      pushIssue(issues, "error", `Suite is missing required test type: ${requiredType}`);
    }
  }

  for (const [reqId, reqRecords] of recordsByReqId.entries()) {
    const reqTypes = new Set(reqRecords.flatMap((record) => normalizeList(record["测试类型"]).map((item) => item.toLowerCase())));
    for (const requiredType of options.requiredTypesPerReq || []) {
      if (reqTypes.has(requiredType)) {
        continue;
      }

      const hasDocumentedNonCoverage = reqRecords.some((record) => {
        const coverage = String(record["覆盖状态"] || "").trim().toLowerCase();
        const recordTypes = new Set(normalizeList(record["测试类型"]).map((item) => item.toLowerCase()));
        return ["blocked", "needs clarification", "not applicable"].includes(coverage) && recordTypes.has(requiredType);
      });

      if (!hasDocumentedNonCoverage) {
        pushIssue(issues, "error", `REQ-ID ${reqId} is missing required per-REQ test type: ${requiredType}`);
      }
    }
  }

  return issues;
}

function validateTraceRecords(headers, traceRecords, caseRecords) {
  const issues = [];

  for (const column of TRACE_COLUMNS) {
    if (!headers.includes(column)) {
      pushIssue(issues, "error", `Missing required traceability column: ${column}`);
    }
  }

  const caseTcIds = new Set(caseRecords.map((record) => String(record["TC-ID"] || "").trim()).filter(Boolean));
  const caseReqIds = new Set(caseRecords.flatMap((record) => normalizeList(record["关联需求"])));
  const caseTriples = new Set();
  const traceTcIds = new Set();
  const traceReqIds = new Set();
  const traceTriples = new Set();

  for (const record of caseRecords) {
    const tcId = String(record["TC-ID"] || "").trim();
    const scenarioId = String(record["Scenario-ID"] || "").trim();
    for (const reqId of normalizeList(record["关联需求"])) {
      caseTriples.add(`${reqId}|${scenarioId}|${tcId}`);
    }
  }

  for (const record of traceRecords) {
    const row = record.__row;
    const tcId = String(record["TC-ID"] || "").trim();
    const reqId = String(record["REQ-ID"] || "").trim();
    const scenarioId = String(record["Scenario-ID"] || "").trim();

    if (!/^REQ-\d{3,}$/.test(reqId)) {
      pushIssue(issues, "error", `Invalid trace REQ-ID: ${reqId || "<blank>"}`, row);
    } else {
      traceReqIds.add(reqId);
    }

    if (!/^TC-\d{3,}$/.test(tcId)) {
      pushIssue(issues, "error", `Invalid trace TC-ID: ${tcId || "<blank>"}`, row);
    } else {
      traceTcIds.add(tcId);
    }

    if (headers.includes("Scenario-ID") && !/^SCN-\d{3,}$/.test(String(record["Scenario-ID"] || "").trim())) {
      pushIssue(issues, "error", `Invalid trace Scenario-ID: ${record["Scenario-ID"] || "<blank>"}`, row);
    }

    if (/^REQ-\d{3,}$/.test(reqId) && /^SCN-\d{3,}$/.test(scenarioId) && /^TC-\d{3,}$/.test(tcId)) {
      const triple = `${reqId}|${scenarioId}|${tcId}`;
      traceTriples.add(triple);
      if (!caseTriples.has(triple)) {
        pushIssue(issues, "error", `Traceability matrix has mismatched REQ-ID/Scenario-ID/TC-ID triple: ${triple}`, row);
      }
    }
  }

  for (const tcId of caseTcIds) {
    if (!traceTcIds.has(tcId)) {
      pushIssue(issues, "error", `TC-ID missing from traceability matrix: ${tcId}`);
    }
  }

  for (const reqId of caseReqIds) {
    if (!traceReqIds.has(reqId)) {
      pushIssue(issues, "error", `REQ-ID missing from traceability matrix: ${reqId}`);
    }
  }

  for (const triple of caseTriples) {
    if (!traceTriples.has(triple)) {
      pushIssue(issues, "error", `Traceability matrix is missing REQ-ID/Scenario-ID/TC-ID triple: ${triple}`);
    }
  }

  for (const tcId of traceTcIds) {
    if (!caseTcIds.has(tcId)) {
      pushIssue(issues, "error", `Traceability matrix references unknown TC-ID: ${tcId}`);
    }
  }

  for (const reqId of traceReqIds) {
    if (!caseReqIds.has(reqId)) {
      pushIssue(issues, "error", `Traceability matrix references unknown REQ-ID: ${reqId}`);
    }
  }

  return issues;
}

function validateSuite(casesCsv, traceCsv = "", options = {}) {
  const { headers, records } = toObjects(casesCsv);
  const issues = validateCaseRecords(headers, records, options);

  if (traceCsv) {
    const { headers: traceHeaders, records: traceRecords } = toObjects(traceCsv);
    issues.push(...validateTraceRecords(traceHeaders, traceRecords, records));
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    caseCount: records.length,
    issues,
  };
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function makeCsv(headers, rows) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
  ].join("\n");
}

function runSelfTest() {
  const caseHeaders = [
    "TC-ID",
    "标题",
    "关联需求",
    "Scenario-ID",
    "优先级",
    "测试类型",
    "前置条件",
    "测试数据",
    "步骤",
    "预期结果",
    "是否可自动化",
    "自动化建议",
    "人工验收状态",
    "覆盖状态",
    "变更状态",
  ];
  const traceHeaders = [
    "REQ-ID",
    "Requirement Summary",
    "Scenario-ID",
    "Scenario Summary",
    "TC-ID",
    "Test Case Title",
    "Test Type",
    "Priority",
    "Coverage Status",
    "Automation Candidate",
    "Automation Level",
    "Manual Acceptance Status",
    "Change Status",
    "Source",
  ];
  const goodCases = makeCsv(caseHeaders, [
    {
      "TC-ID": "TC-001",
      "标题": "有效管理员提交审批后订单进入 approved 状态",
      "关联需求": "REQ-001",
      "Scenario-ID": "SCN-001",
      "优先级": "P0",
      "测试类型": "happy path",
      "前置条件": "存在 pending 订单，用户具备 admin 角色",
      "测试数据": "orderId=ORD-1001; userRole=admin",
      "步骤": "1. 以 admin 登录\n2. 打开订单 ORD-1001\n3. 点击批准",
      "预期结果": "系统返回 200；订单状态变为 approved；审计日志记录操作者 ID 和 approved 事件。",
      "是否可自动化": "是",
      "自动化建议": "API contract + E2E smoke",
      "人工验收状态": "不适用",
      "覆盖状态": "covered",
      "变更状态": "new",
    },
    {
      "TC-ID": "TC-002",
      "标题": "无审批权限用户提交审批时被拒绝且订单状态不变",
      "关联需求": "REQ-001",
      "Scenario-ID": "SCN-002",
      "优先级": "P0",
      "测试类型": "negative path",
      "前置条件": "存在 pending 订单，用户仅具备 viewer 角色",
      "测试数据": "orderId=ORD-1001; userRole=viewer",
      "步骤": "1. 以 viewer 登录\n2. 调用审批接口\n3. 查询订单状态",
      "预期结果": "接口返回 403；订单状态仍为 pending；审计日志记录拒绝原因 permission_denied。",
      "是否可自动化": "是",
      "自动化建议": "API contract",
      "人工验收状态": "不适用",
      "覆盖状态": "covered",
      "变更状态": "new",
    },
  ]);
  const goodTrace = makeCsv(traceHeaders, [
    {
      "REQ-ID": "REQ-001",
      "Requirement Summary": "订单审批必须按角色授权并记录审计",
      "Scenario-ID": "SCN-001",
      "Scenario Summary": "管理员批准订单",
      "TC-ID": "TC-001",
      "Test Case Title": "有效管理员提交审批后订单进入 approved 状态",
      "Test Type": "happy path",
      "Priority": "P0",
      "Coverage Status": "covered",
      "Automation Candidate": "是",
      "Automation Level": "API contract + E2E",
      "Manual Acceptance Status": "不适用",
      "Change Status": "new",
      "Source": "self-test PRD",
    },
    {
      "REQ-ID": "REQ-001",
      "Requirement Summary": "订单审批必须按角色授权并记录审计",
      "Scenario-ID": "SCN-002",
      "Scenario Summary": "无权限审批被拒绝",
      "TC-ID": "TC-002",
      "Test Case Title": "无审批权限用户提交审批时被拒绝且订单状态不变",
      "Test Type": "negative path",
      "Priority": "P0",
      "Coverage Status": "covered",
      "Automation Candidate": "是",
      "Automation Level": "API contract",
      "Manual Acceptance Status": "不适用",
      "Change Status": "new",
      "Source": "self-test PRD",
    },
  ]);

  const goodResult = validateSuite(goodCases, goodTrace, {
    requiredTypes: ["happy path", "negative path"],
    requiredTypesPerReq: ["happy path", "negative path"],
  });
  assert.equal(goodResult.ok, true, JSON.stringify(goodResult.issues, null, 2));
  assert.equal(goodResult.caseCount, 2);

  const badCases = makeCsv(caseHeaders, [
    {
      "TC-ID": "TC-001",
      "标题": "验证审批功能",
      "关联需求": "REQ-001",
      "Scenario-ID": "SCN-001",
      "优先级": "P1",
      "测试类型": "happy path",
      "前置条件": "有订单",
      "测试数据": "orderId=1",
      "步骤": "点击",
      "预期结果": "验证功能正常",
      "是否可自动化": "maybe",
      "自动化建议": "后续再说",
      "人工验收状态": "已验收",
      "覆盖状态": "covered",
      "变更状态": "new",
    },
  ]);

  const badResult = validateSuite(badCases, "", { requiredTypes: ["happy path", "negative path", "boundary value"] });
  assert.equal(badResult.ok, false);
  assert(badResult.issues.some((issue) => issue.message.includes("Weak assertion")));
  assert(badResult.issues.some((issue) => issue.message.includes("是否可自动化")));
  assert(badResult.issues.some((issue) => issue.message.includes("人工验收状态")));
  assert(badResult.issues.some((issue) => issue.message.includes("boundary value")));

  const missingRequiredHeaders = makeCsv(
    caseHeaders.filter((header) => !["Scenario-ID", "覆盖状态", "变更状态"].includes(header)),
    [
      {
        "TC-ID": "TC-003",
        "标题": "缺少必填列的用例",
        "关联需求": "REQ-003",
        "优先级": "P1",
        "测试类型": "happy path",
        "前置条件": "存在用户",
        "测试数据": "userId=U-1",
        "步骤": "1. 执行动作\n2. 查看结果",
        "预期结果": "系统返回 200；响应体包含 userId。",
        "是否可自动化": "是",
        "自动化建议": "API contract",
        "人工验收状态": "不适用",
      },
    ],
  );
  const missingHeaderResult = validateSuite(missingRequiredHeaders);
  assert.equal(missingHeaderResult.ok, false);
  assert(missingHeaderResult.issues.some((issue) => issue.message.includes("Scenario-ID")));

  const weakButCommonCases = makeCsv(caseHeaders, [
    {
      "TC-ID": "TC-004",
      "标题": "弱断言示例",
      "关联需求": "REQ-004",
      "Scenario-ID": "SCN-004",
      "优先级": "P1",
      "测试类型": "happy path",
      "前置条件": "存在用户",
      "测试数据": "userId=U-1",
      "步骤": "1. 登录系统\n2. 执行操作",
      "预期结果": "用户可以成功操作。",
      "是否可自动化": "是",
      "自动化建议": "E2E",
      "人工验收状态": "不适用",
      "覆盖状态": "covered",
      "变更状态": "new",
    },
  ]);
  const weakCommonResult = validateSuite(weakButCommonCases);
  assert.equal(weakCommonResult.ok, false);
  assert(weakCommonResult.issues.some((issue) => issue.message.includes("Weak assertion")));

  const orphanTrace = `${goodTrace}\nREQ-999,Orphan,SCN-999,Orphan,TC-999,Orphan,happy path,P1,covered,是,E2E,不适用,new,self-test`;
  const orphanResult = validateSuite(goodCases, orphanTrace);
  assert.equal(orphanResult.ok, false);
  assert(orphanResult.issues.some((issue) => issue.message.includes("unknown TC-ID: TC-999")));
  assert(orphanResult.issues.some((issue) => issue.message.includes("unknown REQ-ID: REQ-999")));

  const missingTraceColumns = makeCsv(
    traceHeaders.filter((header) => !["Requirement Summary", "Automation Level", "Source"].includes(header)),
    [
      {
        "REQ-ID": "REQ-001",
        "Scenario-ID": "SCN-001",
        "Scenario Summary": "管理员批准订单",
        "TC-ID": "TC-001",
        "Test Case Title": "有效管理员提交审批后订单进入 approved 状态",
        "Test Type": "happy path",
        "Priority": "P0",
        "Coverage Status": "covered",
        "Automation Candidate": "是",
        "Manual Acceptance Status": "不适用",
        "Change Status": "new",
      },
    ],
  );
  const missingTraceResult = validateSuite(goodCases, missingTraceColumns);
  assert.equal(missingTraceResult.ok, false);
  assert(missingTraceResult.issues.some((issue) => issue.message.includes("Requirement Summary")));
  assert(missingTraceResult.issues.some((issue) => issue.message.includes("Automation Level")));
  assert(missingTraceResult.issues.some((issue) => issue.message.includes("Source")));

  const swappedTrace = makeCsv(traceHeaders, [
    {
      "REQ-ID": "REQ-001",
      "Requirement Summary": "错误配对",
      "Scenario-ID": "SCN-002",
      "Scenario Summary": "无权限审批被拒绝",
      "TC-ID": "TC-001",
      "Test Case Title": "有效管理员提交审批后订单进入 approved 状态",
      "Test Type": "happy path",
      "Priority": "P0",
      "Coverage Status": "covered",
      "Automation Candidate": "是",
      "Automation Level": "API contract + E2E",
      "Manual Acceptance Status": "不适用",
      "Change Status": "new",
      "Source": "self-test PRD",
    },
    {
      "REQ-ID": "REQ-001",
      "Requirement Summary": "订单审批必须按角色授权并记录审计",
      "Scenario-ID": "SCN-002",
      "Scenario Summary": "无权限审批被拒绝",
      "TC-ID": "TC-002",
      "Test Case Title": "无审批权限用户提交审批时被拒绝且订单状态不变",
      "Test Type": "negative path",
      "Priority": "P0",
      "Coverage Status": "covered",
      "Automation Candidate": "是",
      "Automation Level": "API contract",
      "Manual Acceptance Status": "不适用",
      "Change Status": "new",
      "Source": "self-test PRD",
    },
  ]);
  const swappedTraceResult = validateSuite(goodCases, swappedTrace);
  assert.equal(swappedTraceResult.ok, false);
  assert(swappedTraceResult.issues.some((issue) => issue.message.includes("mismatched REQ-ID/Scenario-ID/TC-ID triple")));

  const multiReqCases = makeCsv(caseHeaders, [
    {
      "TC-ID": "TC-010",
      "标题": "端到端审批同时覆盖提交和批准需求",
      "关联需求": "REQ-010;REQ-011",
      "Scenario-ID": "SCN-010",
      "优先级": "P0",
      "测试类型": "workflow",
      "前置条件": "存在 draft 订单，采购员和审批员账号可用",
      "测试数据": "orderId=ORD-MULTI-1; amount=100.00",
      "步骤": "1. 采购员提交订单\n2. 审批员批准订单\n3. 查询订单状态和审计日志",
      "预期结果": "订单先变为 pending_approval，再变为 approved；审计日志分别记录提交和批准事件。",
      "是否可自动化": "是",
      "自动化建议": "E2E workflow",
      "人工验收状态": "不适用",
      "覆盖状态": "covered",
      "变更状态": "new",
    },
  ]);
  const incompleteMultiReqTrace = makeCsv(traceHeaders, [
    {
      "REQ-ID": "REQ-010",
      "Requirement Summary": "采购员提交订单",
      "Scenario-ID": "SCN-010",
      "Scenario Summary": "端到端审批",
      "TC-ID": "TC-010",
      "Test Case Title": "端到端审批同时覆盖提交和批准需求",
      "Test Type": "workflow",
      "Priority": "P0",
      "Coverage Status": "covered",
      "Automation Candidate": "是",
      "Automation Level": "E2E",
      "Manual Acceptance Status": "不适用",
      "Change Status": "new",
      "Source": "self-test PRD",
    },
  ]);
  const incompleteMultiReqResult = validateSuite(multiReqCases, incompleteMultiReqTrace);
  assert.equal(incompleteMultiReqResult.ok, false);
  assert(incompleteMultiReqResult.issues.some((issue) => issue.message.includes("missing REQ-ID/Scenario-ID/TC-ID triple: REQ-011|SCN-010|TC-010")));

  const perReqMissingCases = makeCsv(caseHeaders, [
    {
      "TC-ID": "TC-020",
      "标题": "支付成功回调写入支付流水",
      "关联需求": "REQ-020",
      "Scenario-ID": "SCN-020",
      "优先级": "P0",
      "测试类型": "happy path",
      "前置条件": "订单处于 pending_payment",
      "测试数据": "orderId=PAY-1; callbackId=EVT-1",
      "步骤": "1. 发送支付成功回调\n2. 查询订单和支付流水",
      "预期结果": "订单状态变为 paid；支付流水只新增一条 callbackId=EVT-1 的成功记录。",
      "是否可自动化": "是",
      "自动化建议": "API contract",
      "人工验收状态": "不适用",
      "覆盖状态": "covered",
      "变更状态": "new",
    },
    {
      "TC-ID": "TC-021",
      "标题": "库存超卖规则缺失时阻塞安全覆盖",
      "关联需求": "REQ-021",
      "Scenario-ID": "SCN-021",
      "优先级": "P0",
      "测试类型": "security",
      "前置条件": "PRD 未定义秒杀库存并发规则",
      "测试数据": "sku=SKU-1; concurrency=待澄清",
      "步骤": "1. 检查 PRD 是否定义库存锁定与并发扣减规则\n2. 标记阻塞覆盖",
      "预期结果": "覆盖状态为 needs clarification；澄清问题要求确认库存锁定、幂等键和超卖拒绝策略。",
      "是否可自动化": "否",
      "自动化建议": "待确认并发规则后再生成自动化候选",
      "人工验收状态": "待用户验收",
      "覆盖状态": "needs clarification",
      "变更状态": "new",
    },
  ]);
  const perReqMissingResult = validateSuite(perReqMissingCases, "", { requiredTypesPerReq: ["happy path", "security"] });
  assert.equal(perReqMissingResult.ok, false);
  assert(perReqMissingResult.issues.some((issue) => issue.message.includes("REQ-ID REQ-020 is missing required per-REQ test type: security")));
  assert(perReqMissingResult.issues.some((issue) => issue.message.includes("REQ-ID REQ-021 is missing required per-REQ test type: happy path")));
}

function main() {
  const options = parseArgs(process.argv);

  if (options.selfTest) {
    runSelfTest();
    console.log("requirements-test-designer validator self-test passed");
    return 0;
  }

  if (!options.casesPath) {
    throw new Error("Usage: validate-test-suite.mjs <test-cases.csv> [--trace <traceability.csv>] [--require-types <list>] [--require-types-per-req <list>] [--json] or --self-test");
  }

  const casesCsv = readUtf8(path.resolve(options.casesPath));
  const traceCsv = options.tracePath ? readUtf8(path.resolve(options.tracePath)) : "";
  const result = validateSuite(casesCsv, traceCsv, {
    requiredTypes: options.requiredTypes,
    requiredTypesPerReq: options.requiredTypesPerReq,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Test suite validation: ${result.ok ? "PASS" : "FAIL"}`);
    console.log(`Cases: ${result.caseCount}`);
    for (const issue of result.issues) {
      const row = issue.row ? ` row ${issue.row}` : "";
      console.log(`- [${issue.severity}]${row} ${issue.message}`);
    }
  }

  return result.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
