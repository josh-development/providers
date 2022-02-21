import { blueBright } from 'colorette';
import ora from 'ora';
import prompts from 'prompts';
import { jobs } from './jobs.mjs';

const response = await prompts([
  { type: 'text', name: 'name', message: "What's the name of your provider?", initial: 'mydb' },
  { type: 'text', name: 'title', message: "What's the title case name of your provider?", initial: 'MyDB' },
  { type: 'text', name: 'description', message: 'Write a short description of your provider', initial: 'A Josh provider' },
  {
    type: 'select',
    name: 'umd',
    message: 'Can your provider be used in a browser?',
    choices: [
      { title: 'Yes', value: true },
      { title: 'No', value: false }
    ]
  }
]);

if (response.name === undefined) process.exit(1);
if (response.title === undefined) process.exit(1);
if (response.umd === undefined) process.exit(1);

for (const job of jobs) {
  const spinner = ora(job.description).start();

  await job.callback({ name: response.name, title: response.title, description: response.description, umd: response.umd }).catch((error) => {
    spinner.fail(error.message);
    console.log(error);
    process.exit(1);
  });

  spinner.succeed();
}

console.log(blueBright('Done!'));
