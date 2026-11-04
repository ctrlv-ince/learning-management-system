import { AcademicYear, Program } from "./models/index.js";

export const departments = [
  { code: "EAAD", name: "Electrical and Allied Department" },
  { code: "CAAD", name: "Civil and Allied Department" },
  { code: "BASD", name: "Basic Arts and Sciences Department" },
  { code: "MAAD", name: "Mechanical and Allied Department" },
];

export const programs = [
  {
    code: "BSIT",
    name: "Bachelor of Science in Information Technology",
    department: "EAAD",
  },
  {
    code: "BSEE",
    name: "BS Electrical Engineering",
    department: "EAAD",
  },
  {
    code: "BSCE",
    name: "BS Civil Engineering",
    department: "CAAD",
  },
  {
    code: "BSES",
    name: "Bachelor of Science in Environmental Science",
    department: "CAAD",
  },
  {
    code: "BSME",
    name: "BS Mechanical Engineering",
    department: "MAAD",
  },
  {
    code: "BETMT",
    name: "Bachelor of Engineering Technology major in Mechanical Technology",
    department: "MAAD",
  },
  {
    code: "BTVTED-ET",
    name: "Bachelor of Technical-Vocational Teacher Education major in Electrical Technology",
    department: "BASD",
  },
  {
    code: "BTVTED-ELT",
    name: "Bachelor of Technical-Vocational Teacher Education major in Electronics Technology",
    department: "BASD",
  },
].map((program) => ({
  ...program,
  yearLevels: ["1st Year", "2nd Year", "3rd Year", "4th Year"],
}));

export const departmentNames = departments.map(({ name }) => name);
export const departmentCode = (name) =>
  departments.find((department) => department.name === name)?.code;
export const departmentName = (code) =>
  departments.find((department) => department.code === code)?.name;

export async function seedAcademicCatalog() {
  await Program.bulkWrite(
    programs.map((program) => ({
      updateOne: {
        filter: { code: program.code },
        update: {
          $set: {
            name: program.name,
            department: program.department,
            yearLevels: program.yearLevels,
          },
          $setOnInsert: { code: program.code },
        },
        upsert: true,
      },
    })),
  );

  const year = new Date().getFullYear();
  const currentLabel = `${year}-${year + 1}`;
  await AcademicYear.updateOne(
    { label: currentLabel },
    { $setOnInsert: { label: currentLabel, current: false } },
    { upsert: true },
  );
  if (!(await AcademicYear.exists({ current: true })))
    await AcademicYear.updateOne(
      { label: currentLabel },
      { $set: { current: true } },
    );
}
