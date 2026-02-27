export function getDiaPago(dia1: string, dia2?: string): string {
  
  if (!dia2) {
    return dia1;
  }

  return `${dia1} - ${dia2}`;
}