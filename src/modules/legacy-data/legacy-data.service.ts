import { prismaLegacyService } from '../../database/legacy/prisma-legacy.service';

/**************************************************************************************************
 * Servicio para datos Legacy
 * 
 * Servicio para operaciones CRUD en la base de datos legacy
 ***************************************************************************************************/

class LegacyDataService {
  private static instance: LegacyDataService;

  constructor() {}

  public static getInstance(): LegacyDataService {
    if (!LegacyDataService.instance) {
      LegacyDataService.instance = new LegacyDataService();
    }
    return LegacyDataService.instance;
  }

  async getAllSomething() {
    return await prismaLegacyService.something.findMany();
  }

  async getSomethingById(id: string) {
    return await prismaLegacyService.something.findUnique({
      where: { id }
    });
  }

  async createSomething(data: { id: string; message: string }) {
    return await prismaLegacyService.something.create({
      data
    });
  }

  async updateSomething(id: string, message: string) {
    return await prismaLegacyService.something.update({
      where: { id },
      data: { message }
    });
  }

  async deleteSomething(id: string) {
    return await prismaLegacyService.something.delete({
      where: { id }
    });
  }
}

export default LegacyDataService;
