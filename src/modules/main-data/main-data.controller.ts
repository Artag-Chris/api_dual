import { Request, Response } from 'express';
import MainDataService from './main-data.service';

export class MainDataController {
  constructor(
    private readonly mainDataService = MainDataService.getInstance()
  ) {}

  getAll = async (req: Request, res: Response) => {
    try {
      const data = await this.mainDataService.getAllTransformedData();
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
      const data = await this.mainDataService.getTransformedDataById(id);
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
      const data = await this.mainDataService.createTransformedData(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
