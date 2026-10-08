"""add business_type compatibility column

Revision ID: 14df9aca1f3b
Revises: 93084534d580
"""
from alembic import op
import sqlalchemy as sa

revision = '14df9aca1f3b'
down_revision = '93084534d580'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {c['name'] for c in sa.inspect(bind).get_columns('users')}
    if 'business_type' not in columns:
        op.add_column('users', sa.Column('business_type', sa.String(length=100), nullable=True, server_default='Other'))
    else:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.alter_column(
                'business_type',
                existing_type=sa.Text(),
                type_=sa.String(length=100),
                existing_nullable=True,
                existing_server_default=sa.text("'Other'"),
            )


def downgrade():
    bind = op.get_bind()
    columns = {c['name'] for c in sa.inspect(bind).get_columns('users')}
    if 'business_type' in columns:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.drop_column('business_type')
