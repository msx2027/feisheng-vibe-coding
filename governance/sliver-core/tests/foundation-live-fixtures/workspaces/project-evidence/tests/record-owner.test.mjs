import { strictEqual } from "node:assert";
import { normalizeRecord } from "../src/core/record-owner.mjs";
import { adaptRecord } from "../src/adapters/record-adapter.mjs";

strictEqual(normalizeRecord(" record "), "record");
strictEqual(adaptRecord(" review "), "review");
