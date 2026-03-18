# import_frequency

Import word frequency list into normalized csv used by NLP service.

## Usage

```bash
python scripts/import_frequency/import_frequency.py \
  --input /path/to/frequency.csv \
  --output services/nlp/data/frequency_map.csv
```

Output columns:

- `lemma`
- `frequency_band` (`top-1k|top-5k|top-10k|outside-10k`)

Input supports CSV/TSV with common headers:

- lemma: `lemma|word|vocab|surface|term`
- either:
  - `frequency_band|band`
  - or `rank|frequency_rank|freq_rank` (converted to band)
