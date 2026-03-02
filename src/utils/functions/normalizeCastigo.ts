export function normalizeCastigo(value: any): 'SI' | 'NO' {
  if (value === null || value === undefined) return 'NO';
  
  const stringValue = String(value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  const siValues = ['SI', 'S', 'YES', 'Y', 'SÍ', 'TRUE', '1', 'CASTIGO', 'CASTIGADA', 'CASTIGADO', 'VERDADERO'];
  if (siValues.includes(stringValue)) return 'SI';
  
  const noValues = ['NO', 'N', 'FALSE', 'F', 'NOT', 'FALSO', '0', 'INCOBRABLE', 'NO_CASTIGO'];
  if (noValues.includes(stringValue)) return 'NO';
  
  return 'NO'; // Safe fallback
}
