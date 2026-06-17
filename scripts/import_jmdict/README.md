# import_jmdict

Import JMdict XML into sqlite index consumed by `services/nlp`.

## Usage

```bash
python scripts/import_jmdict/import_jmdict.py \
  --input /path/to/JMdict.gz \
  --output services/nlp/data/jmdict.sqlite
```

For quick local test, use `--limit`:

```bash
python scripts/import_jmdict/import_jmdict.py \
  --input /path/to/JMdict.gz \
  --output services/nlp/data/jmdict.sqlite \
  --limit 5000
```

The importer accepts plain XML or `.gz` input. By default it imports English glosses (`--languages eng`) from
JMdict; pass a comma-separated `--languages` list when importing a dictionary source with other gloss languages.

## Runtime behavior

- Production path: NLP lookup reads `JMDICT_DB_PATH` sqlite index.
- Dev fallback (optional): set `ALLOW_SEED_FALLBACK=true` to use `lookup_seed.json` only when sqlite has no match.
- Default is **no seed fallback**.

## Index schema highlights

The importer stores one row per sense and includes ranking fields:

- `primary_meaning`
- `sense_index`
- `is_common`
- `entry_priority`

Lookup uses these fields for multi-sense sorting and better default meaning selection.
