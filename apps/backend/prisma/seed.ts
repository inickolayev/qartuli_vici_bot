/* eslint-disable no-console */
import { PrismaClient, Difficulty, CollectionType, PartOfSpeech } from '@prisma/client'

const prisma = new PrismaClient()

const BASIC_GEORGIAN_WORDS = [
  // Greetings & Basic Phrases
  {
    georgian: 'გამარჯობა',
    russianPrimary: 'привет',
    russianAlt: ['здравствуй', 'здравствуйте'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.INTERJECTION,
  },
  {
    georgian: 'ნახვამდის',
    russianPrimary: 'до свидания',
    russianAlt: ['пока'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.INTERJECTION,
  },
  {
    georgian: 'მადლობა',
    russianPrimary: 'спасибо',
    russianAlt: ['благодарю'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.INTERJECTION,
  },
  {
    georgian: 'დიახ',
    russianPrimary: 'да',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.PARTICLE,
  },
  {
    georgian: 'არა',
    russianPrimary: 'нет',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.PARTICLE,
  },
  {
    georgian: 'კარგი',
    russianPrimary: 'хорошо',
    russianAlt: ['хороший', 'ладно'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADJECTIVE,
  },
  {
    georgian: 'ცუდი',
    russianPrimary: 'плохой',
    russianAlt: ['плохо'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADJECTIVE,
  },
  {
    georgian: 'ბოდიში',
    russianPrimary: 'извините',
    russianAlt: ['простите', 'прости'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.INTERJECTION,
  },

  // Numbers
  {
    georgian: 'ერთი',
    russianPrimary: 'один',
    russianAlt: ['1'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NUMERAL,
  },
  {
    georgian: 'ორი',
    russianPrimary: 'два',
    russianAlt: ['2'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NUMERAL,
  },
  {
    georgian: 'სამი',
    russianPrimary: 'три',
    russianAlt: ['3'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NUMERAL,
  },
  {
    georgian: 'ოთხი',
    russianPrimary: 'четыре',
    russianAlt: ['4'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NUMERAL,
  },
  {
    georgian: 'ხუთი',
    russianPrimary: 'пять',
    russianAlt: ['5'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NUMERAL,
  },

  // Pronouns
  {
    georgian: 'მე',
    russianPrimary: 'я',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.PRONOUN,
  },
  {
    georgian: 'შენ',
    russianPrimary: 'ты',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.PRONOUN,
  },
  {
    georgian: 'ის',
    russianPrimary: 'он',
    russianAlt: ['она', 'оно'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.PRONOUN,
  },
  {
    georgian: 'ჩვენ',
    russianPrimary: 'мы',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.PRONOUN,
  },
  {
    georgian: 'თქვენ',
    russianPrimary: 'вы',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.PRONOUN,
  },

  // Common Nouns
  {
    georgian: 'წყალი',
    russianPrimary: 'вода',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'პური',
    russianPrimary: 'хлеб',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ღვინო',
    russianPrimary: 'вино',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'სახლი',
    russianPrimary: 'дом',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'კაცი',
    russianPrimary: 'мужчина',
    russianAlt: ['человек'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ქალი',
    russianPrimary: 'женщина',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ბავშვი',
    russianPrimary: 'ребёнок',
    russianAlt: ['ребенок', 'дитя'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'დედა',
    russianPrimary: 'мама',
    russianAlt: ['мать'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'მამა',
    russianPrimary: 'папа',
    russianAlt: ['отец'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ძმა',
    russianPrimary: 'брат',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'და',
    russianPrimary: 'сестра',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'მეგობარი',
    russianPrimary: 'друг',
    russianAlt: ['подруга'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },

  // Common Verbs
  {
    georgian: 'მიყვარს',
    russianPrimary: 'люблю',
    russianAlt: ['я люблю'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'მინდა',
    russianPrimary: 'хочу',
    russianAlt: ['я хочу'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'შემიძლია',
    russianPrimary: 'могу',
    russianAlt: ['я могу'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვიცი',
    russianPrimary: 'знаю',
    russianAlt: ['я знаю'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'მაქვს',
    russianPrimary: 'имею',
    russianAlt: ['у меня есть', 'я имею'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },

  // Common Adjectives
  {
    georgian: 'დიდი',
    russianPrimary: 'большой',
    russianAlt: ['большая', 'большое'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADJECTIVE,
  },
  {
    georgian: 'პატარა',
    russianPrimary: 'маленький',
    russianAlt: ['маленькая', 'маленькое', 'малый'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADJECTIVE,
  },
  {
    georgian: 'ლამაზი',
    russianPrimary: 'красивый',
    russianAlt: ['красивая', 'прекрасный'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADJECTIVE,
  },
  {
    georgian: 'ახალი',
    russianPrimary: 'новый',
    russianAlt: ['новая', 'новое'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADJECTIVE,
  },
  {
    georgian: 'ძველი',
    russianPrimary: 'старый',
    russianAlt: ['старая', 'старое'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADJECTIVE,
  },

  // Time
  {
    georgian: 'დღეს',
    russianPrimary: 'сегодня',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADVERB,
  },
  {
    georgian: 'ხვალ',
    russianPrimary: 'завтра',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADVERB,
  },
  {
    georgian: 'გუშინ',
    russianPrimary: 'вчера',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADVERB,
  },

  // Questions
  {
    georgian: 'რა',
    russianPrimary: 'что',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.PRONOUN,
  },
  {
    georgian: 'ვინ',
    russianPrimary: 'кто',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.PRONOUN,
  },
  {
    georgian: 'სად',
    russianPrimary: 'где',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADVERB,
  },
  {
    georgian: 'როდის',
    russianPrimary: 'когда',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADVERB,
  },
  {
    georgian: 'რატომ',
    russianPrimary: 'почему',
    russianAlt: ['зачем'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADVERB,
  },
  {
    georgian: 'როგორ',
    russianPrimary: 'как',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.ADVERB,
  },
]

// Household & Everyday Life Words (Быт)
const HOUSEHOLD_WORDS = [
  // Rooms & Home
  {
    georgian: 'ოთახი',
    russianPrimary: 'комната',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'სამზარეულო',
    russianPrimary: 'кухня',
    russianAlt: [],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'საძინებელი',
    russianPrimary: 'спальня',
    russianAlt: [],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'აბაზანა',
    russianPrimary: 'ванная',
    russianAlt: ['ванна'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'კარი',
    russianPrimary: 'дверь',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ფანჯარა',
    russianPrimary: 'окно',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'კედელი',
    russianPrimary: 'стена',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'იატაკი',
    russianPrimary: 'пол',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ჭერი',
    russianPrimary: 'потолок',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },

  // Furniture
  {
    georgian: 'მაგიდა',
    russianPrimary: 'стол',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'სკამი',
    russianPrimary: 'стул',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'საწოლი',
    russianPrimary: 'кровать',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'კარადა',
    russianPrimary: 'шкаф',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'დივანი',
    russianPrimary: 'диван',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'სარკე',
    russianPrimary: 'зеркало',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },

  // Kitchen items
  {
    georgian: 'თეფში',
    russianPrimary: 'тарелка',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ჭიქა',
    russianPrimary: 'стакан',
    russianAlt: ['чашка'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'კოვზი',
    russianPrimary: 'ложка',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ჩანგალი',
    russianPrimary: 'вилка',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'დანა',
    russianPrimary: 'нож',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ქვაბი',
    russianPrimary: 'кастрюля',
    russianAlt: [],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'მაცივარი',
    russianPrimary: 'холодильник',
    russianAlt: [],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.NOUN,
  },

  // Appliances & Items
  {
    georgian: 'ტელევიზორი',
    russianPrimary: 'телевизор',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ტელეფონი',
    russianPrimary: 'телефон',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'კომპიუტერი',
    russianPrimary: 'компьютер',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'ნათურა',
    russianPrimary: 'лампочка',
    russianAlt: ['лампа'],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },
  {
    georgian: 'გასაღები',
    russianPrimary: 'ключ',
    russianAlt: [],
    difficulty: Difficulty.EASY,
    partOfSpeech: PartOfSpeech.NOUN,
  },

  // Everyday Verbs
  {
    georgian: 'ვჭამ',
    russianPrimary: 'ем',
    russianAlt: ['я ем', 'кушаю'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვსვამ',
    russianPrimary: 'пью',
    russianAlt: ['я пью'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვძინავ',
    russianPrimary: 'сплю',
    russianAlt: ['я сплю'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვიღვიძებ',
    russianPrimary: 'просыпаюсь',
    russianAlt: ['я просыпаюсь'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვხარშავ',
    russianPrimary: 'готовлю',
    russianAlt: ['я готовлю', 'варю'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვრეცხავ',
    russianPrimary: 'мою',
    russianAlt: ['я мою', 'стираю'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვასუფთავებ',
    russianPrimary: 'убираю',
    russianAlt: ['я убираю', 'чищу'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვხსნი',
    russianPrimary: 'открываю',
    russianAlt: ['я открываю'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვკეტავ',
    russianPrimary: 'закрываю',
    russianAlt: ['я закрываю'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვზივარ',
    russianPrimary: 'сижу',
    russianAlt: ['я сижу'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვდგავარ',
    russianPrimary: 'стою',
    russianAlt: ['я стою'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვწევარ',
    russianPrimary: 'лежу',
    russianAlt: ['я лежу'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
  {
    georgian: 'ვმუშაობ',
    russianPrimary: 'работаю',
    russianAlt: ['я работаю'],
    difficulty: Difficulty.MEDIUM,
    partOfSpeech: PartOfSpeech.VERB,
  },
]

async function main() {
  console.log('Starting seed...')

  // Create default collection
  const defaultCollection = await prisma.collection.upsert({
    where: { id: 'default-basic-collection' },
    update: {},
    create: {
      id: 'default-basic-collection',
      name: 'Базовые слова',
      description: 'Основные слова и фразы для начинающих изучать грузинский язык',
      type: CollectionType.DEFAULT,
      wordCount: BASIC_GEORGIAN_WORDS.length,
    },
  })

  console.log(`Created/updated default collection: ${defaultCollection.name}`)

  // Create words
  let createdCount = 0
  let skippedCount = 0

  for (const wordData of BASIC_GEORGIAN_WORDS) {
    try {
      const word = await prisma.word.upsert({
        where: {
          georgian_russianPrimary: {
            georgian: wordData.georgian,
            russianPrimary: wordData.russianPrimary,
          },
        },
        update: {
          russianAlt: wordData.russianAlt,
          difficulty: wordData.difficulty,
          partOfSpeech: wordData.partOfSpeech,
          isPublic: true,
        },
        create: {
          georgian: wordData.georgian,
          russianPrimary: wordData.russianPrimary,
          russianAlt: wordData.russianAlt,
          georgianForms: [],
          difficulty: wordData.difficulty,
          partOfSpeech: wordData.partOfSpeech,
          tags: [],
          isPublic: true,
        },
      })

      // Add word to default collection if not already there
      await prisma.collectionWord.upsert({
        where: {
          collectionId_wordId: {
            collectionId: defaultCollection.id,
            wordId: word.id,
          },
        },
        update: {},
        create: {
          collectionId: defaultCollection.id,
          wordId: word.id,
          orderIndex: createdCount,
        },
      })

      createdCount++
    } catch (error) {
      console.log(`Skipped word: ${wordData.georgian} - ${error}`)
      skippedCount++
    }
  }

  // Update word count
  await prisma.collection.update({
    where: { id: defaultCollection.id },
    data: { wordCount: createdCount },
  })

  console.log(`Basic collection: ${createdCount} words created/updated, ${skippedCount} skipped`)

  // Create Household collection (Быт)
  const householdCollection = await prisma.collection.upsert({
    where: { id: 'default-household-collection' },
    update: {},
    create: {
      id: 'default-household-collection',
      name: 'Быт',
      description: 'Слова для повседневной жизни: дом, мебель, бытовые действия',
      type: CollectionType.DEFAULT,
      wordCount: HOUSEHOLD_WORDS.length,
    },
  })

  console.log(`Created/updated household collection: ${householdCollection.name}`)

  let householdCreatedCount = 0
  let householdSkippedCount = 0

  for (const wordData of HOUSEHOLD_WORDS) {
    try {
      const word = await prisma.word.upsert({
        where: {
          georgian_russianPrimary: {
            georgian: wordData.georgian,
            russianPrimary: wordData.russianPrimary,
          },
        },
        update: {
          russianAlt: wordData.russianAlt,
          difficulty: wordData.difficulty,
          partOfSpeech: wordData.partOfSpeech,
          isPublic: true,
        },
        create: {
          georgian: wordData.georgian,
          russianPrimary: wordData.russianPrimary,
          russianAlt: wordData.russianAlt,
          georgianForms: [],
          difficulty: wordData.difficulty,
          partOfSpeech: wordData.partOfSpeech,
          tags: ['быт', 'повседневный'],
          isPublic: true,
        },
      })

      await prisma.collectionWord.upsert({
        where: {
          collectionId_wordId: {
            collectionId: householdCollection.id,
            wordId: word.id,
          },
        },
        update: {},
        create: {
          collectionId: householdCollection.id,
          wordId: word.id,
          orderIndex: householdCreatedCount,
        },
      })

      householdCreatedCount++
    } catch (error) {
      console.log(`Skipped household word: ${wordData.georgian} - ${error}`)
      householdSkippedCount++
    }
  }

  await prisma.collection.update({
    where: { id: householdCollection.id },
    data: { wordCount: householdCreatedCount },
  })

  console.log(
    `Household collection: ${householdCreatedCount} words created/updated, ${householdSkippedCount} skipped`,
  )
  console.log(`Seed completed!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
