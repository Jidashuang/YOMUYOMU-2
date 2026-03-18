"""add ai provider metrics fields

Revision ID: 20260317_0005
Revises: 20260316_0004
Create Date: 2026-03-17 10:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260317_0005"
down_revision = "20260316_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_explanations", sa.Column("provider_latency_ms", sa.Float(), nullable=True))
    op.add_column("ai_explanations", sa.Column("prompt_tokens", sa.Integer(), nullable=True))
    op.add_column("ai_explanations", sa.Column("completion_tokens", sa.Integer(), nullable=True))
    op.add_column("ai_explanations", sa.Column("total_tokens", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_explanations", "total_tokens")
    op.drop_column("ai_explanations", "completion_tokens")
    op.drop_column("ai_explanations", "prompt_tokens")
    op.drop_column("ai_explanations", "provider_latency_ms")
