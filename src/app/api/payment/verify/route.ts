import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/firebase/config';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, centerId, planId } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment signature details' }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || '';

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    // Payment is valid. Update database.
    const planUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/plans/${planId}`;
    const planRes = await fetch(planUrl);
    if (!planRes.ok) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    const planDoc = await planRes.json();
    const planName = planDoc.fields.name.stringValue;
    const monthlyPrice = parseInt(planDoc.fields.monthlyPrice.integerValue || planDoc.fields.monthlyPrice.doubleValue || '0');
    const limitFarmers = parseInt(planDoc.fields.limits.mapValue.fields.farmers.integerValue || '0');
    const limitStaff = parseInt(planDoc.fields.limits.mapValue.fields.staff.integerValue || '0');
    const limitCenters = parseInt(planDoc.fields.limits.mapValue.fields.centers.integerValue || '1');

    // 1. Record Payment in payments collection
    const paymentId = `pay_${Date.now()}`;
    const paymentUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/payments/${paymentId}`;
    await fetch(paymentUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          paymentId: { stringValue: paymentId },
          centerId: { stringValue: centerId },
          amount: { integerValue: monthlyPrice.toString() },
          status: { stringValue: 'SUCCESS' },
          razorpayOrderId: { stringValue: razorpay_order_id },
          razorpayPaymentId: { stringValue: razorpay_payment_id },
          razorpaySignature: { stringValue: razorpay_signature },
          paidAt: { timestampValue: new Date().toISOString() }
        }
      })
    });

    // 2. Activate Subscription
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(startDate.getMonth() + 1);

    const subUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/subscriptions/${centerId}?updateMask.fieldPaths=id&updateMask.fieldPaths=centerId&updateMask.fieldPaths=planId&updateMask.fieldPaths=planName&updateMask.fieldPaths=status&updateMask.fieldPaths=startDate&updateMask.fieldPaths=expiryDate&updateMask.fieldPaths=limits&updateMask.fieldPaths=autoRenew&updateMask.fieldPaths=razorpaySubscriptionId`;
    await fetch(subUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          id: { stringValue: centerId },
          centerId: { stringValue: centerId },
          planId: { stringValue: planId },
          planName: { stringValue: planName },
          status: { stringValue: 'ACTIVE' },
          startDate: { timestampValue: startDate.toISOString() },
          expiryDate: { timestampValue: expiryDate.toISOString() },
          limits: {
            mapValue: {
              fields: {
                farmers: { integerValue: limitFarmers.toString() },
                staff: { integerValue: limitStaff.toString() },
                centers: { integerValue: limitCenters.toString() }
              }
            }
          },
          autoRenew: { booleanValue: true },
          razorpaySubscriptionId: { stringValue: razorpay_payment_id }
        }
      })
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json({ error: 'Verification failed', details: error.message }, { status: 500 });
  }
}
