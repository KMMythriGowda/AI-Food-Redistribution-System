"""
Smart Reorder Recommendation Engine
"""

class ReorderEngine:
    @staticmethod
    def calculate_reorder(
        current_stock: float,
        forecast_daily_demand: float,
        lead_time_days: int = 3,
        safety_stock: float = 5.0,
        storage_capacity: float = 100.0,
        waste_risk_level: str = "LOW",
        days_to_expiry: int = 30
    ) -> dict:
        """
        Calculates recommended purchase replenishment quantity.
        Rules:
        - If risk is HIGH or CRITICAL: Recommended quantity = 0. Action is REDISTRIBUTE / PROMOTE / DONATE.
        - Under normal risk: replenishment based on lead time, safety stock, and storage boundaries.
        """
        current_stock = max(0.0, current_stock)
        forecast_daily_demand = max(0.0, forecast_daily_demand)
        lead_time_days = max(1, lead_time_days)
        safety_stock = max(0.0, safety_stock)
        storage_capacity = max(current_stock, storage_capacity)

        # 1. ROP (Reorder Point) = (Daily Demand * Lead Time) + Safety Stock
        lead_time_demand = forecast_daily_demand * lead_time_days
        reorder_point = lead_time_demand + safety_stock
        
        # 2. Target Stock = ROP + (Daily Demand * Order Interval [e.g. 7 days])
        target_stock = reorder_point + (forecast_daily_demand * 7.0)

        # 3. Available Storage
        available_capacity = max(0.0, storage_capacity - current_stock)

        # Calculate normal reorder qty
        raw_reorder = max(0.0, target_stock - current_stock)
        
        # Apply capacity constraint
        recommended_quantity = min(raw_reorder, available_capacity)
        recommended_quantity = round(recommended_quantity, 2)

        # 4. Check Risk Level Rule
        is_suppressed = False
        if waste_risk_level in ["HIGH", "CRITICAL"]:
            is_suppressed = True
            recommended_quantity = 0.0
            
            # Determine redistribution action based on expiry days
            if days_to_expiry <= 0:
                action = "EMERGENCY CONSUMPTION"
                reason = "Critical expiry risk; item has expired. Additional purchasing suppressed."
            elif days_to_expiry <= 2:
                action = "DONATE"
                reason = "Expiry in 2 days with surplus stock. Additional purchasing suppressed."
            elif days_to_expiry <= 5:
                action = "REDISTRIBUTE"
                reason = "Expiry in under 5 days with surplus stock. Recommend immediate redistribution."
            elif days_to_expiry <= 7:
                action = "DISCOUNT"
                reason = "Short expiry window (under 7 days). Recommend sales promotion discounts."
            else:
                action = "SUPPRESS PURCHASE"
                reason = "High waste risk detected; additional purchasing suppressed."
        else:
            action = "REORDER" if recommended_quantity > 0 else "NORMAL INVENTORY"
            
            if recommended_quantity > 0:
                if raw_reorder > available_capacity:
                    reason = f"Reorder {recommended_quantity:.0f} units (limited by storage capacity) because current stock is below reorder point of {reorder_point:.1f} units."
                else:
                    reason = f"Reorder {recommended_quantity:.0f} units because projected demand during lead time exceeds available stock while waste risk is {waste_risk_level}."
            else:
                if current_stock >= target_stock:
                    reason = f"No reorder recommended: current stock ({current_stock:.0f}) is healthy and exceeds target stock ({target_stock:.1f})."
                else:
                    reason = f"No reorder recommended: current stock ({current_stock:.0f}) is above the reorder point of {reorder_point:.1f} units."

        expected_stock_after_reorder = current_stock + recommended_quantity

        return {
            'reorder_point': round(reorder_point, 2),
            'target_stock': round(target_stock, 2),
            'recommended_quantity': recommended_quantity,
            'available_storage_capacity': round(available_capacity, 2),
            'action': action,
            'reason': reason,
            'is_suppressed': is_suppressed,
            'forecast_daily_demand': round(forecast_daily_demand, 2),
            'current_stock': round(current_stock, 2),
            'storage_capacity': round(storage_capacity, 2),
            'reorder_explanation': {
                'forecast_daily_demand': round(forecast_daily_demand, 2),
                'lead_time_days': lead_time_days,
                'safety_stock': round(safety_stock, 2),
                'current_stock': round(current_stock, 2),
                'storage_capacity': round(storage_capacity, 2),
                'expected_stock_after_reorder': round(expected_stock_after_reorder, 2),
                'reorder_point': round(reorder_point, 2),
                'target_stock': round(target_stock, 2)
            }
        }
