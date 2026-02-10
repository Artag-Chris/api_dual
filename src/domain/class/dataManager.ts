/**
 * DataManager - Stub temporal
 * Este archivo es un placeholder para permitir la compilación
 */

export class DataManager {
  private static instance: DataManager;

  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  async updateClientCategory(clientId: string, category: string) {
    // Implementar lógica de actualización de categoría
    console.log(`Updating client ${clientId} to category ${category}`);
  }
}
