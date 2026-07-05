import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
    });

    const { centerId, planId, billingCycle = 'monthly' } = await req.json();

    if (!centerId || !planId) {
      return NextResponse.json({ error: 'Center ID and Plan ID are required' }, { status: 400 });
    }

    // Fetch the plan using REST API to bypass Next.js Server gRPC offline bug
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/plans/${planId}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const planDoc = await res.json();
    const monthlyPrice = parseInt(planDoc.fields.monthlyPrice?.integerValue || planDoc.fields.monthlyPrice?.doubleValue || '0');
    const yearlyPrice = parseInt(planDoc.fields.yearlyPrice?.integerValue || planDoc.fields.yearlyPrice?.doubleValue || String(monthlyPrice * 10));
    
    const price = billingCycle === 'yearly' ? yearlyPrice : monthlyPrice;
    
    // Convert to paise (Razorpay expects smallest currency unit, 1 INR = 100 paise)
    const amountInPaise = price * 100;

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${centerId.slice(0, 8)}_${Date.now().toString().slice(-8)}`,
      notes: {
        centerId,
        planId
      }
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency }, { status: 200 });

  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json({ error: 'Failed to create order', details: error.message }, { status: 500 });
  }
}
