"""add user plan field

Revision ID: 20260323_0008
Revises: 20260318_0007
Create Date: 2026-03-23 17:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260323_0008"
down_revision = "20260318_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("plan", sa.String(length=16), nullable=False, server_default="free"))
    op.create_index(op.f("ix_users_plan"), "users", ["plan"], unique=False)
    op.alter_column("users", "plan", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_plan"), table_name="users")
    op.drop_column("users", "plan")
