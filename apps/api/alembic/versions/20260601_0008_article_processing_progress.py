"""add article processing progress fields

Revision ID: 20260601_0008
Revises: 20260318_0007
Create Date: 2026-06-01 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260601_0008"
down_revision = "20260318_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("processed_block_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("articles", sa.Column("total_block_count", sa.Integer(), nullable=True))
    op.alter_column("articles", "processed_block_count", server_default=None)


def downgrade() -> None:
    op.drop_column("articles", "total_block_count")
    op.drop_column("articles", "processed_block_count")
