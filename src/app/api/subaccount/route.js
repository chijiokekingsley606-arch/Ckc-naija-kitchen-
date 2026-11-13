import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { kitchenId, businessName, email, phone, bankCode, accountNumber } = await req.json();

    const flwRes = await fetch('https://flutterwave.com', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: bankCode,
        account_number: accountNumber,
        business_name: businessName,
        business_email: email,
        business_contact: businessName,
        business_contact_mobile: phone,
        business_mobile: phone,
        country: 'NG',
        split_type: 'flat',
        split_value: 300,
      }),
    });

    const data = await flwRes.json();
    if (data.status !== 'success') {
      return NextResponse.json({ error: data.message || 'Bank verification failed' }, { status: 400 });
    }

    await supabaseAdmin
      .from('kitchens')
      .update({
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: data.data.full_name || businessName,
        flw_subaccount_id: data.data.subaccount_id,
      })
      .eq('id', kitchenId);

    return NextResponse.json({ success: true, subaccount_id: data.data.subaccount_id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
