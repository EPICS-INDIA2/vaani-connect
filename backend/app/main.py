"""Backend service bootstrap helpers.

This small module builds the heavy model services used by the API server:
translation and speech recognition. Keep model initialization centralized here
so the FastAPI routes can lazy-load the services without knowing the setup
details.
"""

from __future__ import annotations

from app.asr import ASRService
from app.config import login_huggingface
from app.translation import TranslationService
from app.tts import tts_generate


def build_services() -> tuple[TranslationService, ASRService]:
    # Hugging Face login must happen before model classes try to download or
    # load gated model files.
    hf_token = login_huggingface()
    translation_service = TranslationService()
    asr_service = ASRService(hf_token=hf_token)
    return translation_service, asr_service


def _run_demo() -> None:
    translation_service, _ = build_services()
    demo_text = "Hello, how are you?"
    translated = translation_service.translate_text(demo_text, "eng_Latn", "hin_Deva")
    print("Translated:", translated)

    audio_path = tts_generate(translated, "Hindi")
    print("TTS Audio:", audio_path)


if __name__ == "__main__":
    _run_demo()
