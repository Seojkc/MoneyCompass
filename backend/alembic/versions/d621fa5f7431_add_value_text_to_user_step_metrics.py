"""add value_text to user_step_metrics

Revision ID: d621fa5f7431
Revises: 8e6f00314707
Create Date: 2026-03-05 01:49:40.345061

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd621fa5f7431'
down_revision: Union[str, Sequence[str], None] = '8e6f00314707'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
