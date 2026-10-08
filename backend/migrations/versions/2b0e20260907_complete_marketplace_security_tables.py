"""complete marketplace, notification and security tables

Revision ID: 2b0e20260907
Revises: 14df9aca1f3b
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '2b0e20260907'
down_revision = '14df9aca1f3b'
branch_labels = None
depends_on = None


def _has_table(name):
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'critical_products' not in {c['name'] for c in inspector.get_columns('job_logs')}:
        op.add_column('job_logs', sa.Column('critical_products', sa.Integer(), nullable=True, server_default='0'))

    if not _has_table('surplus_listings'):
        op.create_table(
            'surplus_listings',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('inventory_item_id', sa.String(36), sa.ForeignKey('inventory_items.id', ondelete='SET NULL'), nullable=True),
            sa.Column('product_name', sa.String(255), nullable=False),
            sa.Column('category', postgresql.ENUM('FRUITS','VEGETABLES','DAIRY','BAKERY','BEVERAGES','FROZEN_FOODS','GRAINS','MEAT','SEAFOOD','READY_TO_EAT','OTHERS', name='inventorycategory', create_type=False), nullable=False),
            sa.Column('listing_type', sa.String(50), nullable=False),
            sa.Column('quantity_available', sa.Float(), nullable=False, server_default='0'),
            sa.Column('unit', sa.String(50), nullable=False, server_default='units'),
            sa.Column('price_per_unit', sa.Float(), nullable=False, server_default='0'),
            sa.Column('expiry_date', sa.Date(), nullable=False),
            sa.Column('pickup_location', sa.String(500), nullable=False),
            sa.Column('availability_window', sa.String(255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('payment_required', sa.Boolean(), nullable=True, server_default=sa.false()),
            sa.Column('status', sa.String(50), nullable=False, server_default='AVAILABLE'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_surplus_listings_user_id', 'surplus_listings', ['user_id'])
        op.create_index('ix_surplus_listings_inventory_item_id', 'surplus_listings', ['inventory_item_id'])
        op.create_index('ix_surplus_listings_product_name', 'surplus_listings', ['product_name'])
        op.create_index('ix_surplus_listings_expiry_date', 'surplus_listings', ['expiry_date'])

    if not _has_table('marketplace_orders'):
        op.create_table(
            'marketplace_orders',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('listing_id', sa.String(36), sa.ForeignKey('surplus_listings.id', ondelete='CASCADE'), nullable=False),
            sa.Column('recipient_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('business_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('quantity', sa.Float(), nullable=False),
            sa.Column('unit_price', sa.Float(), nullable=False),
            sa.Column('subtotal', sa.Float(), nullable=False),
            sa.Column('platform_fee', sa.Float(), nullable=False, server_default='0'),
            sa.Column('total_amount', sa.Float(), nullable=False),
            sa.Column('payment_required', sa.Boolean(), nullable=True, server_default=sa.false()),
            sa.Column('payment_id', sa.String(100), nullable=True),
            sa.Column('payment_status', sa.String(50), nullable=False, server_default='PENDING'),
            sa.Column('order_status', sa.String(50), nullable=False, server_default='PENDING'),
            sa.Column('payment_method', sa.String(50), nullable=True),
            sa.Column('refund_status', sa.String(50), nullable=True),
            sa.Column('pickup_date', sa.DateTime(), nullable=True),
            sa.Column('pickup_location', sa.String(500), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('payment_id'),
        )
        op.create_index('ix_marketplace_orders_listing_id', 'marketplace_orders', ['listing_id'])
        op.create_index('ix_marketplace_orders_recipient_id', 'marketplace_orders', ['recipient_id'])
        op.create_index('ix_marketplace_orders_business_id', 'marketplace_orders', ['business_id'])
        op.create_index('ix_marketplace_orders_payment_id', 'marketplace_orders', ['payment_id'])

    if not _has_table('ngo_requirements'):
        op.create_table(
            'ngo_requirements',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('category', postgresql.ENUM('FRUITS','VEGETABLES','DAIRY','BAKERY','BEVERAGES','FROZEN_FOODS','GRAINS','MEAT','SEAFOOD','READY_TO_EAT','OTHERS', name='inventorycategory', create_type=False), nullable=False),
            sa.Column('quantity', sa.Float(), nullable=False),
            sa.Column('unit', sa.String(50), nullable=False, server_default='units'),
            sa.Column('urgency', sa.String(50), nullable=False, server_default='LOW'),
            sa.Column('location', sa.String(500), nullable=False),
            sa.Column('dietary_requirement', sa.String(255), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_ngo_requirements_user_id', 'ngo_requirements', ['user_id'])

    if not _has_table('notifications'):
        op.create_table(
            'notifications',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('title', sa.String(255), nullable=False),
            sa.Column('message', sa.Text(), nullable=False),
            sa.Column('is_read', sa.Boolean(), nullable=True, server_default=sa.false()),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])

    if not _has_table('revoked_tokens'):
        op.create_table(
            'revoked_tokens',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('jti', sa.String(64), nullable=False),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
            sa.Column('token_type', sa.String(20), nullable=False, server_default='access'),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.UniqueConstraint('jti'),
        )
        op.create_index('ix_revoked_tokens_jti', 'revoked_tokens', ['jti'])
        op.create_index('ix_revoked_tokens_user_id', 'revoked_tokens', ['user_id'])
        op.create_index('ix_revoked_tokens_expires_at', 'revoked_tokens', ['expires_at'])


def downgrade():
    for table in ['revoked_tokens', 'notifications', 'ngo_requirements', 'marketplace_orders', 'surplus_listings']:
        if _has_table(table):
            op.drop_table(table)
    bind = op.get_bind()
    if 'critical_products' in {c['name'] for c in sa.inspect(bind).get_columns('job_logs')}:
        op.drop_column('job_logs', 'critical_products')
