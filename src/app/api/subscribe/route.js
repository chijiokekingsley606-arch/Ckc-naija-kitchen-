import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { kitchenId, email, kitchenName, redirectUrl } = await req.json();

    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('monthly_subscription_fee')
      .eq('id', 1)
      .single();

    const fee = settings?.monthly_subscription_fee || 15000;
    const txRef = `SUB-${kitchenId.slice(0, 8)}-${Date.now()}`;

    const flwRes = await fetch('https://flutterwave.com', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: fee,
        currency: 'NGN',
        redirect_url: redirectUrl,
        customer: { email, name: kitchenName },
        customizations: {
          title: 'CKC NAIJA KITCHEN Subscription',
          description: '30-Day Kitchen Partner Access',
        },
        meta: { type: 'kitchen_subscription', kitchen_id: kitchenId },
      }),
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
