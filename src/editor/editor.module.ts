import { Module } from '@nestjs/common';
import { EditorResolver } from './editor.resolver';
import { EditorService } from './editor.service';

@Module({
  providers: [
    EditorResolver,
    EditorService]

})

export class EditorModule{}
