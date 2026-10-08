import React, { useEffect, useRef } from "react";
import { X, Camera } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "barcode-reader",
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 120,
          },
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          onScanSuccess(decodedText);

          scannerRef.current?.clear();

          scannerRef.current = null;

          onClose();
        },
        () => {}
      );
    }

    return () => {
      scannerRef.current?.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">

      <div className="bg-white rounded-3xl shadow-2xl w-[650px] max-w-[95%] overflow-hidden">

        <div className="flex justify-between items-center px-6 py-5 border-b">

          <div className="flex items-center gap-3">

            <Camera className="text-emerald-600" />

            <h2 className="text-2xl font-bold">

              Scan Product Barcode

            </h2>

          </div>

          <button onClick={onClose}>

            <X />

          </button>

        </div>

        <div className="p-6">

          <div
            id="barcode-reader"
            className="rounded-xl overflow-hidden"
          />

          <div className="mt-5 text-center text-gray-500">

            Point your camera at a barcode.

          </div>

        </div>

      </div>

    </div>
  );
};

export default BarcodeScannerModal;