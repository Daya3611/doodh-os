import { offlineDb } from '@/lib/offlineDb';
import { recalculateAndSyncFarmerBalance } from '@/lib/balance';
import { toast } from 'sonner';

export interface BackupPayload {
  version: string;
  backupDate: number;
  centerId: string;
  tables: {
    collections: any[];
    farmers: any[];
    rateCharts: any[];
    rateChartEntries: any[];
    ledger: any[];
  };
}

export const backupService = {
  /**
   * Export all IndexedDB tables for the center into a JSON file download.
   */
  exportBackup: async (centerId: string): Promise<void> => {
    try {
      const collections = await offlineDb.collections.where('centerId').equals(centerId).toArray();
      const farmers = await offlineDb.farmers.where('centerId').equals(centerId).toArray();
      const rateCharts = await offlineDb.rateCharts.where('centerId').equals(centerId).toArray();
      const rateChartEntries = await offlineDb.rateChartEntries.where('centerId').equals(centerId).toArray();
      const ledger = await offlineDb.ledger.where('centerId').equals(centerId).toArray();

      const payload: BackupPayload = {
        version: '1.0',
        backupDate: Date.now(),
        centerId,
        tables: {
          collections,
          farmers,
          rateCharts,
          rateChartEntries,
          ledger
        }
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `DoodhOS_Backup_${centerId}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success('Backup exported successfully!');
    } catch (err) {
      console.error('Export backup failed:', err);
      toast.error('Failed to export backup data.');
    }
  },

  /**
   * Import database from a JSON file payload.
   */
  importBackup: async (file: File, centerId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const payload = JSON.parse(content) as BackupPayload;

          if (!payload.version || !payload.tables) {
            toast.error('Invalid backup file format');
            resolve(false);
            return;
          }

          if (payload.centerId !== centerId) {
            const proceed = window.confirm(`Warning: This backup belongs to center "${payload.centerId}" but you are logged into center "${centerId}". Do you still want to import it?`);
            if (!proceed) {
              resolve(false);
              return;
            }
          }

          // Clear local data for this center and write backup values
          // Collections
          await offlineDb.collections.where('centerId').equals(centerId).delete();
          if (payload.tables.collections?.length > 0) {
            await offlineDb.collections.bulkAdd(payload.tables.collections);
          }

          // Farmers
          await offlineDb.farmers.where('centerId').equals(centerId).delete();
          if (payload.tables.farmers?.length > 0) {
            await offlineDb.farmers.bulkAdd(payload.tables.farmers);
          }

          // Rate Charts
          await offlineDb.rateCharts.where('centerId').equals(centerId).delete();
          if (payload.tables.rateCharts?.length > 0) {
            await offlineDb.rateCharts.bulkAdd(payload.tables.rateCharts);
          }

          // Rate Chart Entries
          await offlineDb.rateChartEntries.where('centerId').equals(centerId).delete();
          if (payload.tables.rateChartEntries?.length > 0) {
            await offlineDb.rateChartEntries.bulkAdd(payload.tables.rateChartEntries);
          }

          // Ledger Entries
          await offlineDb.ledger.where('centerId').equals(centerId).delete();
          if (payload.tables.ledger?.length > 0) {
            await offlineDb.ledger.bulkAdd(payload.tables.ledger);
          }

          // Recalculate all farmer balances
          const farmers = await offlineDb.farmers.where('centerId').equals(centerId).toArray();
          for (const f of farmers) {
            await recalculateAndSyncFarmerBalance(centerId, f.id);
          }

          toast.success('Backup restored successfully!');
          resolve(true);
        } catch (err) {
          console.error('Restore backup failed:', err);
          toast.error('Failed to restore backup. Invalid JSON format.');
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  },

  /**
   * Checks if an auto backup reminder is needed (e.g. once a day)
   */
  checkAutoBackup: async (centerId: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const lastBackup = localStorage.getItem(`doodhos_last_auto_backup_${centerId}`);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (!lastBackup || now - parseInt(lastBackup, 10) > oneDay) {
      // Prompt user or run export backup automatically
      toast.info('Reminder: Please export a backup of your local dairy data to protect against database loss.', {
        action: {
          label: 'Export Now',
          onClick: () => {
            backupService.exportBackup(centerId);
            localStorage.setItem(`doodhos_last_auto_backup_${centerId}`, Date.now().toString());
          }
        },
        duration: 10000
      });
    }
  }
};
