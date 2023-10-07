import { Controller, Get, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { EditorService } from './editor.service';

@Controller()
export class DownloadController {
    constructor(
        private readonly editorService: EditorService,
    ){}

  @Get('download')
  async downloadFile(@Res() res: Response) {
    try {
        const outputFileName = await this.editorService.getSharedData();
        //filepath is server's ./videos/${outputFileName}.mp4
        const filePath = path.join(__dirname, '..', '..', 'videos', `${outputFileName}.mp4`);
        const stat = fs.statSync(filePath);

        res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
        }
    } 
}

