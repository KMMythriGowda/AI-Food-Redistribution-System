"""
Explainable Waste-Risk Scoring Engine
"""

# Configurable Weights (Sum to 1.0)
DEFAULT_WEIGHTS = {
    'expiry': 0.35,
    'excess_stock': 0.30,
    'demand_mismatch': 0.20,
    'historical_waste': 0.10,
    'demand_trend': 0.05
}

class WasteRiskScorer:
    def __init__(self, weights: dict = None):
        self.weights = weights or DEFAULT_WEIGHTS.copy()

    def calculate_risk(
        self,
        current_stock: float,
        forecast_demand: float,
        days_to_expiry: int,
        waste_rate: float = None,
        stock_age_days: float = None,
        historical_demand_trend: float = 0.0,  # Positive = rising, negative = falling
        storage_capacity: float = 100.0
    ) -> dict:
        """
        Calculates a composite waste-risk score from 0 to 100.
        """
        # Ensure non-negative/valid inputs
        current_stock = max(0.0, current_stock)
        forecast_demand = max(0.0, forecast_demand)
        storage_capacity = max(1.0, storage_capacity)

        # 1. Expiry Pressure component (0 to 100)
        # High score when days to expiry is very low
        if days_to_expiry <= 0:
            expiry_score = 100.0
        elif days_to_expiry <= 2:
            expiry_score = 95.0
        elif days_to_expiry <= 5:
            expiry_score = 75.0
        elif days_to_expiry <= 10:
            expiry_score = 50.0
        else:
            expiry_score = max(0.0, 100.0 - (days_to_expiry - 10) * 3.0)
        expiry_score = min(100.0, expiry_score)

        # 2. Excess Stock component (0 to 100)
        # Risk of exceeding storage capacity or carrying too much excess stock
        excess_qty = max(0.0, current_stock - (forecast_demand * max(1, days_to_expiry)))
        excess_stock_score = min(100.0, (excess_qty / storage_capacity) * 100.0)

        # 3. Demand Mismatch component (0 to 100)
        # High mismatch if forecast demand is extremely low compared to stock
        demand_for_lifetime = forecast_demand * max(1, days_to_expiry)
        if current_stock <= 0:
            demand_mismatch_score = 0.0
        else:
            leftover_ratio = max(0.0, (current_stock - demand_for_lifetime) / current_stock)
            demand_mismatch_score = leftover_ratio * 100.0

        # 4. Historical Waste component (0 to 100)
        # Uses waste_rate (0-100) if provided, otherwise calculates a proxy
        if waste_rate is not None:
            historical_waste_score = min(100.0, max(0.0, waste_rate))
        else:
            # Operational proxy: if shelf life remaining is low and mismatch is high, waste probability is high
            historical_waste_score = (expiry_score * 0.6) + (demand_mismatch_score * 0.4)

        # 5. Demand Trend component (0 to 100)
        # High pressure if historical demand trend is negative (falling demand)
        # trend: negative is falling (increases risk), positive is rising (decreases risk)
        if historical_demand_trend < 0:
            # falling trend -> high risk (up to 100)
            demand_trend_score = min(100.0, abs(historical_demand_trend) * 100.0)
        elif historical_demand_trend > 0:
            # rising trend -> low risk
            demand_trend_score = max(0.0, 50.0 - historical_demand_trend * 100.0)
        else:
            # stable trend
            demand_trend_score = 50.0

        # Weighted composite score
        if current_stock <= 0:
            # Remove stock/excess stock dimensions and normalize remaining weights
            w_exp_w = 0.70
            w_wst_w = 0.20
            w_trd_w = 0.10
            score = (
                w_exp_w * expiry_score +
                w_wst_w * historical_waste_score +
                w_trd_w * demand_trend_score
            )
        else:
            score = (
                self.weights['expiry'] * expiry_score +
                self.weights['excess_stock'] * excess_stock_score +
                self.weights['demand_mismatch'] * demand_mismatch_score +
                self.weights['historical_waste'] * historical_waste_score +
                self.weights['demand_trend'] * demand_trend_score
            )
        score = round(min(100.0, max(0.0, score)), 2)

        # Classify Risk Level
        if score < 25:
            risk_level = "LOW"
            action = "NORMAL INVENTORY"
        elif score < 50:
            risk_level = "MEDIUM"
            action = "MONITOR"
        elif score < 75:
            risk_level = "HIGH"
            action = "PROMOTE / REDISTRIBUTE"
        else:
            risk_level = "CRITICAL"
            action = "REDISTRIBUTE / DONATE"

        # Special Override: If it's already expired or expiring within 2 days, risk is CRITICAL and action is REDISTRIBUTE / DONATE
        if current_stock > 0 and days_to_expiry <= 2:
            risk_level = "CRITICAL"
            action = "REDISTRIBUTE / DONATE"
            if days_to_expiry <= 0:
                score = 100.0
            else:
                score = max(85.0, score)

        # Construct explanation
        explanation = f"{risk_level.capitalize()} risk because {current_stock:.0f} units are in stock, forecast demand is {forecast_demand:.1f} units/day and the product expires in {days_to_expiry} days."
        if days_to_expiry <= 0:
            explanation = f"Critical risk because the product has expired ({abs(days_to_expiry)} days ago) with {current_stock:.0f} units remaining in stock."

        # Contributors calculation (weighted sub-scores normalized to sum to exactly 100%)
        if current_stock <= 0:
            w_expiry = 0.70 * expiry_score
            w_excess = 0.0
            w_mismatch = 0.0
            w_historical = 0.20 * historical_waste_score
            w_trend = 0.10 * demand_trend_score
        else:
            w_expiry = self.weights['expiry'] * expiry_score
            w_excess = self.weights['excess_stock'] * excess_stock_score
            w_mismatch = self.weights['demand_mismatch'] * demand_mismatch_score
            w_historical = self.weights['historical_waste'] * historical_waste_score
            w_trend = self.weights['demand_trend'] * demand_trend_score
        
        weighted_sum = w_expiry + w_excess + w_mismatch + w_historical + w_trend
        if weighted_sum > 0:
            expiry_pct = round((w_expiry / weighted_sum) * 100, 1)
            excess_pct = round((w_excess / weighted_sum) * 100, 1)
            mismatch_pct = round((w_mismatch / weighted_sum) * 100, 1)
            historical_pct = round((w_historical / weighted_sum) * 100, 1)
            trend_pct = round((w_trend / weighted_sum) * 100, 1)
            
            expiry_int = int(round(expiry_pct))
            excess_int = int(round(excess_pct))
            mismatch_int = int(round(mismatch_pct))
            historical_int = int(round(historical_pct))
            trend_int = int(round(trend_pct))
            
            total_int = expiry_int + excess_int + mismatch_int + historical_int + trend_int
            diff = 100 - total_int
            if diff != 0:
                parts = [expiry_int, excess_int, mismatch_int, historical_int, trend_int]
                max_idx = parts.index(max(parts))
                if max_idx == 0: expiry_int += diff
                elif max_idx == 1: excess_int += diff
                elif max_idx == 2: mismatch_int += diff
                elif max_idx == 3: historical_int += diff
                else: trend_int += diff
            
            expiry_pct, excess_pct, mismatch_pct, historical_pct, trend_pct = float(expiry_int), float(excess_int), float(mismatch_int), float(historical_int), float(trend_int)
        else:
            expiry_pct, excess_pct, mismatch_pct, historical_pct, trend_pct = 0.0, 0.0, 0.0, 0.0, 0.0

        risk_contributors = {
            "Expiry Risk": expiry_pct,
            "Excess Stock": excess_pct,
            "Demand Mismatch": mismatch_pct,
            "Historical Waste": historical_pct,
            "Demand Volatility": trend_pct
        }

        # Primary Reason mapping
        if days_to_expiry <= 0:
            primary_reason = "The product has already expired while units remain in stock."
        elif days_to_expiry <= 2:
            primary_reason = "The product is approaching expiry (less than 2 days) while stock remains unconsumed."
        elif expiry_pct >= max(excess_pct, mismatch_pct, trend_pct, historical_pct):
            primary_reason = "The product is approaching expiry while sales velocity is insufficient to clear current stock."
        elif excess_pct >= max(expiry_pct, mismatch_pct, trend_pct, historical_pct):
            primary_reason = "Current stock level exceeds storage guidelines and forecast demand limits."
        elif mismatch_pct >= max(expiry_pct, excess_pct, trend_pct, historical_pct):
            primary_reason = "Low sales volume: forecast demand is significantly lower than current stock."
        elif trend_pct >= max(expiry_pct, excess_pct, mismatch_pct, historical_pct):
            primary_reason = "Significant downward demand trend or volatility increases the risk of holding surplus inventory."
        else:
            primary_reason = "Historical waste patterns or other risk indicators show potential loss risk."

        return {
            'risk_score': score,
            'risk_level': risk_level,
            'expiry_pressure': round(expiry_score, 2),
            'excess_stock_pressure': round(excess_stock_score, 2),
            'demand_mismatch': round(demand_mismatch_score, 2),
            'waste_pressure': round(historical_waste_score, 2),
            'demand_trend_pressure': round(demand_trend_score, 2),
            'recommended_action': action,
            'explanation': explanation,
            'risk_contributors': risk_contributors,
            'primary_reason': primary_reason
        }

    @staticmethod
    def determine_trend(previous_score: float, current_score: float) -> dict:
        """
        Determines the risk trend (RISING, STABLE, FALLING) and change.
        """
        change = current_score - previous_score
        if change > 3.0:
            trend = "RISING"
        elif change < -3.0:
            trend = "FALLING"
        else:
            trend = "STABLE"

        return {
            'previous_risk': round(previous_score, 2),
            'current_risk': round(current_score, 2),
            'risk_change': round(change, 2),
            'risk_trend': trend
        }
