use client';
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
    setLoading
