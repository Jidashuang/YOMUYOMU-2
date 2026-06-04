from __future__ import annotations

try:
    from sudachipy import dictionary, tokenizer as sudachi_tokenizer
except Exception:  # noqa: BLE001
    dictionary = None
    sudachi_tokenizer = None

from app.difficulty import resolve_difficulty
from app.schemas import AnnotatedToken, TokenInfo


class TokenizerService:
    def __init__(self, jlpt_map: dict[str, str], frequency_map: dict[str, str]):
        if dictionary is None or sudachi_tokenizer is None:
            raise RuntimeError("Sudachi tokenizer is unavailable")
        self.tokenizer = dictionary.Dictionary().create()
        self.mode = sudachi_tokenizer.Tokenizer.SplitMode.C
        self.jlpt_map = jlpt_map
        self.frequency_map = frequency_map

    def tokenize(self, text: str) -> list[TokenInfo]:
        morphemes = self.tokenizer.tokenize(text, self.mode)
        tokens: list[TokenInfo] = []
        for morph in morphemes:
            pos_major = morph.part_of_speech()[0]
            jlpt_level, frequency_band, _ = resolve_difficulty(
                morph.dictionary_form(),
                pos_major,
                self.jlpt_map,
                self.frequency_map,
            )
            tokens.append(
                TokenInfo(
                    surface=morph.surface(),
                    lemma=morph.dictionary_form(),
                    reading=morph.reading_form(),
                    pos=pos_major,
                    start=morph.begin(),
                    end=morph.end(),
                    jlpt_level=jlpt_level,
                    frequency_band=frequency_band,
                )
            )
        return tokens

    def annotate(self, text: str) -> list[AnnotatedToken]:
        morphemes = self.tokenizer.tokenize(text, self.mode)
        tokens: list[AnnotatedToken] = []
        for morph in morphemes:
            pos_major = morph.part_of_speech()[0]
            jlpt_level, frequency_band, source = resolve_difficulty(
                morph.dictionary_form(),
                pos_major,
                self.jlpt_map,
                self.frequency_map,
            )
            tokens.append(
                AnnotatedToken(
                    surface=morph.surface(),
                    lemma=morph.dictionary_form(),
                    reading=morph.reading_form(),
                    pos=pos_major,
                    start=morph.begin(),
                    end=morph.end(),
                    jlpt_level=jlpt_level,
                    frequency_band=frequency_band,
                    difficulty_source=source,
                )
            )
        return tokens
