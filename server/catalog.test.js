import test from "node:test";
import assert from "node:assert/strict";
import { departments, departmentCode, programs } from "./catalog.js";
import { formatStudentId } from "./logic.js";

test("the academic catalog contains the four approved departments", () => {
  assert.deepEqual(
    departments.map((department) => department.name),
    [
      "Electrical and Allied Department",
      "Civil and Allied",
      "Basic Arts and Sciences",
      "Mechanical and Allied",
    ],
  );
});

test("all eight approved programs belong to the requested departments", () => {
  assert.deepEqual(
    programs.map(({ code, department }) => [code, department]),
    [
      ["BSIT", "EAAD"],
      ["BSEE", "EAAD"],
      ["BSCE", "CAAD"],
      ["BSES", "CAAD"],
      ["BSME", "MAAD"],
      ["BETMT", "MAAD"],
      ["BTVTED-ET", "BASD"],
      ["BTVTED-ELT", "BASD"],
    ],
  );
  assert.ok(programs.every((program) => program.yearLevels.length > 0));
  assert.equal(departmentCode("Mechanical and Allied"), "MAAD");
  assert.equal(formatStudentId(2026, "BTVTED-ET", 12), "2026-BTVTED-ET-0012");
});
