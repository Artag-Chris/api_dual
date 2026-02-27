export function getTasabyPeriocidad(tasa: string, periocidad: string): number {
  
  const periocidadUpper = periocidad.toUpperCase().trim();
  
  // Convertir la tasa de string a número
  const tasaNum = parseFloat(tasa);
  
  // Verificar que la conversión sea válida
  if (isNaN(tasaNum)) {
    return 0; // Retornar 0 si no es un número válido
  }
  
  // Función auxiliar para redondear a 4 decimales y evitar flotantes
  const redondear = (valor: number): number => {
    return Math.round(valor * 10000) / 10000;
  };
  
  // Caso MENSUAL
  if (periocidadUpper === 'MENSUAL') {
    
    if (tasaNum < 1) {
      // Tasa en formato decimal (0.0188 → 1.88)
      return redondear(tasaNum * 100); 
    }
    
    // Tasa >= 1 ya está en porcentaje (1.88 = 1.88%)
    return redondear(tasaNum); 
  }
  
  // Caso QUINCENAL (aplicar factor x2 solo si es formato decimal)
  if (periocidadUpper === 'QUINCENAL') {
    
    if (tasaNum < 1) {
      // Tasa en formato decimal (0.0188 → 3.76 quincenal)
      return redondear(tasaNum * 2 * 100); 
    }
    
    // Tasa >= 1 ya está en porcentaje y ajustada para quincenal (1.88 = 1.88%)
    return redondear(tasaNum); 
  }
  

  return redondear(tasaNum);
}