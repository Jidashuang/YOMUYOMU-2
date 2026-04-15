"""add user stripe billing fields

Revision ID: 20260324_0009
Revises: 20260323_0008
Create Date: 2026-03-24 14:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260324_0009"
down_revision = "20260323_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("stripe_subscription_id", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("billing_status", sa.String(length=32), nullable=True))
    op.create_index(op.f("ix_users_stripe_customer_id"), "users", ["stripe_customer_id"], unique=False)
    op.create_index(op.f("ix_users_stripe_subscription_id"), "users", ["stripe_subscription_id"], unique=False)
    op.create_index(op.f("ix_users_billing_status"), "users", ["billing_status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_billing_status"), table_name="users")
    op.drop_index(op.f("ix_users_stripe_subscription_id"), table_name="users")
    op.drop_index(op.f("ix_users_stripe_customer_id"), table_name="users")
    op.drop_column("users", "billing_status")
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
