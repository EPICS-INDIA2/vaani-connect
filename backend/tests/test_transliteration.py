"""Tests for romanized input detection and transliteration normalization."""

import unittest
from unittest.mock import patch

from app import transliteration


class TransliterationTests(unittest.TestCase):
    def test_detects_native_script_input(self) -> None:
        self.assertFalse(transliteration.is_probably_romanized("मेरा नाम राहुल है", "Hindi"))

    def test_detects_romanized_input(self) -> None:
        self.assertTrue(transliteration.is_probably_romanized("mera naam rahul hai", "Hindi"))

    def test_english_is_not_treated_as_romanized_indic(self) -> None:
        self.assertFalse(transliteration.transliteration_supported("English"))
        normalized = transliteration.normalize_text_for_translation("hello there", "English")
        self.assertEqual(normalized.normalized_text, "hello there")
        self.assertFalse(normalized.transliteration_applied)

    def test_normalization_transliterates_supported_language(self) -> None:
        with patch.object(
            transliteration,
            "transliterate_to_native",
            return_value="मेरा नाम राहुल है",
        ) as mock_transliterate:
            normalized = transliteration.normalize_text_for_translation("mera naam rahul hai", "Hindi")

        self.assertEqual(normalized.normalized_text, "मेरा नाम राहुल है")
        self.assertTrue(normalized.transliteration_applied)
        mock_transliterate.assert_called_once_with("mera naam rahul hai", "Hindi")

    def test_normalization_skips_when_language_not_supported(self) -> None:
        normalized = transliteration.normalize_text_for_translation("adaab", "Urdu")
        self.assertEqual(normalized.normalized_text, "adaab")
        self.assertTrue(normalized.is_romanized)
        self.assertFalse(normalized.transliteration_supported)
        self.assertFalse(normalized.transliteration_applied)


if __name__ == "__main__":
    unittest.main()
