import { faker } from '@faker-js/faker';

export function createCard(i: number) {
  return {
    id: i.toString(),
    net: 0,
    ids: [],
    name: faker.name.findName(),
    username: faker.internet.userName(),
    email: faker.internet.email(),
    address: {
      streetA: faker.address.street(),
      streetB: faker.address.streetAddress(),
      streetC: faker.address.streetAddress(true),
      streetD: faker.address.secondaryAddress(),
      city: faker.address.city(),
      state: faker.address.state(),
      country: faker.address.country(),
      zipCode: faker.address.zipCode(),
      geo: {
        lat: faker.address.latitude(),
        lng: faker.address.longitude()
      }
    },
    phone: faker.phone.number(),
    website: faker.internet.domainName(),
    company: {
      name: faker.company.companyName(),
      catchPhrase: faker.company.catchPhrase(),
      bs: faker.company.bs()
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
