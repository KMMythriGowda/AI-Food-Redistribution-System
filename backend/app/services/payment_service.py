"""
Mock Sandbox Payment Service
"""
import uuid

class PaymentService:
    @staticmethod
    def create_payment(order_id: str, amount: float):
        """
        Simulates initiating a payment transaction with a mock provider.
        Returns a mock payment ID and the initial payment status.
        """
        payment_id = f"pay_test_{uuid.uuid4().hex[:16]}"
        return {
            "payment_id": payment_id,
            "status": "PAYMENT_INITIATED",
            "amount": amount,
            "currency": "INR",
            "provider": "MOCK_SANDBOX"
        }

    @staticmethod
    def verify_payment(payment_id: str, success: bool = True):
        """
        Simulates verifying a payment status with the payment gateway.
        """
        if success:
            return {
                "status": "PAYMENT_SUCCESS",
                "payment_id": payment_id,
                "method": "SANDBOX_CARD",
                "error": None
            }
        else:
            return {
                "status": "PAYMENT_FAILED",
                "payment_id": payment_id,
                "method": "SANDBOX_CARD",
                "error": "Simulated sandbox transaction rejection"
            }

    @staticmethod
    def handle_payment_failure(payment_id: str):
        """
        Simulates marking a payment transaction as failed.
        """
        return {
            "status": "PAYMENT_FAILED",
            "payment_id": payment_id
        }

    @staticmethod
    def process_refund(payment_id: str):
        """
        Simulates processing a refund for a payment.
        """
        return {
            "status": "REFUNDED",
            "payment_id": payment_id,
            "refund_id": f"ref_test_{uuid.uuid4().hex[:16]}"
        }

    @staticmethod
    def get_payment_status(payment_id: str):
        """
        Simulates checking the current status of a payment.
        """
        return {
            "payment_id": payment_id,
            "status": "PAYMENT_SUCCESS"
        }
