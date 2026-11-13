'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function CartSection({ cart, setCart, user, setAuthMode, settings, myOrders }) {
  const [address, setAddress] = useState('');
  const [promo, setPromo] = useState('');
  const [discount, setDiscount] = useState(0);

  const foodTotal = cart.reduce((s, i) => s + Number(i.price), 0);
  const finalServiceFee = Math.max(0, Number(settings.buyer_service_fee) - discount);

  async function applyPromo() {
    const { data } = await supabase.from('promo_codes').select('*').eq('code', promo.toUpperCase()).eq('is_active', true).single();
    if (!data) return alert('Invalid promo code');
    setDiscount(Number(data.discount_amount));
    alert(`Promo applied! ₦${data.discount_amount} off service fee.`);
  }

  async function checkout() {
    if (!user) return setAuthMode('buyer');
    if (!address) return alert('Please enter your delivery address');
    const grandTotal = foodTotal + finalServiceFee;

    const { data: order, error } = await supabase.from('orders').insert({
      buyer_id: user.id,
      kitchen_id: cart[0].kitchen_id,
      items: cart.map((c) => ({ name: c.name, price: c.price })),
      food_total: foodTotal,
      service_fee: finalServiceFee,
      discount_applied: discount,
      grand_total: grandTotal,
      delivery_address: address,
    }).select().single();

    if (error) return alert(error.message);

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, email: user.email, name: user.email, redirectUrl: window.location.href }),
    });
    const pay = await res.json();
    if (pay.link) window.location.href = pay.link;
  }

  return (
    <>
      {cart.length > 0 && (
        <div className="bg-white p-5 rounded-2xl shadow-lg border-2 border-orange-500 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">Your Plate ({cart[0].kitchens?.name})</h3>
            <button onClick={() => setCart([])} className="text-xs text-red-600 underline">Clear</button>
          </div>
          {cart.map((c, idx) => (
            <div key={idx} className="flex justify-between text-sm"><span>{c.name}</span><span>₦{Number(c.price).toLocaleString()}</span></div>
          ))}
          <div className="border-t pt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span>Kitchen Food Price:</span><b>₦{foodTotal.toLocaleString()}</b></div>
            <div className="flex justify-between text-orange-700"><span>Platform Service Fee:</span><b>₦{finalServiceFee.toLocaleString()}</b></div>
            <div className="flex justify-between text-base font-extrabold pt-1"><span>Total to Pay:</span><span>₦{(foodTotal + finalServiceFee).toLocaleString()}</span></div>
          </div>
          <p className="text-xs bg-orange-50 p-2 rounded text-orange-900">Delivery/transportation fee is agreed directly with the kitchen on WhatsApp right after payment.</p>
          <div className="flex gap-2">
            <input placeholder="Promo Code" className="border p-2 rounded-lg text-sm" value={promo} onChange={(e) => setPromo(e.target.value)} />
            <button onClick={applyPromo} className="bg-gray-800 text-white px-3 rounded-lg text-sm">Apply</button>
          </div>
          <input placeholder="Your Delivery Street & Landmark" className="w-full border p-2.5 rounded-lg" value={address} onChange={(e) => setAddress(e.target.value)} />
          <button onClick={checkout} className="w-full bg-green-600 text-white py-3 rounded-xl font-extrabold">Pay Now via Flutterwave</button>
        </div>
      )}

      {myOrders.length > 0 && (
        <div className="bg-white p-5 rounded-2xl shadow space-y-3">
          <h3 className="font-bold text-lg">My Orders</h3>
          {myOrders.map((o) => {
            const msg = encodeURIComponent(`Hello ${o.kitchens?.name}, I paid for Order #${o.id.slice(0, 6)} on CKC NAIJA KITCHEN. Address: ${o.delivery_address}. Let's arrange delivery!`);
            return (
              <div key={o.id} className="border p-4 rounded-xl space-y-2">
                <div className="flex justify-between font-bold">
                  <span>{o.kitchens?.name} — ₦{o.grand_total}</span>
                  <span className="uppercase text-sm text-green-700">{o.payment_status} • {o.order_status.replaceAll('_', ' ')}</span>
                </div>
                {o.payment_status === 'paid' && (
                  <>
                    <p className="text-sm font-bold text-orange-700">4-Digit Delivery PIN: <span className="bg-orange-100 px-2 py-0.5 rounded">{o.delivery_pin}</span></p>
                    <a href={`https://wa.me{o.kitchens?.whatsapp_number}?text=${msg}`} target="_blank" className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold">
                      Message Kitchen on WhatsApp for Delivery
                    </a>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
