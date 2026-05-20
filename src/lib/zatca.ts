/**
 * ZATCA TLV (Tag-Length-Value) QR Code Generator
 *
 * Encodes invoice data per ZATCA Phase 2 simplified tax invoice requirements.
 * The QR code contains a Base64-encoded TLV structure with:
 *   Tag 1: Seller Name
 *   Tag 2: VAT Registration Number
 *   Tag 3: Invoice Timestamp (ISO 8601)
 *   Tag 4: Invoice Total (with VAT)
 *   Tag 5: VAT Total
 *
 * Reference: ZATCA E-Invoicing SDK / FATOORA specifications
 */

export interface ZatcaInvoiceData {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO 8601 format
  invoiceTotal: string; // SAR with 2 decimal places
  vatTotal: string; // SAR with 2 decimal places
}

/**
 * Encodes a single TLV field.
 * Tag: 1 byte, Length: 1 byte, Value: UTF-8 bytes
 */
function encodeTLV(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const tlv = new Uint8Array(2 + valueBytes.length);
  tlv[0] = tag;
  tlv[1] = valueBytes.length;
  tlv.set(valueBytes, 2);
  return tlv;
}

/**
 * Generates the ZATCA TLV Base64-encoded QR string from invoice data.
 */
export function generateZatcaQRBase64(data: ZatcaInvoiceData): string {
  const tlv1 = encodeTLV(1, data.sellerName);
  const tlv2 = encodeTLV(2, data.vatNumber);
  const tlv3 = encodeTLV(3, data.timestamp);
  const tlv4 = encodeTLV(4, data.invoiceTotal);
  const tlv5 = encodeTLV(5, data.vatTotal);

  const totalLength =
    tlv1.length + tlv2.length + tlv3.length + tlv4.length + tlv5.length;
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const tlv of [tlv1, tlv2, tlv3, tlv4, tlv5]) {
    combined.set(tlv, offset);
    offset += tlv.length;
  }

  return uint8ArrayToBase64(combined);
}

/**
 * Converts Uint8Array to Base64 string (works in both Node.js and browser).
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a ZATCA TLV Base64 QR string back to its fields (for verification).
 */
export function decodeZatcaQRBase64(base64: string): ZatcaInvoiceData | null {
  try {
    let bytes: Uint8Array;
    if (typeof Buffer !== "undefined") {
      bytes = new Uint8Array(Buffer.from(base64, "base64"));
    } else {
      const binary = atob(base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    }

    const decoder = new TextDecoder();
    const fields: Record<number, string> = {};
    let offset = 0;

    while (offset < bytes.length) {
      const tag = bytes[offset];
      const length = bytes[offset + 1];
      const value = decoder.decode(bytes.slice(offset + 2, offset + 2 + length));
      fields[tag] = value;
      offset += 2 + length;
    }

    return {
      sellerName: fields[1] || "",
      vatNumber: fields[2] || "",
      timestamp: fields[3] || "",
      invoiceTotal: fields[4] || "",
      vatTotal: fields[5] || "",
    };
  } catch {
    return null;
  }
}

// Store constants
export const BAKALA_STORE = {
  sellerName: "Eman Bakery | مخابز ايمان",
  vatNumber: "300000000000003",
} as const;
