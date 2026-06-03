import { NextRequest } from "next/server";
import { searchProducts } from "@/lib/db";
import { parseFilters } from "@/lib/parseFilters";
import { parseSpecRequirements } from "@/lib/parseSpecs";

async function transcribeWithHuggingFace(
  audioBuffer: ArrayBuffer,
  audioType: string
): Promise<string> {
  const token = process.env.HF_API_TOKEN;
  if (!token) throw new Error("HF_API_TOKEN is not set");

  const res = await fetch(
    "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": audioType.split(";")[0],
      },
      body: Buffer.from(audioBuffer),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`HuggingFace Whisper error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.text || "";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return Response.json({ error: "No audio file provided" }, { status: 400 });
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const audioType = audioFile.type || "audio/webm";

    let transcribedText: string;
    try {
      transcribedText = await transcribeWithHuggingFace(audioBuffer, audioType);
    } catch (err) {
      console.error("Transcription failed:", err);
      return Response.json({ error: `Transcription failed: ${err}` }, { status: 500 });
    }

    if (!transcribedText.trim()) {
      return Response.json({ results: [], message: "No speech detected in audio", transcribedText: "" });
    }

    const { category, maxPrice } = parseFilters(transcribedText);
    const specReqs = parseSpecRequirements(transcribedText);
    const { results, mode } = await searchProducts(transcribedText, category, maxPrice, specReqs);

    return Response.json({
      results,
      mode,
      transcribedText,
      transcriptionSource: "huggingface",
      category,
      maxPrice: maxPrice < 999999 ? maxPrice : undefined,
    });
  } catch (error) {
    console.error("Audio search error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
