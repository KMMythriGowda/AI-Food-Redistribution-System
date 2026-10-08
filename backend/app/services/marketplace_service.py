import os
import math
from datetime import datetime, date
from app.extensions import db
from app.models.user import User
from app.models.enums import InventoryCategory
from app.models.inventory import InventoryItem
from app.models.marketplace import SurplusListing, MarketplaceOrder
from app.models.ngo_requirement import NgoRequirement
from app.models.notification import Notification
from app.utils.geocoding import geocode_address
from app.services.payment_service import PaymentService

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    try:
        R = 6371.0  # Radius of Earth in km
        dlat = math.radians(float(lat2) - float(lat1))
        dlon = math.radians(float(lon2) - float(lon1))
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)
    except Exception:
        return None

class MarketplaceService:
    @staticmethod
    def create_listing(business_id: str, data: dict):
        """
        Creates a new marketplace listing from business inventory or manually.
        """
        try:
            inventory_item_id = data.get('inventory_item_id')
            product_name = data.get('product_name')
            category_str = data.get('category', 'Others')
            
            # Map category string to Enum
            try:
                category = InventoryCategory(category_str)
            except ValueError:
                category = InventoryCategory.OTHERS

            listing_type = data.get('listing_type', 'DONATION')
            quantity_available = float(data.get('quantity_available', 0))
            unit = data.get('unit', 'units')
            price_per_unit = float(data.get('price_per_unit', 0.0))
            
            expiry_date_str = data.get('expiry_date')
            if isinstance(expiry_date_str, str):
                expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d').date()
            else:
                expiry_date = expiry_date_str

            pickup_location = data.get('pickup_location')
            availability_window = data.get('availability_window')
            description = data.get('description', '')

            # Enforce price and payment requirements based on listing type
            if listing_type == 'DONATION':
                price_per_unit = 0.0
                payment_required = False
            else:
                payment_required = True
                if price_per_unit <= 0.0:
                    return None, "Paid surplus must have a price greater than 0."

            # Verify inventory item quantity if provided
            if inventory_item_id:
                inv_item = InventoryItem.query.filter_by(id=inventory_item_id, user_id=business_id).first()
                if not inv_item:
                    return None, "Inventory item not found."
                if inv_item.quantity < quantity_available:
                    return None, f"Insufficient inventory quantity. Available: {inv_item.quantity} {inv_item.unit}"

            listing = SurplusListing(
                user_id=business_id,
                inventory_item_id=inventory_item_id,
                product_name=product_name,
                category=category,
                listing_type=listing_type,
                quantity_available=quantity_available,
                unit=unit,
                price_per_unit=price_per_unit,
                expiry_date=expiry_date,
                pickup_location=pickup_location,
                availability_window=availability_window,
                description=description,
                payment_required=payment_required,
                status='AVAILABLE'
            )

            db.session.add(listing)
            db.session.commit()
            return listing.to_dict(), None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def list_listings(recipient_id: str = None, params: dict = None):
        """
        Lists all available surplus listings with optional NGO location distance calculation.
        """
        from datetime import timedelta
        try:
            params = params or {}
            query = SurplusListing.query.filter(
                SurplusListing.status == 'AVAILABLE',
                SurplusListing.expiry_date >= date.today(),
                SurplusListing.quantity_available > 0
            )

            # Apply filters
            if params.get('search'):
                query = query.filter(SurplusListing.product_name.ilike(f"%{params['search']}%"))
            if params.get('category'):
                try:
                    cat_enum = InventoryCategory(params['category'])
                    query = query.filter(SurplusListing.category == cat_enum)
                except ValueError:
                    pass
            if params.get('listing_type'):
                query = query.filter(SurplusListing.listing_type == params['listing_type'])
            if params.get('expiry_days'):
                try:
                    exp_days = int(params['expiry_days'])
                    max_expiry = date.today() + timedelta(days=exp_days)
                    query = query.filter(SurplusListing.expiry_date <= max_expiry)
                except ValueError:
                    pass

            listings = query.order_by(SurplusListing.created_at.desc()).all()

            # Retrieve recipient user to calculate distance
            recipient = User.query.get(recipient_id) if recipient_id else None

            # Retrieve NGO requirements for smart matching. If the NGO has never stored
            # coordinates, use the requirement location to populate them when possible.
            requirements = NgoRequirement.query.filter_by(user_id=recipient_id).all() if recipient_id else []
            if recipient and (recipient.latitude is None or recipient.longitude is None):
                location_hint = next((r.location for r in requirements if r.location), recipient.address)
                lat_guess, lon_guess = geocode_address(location_hint)
                if lat_guess is not None and lon_guess is not None:
                    recipient.latitude, recipient.longitude = lat_guess, lon_guess
                    db.session.commit()

            lat1 = recipient.latitude if recipient else None
            lon1 = recipient.longitude if recipient else None

            # Handle distance filtering threshold
            max_dist = None
            if params.get('max_distance'):
                try:
                    max_dist = float(params['max_distance'])
                except ValueError:
                    pass

            result = []
            for item in listings:
                # Include donor public details
                donor = item.user
                if donor and (donor.latitude is None or donor.longitude is None) and donor.address:
                    donor_lat, donor_lon = geocode_address(donor.address)
                    if donor_lat is not None and donor_lon is not None:
                        donor.latitude, donor.longitude = donor_lat, donor_lon
                        db.session.commit()

                # Distance calculation
                distance = calculate_haversine_distance(lat1, lon1, donor.latitude, donor.longitude)
                if max_dist is not None and (distance is None or distance > max_dist):
                    continue

                item_dict = item.to_dict()
                item_dict['donor_name'] = donor.organization_name or donor.full_name
                item_dict['donor_type'] = donor.business_type or "Other"
                item_dict['donor_verified'] = donor.is_verified
                item_dict['distance_km'] = distance

                # Completed donations count for this donor
                donation_count = MarketplaceOrder.query.filter_by(
                    business_id=donor.id,
                    payment_status='NOT_REQUIRED',
                    order_status='COMPLETED'
                ).count()
                item_dict['donor_completed_donations'] = donation_count

                # Calculate smart match score
                best_score = None
                best_reasons = []
                if requirements:
                    for req in requirements:
                        score, reasons = MarketplaceService._score_match(item, req, donor, recipient, distance)
                        if best_score is None or score > best_score:
                            best_score = score
                            best_reasons = reasons
                
                item_dict['smart_match_score'] = best_score
                item_dict['smart_match_reasons'] = best_reasons

                result.append(item_dict)

            # If user requested only matching recommendations, sort by score descending
            if params.get('matching_only') == 'true':
                result = [r for r in result if r['smart_match_score'] is not None and r['smart_match_score'] >= 40]
                result.sort(key=lambda x: x['smart_match_score'], reverse=True)

            return result, None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def get_business_listings(business_id: str):
        """
        Fetches listings created by a business.
        """
        try:
            listings = SurplusListing.query.filter_by(user_id=business_id).order_by(SurplusListing.created_at.desc()).all()
            return [l.to_dict() for l in listings], None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def initiate_checkout(recipient_id: str, data: dict):
        """
        Strictly initiates checkout by validating quantity, expiry, price, and calculating totals on the backend.
        Creates a PENDING order.
        """
        try:
            listing_id = data.get('listing_id')
            quantity = float(data.get('quantity', 0))

            if quantity <= 0:
                return None, "Quantity must be greater than zero."

            # Lock the listing row to prevent simultaneous modifications
            listing = SurplusListing.query.with_for_update().filter_by(id=listing_id).first()
            if not listing:
                return None, "Surplus listing not found."

            if listing.status != 'AVAILABLE':
                return None, "Listing is no longer available."

            if listing.expiry_date < date.today():
                return None, "Listing has expired."

            if listing.quantity_available < quantity:
                return None, f"Insufficient quantity available. Remaining: {listing.quantity_available} {listing.unit}"

            # Calculate amount on the backend using database prices (Idempotent to frontend values)
            unit_price = listing.price_per_unit
            subtotal = round(quantity * unit_price, 2)
            platform_fee = 0.0  # Platform fee defaults to 0.0 but matches e-commerce patterns
            total_amount = round(subtotal + platform_fee, 2)

            payment_required = listing.payment_required
            
            # Construct order
            order = MarketplaceOrder(
                listing_id=listing.id,
                recipient_id=recipient_id,
                business_id=listing.user_id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=subtotal,
                platform_fee=platform_fee,
                total_amount=total_amount,
                payment_required=payment_required,
                payment_status='NOT_REQUIRED' if not payment_required else 'PENDING',
                order_status='PENDING',
                pickup_location=listing.pickup_location
            )

            db.session.add(order)
            db.session.flush() # Populate order ID

            payment_info = None
            if payment_required:
                # Call Payment service to create transaction
                payment_details = PaymentService.create_payment(order.id, total_amount)
                order.payment_id = payment_details['payment_id']
                order.payment_status = 'PAYMENT_INITIATED'
                order.payment_method = 'SANDBOX'
                payment_info = payment_details

            db.session.commit()
            
            response_data = order.to_dict()
            if payment_info:
                response_data['payment_details'] = payment_info
            
            return response_data, None

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def verify_payment(recipient_id: str, order_id: str, success: bool = True):
        """
        Idempotent payment verification. Syncs listing and inventory quantities on success,
        or processes immediate refunds on race conditions.
        """
        try:
            # Query order and apply lock
            order = MarketplaceOrder.query.with_for_update().filter_by(id=order_id, recipient_id=recipient_id).first()
            if not order:
                return None, "Order not found."

            # Idempotency check: Already processed
            if order.order_status == 'ORDER_CONFIRMED' or order.payment_status == 'PAYMENT_SUCCESS':
                return order.to_dict(), None

            if order.payment_status == 'PAYMENT_FAILED' or order.order_status == 'CANCELLED':
                return None, "This transaction has already failed or been cancelled."

            # Verify transaction using Payment service
            payment_res = PaymentService.verify_payment(order.payment_id, success)
            
            if payment_res['status'] == 'PAYMENT_SUCCESS':
                # Revalidate inventory listing availability *before* completing order
                listing = SurplusListing.query.with_for_update().filter_by(id=order.listing_id).first()
                
                if not listing or listing.status != 'AVAILABLE' or listing.expiry_date < date.today() or listing.quantity_available < order.quantity:
                    # Race condition hit (quantity sold out while user was in checkout payment gateway)
                    # Trigger automatic refund
                    if order.payment_required:
                        refund_res = PaymentService.process_refund(order.payment_id)
                        order.payment_status = 'REFUNDED'
                        order.refund_status = 'REFUNDED'
                    order.order_status = 'CANCELLED'
                    db.session.commit()
                    return None, "Inventory locked or quantity no longer available. Payment refunded."

                # Success path: Permanent inventory deduction
                listing.quantity_available -= order.quantity
                if listing.quantity_available <= 0:
                    listing.status = 'CLAIMED'

                # Sync with original InventoryItem if linked
                if listing.inventory_item_id:
                    inv_item = InventoryItem.query.filter_by(id=listing.inventory_item_id).first()
                    if inv_item:
                        inv_item.quantity = max(0.0, inv_item.quantity - order.quantity)
                        if inv_item.quantity <= 0:
                            inv_item.status = 'Donated'

                if order.payment_required:
                    order.payment_status = 'PAYMENT_SUCCESS'
                else:
                    order.payment_status = 'NOT_REQUIRED'
                order.order_status = 'ORDER_CONFIRMED'

                # In-app notifications triggers
                ngo = order.recipient
                ngo_name = (ngo.organization_name or ngo.full_name) if ngo else "NGO"
                if order.payment_required:
                    MarketplaceService.send_in_app_notification(
                        order.business_id, 
                        "Surplus Purchased", 
                        f"{ngo_name} purchased {order.quantity} {listing.unit} of '{listing.product_name}' for ₹{order.total_amount}."
                    )
                    MarketplaceService.send_in_app_notification(
                        order.business_id, 
                        "Payment Successful", 
                        f"Payment of ₹{order.total_amount} received for order '{order.id[:8]}'."
                    )
                    MarketplaceService.send_in_app_notification(
                        order.recipient_id, 
                        "Order Confirmed", 
                        f"Your purchase of {order.quantity} {listing.unit} of '{listing.product_name}' is confirmed."
                    )
                    MarketplaceService.send_in_app_notification(
                        order.recipient_id, 
                        "Payment Confirmed", 
                        f"Payment of ₹{order.total_amount} was successfully verified."
                    )
                else:
                    MarketplaceService.send_in_app_notification(
                        order.business_id, 
                        "New Donation Claimed", 
                        f"{ngo_name} claimed {order.quantity} {listing.unit} of '{listing.product_name}'."
                    )
                    MarketplaceService.send_in_app_notification(
                        order.recipient_id, 
                        "Claim Confirmed", 
                        f"Your claim for {order.quantity} {listing.unit} of '{listing.product_name}' is confirmed."
                    )

                db.session.commit()
                return order.to_dict(), None
            else:
                # Failure path: Update status, do NOT reduce inventory
                order.payment_status = 'PAYMENT_FAILED'
                order.order_status = 'PENDING' # Order stays unconfirmed
                
                # In-app notification for NGO
                MarketplaceService.send_in_app_notification(
                    order.recipient_id, 
                    "Payment Failed", 
                    f"Payment for your order of '{order.listing.product_name}' failed."
                )

                db.session.commit()
                return None, "Payment failed. Order not confirmed."

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_my_orders(recipient_id: str):
        """
        Lists claim/order history for an NGO user.
        """
        try:
            orders = MarketplaceOrder.query.filter_by(recipient_id=recipient_id).order_by(MarketplaceOrder.created_at.desc()).all()
            result = []
            for order in orders:
                ord_dict = order.to_dict()
                listing = order.listing
                ord_dict['product_name'] = listing.product_name
                ord_dict['unit'] = listing.unit
                donor = order.business
                ord_dict['donor_name'] = donor.organization_name or donor.full_name
                result.append(ord_dict)
            return result, None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def schedule_pickup(user_id: str, order_id: str, pickup_date_str: str):
        """
        Schedules a pickup window for a confirmed order.
        """
        try:
            order = MarketplaceOrder.query.filter(
                MarketplaceOrder.id == order_id,
                (MarketplaceOrder.recipient_id == user_id) | (MarketplaceOrder.business_id == user_id)
            ).first()
            if not order:
                return None, "Order not found."
            if order.order_status != 'ORDER_CONFIRMED':
                return None, "Only confirmed orders can be scheduled for pickup."

            order.pickup_date = datetime.fromisoformat(pickup_date_str.replace('Z', ''))
            order.order_status = 'PICKUP_SCHEDULED'

            # Notifications
            listing = order.listing
            ngo = order.recipient
            ngo_name = (ngo.organization_name or ngo.full_name) if ngo else "NGO"
            formatted_date = order.pickup_date.strftime('%Y-%m-%d %H:%M')
            MarketplaceService.send_in_app_notification(
                order.business_id, 
                "Pickup Scheduled", 
                f"{ngo_name} scheduled a pickup for '{listing.product_name}' on {formatted_date}."
            )
            MarketplaceService.send_in_app_notification(
                order.recipient_id, 
                "Pickup Scheduled", 
                f"Your pickup for '{listing.product_name}' has been scheduled on {formatted_date}."
            )

            db.session.commit()
            return order.to_dict(), None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def complete_pickup(user_id: str, order_id: str):
        """
        Completes the pickup process, marking the order as COMPLETED.
        """
        try:
            order = MarketplaceOrder.query.filter(
                MarketplaceOrder.id == order_id,
                (MarketplaceOrder.recipient_id == user_id) | (MarketplaceOrder.business_id == user_id)
            ).first()
            if not order:
                return None, "Order not found."
            if order.order_status not in ['ORDER_CONFIRMED', 'PICKUP_SCHEDULED']:
                return None, "Order cannot be completed in its current state."

            order.order_status = 'COMPLETED'

            # Notifications
            listing = order.listing
            MarketplaceService.send_in_app_notification(
                order.business_id, 
                "Pickup Completed", 
                f"The pickup for your listing '{listing.product_name}' (Quantity: {order.quantity} {listing.unit}) has been marked as completed."
            )
            MarketplaceService.send_in_app_notification(
                order.recipient_id, 
                "Order Completed", 
                f"Your claim for '{listing.product_name}' has been successfully completed. Thank you for rescuing food!"
            )

            db.session.commit()
            return order.to_dict(), None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def cancel_order(user_id: str, order_id: str):
        """
        Cancels an order and refunds it if payment succeeded.
        """
        try:
            order = MarketplaceOrder.query.with_for_update().filter(
                MarketplaceOrder.id == order_id,
                (MarketplaceOrder.recipient_id == user_id) | (MarketplaceOrder.business_id == user_id)
            ).first()
            if not order:
                return None, "Order not found."
            
            if order.order_status in ['COMPLETED', 'CANCELLED']:
                return None, "Completed or cancelled orders cannot be cancelled."

            # Process refund if payment succeeded
            if order.payment_status == 'PAYMENT_SUCCESS':
                refund_res = PaymentService.process_refund(order.payment_id)
                order.payment_status = 'REFUNDED'
                order.refund_status = 'REFUNDED'
            elif order.payment_status == 'PAYMENT_INITIATED':
                order.payment_status = 'PAYMENT_FAILED'

            # Revert inventory if order was confirmed
            if order.order_status in ['ORDER_CONFIRMED', 'PICKUP_SCHEDULED']:
                listing = SurplusListing.query.with_for_update().filter_by(id=order.listing_id).first()
                if listing:
                    listing.quantity_available += order.quantity
                    if listing.status == 'CLAIMED' and listing.quantity_available > 0:
                        listing.status = 'AVAILABLE'
                    
                    if listing.inventory_item_id:
                        inv_item = InventoryItem.query.filter_by(id=listing.inventory_item_id).first()
                        if inv_item:
                            inv_item.quantity += order.quantity

            order.order_status = 'CANCELLED'

            # Notifications
            listing = order.listing
            MarketplaceService.send_in_app_notification(
                order.business_id, 
                "Order Cancelled", 
                f"The order for your listing '{listing.product_name}' has been cancelled."
            )
            MarketplaceService.send_in_app_notification(
                order.recipient_id, 
                "Order Cancelled", 
                f"Your order for '{listing.product_name}' has been successfully cancelled and refunded if applicable."
            )

            db.session.commit()
            return order.to_dict(), None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_donor_profile(business_id: str):
        """
        Compiles public business profile, dynamic metrics, trust indicators, and contribution history.
        """
        try:
            business = User.query.get(business_id)
            if not business or business.role.value != 'BUSINESS':
                return None, "Donor business not found."

            # Metrics compiled dynamically from orders database
            completed_donations = MarketplaceOrder.query.filter_by(
                business_id=business_id,
                payment_status='NOT_REQUIRED',
                order_status='COMPLETED'
            ).count()

            completed_surplus_tx = MarketplaceOrder.query.filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.payment_status == 'PAYMENT_SUCCESS',
                MarketplaceOrder.order_status == 'COMPLETED'
            ).count()

            total_units_redistributed = db.session.query(db.func.sum(MarketplaceOrder.quantity)).filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.order_status == 'COMPLETED'
            ).scalar() or 0.0

            active_listings_count = SurplusListing.query.filter_by(
                user_id=business_id,
                status='AVAILABLE'
            ).count()

            # Trust Indicators
            trust_indicators = []
            if business.is_verified:
                trust_indicators.append("Verified Business")
            if completed_donations > 0:
                trust_indicators.append(f"{completed_donations} Completed Donations")
            
            successful_pickups = MarketplaceOrder.query.filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.order_status == 'COMPLETED'
            ).count()
            if successful_pickups > 0:
                trust_indicators.append(f"{successful_pickups} Successful Pickups")
            
            if len(trust_indicators) == 0:
                trust_indicators.append("New Contributor")
            else:
                trust_indicators.append("Active Contributor")

            # Limited public history (completed transactions only)
            recent_orders = MarketplaceOrder.query.filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.order_status == 'COMPLETED'
            ).order_by(MarketplaceOrder.created_at.desc()).limit(5).all()

            history = []
            for o in recent_orders:
                listing = o.listing
                history.append({
                    "product_name": listing.product_name,
                    "category": listing.category.value if hasattr(listing.category, 'value') else str(listing.category),
                    "quantity": o.quantity,
                    "unit": listing.unit,
                    "status": o.order_status,
                    "date": o.created_at.date().isoformat()
                })

            profile_data = {
                "id": business.id,
                "organization_name": business.organization_name or business.full_name,
                "business_type": business.business_type or "Other",
                "address": business.address or "Not available",
                "phone": business.phone if business.phone else "Not available",
                "latitude": business.latitude,
                "longitude": business.longitude,
                "joined_date": business.created_at.date().isoformat() if business.created_at else "Not available",
                "is_verified": business.is_verified,
                "completed_donations": completed_donations,
                "completed_surplus_transactions": completed_surplus_tx,
                "total_units_redistributed": total_units_redistributed,
                "active_listings_count": active_listings_count,
                "trust_indicators": trust_indicators,
                "history": history
            }

            return profile_data, None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def update_donor_profile(business_id: str, data: dict):
        """
        Allows business owners to update public profile fields.
        """
        try:
            business = User.query.get(business_id)
            if not business:
                return None, "Business not found."

            if 'organization_name' in data:
                business.organization_name = data['organization_name']
            if 'business_type' in data:
                business.business_type = data['business_type']
            if 'phone' in data:
                business.phone = data['phone']
            if 'address' in data:
                business.address = data['address']
            if data.get('latitude') is not None and data.get('longitude') is not None:
                business.latitude = float(data['latitude'])
                business.longitude = float(data['longitude'])
            elif 'address' in data and data.get('address'):
                latitude, longitude = geocode_address(data.get('address'))
                if latitude is not None and longitude is not None:
                    business.latitude, business.longitude = latitude, longitude

            db.session.commit()
            return business.to_dict(), None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_business_transactions(business_id: str):
        """
        Fetches transaction list for business dashboard.
        """
        try:
            orders = MarketplaceOrder.query.filter_by(business_id=business_id).order_by(MarketplaceOrder.created_at.desc()).all()
            result = []
            for order in orders:
                ord_dict = order.to_dict()
                listing = order.listing
                ord_dict['product_name'] = listing.product_name
                ord_dict['unit'] = listing.unit
                recipient = order.recipient
                ord_dict['recipient_name'] = recipient.organization_name or recipient.full_name
                result.append(ord_dict)
            return result, None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def get_business_stats(business_id: str):
        """
        Calculates transaction statistics for business dashboard.
        """
        try:
            CO2_FACTOR = float(os.getenv('CO2_CONVERSION_FACTOR', '2.5'))
            MEALS_FACTOR = float(os.getenv('MEALS_CONVERSION_FACTOR', '2.0'))

            total_sales = db.session.query(db.func.sum(MarketplaceOrder.total_amount)).filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.payment_status == 'PAYMENT_SUCCESS',
                MarketplaceOrder.order_status == 'COMPLETED'
            ).scalar() or 0.0

            successful_tx = MarketplaceOrder.query.filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.payment_status == 'PAYMENT_SUCCESS',
                MarketplaceOrder.order_status == 'COMPLETED'
            ).count()

            pending_tx = MarketplaceOrder.query.filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.payment_status == 'PAYMENT_INITIATED'
            ).count()

            failed_tx = MarketplaceOrder.query.filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.payment_status == 'PAYMENT_FAILED'
            ).count()

            refunded_tx = MarketplaceOrder.query.filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.payment_status == 'REFUNDED'
            ).count()

            quantity_redistributed = db.session.query(db.func.sum(MarketplaceOrder.quantity)).filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.order_status == 'COMPLETED'
            ).scalar() or 0.0

            completed_donations = MarketplaceOrder.query.filter_by(
                business_id=business_id,
                payment_status='NOT_REQUIRED',
                order_status='COMPLETED'
            ).count()

            completed_paid_sales = MarketplaceOrder.query.filter(
                MarketplaceOrder.business_id == business_id,
                MarketplaceOrder.payment_status == 'PAYMENT_SUCCESS',
                MarketplaceOrder.order_status == 'COMPLETED'
            ).count()

            active_listings_count = SurplusListing.query.filter_by(
                user_id=business_id,
                status='AVAILABLE'
            ).count()

            completed_pickups = MarketplaceOrder.query.filter_by(
                business_id=business_id,
                order_status='COMPLETED'
            ).count()

            estimated_co2_savings = round(quantity_redistributed * CO2_FACTOR, 2)
            estimated_meals_redistributed = round(quantity_redistributed * MEALS_FACTOR, 2)

            return {
                "total_sales_revenue": total_sales,
                "successful_transactions": successful_tx,
                "pending_transactions": pending_tx,
                "failed_transactions": failed_tx,
                "refunded_transactions": refunded_tx,
                "quantity_redistributed": quantity_redistributed,
                "completed_donations": completed_donations,
                "completed_paid_sales": completed_paid_sales,
                "active_listings_count": active_listings_count,
                "completed_pickups": completed_pickups,
                "estimated_co2_savings": estimated_co2_savings,
                "estimated_meals_redistributed": estimated_meals_redistributed,
                "co2_per_unit_factor": CO2_FACTOR,
                "meals_per_unit_factor": MEALS_FACTOR
            }, None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def get_marketplace_analytics():
        """
        Aggregates global platform statistics.
        """
        try:
            CO2_FACTOR = float(os.getenv('CO2_CONVERSION_FACTOR', '2.5'))
            MEALS_FACTOR = float(os.getenv('MEALS_CONVERSION_FACTOR', '2.0'))

            total_donated_weight = db.session.query(db.func.sum(MarketplaceOrder.quantity)).filter(
                MarketplaceOrder.payment_status == 'NOT_REQUIRED',
                MarketplaceOrder.order_status == 'COMPLETED'
            ).scalar() or 0.0

            total_sold_weight = db.session.query(db.func.sum(MarketplaceOrder.quantity)).filter(
                MarketplaceOrder.payment_status == 'PAYMENT_SUCCESS',
                MarketplaceOrder.order_status == 'COMPLETED'
            ).scalar() or 0.0

            total_revenue = db.session.query(db.func.sum(MarketplaceOrder.total_amount)).filter(
                MarketplaceOrder.payment_status == 'PAYMENT_SUCCESS',
                MarketplaceOrder.order_status == 'COMPLETED'
            ).scalar() or 0.0

            completed_paid_orders = MarketplaceOrder.query.filter(
                MarketplaceOrder.payment_status == 'PAYMENT_SUCCESS',
                MarketplaceOrder.order_status == 'COMPLETED'
            ).count()

            avg_transaction_value = round(total_revenue / completed_paid_orders, 2) if completed_paid_orders > 0 else 0.0

            total_volume = total_donated_weight + total_sold_weight
            estimated_co2_savings = round(total_volume * CO2_FACTOR, 2)
            estimated_meals_redistributed = round(total_volume * MEALS_FACTOR, 2)

            return {
                "food_donated_quantity": total_donated_weight,
                "food_sold_quantity": total_sold_weight,
                "payment_revenue": total_revenue,
                "completed_paid_transactions": completed_paid_orders,
                "average_transaction_value": avg_transaction_value,
                "total_volume_redistributed": total_volume,
                "estimated_co2_savings": estimated_co2_savings,
                "estimated_meals_redistributed": estimated_meals_redistributed,
                "co2_per_unit_factor": CO2_FACTOR,
                "meals_per_unit_factor": MEALS_FACTOR
            }, None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def _score_match(listing, requirement, donor, recipient, distance):
        # 1. Food category compatibility (30%)
        category_score = 0.0
        l_cat = listing.category.value if hasattr(listing.category, 'value') else str(listing.category)
        r_cat = requirement.category.value if hasattr(requirement.category, 'value') else str(requirement.category)
        if l_cat == r_cat:
            category_score = 30.0

        # 2. NGO requested quantity vs available quantity (20%)
        quantity_score = 0.0
        if listing.quantity_available >= requirement.quantity:
            quantity_score = 20.0
        elif requirement.quantity > 0:
            quantity_score = (listing.quantity_available / requirement.quantity) * 20.0

        # 3. Location proximity (20%). Unknown coordinates receive no proximity
        # points instead of an arbitrary half-score.
        proximity_score = 0.0
        if distance is not None:
            if distance <= 5.0:
                proximity_score = 20.0
            elif distance <= 15.0:
                proximity_score = 15.0
            elif distance <= 30.0:
                proximity_score = 10.0
            else:
                proximity_score = 5.0

        # 4. Expiry urgency (20%)
        expiry_score = 5.0
        days_remaining = (listing.expiry_date - date.today()).days
        if days_remaining <= 1:
            expiry_score = 20.0
        elif days_remaining <= 3:
            expiry_score = 15.0
        elif days_remaining <= 7:
            expiry_score = 10.0
        else:
            expiry_score = 5.0

        # 5. NGO requirement priority/urgency (10%)
        urgency_score = 2.0
        urg = (requirement.urgency or 'LOW').upper()
        if urg == 'CRITICAL':
            urgency_score = 10.0
        elif urg == 'HIGH':
            urgency_score = 8.0
        elif urg == 'MEDIUM':
            urgency_score = 5.0
        else:
            urgency_score = 2.0

        score = round(category_score + quantity_score + proximity_score + expiry_score + urgency_score)
        
        reasons = []
        if category_score > 0:
            reasons.append(f"✓ Food category matches NGO requirement ({r_cat})")
        else:
            reasons.append(f"✕ Food category mismatch (Listing: {l_cat} vs Req: {r_cat})")

        if listing.quantity_available >= requirement.quantity:
            reasons.append(f"✓ Quantity requirement satisfied ({listing.quantity_available} {listing.unit} available vs {requirement.quantity} {requirement.unit} requested)")
        else:
            reasons.append(f"✓ Partially satisfies quantity ({listing.quantity_available} {listing.unit} available)")

        if distance is not None:
            reasons.append(f"✓ {distance} km away")
        else:
            reasons.append("• Location coordinates unavailable; proximity was not scored")

        if days_remaining <= 3:
            reasons.append(f"✓ High expiry priority ({days_remaining} days remaining)")
        else:
            reasons.append(f"✓ Stable shelf life ({days_remaining} days remaining)")

        reasons.append(f"✓ Urgency: {urg} requirement")

        return score, reasons

    @staticmethod
    def create_requirement(user_id: str, data: dict):
        try:
            category_str = data.get('category', 'Others')
            try:
                category = InventoryCategory(category_str)
            except ValueError:
                category = InventoryCategory.OTHERS

            quantity = float(data.get('quantity', 0.0))
            location = (data.get('location') or '').strip()
            if quantity <= 0:
                return None, "Quantity must be greater than zero."
            if not location:
                return None, "Location is required."

            req = NgoRequirement(
                user_id=user_id,
                category=category,
                quantity=quantity,
                unit=data.get('unit', 'units'),
                urgency=data.get('urgency', 'LOW'),
                location=location,
                dietary_requirement=data.get('dietary_requirement')
            )
            db.session.add(req)

            recipient = User.query.get(user_id)
            if recipient and (recipient.latitude is None or recipient.longitude is None):
                latitude, longitude = geocode_address(location)
                if latitude is not None and longitude is not None:
                    recipient.latitude, recipient.longitude = latitude, longitude
                    if not recipient.address:
                        recipient.address = location

            db.session.commit()
            return req.to_dict(), None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def list_requirements(user_id: str):
        try:
            reqs = NgoRequirement.query.filter_by(user_id=user_id).order_by(NgoRequirement.created_at.desc()).all()
            return [r.to_dict() for r in reqs], None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def delete_requirement(user_id: str, requirement_id: str):
        try:
            req = NgoRequirement.query.filter_by(id=requirement_id, user_id=user_id).first()
            if not req:
                return False, "Requirement not found."
            db.session.delete(req)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def get_recommendations(user_id: str):
        return MarketplaceService.list_listings(user_id, {'matching_only': 'true'})

    @staticmethod
    def send_in_app_notification(user_id: str, title: str, message: str):
        try:
            notif = Notification(user_id=user_id, title=title, message=message)
            db.session.add(notif)
            db.session.flush()
        except Exception as e:
            print("Failed to save notification:", e)

    @staticmethod
    def list_notifications(user_id: str):
        try:
            notifs = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
            return [n.to_dict() for n in notifs], None
        except Exception as e:
            return None, str(e)

    @staticmethod
    def mark_all_notifications_read(user_id: str):
        try:
            Notification.query.filter_by(user_id=user_id, is_read=False).update({Notification.is_read: True})
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def get_ngo_impact(recipient_id: str):
        try:
            completed_orders = MarketplaceOrder.query.filter_by(
                recipient_id=recipient_id,
                order_status='COMPLETED'
            ).all()

            total_units = sum(o.quantity for o in completed_orders)
            completed_pickups = len(completed_orders)
            
            MEALS_FACTOR = float(os.getenv('MEALS_CONVERSION_FACTOR', '2.0'))
            CO2_FACTOR = float(os.getenv('CO2_CONVERSION_FACTOR', '2.5'))

            meals_supported = round(total_units * MEALS_FACTOR, 2)
            co2_savings = round(total_units * CO2_FACTOR, 2)

            return {
                "completed_pickups": completed_pickups,
                "total_units_received": total_units,
                "meals_supported": meals_supported,
                "food_recovery_volume": total_units,
                "estimated_co2_savings": co2_savings,
                "meals_per_unit_factor": MEALS_FACTOR,
                "co2_per_unit_factor": CO2_FACTOR
            }, None
        except Exception as e:
            return None, str(e)
