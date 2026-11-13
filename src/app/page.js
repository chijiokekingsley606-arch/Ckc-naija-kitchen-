'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SellerDashboard, AdminDashboard } from '../components/Dashboards';

const ADMIN_EMAIL = 'chijiokekingsley606@gmail.com';

function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [roleView, setRoleView] = useState('buyer');
  const [authMode, setAuthMode] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dishes, setDishes] = useState([]);
  const [settings, setSettings] = useState({ buyer_service_fee: 300, monthly_subscription_fee: 15000 });
  const [userCoords, setUserCoords] = useState(null);
  const [cityFilter, setCityFilter] = useState('');
  const [cart, setCart] = useState([]);
  const [address, setAddress] = useState('');
  const [promo, setPromo] = useState('');
  const [discount, setDiscount] = useState(0);
  const [myOrders, setMyOrders] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) handleUserLoaded(data.session.user);
    });
    fetchSettings();
    fetchMenu();
  }, []);

  async function handleUserLoaded(u) {
    setUser(u);
    if (u.email === ADMIN_EMAIL) {
      setRoleView('admin');
    } else {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', u.id).single();
      if (prof?.role) setRoleView(prof.role);
    }
    fetchMyOrders(u.id);
  }

  async function fetchSettings() {
    const { data } = await supabase.from('platform_settings').select('*').eq('id', 1).single();
    if (data) setSettings(data);
  }

  async function fetchMenu() {
    const { data } = await supabase.from('dishes').select('*, kitchens(*)').eq('is_available', true);
    setDishes((data || []).filter((d) => d.kitchens));
  }

  async function fetchMyOrders(uid) {
    const { data } = await supabase.from('orders').select('*, kitchens(name, whatsapp_number)').eq('buyer_id', uid).order('created_at', { ascending: false });
    setMyOrders(data || []);
  }

  function enableNearbyGPS() {
    if (!navigator.geolocation) return alert('GPS not available');
    navigator.geolocation.getCurrentPosition((p) => setUserCoords({ lat: p.coords.latitude, lng: p.coords.longitude }));
  }

  async function handleAuth(e) {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({ email, password });
    let activeUser = data?.user;
    if (error) {
      const login = await supabase.auth.signInWithPassword({ email, password });
      if (login.error) return alert(login.error.message);
      activeUser = login.data.user;
    }
    if (activeUser) {
      const chosenRole = activeUser.email === ADMIN_EMAIL ? 'admin' : authMode;
      await supabase.from('profiles').upsert({ id: activeUser.id, email: activeUser.email, role: chosenRole });
      setAuthMode(null);
      handleUserLoaded(activeUser);
    }
  }

  function addToCart(dish) {
    if (cart.length > 0 && cart.kitchen_id !== dish.kitchen_id) {
      if (!confirm('Clear cart from previous kitchen to order from this kitchen?')) return;
      setCart([dish]);
      return;
    }
    setCart([...cart, dish]);
  }

  async function applyPromo() {
    const { data } = await supabase.from('promo_codes').select('*').eq('code', promo.toUpperCase()).eq('is_active', true).single();
    if (!data) return alert('Invalid promo code');
    setDiscount(Number(data.discount_amount));
    alert(`Promo applied! ₦${data.discount_amount} off service fee.`);
  }

  async function checkout() {
    if (!user) return setAuthMode('buyer');
    if (!address) return alert('Please enter your delivery address');
    const foodTotal = cart.reduce((s, i) => s + Number(i.price), 0);
    const serviceFee = Math.max(0, Number(settings.buyer_service_fee) - discount);
    const grandTotal = foodTotal + serviceFee;

    const { data: order, error } = await supabase.from('orders').insert({
      buyer_id: user.id,
      kitchen_id: cart.kitchen_id,
      items: cart.map((c) => ({ name: c.name, price: c.price })),
      food_total: foodTotal,
      service_fee: serviceFee,
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

  const sortedDishes = dishes
    .map((d) => ({ ...d, dist: userCoords ? getDistanceKm(userCoords.lat, userCoords.lng, d.kitchens.latitude, d.kitchens.longitude) : null }))
    .filter((d) => !cityFilter || d.kitchens.city.toLowerCase().includes(cityFilter.toLowerCase()))
    .sort((a, b) => (a.dist ?? 9999) - (b.dist ?? 9999));

  const foodTotal = cart.reduce((s, i) => s + Number(i.price), 0);
  const finalServiceFee = Math.max(0, Number(settings.buyer_service_fee) - discount);

  return (
    <>
      <header className="bg-orange-600 text-white p-4 shadow sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">CKC NAIJA KITCHEN</h1>
            <p className="text-xs text-orange-100">Fresh Local Meals • Transparent Pricing</p>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => setRoleView('buyer')} className="px-3 py-1.5 bg-white text-orange-700 rounded-lg font-bold text-sm">Order Food</button>
            <button onClick={() => (user ? setRoleView('seller') : setAuthMode('seller'))} className="px-3 py-1.5 bg-orange-800 text-white rounded-lg font-bold text-sm">Run a Kitchen</button>
            {user && <button onClick={() => { supabase.auth.signOut(); setUser(null); setRoleView('buyer'); }} className="text-xs underline ml-1">Logout</button>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full p-4 flex-1 space-y-6">
        {authMode && (
          <form onSubmit={handleAuth} className="bg-white p-5 rounded-2xl shadow max-w-md mx-auto space-y-3 border-2 border-orange-500">
            <h2 className="font-bold text-lg capitalize">Continue as {authMode}</h2>
            <input required type="email" placeholder="Email Address" className="w-full border p-2.5 rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input required type="password" placeholder="Password (min 6 chars)" className="w-full border p-2.5 rounded-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="flex gap-2">
              <button className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-bold">Login / Sign Up</button>
              <button type="button" onClick={() => setAuthMode(null)} className="px-4 border rounded-lg">Cancel</button>
            </div>
          </form>
        )}

        {roleView === 'admin' && user?.email === ADMIN_EMAIL ? (
          <AdminDashboard settings={settings} refreshSettings={fetchSettings} />
        ) : roleView === 'seller' && user ? (
          <SellerDashboard user={user} settings={settings} />
        ) : (
          <>
            <div className="bg-white p-4 rounded-2xl shadow flex flex-wrap gap-3 items-center justify-between">
              <button onClick={enableNearbyGPS} className="bg-orange-100 text-orange-800 px-4 py-2 rounded-xl font-bold text-sm">
                {userCoords ? 'GPS Active: Nearest Kitchens First' : 'Find Kitchens Near Me (GPS)'}
              </button>
              <input placeholder="Filter by City (Umuahia, Lagos, Abuja...)" className="border p-2 rounded-xl flex-1 min-w-[200px]" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedDishes.map((d) => (
                <div key={d.id} className="bg-white rounded-2xl shadow overflow-hidden flex flex-col">
                  <img src={d.image_url} alt={d.name} className="h-44 w-full object-cover" />
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg">{d.name}</h3>
                        <span className="font-extrabold text-orange-600">₦{Number(d.price).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-gray-500">{d.kitchens.name} • {d.kitchens.city} {d.dist !== null ? `(${d.dist.toFixed(1)} km)` : ''}</p>
                      <p className="text-sm text-gray-600 mt-1">{d.description}</p>
                    </div>
                    <button disabled={!d.kitchens.is_open} onClick={() => addToCart(d)} className={`w-full py-2.5 rounded-xl font-bold text-white ${d.kitchens.is_open ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-400'}`}>
                      {d.kitchens.is_open ? 'Add to Plate' : 'Kitchen Currently Closed'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
