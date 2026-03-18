# import_jlpt

Import JLPT vocabulary list into normalized csv used by NLP service.

## Usage

```bash
python scripts/import_jlpt/import_jlpt.py \
  --input /path/to/jlpt_words.csv \
  --output services/nlp/data/jlpt_map.csv
```

Output columns:

- `lemma`
- `jlpt_level` (`N1..N5`)

Input supports CSV/TSV with common headers:

- lemma: `lemma|word|vocab|surface|term`
- level: `jlpt_level|level|jlpt|n_level`
