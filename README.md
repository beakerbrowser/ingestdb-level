# injestdb-level

Secondary indexes and promisification for leveldb.

## Example

```js
const level = require('level')
const injestdbLevel = require('injestdb-level')
const sub = require('level-sublevel')

const db = injestdbLevel(sub(level(__dirname + '/db', {
  valueEncoding: 'json'
})), ['lastName', 'lastName+firstName', '*attributes'])


const PAUL = {firstName: 'Paul', lastName: 'Frazee', attributes: ['ginger', 'hacker']}
const JACK = {firstName: 'Jack', lastName: 'Frazee', attributes: ['ginger', 'lawyer']}
const TARA = {firstName: 'Tara', lastName: 'Vancil', attributes: ['brunette', 'hacker']}

await db.put(1, PAUL)
await db.put(2, JACK)
await db.put(3, TARA)

await db.get(1) // => PAUL
await db.indexes.lastName.get('Vancil') // => TARA
await db.indexes['lastName+firstName'].get(['Frazee', 'Jack']) // => JACK
await db.indexes.attributes.get('hacker') // => PAUL
db.createValueStream() // => [PAUL, JACK, TARA]
db.indexes.lastName.createValueStream({gt: 'Frazee'}) // => [TARA]
db.indexes['lastName+firstName'].createValueStream({gte: ['Frazee']}) // => [JACK, PAUL, TARA]
db.indexes.attributes.createValueStream({gte: 'hacker', lte: 'hacker'}) // => [PAUL, TARA]

JACK.attributes.push('hacker')
await db.put(2, JACK)

db.indexes.attributes.createValueStream({gte: 'hacker', lte: 'hacker'}) // => [PAUL, TARA, JACK]
```

## API

```js
const injestdbLevel = require('injestdb-level')
const db = injestdbLevel(level, indexesSpec)
await db.get(key, opts)
await db.put(key, value, opts)
await db.del(key, opts)
db.createReadStream(opts)
db.createKeyStream(opts)
db.createValueStream(opts)
await db.indexes[...].get(key, opts)
db.indexes[...].createReadStream(opts)
db.indexes[...].createKeyStream(opts)
db.indexes[...].createValueStream(opts)
```

## License

(MIT)

Copyright (c) 2017 Paul Frazee &lt;pfrazee@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
