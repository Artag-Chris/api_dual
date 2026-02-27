export function getDatacreditScore(id: number | null | undefined): string {
  
  // Si el id es null, undefined, o no es un número válido
  if (id === null || id === undefined || isNaN(id)) {
    return 'Sin Exp';
  }
  
  const scoreMap: Record<number, string> = {
    5: '800',
    4: '700',
    3: '600',
    2: '500',
    1: '0',//Reportado
    0: '0'//Sin Exp
  };
  
  return scoreMap[id] || '0';
}