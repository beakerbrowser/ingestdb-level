# level-secondary

Secondary indexes for leveldb.

[![build status](https://secure.travis-ci.org/juliangruber/level-secondary.png)](http://travis-ci.org/juliangruber/level-secondary)

## Example

Create 2 indexes on top of a posts database.

```js
var level = require('level');
var Secondary = require('level-secondary');
var sub = require('level-sublevel');

var db = sub(level(__dirname + '/db', {
  valueEncoding: 'json'
}));

var posts = db.sublevel('posts');

// add a title index
posts.byTitle = Secondary(posts, 'title');

// add a length index
// append the post.id for unique indexes with possibly overlapping values
posts.byLength = Secondary(posts, 'length', function(post){
  return post.body.length + '!' + post.id;
});

posts.put('1337', {
  id: '1337',
  title: 'a title',
  body: 'lorem ipsum'
}, function(err) {
  if (err) throw err;

  posts.byTitle.get('a title', function(err, post) {
    if (err) throw err;
    console.log('get', post);
    // => get: { id: '1337', title: 'a title', body: 'lorem ipsum' }

    posts.del('1337', function(err) {
      if (err) throw err;
      posts.byTitle.get('a title', function(err) {
        console.log(err.name);
        // => NotFoundError
      });
    });
  });

  posts.byLength.createReadStream({
    start: 10,
    end: 20
  }).on('data', console.log.bind(console, 'read'));
  // => read { key: '1337', value: { id: '1337', title: 'a title', body: 'lorem ipsum' } }

  posts.byLength.createKeyStream({
    start: 10,
    end: 20
  }).on('data', console.log.bind(console, 'key'));
  // => key 1337

  posts.byLength.createValueStream({
    start: 10,
    end: 20
  }).on('data', console.log.bind(console, 'value'));
  // => value { id: '1337', title: 'a title', body: 'lorem ipsum' }
});
```

## API

### Secondary(db, name[, reduce])

Return a secondary index that either indexes property `name` or uses a custom
`reduce` function to map values to indexes.

### Secondary#updateIndex(key, value, cb)

Update the index data for the given key/value. (Must be done on put to keep the index correct.)

### Secondary#removeIndex(key, value, cb)

Remove the index data for the given key/value. (Must be done on del to keep the index correct.)

### Secondary#get(key, opts[, cb])

Get the value that has been indexed with `key`.

### Secondary#create{Key,Value,Read}Stream(opts)

Create a readable stream that has indexes as keys and indexed data as values.

## License

(MIT)

Copyright (c) 2017 Paul Frazee &lt;pfrazee@gmail.com&gt;
Copyright (c) 2013 Julian Gruber &lt;julian@juliangruber.com&gt;

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
