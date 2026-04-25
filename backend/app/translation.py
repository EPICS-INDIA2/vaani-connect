"""Translation service for Vaani Connect.

This file wraps the IndicTrans2 models used by the backend. The API sends
language codes like ``eng_Latn`` and receives translated text plus timing stats
that are useful for benchmarks and debugging.
"""

from __future__ import annotations

from dataclasses import dataclass
import logging
import time
from typing import Any

import torch
from IndicTransToolkit.processor import IndicProcessor
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

ENGLISH_CODE = "eng_Latn"
# These Hugging Face model IDs must stay compatible with the language codes in
# app/languages.py. Changing them can require changing routing and tests.
EN_INDIC_MODEL_ID = "ai4bharat/indictrans2-en-indic-dist-200M"
INDIC_EN_MODEL_ID = "ai4bharat/indictrans2-indic-en-dist-200M"
INDIC_INDIC_MODEL_ID = "ai4bharat/indictrans2-indic-indic-dist-320M"

logger = logging.getLogger(__name__)


@dataclass
class TranslationService:
    """IndicTrans2 translation wrapper for backend usage."""

    device: str = "cuda" if torch.cuda.is_available() else "cpu"

    def __post_init__(self) -> None:
        # Load all three translation directions once. This is slow at startup
        # but avoids paying model-loading cost for every user request.
        self.ip = IndicProcessor(inference=True)
        self.en_indic_tokenizer = AutoTokenizer.from_pretrained(
            EN_INDIC_MODEL_ID,
            trust_remote_code=True,
        )
        self.en_indic_model = AutoModelForSeq2SeqLM.from_pretrained(
            EN_INDIC_MODEL_ID,
            trust_remote_code=True,
        ).to(self.device)
        self.en_indic_model.eval()

        self.indic_en_tokenizer = AutoTokenizer.from_pretrained(
            INDIC_EN_MODEL_ID,
            trust_remote_code=True,
        )
        self.indic_en_model = AutoModelForSeq2SeqLM.from_pretrained(
            INDIC_EN_MODEL_ID,
            trust_remote_code=True,
        ).to(self.device)
        self.indic_en_model.eval()

        self.indic_indic_tokenizer = AutoTokenizer.from_pretrained(
            INDIC_INDIC_MODEL_ID,
            trust_remote_code=True,
        )
        self.indic_indic_model = AutoModelForSeq2SeqLM.from_pretrained(
            INDIC_INDIC_MODEL_ID,
            trust_remote_code=True,
        ).to(self.device)
        self.indic_indic_model.eval()

    def _run_translation_with_stats(
        self,
        texts: list[str],
        src_lang: str,
        tgt_lang: str,
        model,
        tokenizer,
        model_id: str,
        stage_name: str,
    ) -> tuple[list[str], dict[str, Any]]:
        # One translation "stage" is preprocess -> tokenize -> model generate
        # -> decode/postprocess. Stats from each stage are returned to the API
        # so benchmark scripts can explain where latency came from.
        stage_start = time.perf_counter()

        preprocess_start = time.perf_counter()
        batch = self.ip.preprocess_batch(texts, src_lang=src_lang, tgt_lang=tgt_lang)
        preprocess_ms = (time.perf_counter() - preprocess_start) * 1000

        tokenize_start = time.perf_counter()
        inputs = tokenizer(
            batch,
            return_tensors="pt",
            padding=True,
            truncation=True,
        ).to(self.device)
        tokenize_ms = (time.perf_counter() - tokenize_start) * 1000

        input_tokens = None
        if "input_ids" in inputs:
            input_tokens = int(inputs["input_ids"].shape[-1])

        generate_start = time.perf_counter()
        with torch.no_grad():
            generated = model.generate(
                **inputs,
                num_beams=5,
                num_return_sequences=1,
                max_length=256,
            )
        generate_ms = (time.perf_counter() - generate_start) * 1000

        output_tokens = int(generated.shape[-1]) if hasattr(generated, "shape") else None

        decode_start = time.perf_counter()
        decoded = tokenizer.batch_decode(generated, skip_special_tokens=True)
        outputs = self.ip.postprocess_batch(decoded, lang=tgt_lang)
        decode_ms = (time.perf_counter() - decode_start) * 1000

        stage_total_ms = (time.perf_counter() - stage_start) * 1000
        stats = {
            "stage": stage_name,
            "model_id": model_id,
            "src_lang": src_lang,
            "tgt_lang": tgt_lang,
            "device": self.device,
            "batch_size": len(texts),
            "input_chars": sum(len(item) for item in texts),
            "output_chars": sum(len(item) for item in outputs),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "preprocess_ms": round(preprocess_ms, 2),
            "tokenize_ms": round(tokenize_ms, 2),
            "generate_ms": round(generate_ms, 2),
            "decode_ms": round(decode_ms, 2),
            "latency_ms": round(stage_total_ms, 2),
        }
        return outputs, stats

    def _build_result(
        self,
        *,
        request_start: float,
        route: str,
        translated: str,
        steps: list[dict[str, Any]],
        model_ids: list[str],
        input_text: str,
        used_fallback: bool,
        fallback_reason: str | None = None,
    ) -> dict[str, Any]:
        result = {
            "route": route,
            "used_fallback": used_fallback,
            "device": self.device,
            "model_ids": model_ids,
            "steps": steps,
            "input_chars": len(input_text),
            "output_chars": len(translated),
            "total_latency_ms": round((time.perf_counter() - request_start) * 1000, 2),
        }
        if fallback_reason is not None:
            result["fallback_reason"] = fallback_reason
        return result

    def translate_text_with_stats(
        self,
        text: str,
        src_lang: str,
        tgt_lang: str,
    ) -> tuple[str, dict[str, Any]]:
        request_start = time.perf_counter()
        steps: list[dict[str, Any]] = []
        route = ""
        fallback_reason: str | None = None

        # English has its own direct model path.
        if src_lang == ENGLISH_CODE:
            route = "en_to_indic_direct"
            outputs, step_stats = self._run_translation_with_stats(
                [text],
                src_lang,
                tgt_lang,
                self.en_indic_model,
                self.en_indic_tokenizer,
                model_id=EN_INDIC_MODEL_ID,
                stage_name="en_to_indic",
            )
            steps.append(step_stats)
            translated = outputs[0]
            return translated, self._build_result(
                request_start=request_start,
                route=route,
                translated=translated,
                steps=steps,
                model_ids=[EN_INDIC_MODEL_ID],
                input_text=text,
                used_fallback=False,
            )

        # Translating into English also has its own direct model path.
        if tgt_lang == ENGLISH_CODE:
            route = "indic_to_en_direct"
            outputs, step_stats = self._run_translation_with_stats(
                [text],
                src_lang,
                tgt_lang,
                self.indic_en_model,
                self.indic_en_tokenizer,
                model_id=INDIC_EN_MODEL_ID,
                stage_name="indic_to_en",
            )
            steps.append(step_stats)
            translated = outputs[0]
            return translated, self._build_result(
                request_start=request_start,
                route=route,
                translated=translated,
                steps=steps,
                model_ids=[INDIC_EN_MODEL_ID],
                input_text=text,
                used_fallback=False,
            )

        try:
            # For Indic-to-Indic pairs, use the direct model first. If that
            # model fails for a specific pair, the fallback below pivots through
            # English so users still get a result when possible.
            route = "indic_to_indic_direct"
            outputs, step_stats = self._run_translation_with_stats(
                [text],
                src_lang,
                tgt_lang,
                self.indic_indic_model,
                self.indic_indic_tokenizer,
                model_id=INDIC_INDIC_MODEL_ID,
                stage_name="indic_to_indic",
            )
            steps.append(step_stats)
            translated = outputs[0]
            return translated, self._build_result(
                request_start=request_start,
                route=route,
                translated=translated,
                steps=steps,
                model_ids=[INDIC_INDIC_MODEL_ID],
                input_text=text,
                used_fallback=False,
            )
        except Exception:  # noqa: BLE001 - fallback keeps API robust for edge language-code/model issues.
            fallback_reason = "direct_indic_to_indic_failed"
            logger.exception(
                "Direct Indic->Indic translation failed for %s -> %s; using English pivot fallback.",
                src_lang,
                tgt_lang,
            )

        # Fallback route: source Indic language -> English -> target Indic
        # language. This is slower, but it keeps the app usable when the direct
        # Indic-to-Indic model has an edge-case failure.
        route = "indic_to_indic_via_english_fallback"
        english_intermediate, step_1_stats = self._run_translation_with_stats(
            [text],
            src_lang,
            ENGLISH_CODE,
            self.indic_en_model,
            self.indic_en_tokenizer,
            model_id=INDIC_EN_MODEL_ID,
            stage_name="indic_to_en_pivot",
        )
        steps.append(step_1_stats)
        translated_outputs, step_2_stats = self._run_translation_with_stats(
            english_intermediate,
            ENGLISH_CODE,
            tgt_lang,
            self.en_indic_model,
            self.en_indic_tokenizer,
            model_id=EN_INDIC_MODEL_ID,
            stage_name="en_to_indic_pivot",
        )
        steps.append(step_2_stats)
        translated = translated_outputs[0]
        return translated, self._build_result(
            request_start=request_start,
            route=route,
            translated=translated,
            steps=steps,
            model_ids=[INDIC_EN_MODEL_ID, EN_INDIC_MODEL_ID],
            input_text=text,
            used_fallback=True,
            fallback_reason=fallback_reason,
        )

    def translate_text(self, text: str, src_lang: str, tgt_lang: str) -> str:
        translated, _ = self.translate_text_with_stats(text=text, src_lang=src_lang, tgt_lang=tgt_lang)
        return translated

    def warmup(self) -> None:
        warmup_pairs = [
            ("hello", ENGLISH_CODE, "hin_Deva"),
            ("namaste", "hin_Deva", ENGLISH_CODE),
            ("namaste", "hin_Deva", "tam_Taml"),
        ]

        for text, src_lang, tgt_lang in warmup_pairs:
            try:
                self.translate_text(text, src_lang, tgt_lang)
            except Exception:  # noqa: BLE001 - warmup should not crash service boot.
                logger.exception("Translation warmup failed for %s -> %s", src_lang, tgt_lang)
