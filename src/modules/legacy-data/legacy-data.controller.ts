import { Request, Response } from 'express';
import LegacyDataService from './legacy-data.service';

export class LegacyDataController {
  constructor(
    private readonly legacyDataService = LegacyDataService.getInstance()
  ) {}

  getAll = async (req: Request, res: Response) => {
    try {
      const data = await this.legacyDataService.getAllSomething();
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = await this.legacyDataService.getSomethingById(id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const data = await this.legacyDataService.createSomething(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
