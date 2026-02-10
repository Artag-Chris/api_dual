import { prismaMainService } from '../../database/main/prisma-main.service';

/**************************************************************************************************
 * Servicio para datos Main
 * 
 * Servicio para operaciones CRUD en la base de datos principal
 ***************************************************************************************************/

class MainDataService {
  private static instance: MainDataService;

  constructor() {}

  public static getInstance(): MainDataService {
    if (!MainDataService.instance) {
      MainDataService.instance = new MainDataService();
    }
    return MainDataService.instance;
  }

  async getAllTransformedData() {
    return await prismaMainService.transformedData.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getTransformedDataById(id: string) {
    return await prismaMainService.transformedData.findUnique({
      where: { id }
    });
  }

  async createTransformedData(data: { id?: string; content: string }) {
    return await prismaMainService.transformedData.create({
      data
    });
  }

  async updateTransformedData(id: string, content: string) {
    return await prismaMainService.transformedData.update({
      where: { id },
      data: { content }
    });
  }

  async deleteTransformedData(id: string) {
    return await prismaMainService.transformedData.delete({
      where: { id }
    });
  }
}

export default MainDataService;
