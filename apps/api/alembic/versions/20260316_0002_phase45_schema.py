"""phase 4.5 schema updates

Revision ID: 20260316_0002
Revises: 20260316_0001
Create Date: 2026-03-16 00:45:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260316_0002"
down_revision = "20260316_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("status", sa.String(length=32), server_default="processing", nullable=False),
    )
    op.add_column("articles", sa.Column("processing_error", sa.Text(), nullable=True))
    op.create_index("ix_articles_status", "articles", ["status"], unique=False)
    op.execute("UPDATE articles SET status = 'ready' WHERE status = 'processing'")
    op.alter_column("articles", "status", server_default=None)

    op.add_column("highlights", sa.Column("block_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("highlights", sa.Column("start_offset_in_block", sa.Integer(), nullable=True))
    op.add_column("highlights", sa.Column("end_offset_in_block", sa.Integer(), nullable=True))
    op.add_column("highlights", sa.Column("text_quote", sa.Text(), nullable=True))

    op.create_foreign_key(
        "fk_highlights_block_id_article_blocks",
        "highlights",
        "article_blocks",
        ["block_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_highlights_block_id", "highlights", ["block_id"], unique=False)

    op.execute(
        """
        UPDATE highlights AS h
        SET
          block_id = b.block_id,
          start_offset_in_block = COALESCE(h.start_offset, 0),
          end_offset_in_block = COALESCE(h.end_offset, 0),
          text_quote = COALESCE(h.text, '')
        FROM (
          SELECT article_id, MIN(id) AS block_id
          FROM article_blocks
          GROUP BY article_id
        ) AS b
        WHERE h.article_id = b.article_id
        """
    )

    op.drop_column("highlights", "start_offset")
    op.drop_column("highlights", "end_offset")
    op.drop_column("highlights", "text")

    op.add_column(
        "ai_explanations",
        sa.Column("from_cache", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "ai_explanations",
        sa.Column("prompt_version", sa.String(length=32), server_default="v1", nullable=False),
    )
    op.add_column(
        "ai_explanations",
        sa.Column("provider", sa.String(length=64), server_default="mock", nullable=False),
    )
    op.alter_column("ai_explanations", "from_cache", server_default=None)
    op.alter_column("ai_explanations", "prompt_version", server_default=None)
    op.alter_column("ai_explanations", "provider", server_default=None)


def downgrade() -> None:
    op.drop_column("ai_explanations", "provider")
    op.drop_column("ai_explanations", "prompt_version")
    op.drop_column("ai_explanations", "from_cache")

    op.add_column("highlights", sa.Column("text", sa.Text(), nullable=False, server_default=""))
    op.add_column("highlights", sa.Column("end_offset", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("highlights", sa.Column("start_offset", sa.Integer(), nullable=False, server_default="0"))

    op.execute(
        """
        UPDATE highlights
        SET
          start_offset = COALESCE(start_offset_in_block, 0),
          end_offset = COALESCE(end_offset_in_block, 0),
          text = COALESCE(text_quote, '')
        """
    )

    op.drop_index("ix_highlights_block_id", table_name="highlights")
    op.drop_constraint("fk_highlights_block_id_article_blocks", "highlights", type_="foreignkey")
    op.drop_column("highlights", "text_quote")
    op.drop_column("highlights", "end_offset_in_block")
    op.drop_column("highlights", "start_offset_in_block")
    op.drop_column("highlights", "block_id")

    op.drop_index("ix_articles_status", table_name="articles")
    op.drop_column("articles", "processing_error")
    op.drop_column("articles", "status")
