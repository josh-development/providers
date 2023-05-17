import { faker } from '@faker-js/faker';

export function createCard(i: number) {
  return {
    id: i.toString(),
    net: 0,
    ids: [],
    name: faker.person.fullName(),
    username: faker.internet.userName(),
    email: faker.internet.email(),
    address: {
      streetA: faker.location.street(),
      streetB: faker.location.streetAddress(),
      streetC: faker.location.streetAddress(true),
      streetD: faker.location.secondaryAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      country: faker.location.country(),
      zipCode: faker.location.zipCode(),
      geo: {
        lat: faker.location.latitude(),
        lng: faker.location.longitude()
      }
    },
    phone: faker.phone.number(),
    website: faker.internet.domainName(),
    company: {
      name: faker.company.name(),
      catchPhrase: faker.company.catchPhrase(),
      bs: faker.company.name()
    },
    posts: [
      {
        words: faker.lorem.words(),
        sentence: faker.lorem.sentence(),
        sentences: faker.lorem.sentences(),
        paragraph: faker.lorem.paragraph()
      },
      {
        words: faker.lorem.words(),
        sentence: faker.lorem.sentence(),
        sentences: faker.lorem.sentences(),
        paragraph: faker.lorem.paragraph()
      },
      {
        words: faker.lorem.words(),
        sentence: faker.lorem.sentence(),
        sentences: faker.lorem.sentences(),
        paragraph: faker.lorem.paragraph()
      }
    ]
  };
}
