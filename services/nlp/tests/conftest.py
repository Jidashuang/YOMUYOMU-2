from __future__ import annotations

import os
import sys
from pathlib import Path

NLP_ROOT = Path(__file__).resolve().parents[1]
if str(NLP_ROOT) not in sys.path:
    sys.path.insert(0, str(NLP_ROOT))

os.environ.setdefault("ALLOW_SEED_FALLBACK", "false")
