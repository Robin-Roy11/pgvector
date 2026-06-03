import io
import os
import uvicorn
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import librosa
from transformers import AutoProcessor, ClapModel, pipeline

# Load environment variables from root .env if it exists
if os.path.exists("../.env"):
    with open("../.env") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                parts = line.strip().split("=", 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip().strip('"').strip("'")
                    os.environ[key] = val

# Map HF_API_TOKEN to HF_TOKEN for HuggingFace library authentication
if "HF_API_TOKEN" in os.environ and "HF_TOKEN" not in os.environ:
    os.environ["HF_TOKEN"] = os.environ["HF_API_TOKEN"]

app = FastAPI(title="CLAP Joint Text-Audio Embedding & Transcription Server")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model lazy loading
model = None
processor = None
whisper_pipeline = None

# Support Apple Silicon (MPS), CUDA, and CPU
if torch.backends.mps.is_available():
    device = "mps"
elif torch.cuda.is_available():
    device = "cuda"
else:
    device = "cpu"

def get_model_and_processor():
    global model, processor
    if model is None or processor is None:
        print(f"Loading CLAP model onto {device}...")
        hf_token = os.environ.get("HF_TOKEN")
        # Fix: Using correct and public model identifier
        model = ClapModel.from_pretrained("laion/clap-htsat-unfused", token=hf_token).to(device)
        processor = AutoProcessor.from_pretrained("laion/clap-htsat-unfused", token=hf_token)
        print("Model and processor loaded successfully!")
    return model, processor

def get_whisper_pipeline():
    global whisper_pipeline
    if whisper_pipeline is None:
        print(f"Loading Whisper pipeline onto {device}...")
        hf_token = os.environ.get("HF_TOKEN")
        # Use a string or device object depending on platform compatibility
        whisper_pipeline = pipeline(
            "automatic-speech-recognition",
            model="openai/whisper-tiny",
            device=device,
            token=hf_token
        )
        print("Whisper pipeline loaded successfully!")
    return whisper_pipeline

class TextRequest(BaseModel):
    text: str

@app.get("/health")
def health():
    return {"status": "healthy", "device": device}

@app.post("/embed/text")
def embed_text(req: TextRequest):
    clap_model, clap_processor = get_model_and_processor()
    inputs = clap_processor(text=[req.text], return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        text_embeds = clap_model.get_text_features(**inputs)
        # Handle different transformers versions (some return BaseModelOutputWithPooling, others a tensor)
        if hasattr(text_embeds, "pooler_output"):
            text_embeds = text_embeds.pooler_output
    # L2 normalize
    text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)
    embedding = text_embeds[0].cpu().numpy().tolist()
    return {"embedding": embedding}

@app.post("/embed/audio")
async def embed_audio(file: UploadFile = File(...)):
    clap_model, clap_processor = get_model_and_processor()
    audio_bytes = await file.read()

    # Load audio. CLAP natively expects 48000Hz sampling rate
    try:
        audio_data, sr = librosa.load(io.BytesIO(audio_bytes), sr=48000)
    except Exception as e:
        return {"error": f"Failed to parse audio file: {str(e)}"}, 400

    inputs = clap_processor(audio=audio_data, sampling_rate=48000, return_tensors="pt").to(device)
    with torch.no_grad():
        audio_embeds = clap_model.get_audio_features(**inputs)
        # Handle different transformers versions (some return BaseModelOutputWithPooling, others a tensor)
        if hasattr(audio_embeds, "pooler_output"):
            audio_embeds = audio_embeds.pooler_output

    # L2 normalize
    audio_embeds = audio_embeds / audio_embeds.norm(dim=-1, keepdim=True)
    embedding = audio_embeds[0].cpu().numpy().tolist()
    return {"embedding": embedding}

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    audio_bytes = await file.read()

    # Load audio. Whisper natively expects 16000Hz sampling rate
    try:
        audio_data, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000)
    except Exception as e:
        return {"error": f"Failed to parse audio file: {str(e)}"}, 400

    try:
        pipeline_instance = get_whisper_pipeline()
        res = pipeline_instance(audio_data)
        return {"text": res["text"]}
    except Exception as e:
        return {"error": f"Transcription failed: {str(e)}"}, 500

if __name__ == "__main__":
    print("Starting CLAP server on http://localhost:8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
