import { Args, Query, Mutation, Resolver } from '@nestjs/graphql';
import { InputOfOneVideo } from './editor.interface';
import { EditorService } from './editor.service';

@Resolver()
export class EditorResolver {
    constructor(
        private readonly editorService: EditorService,
    ){}

    @Query()
    async helloWorld(): Promise<string> {
        return 'Hello World!';
    }

    @Mutation()
    async processVideo(
        @Args('user_input') userInputs: InputOfOneVideo[],
    ): Promise<any> {
        return this.editorService.processVideo(userInputs);
    }

}
