"use client";

import { useState, useMemo } from "react";

interface Product {
  id: string;
  name: string;
  nameAr: string;
  price: number; // SAR VAT-inclusive retail price
  emoji: string;
}

interface CartItem extends Product {
  quantity: number;
}

const BAKALA_PRODUCTS: Product[] = [
  { id: "p1", name: "Almarai Long Life Milk 1L", nameAr: "حليب المراعي طويل الأجل", price: 6.5, emoji: "🥛" },
  { id: "p2", name: "Nova Water 330ml", nameAr: "مياه نوفا", price: 1.0, emoji: "💧" },
  { id: "p3", name: "Indomie Noodles Pack", nameAr: "إندومي نودلز", price: 1.5, emoji: "🍜" },
  { id: "p4", name: "Lays Potato Chips", nameAr: "شيبس ليز", price: 3.0, emoji: "🥔" },
  { id: "p5", name: "Pepsi Can 330ml", nameAr: "بيبسي", price: 2.5, emoji: "🥤" },
  { id: "p6", name: "Samoli White Bread", nameAr: "خبز صامولي أبيض", price: 3.0, emoji: "🍞" },
  { id: "p7", name: "Nadec Laban 360ml", nameAr: "لبن نادك", price: 2.0, emoji: "🥛" },
  { id: "p8", name: "KDD Orange Juice 250ml", nameAr: "عصير برتقال كي دي دي", price: 1.5, emoji: "🧃" },
  { id: "p9", name: "Almarai Cream Cheese", nameAr: "جبنة كريمي المراعي", price: 8.0, emoji: "🧀" },
  { id: "p10", name: "Galaxy Chocolate Bar", nameAr: "شوكولاتة جالاكسي", price: 4.0, emoji: "🍫" },
  { id: "p11", name: "Sunsilk Shampoo 200ml", nameAr: "شامبو صانسيلك", price: 12.0, emoji: "🧴" },
  { id: "p12", name: "Fine Tissues Box", nameAr: "مناديل فاين", price: 5.5, emoji: "🧻" },
];

interface CheckoutResult {
  success: boolean;
  transaction?: { number: number; status: string };
  receipt?: {
    subtotal_net_sar: number;
    total_vat_sar: number;
    total_gross_sar: number;
    amount_paid_sar: number;
    change_sar: number;
    vat_rate: string;
  };
  double_entry?: {
    debits: { account: string; amount_sar: number }[];
    credits: { account: string; amount_sar: number }[];
  };
  error?: string;
  detail?: string;
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<CheckoutResult | null>(null);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setLastResult(null);
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function clearCart() {
    setCart([]);
    setLastResult(null);
  }

  const totals = useMemo(() => {
    const grossHalalas = cart.reduce(
      (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
      0
    );
    const netHalalas = cart.reduce((sum, item) => {
      const netPerUnit = Math.round(Math.round(item.price * 100) / 1.15);
      return sum + netPerUnit * item.quantity;
    }, 0);
    const vatHalalas = grossHalalas - netHalalas;

    return {
      gross: grossHalalas / 100,
      net: netHalalas / 100,
      vat: vatHalalas / 100,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [cart]);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setIsProcessing(true);
    setLastResult(null);

    try {
      const response = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          payment_method: paymentMethod,
        }),
      });

      const data: CheckoutResult = await response.json();
      setLastResult(data);

      if (data.success) {
        setCart([]);
      }
    } catch {
      setLastResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Bakala POS
          </h1>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
            &ldquo;The Taste of Tradition&rdquo;
          </span>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400" dir="rtl">
          نقطة البيع — مخابز ايمان
        </p>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Product Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {BAKALA_PRODUCTS.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-amber-400 hover:shadow-md hover:scale-[1.02] transition-all active:scale-95 cursor-pointer"
              >
                <span className="text-3xl">{product.emoji}</span>
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 text-center leading-tight line-clamp-2">
                  {product.name}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center" dir="rtl">
                  {product.nameAr}
                </span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">
                  {product.price.toFixed(2)} SAR
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Receipt / Cart */}
        <div className="w-[380px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0">
          {/* Cart Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
              Receipt ({totals.itemCount} items)
            </h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 && !lastResult && (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-8">
                Tap items to add to cart
              </p>
            )}
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {item.emoji} {item.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {item.price.toFixed(2)} × {item.quantity} ={" "}
                    {(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-sm font-bold hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-sm font-bold hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            {/* Success Result */}
            {lastResult?.success && (
              <div className="mt-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
                  ✓ Sale #{lastResult.transaction?.number} Completed
                </p>
                {lastResult.double_entry && (
                  <div className="text-xs font-mono space-y-1">
                    <p className="text-green-700 dark:text-green-400 font-semibold">
                      Journal Entry:
                    </p>
                    {lastResult.double_entry.debits.map((d, i) => (
                      <p key={i} className="text-zinc-700 dark:text-zinc-300">
                        DR {d.account}: {d.amount_sar.toFixed(2)}
                      </p>
                    ))}
                    {lastResult.double_entry.credits.map((c, i) => (
                      <p key={i} className="text-zinc-700 dark:text-zinc-300">
                        CR {c.account}: {c.amount_sar.toFixed(2)}
                      </p>
                    ))}
                    <p className="text-green-700 dark:text-green-400 font-semibold mt-1">
                      ✓ Balanced
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {lastResult && !lastResult.success && (
              <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  ✗ {lastResult.error}
                </p>
                {lastResult.detail && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">
                    {lastResult.detail}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Receipt Footer — VAT Breakdown */}
          {cart.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
              {/* Tax Invoice Preview */}
              <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-3 font-mono text-xs">
                <p className="text-center text-zinc-500 dark:text-zinc-400 font-semibold mb-2 uppercase tracking-wider text-[10px]">
                  Simplified Tax Invoice Preview
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Subtotal (excl. VAT):</span>
                    <span className="font-bold">{totals.net.toFixed(2)} SAR</span>
                  </div>
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>VAT (15%):</span>
                    <span className="font-bold">{totals.vat.toFixed(2)} SAR</span>
                  </div>
                  <div className="border-t border-zinc-300 dark:border-zinc-600 pt-1 mt-1 flex justify-between text-zinc-900 dark:text-zinc-100 text-sm">
                    <span className="font-bold">TOTAL (incl. VAT):</span>
                    <span className="font-bold">{totals.gross.toFixed(2)} SAR</span>
                  </div>
                </div>
                <p className="text-center text-[9px] text-zinc-400 dark:text-zinc-500 mt-2">
                  VAT Reg # — ZATCA Simplified Invoice | ض.ق.م 15%
                </p>
              </div>

              {/* Payment Method */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    paymentMethod === "cash"
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-2 border-amber-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  💵 Cash
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    paymentMethod === "card"
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-2 border-amber-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  💳 Card
                </button>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={isProcessing || cart.length === 0}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-bold text-lg transition-colors shadow-lg shadow-green-600/20"
              >
                {isProcessing
                  ? "Processing..."
                  : `Checkout — ${totals.gross.toFixed(2)} SAR`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
