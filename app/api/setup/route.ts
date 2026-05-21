import { setupDatabase } from "@/lib/db";

export async function POST() {
  try {
    await setupDatabase();
    return Response.json({ success: true, message: "Database setup complete" });
  } catch (error) {
    console.error("Setup error:", error);
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
