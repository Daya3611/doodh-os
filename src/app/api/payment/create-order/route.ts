import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export async function POST(req: Request) {
  try {
    const { centerId, planId } = await req.json();

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
    const monthlyPrice = parseInt(planDoc.fields.monthlyPrice.integerValue || planDoc.fields.monthlyPrice.doubleValue || '0');
    
    // Convert to paise (Razorpay expects smallest currency unit, 1 INR = 100 paise)
    const amountInPaise = monthlyPrice * 100;

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
