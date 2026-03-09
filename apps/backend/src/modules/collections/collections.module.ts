import { Module } from '@nestjs/common'
import { CollectionsService } from './collections.service'
import { PersonalCollectionService } from './personal-collection.service'

@Module({
  providers: [CollectionsService, PersonalCollectionService],
  exports: [CollectionsService, PersonalCollectionService],
})
export class CollectionsModule {}
