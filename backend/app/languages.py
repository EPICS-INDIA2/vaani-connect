from __future__ import annotations

# Shared language registry for the backend.
#
# The frontend sends human-readable names such as "Hindi"; the backend converts
# them to the model-specific IndicTrans codes below before calling translation.
# If a language is added here, check the frontend language list and TTS/ASR
# fallback maps too.

# Canonical language names mapped to IndicTrans language codes.
LANGUAGE_TO_CODE = {
    "English": "eng_Latn",
    "Assamese": "asm_Beng",
    "Bodo": "brx_Deva",
    "Dogri": "doi_Deva",
    "Gujarati": "guj_Gujr",
    "Hindi": "hin_Deva",
    "Kannada": "kan_Knda",
    "Kashmiri": "kas_Arab",
    "Konkani": "gom_Deva",
    "Maithili": "mai_Deva",
    "Malayalam": "mal_Mlym",
    "Bengali": "ben_Beng",
    "Manipuri": "mni_Mtei",
    "Marathi": "mar_Deva",
    "Nepali": "npi_Deva",
    "Odia": "ory_Orya",
    "Punjabi": "pan_Guru",
    "Sanskrit": "san_Deva",
    "Santali": "sat_Olck",
    "Sindhi": "snd_Arab",
    "Tamil": "tam_Taml",
    "Telugu": "tel_Telu",
    "Urdu": "urd_Arab",
}

# Dialect and alternate names that are normalized to canonical names above.
# These aliases let users or API clients pass familiar names while the model
# still receives one supported canonical language.
LANGUAGE_ALIASES = {
    # Hindi cluster dialects.
    "Awadhi": "Hindi",
    "Avadhi": "Hindi",
    "Bhojpuri": "Hindi",
    "Braj": "Hindi",
    "Bundeli": "Hindi",
    "Chhattisgarhi": "Hindi",
    "Garhwali": "Hindi",
    "Haryanvi": "Hindi",
    "Kumaoni": "Hindi",
    "Magahi": "Hindi",
    "Marwari": "Hindi",
    # Bengali cluster dialects.
    "Sylheti": "Bengali",
    "Chittagonian": "Bengali",
    # Urdu variants.
    "Dakhini": "Urdu",
    "Hyderabadi Urdu": "Urdu",
    # Kannada variants.
    "Tulu": "Kannada",
    "Kodava": "Kannada",
    # Common alternate spellings.
    "Bangla": "Bengali",
    "Oriya": "Odia",
    "Meitei": "Manipuri",
}
