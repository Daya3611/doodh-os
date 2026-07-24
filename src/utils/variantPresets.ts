export interface VariantPreset {
  name: string;
  multiplier: number; // Conversion multiplier in Stock Units
  isDefault?: boolean;
}

export function getPresetVariantsForUnit(stockUnit: string): VariantPreset[] {
  const normalized = (stockUnit || '').toLowerCase().trim();

  if (normalized === 'kg' || normalized === 'kilogram' || normalized === 'gram') {
    return [
      { name: '50 KG Bag', multiplier: 50 },
      { name: '25 KG Bag', multiplier: 25 },
      { name: '10 KG Bag', multiplier: 10 },
      { name: '5 KG Bag', multiplier: 5 },
      { name: '1 KG', multiplier: 1 },
      { name: '500 Gram', multiplier: 0.5 },
      { name: '250 Gram', multiplier: 0.25, isDefault: false },
      { name: 'Loose KG', multiplier: 1, isDefault: true },
    ];
  }

  if (normalized === 'liter' || normalized === 'litre' || normalized === 'l' || normalized === 'ml') {
    return [
      { name: '20 L Can', multiplier: 20 },
      { name: '10 L Can', multiplier: 10 },
      { name: '5 L Can', multiplier: 5 },
      { name: '2 L Bottle', multiplier: 2 },
      { name: '1 L Bottle', multiplier: 1, isDefault: true },
      { name: '500 ml Bottle', multiplier: 0.5 },
      { name: '250 ml Bottle', multiplier: 0.25 },
    ];
  }

  if (normalized === 'piece' || normalized === 'pcs' || normalized === 'pc' || normalized === 'packet' || normalized === 'box' || normalized === 'bag' || normalized === 'can' || normalized === 'bottle') {
    return [
      { name: 'Box of 100', multiplier: 100 },
      { name: 'Box of 50', multiplier: 50 },
      { name: 'Box of 20', multiplier: 20 },
      { name: 'Single Piece', multiplier: 1, isDefault: true },
    ];
  }

  if (normalized === 'meter' || normalized === 'mtr' || normalized === 'm') {
    return [
      { name: '100 Meter Roll', multiplier: 100 },
      { name: '50 Meter Roll', multiplier: 50 },
      { name: '10 Meter Roll', multiplier: 10 },
      { name: 'Loose Meter', multiplier: 1, isDefault: true },
    ];
  }

  // Generic fallback
  return [
    { name: `Pack of 10 ${stockUnit || 'Units'}`, multiplier: 10 },
    { name: `Single ${stockUnit || 'Unit'}`, multiplier: 1, isDefault: true },
  ];
}
