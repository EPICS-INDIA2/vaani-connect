"""Romanized-input normalization for Indic language text.

Users sometimes type Hindi/Tamil/etc. with Latin letters. This helper detects
that case and, when supported, converts the text to the native script before it
goes into the translation model.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from app.languages import LANGUAGE_TO_CODE

logger = logging.getLogger(__name__)

try:
    from indic_transliteration import sanscript
    from indic_transliteration.sanscript import transliterate as sanscript_transliterate
except ImportError:  # pragma: no cover - exercised in environments without the optional dependency.
    sanscript = None
    sanscript_transliterate = None


SCRIPT_RANGES: dict[str, str] = {
    "Arab": r"\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF",
    "Beng": r"\u0980-\u09FF",
    "Deva": r"\u0900-\u097F",
    "Gujr": r"\u0A80-\u0AFF",
    "Guru": r"\u0A00-\u0A7F",
    "Knda": r"\u0C80-\u0CFF",
    "Mlym": r"\u0D00-\u0D7F",
    "Mtei": r"\uABC0-\uABFF",
    "Olck": r"\u1C50-\u1C7F",
    "Orya": r"\u0B00-\u0B7F",
    "Taml": r"\u0B80-\u0BFF",
    "Telu": r"\u0C00-\u0C7F",
}

SCRIPT_TO_SANSCRIPT: dict[str, str] = {}


def _get_scheme(*names: str) -> str | None:
    if sanscript is None:
        return None
    for name in names:
        value = getattr(sanscript, name, None)
        if value is not None:
            return value
    return None


if sanscript is not None:
    candidate_schemes = {
        "Beng": _get_scheme("BENGALI"),
        "Deva": _get_scheme("DEVANAGARI"),
        "Gujr": _get_scheme("GUJARATI"),
        "Guru": _get_scheme("GURMUKHI"),
        "Knda": _get_scheme("KANNADA"),
        "Mlym": _get_scheme("MALAYALAM"),
        "Orya": _get_scheme("ORIYA", "ODIA"),
        "Taml": _get_scheme("TAMIL"),
        "Telu": _get_scheme("TELUGU"),
    }
    SCRIPT_TO_SANSCRIPT = {
        script_code: scheme for script_code, scheme in candidate_schemes.items() if scheme is not None
    }

LATIN_LETTER_RE = re.compile(r"[A-Za-z]")


@dataclass(frozen=True)
class NormalizedText:
    text: str
    normalized_text: str
    source_language: str
    source_script: str
    is_romanized: bool
    transliteration_applied: bool
    transliteration_supported: bool


def _language_script_code(language_name: str) -> str | None:
    lang_code = LANGUAGE_TO_CODE.get(language_name)
    if not lang_code or "_" not in lang_code:
        return None
    return lang_code.rsplit("_", 1)[-1]


def _script_pattern(script_code: str) -> re.Pattern[str] | None:
    unicode_range = SCRIPT_RANGES.get(script_code)
    if unicode_range is None:
        return None
    return re.compile(f"[{unicode_range}]")


def _contains_native_script(text: str, script_code: str) -> bool:
    pattern = _script_pattern(script_code)
    if pattern is None:
        return False
    return pattern.search(text) is not None


def is_probably_romanized(text: str, source_language: str) -> bool:
    # Heuristic only: if most meaningful characters are Latin letters and the
    # native script is absent, treat the input as romanized.
    stripped = text.strip()
    if not stripped:
        return False

    script_code = _language_script_code(source_language)
    if script_code is None:
        return False
    if _contains_native_script(stripped, script_code):
        return False

    latin_count = len(LATIN_LETTER_RE.findall(stripped))
    if latin_count == 0:
        return False

    meaningful_char_count = len([char for char in stripped if not char.isspace()])
    if meaningful_char_count == 0:
        return False

    return (latin_count / meaningful_char_count) >= 0.6


def transliteration_supported(source_language: str) -> bool:
    script_code = _language_script_code(source_language)
    if script_code is None:
        return False
    return script_code in SCRIPT_TO_SANSCRIPT and sanscript_transliterate is not None


def transliterate_to_native(text: str, source_language: str) -> str:
    script_code = _language_script_code(source_language)
    if script_code is None:
        raise ValueError(f"No script configured for language: {source_language}")

    target_scheme = SCRIPT_TO_SANSCRIPT.get(script_code)
    if target_scheme is None or sanscript_transliterate is None or sanscript is None:
        raise ValueError(f"Romanized transliteration is not supported for: {source_language}")

    optitrans_scheme = _get_scheme("OPTITRANS") or _get_scheme("ITRANS")
    itrans_scheme = _get_scheme("ITRANS")
    if optitrans_scheme is None or itrans_scheme is None:
        raise ValueError("Romanized transliteration backend is not fully configured")

    try:
        return sanscript_transliterate(text, optitrans_scheme, target_scheme)
    except Exception as optitrans_error:  # noqa: BLE001 - fallback to ITRANS for looser user input.
        logger.debug(
            "OPTITRANS transliteration failed for %s. Falling back to ITRANS.",
            source_language,
            exc_info=True,
        )
        try:
            return sanscript_transliterate(text, itrans_scheme, target_scheme)
        except Exception as itrans_error:  # noqa: BLE001 - normalize into one backend-facing error.
            raise ValueError(
                f"Romanized transliteration failed for {source_language}: {itrans_error}"
            ) from optitrans_error


def normalize_text_for_translation(text: str, source_language: str) -> NormalizedText:
    # The server uses this one function before translation so it can also report
    # whether transliteration was attempted in the API response/metrics.
    stripped = text.strip()
    script_code = _language_script_code(source_language) or "unknown"
    supported = transliteration_supported(source_language)
    romanized = is_probably_romanized(stripped, source_language)

    if not romanized:
        return NormalizedText(
            text=text,
            normalized_text=text,
            source_language=source_language,
            source_script=script_code,
            is_romanized=False,
            transliteration_applied=False,
            transliteration_supported=supported,
        )

    if not supported:
        return NormalizedText(
            text=text,
            normalized_text=text,
            source_language=source_language,
            source_script=script_code,
            is_romanized=True,
            transliteration_applied=False,
            transliteration_supported=False,
        )

    normalized_text = transliterate_to_native(text, source_language)
    return NormalizedText(
        text=text,
        normalized_text=normalized_text,
        source_language=source_language,
        source_script=script_code,
        is_romanized=True,
        transliteration_applied=normalized_text != text,
        transliteration_supported=True,
    )
