const jsdoc2md = require('jsdoc-to-markdown');
const fs = require('fs');
const slug = require('limax');

var htmlEntities = {
  nbsp: ' ',
  cent: '¢',
  pound: '£',
  yen: '¥',
  euro: '€',
  copy: '©',
  reg: '®',
  lt: '<',
  gt: '>',
  quot: '"',
  amp: '&',
  apos: '\'',
};

// eslint-disable-next-line
const unescapeHTML = str => str.replace(/\&([^;]+);/g, (entity, entityCode) => {
  let match;

  if (entityCode in htmlEntities) {
    return htmlEntities[entityCode];
    /* eslint no-cond-assign: 0 */
  } else if (match = entityCode.match(/^#x([\da-fA-F]+)$/)) {
    return String.fromCharCode(parseInt(match[1], 16));
    /* eslint no-cond-assign: 0 */
  } else if (match = entityCode.match(/^#(\d+)$/)) {
    // eslint-disable-next-line
    return String.fromCharCode(~~match[1]);
  } else {
    return entity;
  }
});

const finalize = str => str
  .replace(/\[<code>Promise\.&lt;JoshProvider&gt;<\/code >\](#JoshProvider)/gi, '[<code>Promise.&lt;JoshProvider&gt;</code>](#joshprovider)')
  .replace(/\[<code>JoshProvider<\/code>\]\(#JoshProvider\)/gi, '[<code>JoshProvider</code>](#joshprovider)')
  .replace('* [new JoshProvider([options])](#new_JoshProvider_new)', '* [new JoshProvider([options])](#new-joshprovider-options)');

const regexread = /^ {4}\* \[\.(.*?)\]\((.*?)\)(.*?)(\(#.*?\)|)$/gm;

// eslint-disable-next-line
const parseData = data => finalize(data.replace(regexread, (_, b, __, d) =>
  `    * [.${b}](#${slug(`joshprovider.${b} ${unescapeHTML(d.replace(/<\/?code>/g, ''))}`)})${d}`));

jsdoc2md.render({ files: './base_provider.js' }).then(data => {
  console.log(data);
  fs.writeFile('./provider_docs.md', parseData(data), () => false);
});
