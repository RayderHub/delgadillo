importScripts('/src/js/idb.js');
importScripts('/src/js/utility.js');

var CACHE_STATIC_NAME = 'static-v12';
var CACHE_DYNAMIC_NAME = 'dynamic-v6';
var STATIC_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/src/js/app.js',
  '/src/js/feed.js',
  '/src/js/idb.js',
  '/src/css/app.css',
  '/src/css/feed.css',
  'https://fonts.googleapis.com/css?family=Roboto:400,700',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.min.js'
];


self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing Service Worker ...', event);

  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then(function(cache) {
        console.log('[Service Worker] Precaching App Shell');
            cache.addAll(STATIC_FILES);
        
      })
  );
});


// ========================================
// ACTIVATE
// ========================================

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating Service Worker ....', event);

  event.waitUntil(
    caches.keys()
      .then(function(keyList) {
        return Promise.all(
          keyList.map(function(key) {

            if (
              key !== CACHE_STATIC_NAME &&
              key !== CACHE_DYNAMIC_NAME
            ) {
              console.log('[Service Worker] Removing old cache.', key);
              return caches.delete(key);
            }

          })
        );
      })
  );

  return self.clients.claim();
});


function isInArray(string, array) {
  var cachePath;
  if (string.indexOf(self.origin) === 0) {
    console.log('matched ', string);
    // request targets domain where we serve the page from (i.e. NOT a CDN)
    cachePath = string.substring(self.origin.length); // take the part of the URL AFTER the domain (e.g. after localhost:8080)
  } else {
    cachePath = string;
  }
  return array.indexOf(cachePath) > -1;
}

// ========================================
// FETCH
// ========================================

self.addEventListener('fetch', function(event) {

  var url = 'https://mi-proyecto-pwa-default-rtdb.firebaseio.com/post.json';

  // =========================================
  // FIREBASE - NETWORK FIRST + CACHE FALLBACK
  // =========================================

 if (event.request.url.indexOf(url) > -1) {

    event.respondWith(
      fetch(event.request)
        .then(function(res) {
          var clonedRes = res.clone();

          clonedRes.json()
            .then(function(data) {
              return clearAllData('posts')
                .then(function() {
                  if (data) {
                    for (var key in data) {
                      writeData('posts', data[key]);
                    }
                  }
                });
            })
            .catch(function(err) {
              console.log('Error al guardar posts:', err);
            });

          return res;
        })
        .catch(function(err) {
          console.log('Sin conexión a Firebase:', err);
          throw err;
        })
    );

  } else if (isInArray(event.request.url, STATIC_FILES)) {

    // ARCHIVOS ESTÁTICOS
    event.respondWith(
      caches.match(event.request)
    );

  } else {

    // CACHÉ DINÁMICO
    event.respondWith(
      caches.match(event.request)
        .then(function(response) {

          if (response) {
            return response;
          }

          return fetch(event.request)
            .then(function(res) {
              return caches.open(CACHE_DYNAMIC_NAME)
                .then(function(cache) {
                  cache.put(event.request, res.clone());
                  return res;
                });
            })
            .catch(function(err) {
              return caches.open(CACHE_STATIC_NAME)
                .then(function(cache) {
                  if (event.request.headers.get('accept') &&
                      event.request.headers.get('accept').includes('text/html')) {
                    return cache.match('/offline.html');
                  }
                });
            });
        })
    );
  }
});

self.addEventListener('sync', function(event) {
  console.log('[Service Worker] Background syncing', event);  
  if (event.tag === 'sync-new-posts') {
    console.log('[Service Worker] Syncing new posts');
    event.waitUntil(
      readAllData('sync-posts')
        .then(function(data) {  
          for (var dt of data) {
            fetch('https://mi-proyecto-pwa-default-rtdb.firebaseio.com/post.json', {
              method: 'POST', 
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                id: dt.id,
                title: dt.title,
                location: dt.location,
                image: 'https://firebasestorage.googleapis.com/v0/b/uteqgram-gael.firebasestorage.app/o/main-image.jpg?alt=media&token=4fdb63e9-7b31-40e2-aa7d-b94b2ec98f69'
              })
            })
            .then(function(res) {
              console.log('Sent data', res);
              if (res.ok) {
                deleteItemFromData('sync-posts', dt.id);
              }
            })
            .catch(function(err) {
              console.log('Error while sending data', err);
            });
          }   
        })
    );
  }
});