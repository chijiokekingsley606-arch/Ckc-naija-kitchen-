import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = req.headers.get('verif-hash');

  if (!signature || signature !== secretHash) {
    return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 });
  }

  const body = await req.json();

  if (body.event === 'charge.completed' && body.data?.status === 'successful') {
    const txId = body.data.id;
    const verifyRes = await fetch(`https://flutterwave.com{txId}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    });
    const verified = await verifyRes.json();

    if (verified.status === 'success' && verified.data?.status === 'successful') {
      const meta = verified.data.meta || {};

      if (meta.type === 'food_order' && meta.order_id) {
        await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', meta.order_id);
      }

      if (meta.type === 'kitchen_subscription' && meta.kitchen_id) {
        const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('kitchens')
          .update({ subscription_expires_at: nextMonth })
          .eq('id', meta.kitchen_id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
