var level = require('memdb');
var Secondary = require('..');
var sub = require('level-sublevel');
var test = require('tape');

test('read streams', function(t) {
  t.plan(5);
  var db = sub(level({ valueEncoding: 'json' }));

  var posts = db.sublevel('posts');
  posts.byTitle = Secondary(posts, 'title');
  posts.byLength = Secondary(posts, 'length', function(post){
    return post.body.length;
  });

  var post = {
    title: 'a title',
    body: 'lorem ipsum'
  };

  posts.put('1337', post, function(err) {
    t.error(err);

    posts.byLength.updateIndex('1337', post, function (err) {
      t.error(err);

      posts.byLength.createReadStream({
        start: 10,
        end: 20
      }).on('data', function(data) {
        t.deepEqual(data, {
          key: '1337',
          value: post
        });
      });

      posts.byLength.createKeyStream({
        start: 10,
        end: 20
      }).on('data', function(data) {
        t.equal(data, '1337');
      });

      posts.byLength.createValueStream({
        start: 10,
        end: 20
      }).on('data', function(data) {
        t.deepEqual(data, post);
      });
    })
  });
});

test('read streams conflicting values', function(t) {
  t.plan(7);
  var db = sub(level({ valueEncoding: 'json' }));

  var posts = db.sublevel('posts');
  posts.byTitle = Secondary(posts, 'title');

  posts.put('1337', {title: 'a title', foo: 'bar'}, function(err) {
    t.error(err);

    posts.byTitle.updateIndex('1337', {title: 'a title', foo: 'bar'}, function (err) {
      t.error(err);

      posts.put('1338', {title: 'a title', foo: 'baz'}, function(err) {
        t.error(err);

        posts.byTitle.updateIndex('1338', {title: 'a title', foo: 'baz'}, function (err) {
          t.error(err);

          var datas1 = []
          posts.byTitle.createReadStream({
            lte: 'a title',
            gte: 'a title'
          }).on('data', function(data) {
            datas1.push(data)
            if (datas1.length === 2) {
              t.deepEqual(datas1, [{
                key: '1337',
                value: {title: 'a title', foo: 'bar'}
              },{
                key: '1338',
                value: {title: 'a title', foo: 'baz'}
              }]);
            }
          });

          var datas2 = []
          posts.byTitle.createKeyStream({
            lte: 'a title',
            gte: 'a title'
          }).on('data', function(data) {
            datas2.push(data)
            if (datas2.length === 2) {
              t.deepEqual(datas2, ['1337', '1338']);
            }
          });

          var datas3 = []
          posts.byTitle.createValueStream({
            lte: 'a title',
            gte: 'a title'
          }).on('data', function(data) {
            datas3.push(data)
            if (datas3.length === 2) {
              t.deepEqual(datas3, [{
                title: 'a title', foo: 'bar'
              },{
                title: 'a title', foo: 'baz'
              }]);
            }
          });
        })
      })
    });
  });
});
