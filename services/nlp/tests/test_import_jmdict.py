from __future__ import annotations

import gzip
import sqlite3
from pathlib import Path

from scripts.import_jmdict.import_jmdict import import_jmdict


def test_import_jmdict_reads_gzip_and_filters_languages(tmp_path: Path) -> None:
    source = tmp_path / "JMdict.gz"
    output = tmp_path / "jmdict.sqlite"
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<JMdict>
  <entry>
    <ent_seq>1000010</ent_seq>
    <k_ele><keb>中心</keb><ke_pri>ichi1</ke_pri></k_ele>
    <r_ele><reb>ちゅうしん</reb><re_pri>ichi1</re_pri></r_ele>
    <sense>
      <pos>noun</pos>
      <gloss>center</gloss>
      <gloss xml:lang="ger">Mitte</gloss>
    </sense>
  </entry>
</JMdict>
"""
    source.write_bytes(gzip.compress(xml.encode("utf-8")))

    parsed, inserted = import_jmdict(source, output, limit=None, languages={"eng"})

    assert parsed == 1
    assert inserted > 0
    with sqlite3.connect(output) as conn:
        row = conn.execute(
            "SELECT lemma, reading, meanings_json, primary_meaning, example_sentence FROM entries WHERE surface = ?",
            ("中心",),
        ).fetchone()

    assert row is not None
    assert row[0] == "中心"
    assert row[1] == "ちゅうしん"
    assert row[2] == '["center"]'
    assert row[3] == "center"
    assert row[4] == ""
