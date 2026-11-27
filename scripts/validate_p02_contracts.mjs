#!/usr/bin/env node
// Node / browser-compatible semantic contract validation runner.
import {readFileSync} from "node:fs";
import {validateBundle} from "../web/js/contracts.mjs";
const files = process.argv.slice(2);
if (!files.length) files.push("tests/fixtures/synthetic/synthetic_2024.json","tests/fixtures/synthetic/synthetic_2025.json");
let bad = false;
for (const path of files) {
  let errors;
  try {
    errors = validateBundle(JSON.parse(readFileSync(path,"utf8")));
  } catch (_) {
    errors = ["INPUT_INVALID"];
  }
  console.log(JSON.stringify({errors, file:path.split("/").at(-1)}));
  bad ||= errors.length > 0;
}
process.exitCode = bad ? 1 : 0;
