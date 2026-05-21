import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, query, where,
  serverTimestamp, orderBy, runTransaction,
} from 'firebase/firestore';
import { Purchase, PurchaseItem } from '@/types';

export const purchaseService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'purchases'),

  getAll: async (centerId: string): Promise<Purchase[]> => {
    const q = query(
      purchaseService.getCollectionRef(centerId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
  },

  add: async (
    centerId: string,
    farmerId: string,
    farmerName: string,
    items: PurchaseItem[],
    total: number,
    createdBy: string
  ): Promise<string> => {
    return await runTransaction(db, async (tx) => {
      // 1. Get the farmer to update balance
      const farmerRef = doc(db, 'centers', centerId, 'farmers', farmerId);
      const farmerDoc = await tx.get(farmerRef);
      if (!farmerDoc.exists()) throw new Error('Farmer not found');
      
      const currentBalance = farmerDoc.data().balance || 0;
      const newBalance = currentBalance - total;

      // 2. Read all inventory items to ensure stock is sufficient
      const inventoryRefs = items.map(item => doc(db, 'centers', centerId, 'inventory', item.productId));
      const inventoryDocs = await Promise.all(inventoryRefs.map(ref => tx.get(ref)));
      
      inventoryDocs.forEach((invDoc, index) => {
        if (!invDoc.exists()) throw new Error(`Product ${items[index].name} not found`);
        const currentStock = invDoc.data().stock || 0;
        if (currentStock < items[index].quantity) {
          throw new Error(`Insufficient stock for ${items[index].name}`);
        }
      });

      // 3. Update inventory stocks
      inventoryDocs.forEach((invDoc, index) => {
        const currentStock = invDoc.data()?.stock || 0;
        tx.update(invDoc.ref, { stock: currentStock - items[index].quantity });
      });

      // 4. Create the purchase document
      const purchaseRef = doc(purchaseService.getCollectionRef(centerId));
      tx.set(purchaseRef, {
        farmerId,
        farmerName,
        items,
        total,
        createdBy,
        createdAt: serverTimestamp(),
      });

      // 5. Create the ledger entry
      const ledgerRef = doc(collection(db, 'centers', centerId, 'ledger'));
      tx.set(ledgerRef, {
        farmerId,
        transactionType: 'purchase',
        description: `Purchased ${items.length} items`,
        credit: 0,
        debit: total,
        balance: newBalance,
        referenceId: purchaseRef.id,
        createdAt: serverTimestamp(),
      });

      // 6. Update farmer balance
      tx.update(farmerRef, { balance: newBalance });

      return purchaseRef.id;
    });
  },
};
