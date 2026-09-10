import { strictEqual, match } from "node:assert";
import { StableDataTable } from "../src/components/StableDataTable.js";
import { Card } from "../src/components/ui/Card.js";
import { workflowCopy } from "../src/i18n/workflow.js";

const table = StableDataTable([{ id: "REC-101", status: "Ready" }]);
match(table, /<th>Record<\/th><th>Status<\/th>/);
match(table, /REC-101/);
match(table, /Ready/);
strictEqual(Card(table).includes(table), true);
strictEqual(workflowCopy.error, "Records could not be loaded");
