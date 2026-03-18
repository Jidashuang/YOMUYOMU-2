"""add ai explanation error_type

Revision ID: 20260316_0003
Revises: 20260316_0002
Create Date: 2026-03-16 22:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260316_0003"
down_revision = "20260316_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_explanations", sa.Column("error_type", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_explanations", "error_type")
