import { Offering } from "./models/index.js";

export const COURSE_ENROLLMENT_LIMIT = 40;

export async function addStudentToOffering(offeringId, studentId) {
  const updated = await Offering.updateOne(
    {
      _id: offeringId,
      students: { $ne: studentId },
      $expr: {
        $lt: [
          { $size: { $ifNull: ["$students", []] } },
          COURSE_ENROLLMENT_LIMIT,
        ],
      },
    },
    { $addToSet: { students: studentId } },
  );
  if (updated.modifiedCount) return "enrolled";

  const offering = await Offering.findById(offeringId).select("students");
  if (
    offering?.students.some((student) => String(student) === String(studentId))
  )
    return "already-enrolled";
  return "full";
}
