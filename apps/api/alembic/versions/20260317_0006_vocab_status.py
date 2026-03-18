"""add vocab status field

Revision ID: 20260317_0006
Revises: 20260317_0005
Create Date: 2026-03-17 14:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260317_0006"
down_revision = "20260317_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vocab_items",
        sa.Column("status", sa.String(length=16), server_default="new", nullable=False),
    )
    op.create_index("ix_vocab_items_status", "vocab_items", ["status"], unique=False)
    op.alter_column("vocab_items", "status", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_vocab_items_status", table_name="vocab_items")
    op.drop_column("vocab_items", "status")
