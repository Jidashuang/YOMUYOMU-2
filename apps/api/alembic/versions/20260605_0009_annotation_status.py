"""split annotation status from article status

Revision ID: 20260605_0009
Revises: 20260601_0008
Create Date: 2026-06-05 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260605_0009"
down_revision = "20260601_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("annotation_status", sa.String(16), nullable=False, server_default="pending"),
    )
    op.add_column("articles", sa.Column("annotation_error", sa.Text(), nullable=True))
    op.add_column(
        "articles",
        sa.Column("annotation_retry_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("articles", sa.Column("annotation_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_articles_annotation_status", "articles", ["annotation_status"])
    op.alter_column("articles", "annotation_status", server_default=None)
    op.alter_column("articles", "annotation_retry_count", server_default=None)

    # Backfill existing rows so the startup recovery scan does not re-annotate the whole
    # library. Readable text with no recorded error → annotation already succeeded; readable
    # text that carried a (previously overloaded) processing_error → degraded/partial.
    op.execute("UPDATE articles SET annotation_status='ready' WHERE status='ready' AND processing_error IS NULL")
    op.execute("UPDATE articles SET annotation_status='partial' WHERE status='ready' AND processing_error IS NOT NULL")
    op.execute("UPDATE articles SET annotation_status='failed' WHERE status='failed'")


def downgrade() -> None:
    op.drop_index("ix_articles_annotation_status", table_name="articles")
    op.drop_column("articles", "annotation_updated_at")
    op.drop_column("articles", "annotation_retry_count")
    op.drop_column("articles", "annotation_error")
    op.drop_column("articles", "annotation_status")
