'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function SellerDashboard({ user, settings }) {
  const [kitchen, setKitchen] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ name: '', city: '', address: '', whatsapp: '', lat: '', lng: '' });
  const [dishForm, setDishForm] = useState({ name: '', price: '', desc: '', img: '' });
  const [bankForm, setBankForm] = useState({ bankCode: '044', accountNumber: '' });
  const [pinInputs, setPinInputs] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadKitchen();
  }, [user]);

  async function loadKitchen() {
    const { data: k } = await supabase.from('kitchens').select('*').eq('owner_id', user.id).single();
    if (k) {
      setKitchen(k);
      const { data: d } = await supabase.from('dishes').select('*').eq('kitchen_id', k.id);
      const { data: o } = await supabase.from('orders').select('*').eq('kitchen_id', k.id).eq('payment_status', 'paid').order('created_at', { ascending: false });
      setDishes(d || []);
      setOrders(o || []);
    }
  }

  function grabGPS() {
    if (!navigator.geolocation) return alert('GPS not supported on this browser');
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
      alert('GPS Location captured!');
    });
  }

  async function createKitchen(e) {
    e.preventDefault();
    setLoading(true);
    await supabase.from('kitchens').insert({
      owner_id: user.id,
      name: form.name,
      city: form.city,
      address: form.address,
      whatsapp_number: form.whatsapp,
      latitude: form.lat ? Number(form.lat) : null,
      longitude: form.lng ? Number(form.lng) : null,
    });
    setLoading(false);
    loadKitchen();
  }

  async function saveBank(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/subaccount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kitchenId: kitchen.id,
        businessName: kitchen.name,
        email: user.email,
        phone: kitchen.whatsapp_number,
        bankCode: bankForm.bankCode,
        accountNumber: bankForm.accountNumber,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) return alert(data.error);
    alert('Bank linked for automatic 100% food payouts!');
    loadKitchen();
  }

  async function addDish(e) {
    e.preventDefault();
    await supabase.from('dishes').insert({
      kitchen_id: kitchen.id,
      name: dishForm.name,
      price: Number(dishForm.price),
      description: dishForm.desc,
      image_url: dishForm.img || 'https://unsplash.com',
    });
    setDishForm({ name: '', price: '', desc: '', img: '' });
    loadKitchen();
  }

  async function toggleOpen() {
    await supabase.from('kitchens').update({ is_open: !kitchen.is_open }).eq('id', kitchen.id);
    loadKitchen();
  }

  async function updateStage(order, nextStage) {
    if (nextStage === 'delivered') {
      if ((pinInputs[order.id] || '').trim() !== order.delivery_pin) {
        return alert('Incorrect 4-digit Buyer Delivery PIN!');
      }
    }
    await supabase.from('orders').update({ order_status: nextStage }).eq('id', order.id);
    loadKitchen();
  }

  async function renewSubscription() {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kitchenId: kitchen.id,
        email: user.email,
        kitchenName: kitchen.name,
        redirectUrl: window.location.href,
      }),
    });
    const data = await res.json();
    if (data.link) window.location.href = data.link;
  }

  if (!kitchen) {
    return (
      <form onSubmit={createKitchen} className="bg-white p-5 rounded-2xl shadow max-w-lg mx-auto space-y-3">
        <h2 className="text-xl font-bold text-orange-700">Register Your Kitchen (30-Day Free Trial)</h2>
        <input required placeholder="Kitchen Name (e.g. Mama Nkechi's Pot)" className="w-full border p-2.5 rounded-lg" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required placeholder="City (e.g. Umuahia, Lagos, Abuja)" className="w-full border p-2.5 rounded-lg" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input required placeholder="Street Address" className="w-full border p-2.5 rounded-lg" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input required placeholder="WhatsApp Number (e.g. 2348012345678)" className="w-full border p-2.5 rounded-lg" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        <button type="button" onClick={grabGPS} className="w-full bg-orange-100 text-orange-800 py-2 rounded-lg font-medium">
          {form.lat ? `GPS Saved (${Number(form.lat).toFixed(3)})` : 'Capture Kitchen GPS Location'}
        </button>
        <button disabled={loading} className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold">
          {loading ? 'Submitting...' : 'Submit Kitchen for Approval'}
        </button>
      </form>
    );
  }

  const isExpired = new Date(kitchen.subscription_expires_at) < new Date();

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl shadow flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold">{kitchen.name}</h2>
          <p className="text-sm text-gray-600">
            Approval: <b>{kitchen.is_approved ? 'Approved' : 'Pending Admin Review'}</b> | Access Ends: {new Date(kitchen.subscription_expires_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleOpen} className={`px-4 py-2 rounded-lg font-bold text-white ${kitchen.is_open ? 'bg-green-600' : 'bg-red-600'}`}>
            {kitchen.is_open ? 'Status: OPEN' : 'Status: CLOSED'}
          </button>
          <button onClick={renewSubscription} className="px-4 py-2 rounded-lg bg-orange-600 text-white font-bold">
            {isExpired ? 'Renew Subscription' : `Extend (₦${settings?.monthly_subscription_fee || 15000})`}
          </button>
        </div>
      </div>

      <form onSubmit={saveBank} className="bg-white p-5 rounded-2xl shadow space-y-3">
        <h3 className="font-bold text-lg">Payout Bank Setup (Keep 100% of Food Price)</h3>
        {kitchen.flw_subaccount_id && <p className="text-sm text-green-700 font-medium">Linked Account: {kitchen.account_name} ({kitchen.account_number})</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select className="border p-2.5 rounded-lg" value={bankForm.bankCode} onChange={(e) => setBankForm({ ...bankForm, bankCode: e.target.value })}>
            <option value="044">Access Bank (044)</option>
            <option value="058">GTBank (058)</option>
            <option value="011">First Bank (011)</option>
            <option value="033">UBA (033)</option>
            <option value="057">Zenith Bank (057)</option>
            <option value="999992">OPay (999992)</option>
            <option value="50211">Kuda Bank (50211)</option>
          </select>
          <input required placeholder="10-Digit Account Number" className="border p-2.5 rounded-lg" value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} />
          <button disabled={loading} className="bg-gray-900 text-white rounded-lg font-bold py-2.5">Save Bank</button>
        </div>
      </form>

      <form onSubmit={addDish} className="bg-white p-5 rounded-2xl shadow space-y-3">
        <h3 className="font-bold text-lg">Add Menu Dish</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input required placeholder="Dish Name (e.g. Egusi & Pounded Yam)" className="border p-2.5 rounded-lg" value={dishForm.name} onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })} />
          <input required type="number" placeholder="Your Price in ₦ (e.g. 1000)" className="border p-2.5 rounded-lg" value={dishForm.price} onChange={(e) => setDishForm({ ...dishForm, price: e.target.value })} />
          <input placeholder="Short Description" className="border p-2.5 rounded-lg" value={dishForm.desc} onChange={(e) => setDishForm({ ...dishForm, desc: e.target.value })} />
          <input placeholder="Food Image URL (Optional)" className="border p-2.5 rounded-lg" value={dishForm.img} onChange={(e) => setDishForm({ ...dishForm, img: e.target.value })} />
        </div>
        <button className="bg-orange-600 text-white px-5 py-2.5 rounded-lg font-bold">Add Dish to Menu</button>
      </form>

      <div className="bg-white p-5 rounded-2xl shadow space-y-3">
        <h3 className="font-bold text-lg">Paid Orders ({orders.length})</h3>
        {orders.map((o) => (
          <div key={o.id} className="border p-4 rounded-xl space-y-2">
            <div className="flex justify-between font-bold">
              <span>Order #{o.id.slice(0, 6)} — Your Earnings: ₦{o.food_total}</span>
              <span className="uppercase text-orange-600">{o.order_status.replaceAll('_', ' ')}</span>
            </div>
            <p className="text-sm text-gray-600">Address: {o.delivery_address}</p>
            <div className="flex flex-wrap gap-2 items-center pt-2">
              <button onClick={() => updateStage(o, 'preparing')} className="px-3 py-1 bg-yellow-100 rounded text-sm font-medium">Preparing</button>
      
