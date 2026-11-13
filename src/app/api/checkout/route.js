import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { orderId, email, name, redirectUrl } = await req.json();

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*, kitchens(flw_subaccount_id, name)')
      .eq('id', orderId)
      .single();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const txRef = `CKC-${order.id.slice(0, 8)}-${Date.now()}`;
    await supabaseAdmin.from('orders').update({ flw_tx_ref: txRef }).eq('id', order.id);

    const payload = {
      tx_ref: txRef,
      amount: order.grand_total,
      currency: 'NGN',
      redirect_url: redirectUrl,
      customer: { email, name: name || 'CKC Customer' },
      customizations: {
        title: 'CKC NAIJA KITCHEN',
        description: `Order from ${order.kitchens?.name || 'Local Kitchen'}`,
      },
      meta: { type: 'food_order', order_id: order.id },
    };

    if (order.kitchens?.flw_subaccount_id) {
      payload.subaccounts = [
        {
          id: order.kitchens.flw_subaccount_id,
          transaction_charge_type: 'flat',
          transaction_charge: Number(order.service_fee),
        },
      ];
    }

    const flwRes = await fetch('https://flutterwave.com', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await flwRes.json();
    if (data.status !== 'success') {
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

    return NextResponse.json({ link: data.data.link });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
