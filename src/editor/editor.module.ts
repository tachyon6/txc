import { Module } from '@nestjs/common';
import { DownloadController } from './editor.controller';
import { EditorResolver } from './editor.resolver';
import { EditorService } from './editor.service';

@Module({
  providers: [
    EditorResolver,
    EditorService
  ],
  controllers: [
    DownloadController
  ]

})

export class EditorModule{}
