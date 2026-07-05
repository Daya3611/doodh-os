import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/firebase/config';
import { doc, collection, setDoc, Timestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Record webhook event in audit logs
    const auditRef = doc(collection(db, 'webhook_logs'));
    await setDoc(auditRef, {
      id: auditRef.id,
      event: event.event,
      payload: event.payload,
      createdAt: Timestamp.now()
    });

    switch (event.event) {
      case 'payment.captured':
        // Handle successful payment, typically already handled by client-side verify 
        // but this ensures we don't miss payments if the client browser closed.
        console.log('Payment Captured:', event.payload.payment.entity.id);
        break;
      
      case 'payment.failed':
        console.error('Payment Failed:', event.payload.payment.entity.id);
        // Handle failed payment (e.g. notify user)
        break;

      default:
        console.log(`Unhandled webhook event: ${event.event}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}
