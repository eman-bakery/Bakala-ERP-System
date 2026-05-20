"use client";

import { useEffect, useState } from "react";
import { BAKALA_STORE } from "@/lib/zatca";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price_sar: number;
  line_total_sar: number;
  net_sar: number;
  vat_sar: number;
}

export interface ReceiptData {
  transaction_number: number;
  date: string;
  items: ReceiptItem[];
  subtotal_net_sar: number;
  total_vat_sar: number;
  total_gross_sar: number;
  amount_paid_sar: number;
  change_sar: number;
  payment_method: string;
  zatca_qr_base64: string;
}

interface ReceiptProps {
  data: ReceiptData;
  onClose: () => void;
}

export default function Receipt({ data, onClose }: ReceiptProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(data.zatca_qr_base64, {
        width: 160,
        margin: 1,
        errorCorrectionLevel: "M",
      }).then((url: string) => {
        if (!cancelled) setQrDataUrl(url);
      });
    });
    return () => { cancelled = true; };
  }, [data.zatca_qr_base64]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:bg-white print:static print:block">
      {/* Print/Close Controls — hidden in print */}
      <div className="absolute top-4 right-4 flex gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm"
        >
          🖨️ Print Receipt
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-800 text-white font-medium text-sm"
        >
          ✕ Close
        </button>
      </div>

      {/* Receipt Paper */}
      <div className="receipt-paper bg-white text-black w-[80mm] max-h-[90vh] overflow-y-auto shadow-2xl print:shadow-none print:max-h-none print:overflow-visible p-4 font-mono text-[11px] leading-tight">
        {/* Store Header */}
        <div className="text-center border-b border-dashed border-zinc-400 pb-3 mb-3">
          <p className="text-base font-bold">Eman Bakery</p>
          <p className="text-sm font-bold" dir="rtl">مخابز ايمان</p>
          <p className="text-[9px] text-zinc-500 mt-1 italic">
            &ldquo;The Taste of Tradition&rdquo; — SINCE 2007
          </p>
          <p className="text-[9px] text-zinc-500 mt-0.5">Jeddah, Saudi Arabia</p>
        </div>

        {/* Invoice Type */}
        <div className="text-center mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider">
            Simplified Tax Invoice
          </p>
          <p className="text-[9px]" dir="rtl">فاتورة ضريبية مبسطة</p>
        </div>

        {/* Invoice Details */}
        <div className="border-b border-dashed border-zinc-400 pb-2 mb-2 space-y-0.5">
          <div className="flex justify-between">
            <span>Invoice #:</span>
            <span className="font-bold">{data.transaction_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{new Date(data.date).toLocaleDateString("en-SA")}</span>
          </div>
          <div className="flex justify-between">
            <span>Time:</span>
            <span>
              {new Date(data.date).toLocaleTimeString("en-SA", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>VAT Reg #:</span>
            <span>{BAKALA_STORE.vatNumber}</span>
          </div>
        </div>

        {/* Items */}
        <div className="border-b border-dashed border-zinc-400 pb-2 mb-2">
          <div className="flex justify-between text-[9px] font-bold uppercase text-zinc-500 mb-1">
            <span>Item</span>
            <span>Total</span>
          </div>
          {data.items.map((item, i) => (
            <div key={i} className="mb-1">
              <div className="flex justify-between">
                <span className="truncate max-w-[55%]">{item.name}</span>
                <span className="font-bold">{item.line_total_sar.toFixed(2)}</span>
              </div>
              <div className="text-[9px] text-zinc-500 pl-2">
                {item.quantity} × {item.unit_price_sar.toFixed(2)} SAR
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-b border-dashed border-zinc-400 pb-2 mb-2 space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal (excl. VAT):</span>
            <span>{data.subtotal_net_sar.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (15%):</span>
            <span>{data.total_vat_sar.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-zinc-300 pt-1 mt-1">
            <span>TOTAL (incl. VAT):</span>
            <span>{data.total_gross_sar.toFixed(2)} SAR</span>
          </div>
        </div>

        {/* Payment */}
        <div className="border-b border-dashed border-zinc-400 pb-2 mb-3 space-y-0.5">
          <div className="flex justify-between">
            <span>Payment:</span>
            <span className="capitalize">{data.payment_method}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid:</span>
            <span>{data.amount_paid_sar.toFixed(2)} SAR</span>
          </div>
          {data.change_sar > 0 && (
            <div className="flex justify-between">
              <span>Change:</span>
              <span>{data.change_sar.toFixed(2)} SAR</span>
            </div>
          )}
        </div>

        {/* ZATCA QR Code */}
        <div className="text-center mb-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="ZATCA QR Code"
              className="mx-auto w-[140px] h-[140px]"
            />
          ) : (
            <div className="w-[140px] h-[140px] mx-auto bg-zinc-100 flex items-center justify-center text-[9px] text-zinc-400">
              Loading QR...
            </div>
          )}
          <p className="text-[8px] text-zinc-400 mt-1">
            ZATCA TLV QR — Scan to verify
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-[9px] text-zinc-500 space-y-0.5">
          <p>ض.ق.م 15% — VAT 15%</p>
          <p dir="rtl">شكراً لزيارتكم — Thank you!</p>
          <p className="italic">&ldquo;The Taste of Tradition&rdquo;</p>
        </div>
      </div>
    </div>
  );
}
