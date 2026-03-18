"""add vocab review scheduling fields

Revision ID: 20260318_0007
Revises: 20260317_0006
Create Date: 2026-03-18 13:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260318_0007"
down_revision = "20260317_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vocab_items",
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "vocab_items",
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_vocab_items_next_review_at", "vocab_items", ["next_review_at"], unique=False)
    bind = op.get_bind()
    now_expr = "CURRENT_TIMESTAMP" if bind.dialect.name == "sqlite" else "NOW()"
    op.execute(
        sa.text(
            f"""
            UPDATE vocab_items
            SET next_review_at = {now_expr}
            WHERE status IN ('new', 'learning') AND next_review_at IS NULL
            """
        )
    )
    op.alter_column("vocab_items", "review_count", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_vocab_items_next_review_at", table_name="vocab_items")
    op.drop_column("vocab_items", "review_count")
    op.drop_column("vocab_items", "next_review_at")
