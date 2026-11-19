
var shareImageButton = document.querySelector('#share-image-button');
var createPostArea = document.querySelector('#create-post');
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
var sharedMomentsArea = document.querySelector('#shared-moments');
var form = document.querySelector('form');
var titleInput = document.querySelector('#title');
var locationInput = document.querySelector('#location');

// ========================================
// CONFIGURACION FIREBASE
// ========================================

var url = 'https://mi-proyecto-pwa-default-rtdb.firebaseio.com/post.json';

var imageUrl = 'https://xrpdeyestnhgcnoljqmv.supabase.co/storage/v1/object/public/imagenes/47478.jpg';

var networkDataReceived = false;


// ========================================
// ABRIR MODAL
// ========================================

function openCreatePostModal() {
  createPostArea.style.transform = 'translateY(0)';

  if (typeof deferredPrompt !== 'undefined' && deferredPrompt) {
    deferredPrompt.prompt();

    deferredPrompt.userChoice.then(function(choiceResult) {
      console.log(choiceResult.outcome);

      if (choiceResult.outcome === 'dismissed') {
        console.log('User cancelled installation');
      } else {
        console.log('User added to home screen');
      }
    });

    deferredPrompt = null;
  }
}


// ========================================
// CERRAR MODAL
// ========================================

function closeCreatePostModal() {
  createPostArea.style.transform = 'translateY(100vh)';
}

shareImageButton.addEventListener('click', openCreatePostModal);

closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);


// ========================================
// LIMPIAR TARJETAS
// ========================================

function clearCards() {
  while (sharedMomentsArea.hasChildNodes()) {
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
  }
}


// ========================================
// CREAR TARJETA
// ========================================

function createCard(data) {
  var cardWrapper = document.createElement('div');
  cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';

  var cardTitle = document.createElement('div');
  cardTitle.className = 'mdl-card__title';

  // Utilizar imagen nueva para publicaciones
  // antiguas que tengan URLs incorrectas.

  var imagenPublicacion = data.image;

  // Si no tiene imagen, o tiene 'XXXX' o la antigua de sf-boat, usamos la imagen de respaldo
  if (!imagenPublicacion || imagenPublicacion === 'XXXX' || imagenPublicacion.indexOf('sf-boat.jpg') !== -1) {
    imagenPublicacion = '/src/images/main-image.jpg';
  }

  cardTitle.style.backgroundImage = 'url("' + imagenPublicacion + '")';
  cardTitle.style.backgroundSize = 'cover';
  cardTitle.style.backgroundPosition = 'center';
  cardTitle.style.height = '180px';

  cardWrapper.appendChild(cardTitle);

  var cardTitleTextElement = document.createElement('h2');
  cardTitleTextElement.style.color = 'white';
  cardTitleTextElement.className = 'mdl-card__title-text';
  cardTitleTextElement.textContent = data.title;

  cardTitle.appendChild(cardTitleTextElement);

  var cardSupportingText = document.createElement('div');
  cardSupportingText.className = 'mdl-card__supporting-text';
  cardSupportingText.textContent = data.location;
  cardSupportingText.style.textAlign = 'center';

  cardWrapper.appendChild(cardSupportingText);

  if (typeof componentHandler !== 'undefined') {
    componentHandler.upgradeElement(cardWrapper);
  }

  sharedMomentsArea.appendChild(cardWrapper);
}


// ========================================
// ACTUALIZAR INTERFAZ
// ========================================

function updateUI(data) {
  clearCards();

  if (!data || !Array.isArray(data)) {
    return;
  }

  for (var i = 0; i < data.length; i++) {
    createCard(data[i]);
  }
}


// ========================================
// NOTIFICACIONES (TOAST / SNACKBAR)
// ========================================

function showNotification(message) {
  var snackbarContainer = document.querySelector('#confirmation-toast');
  if (snackbarContainer && snackbarContainer.MaterialSnackbar) {
    snackbarContainer.MaterialSnackbar.showSnackbar({
      message: message,
      timeout: 3500
    });
  }
}


// ========================================
// OBTENER PUBLICACIONES FIREBASE
// ========================================

function loadPostsFromNetwork() {
  return fetch(url)
    .then(function(res) {
      if (!res.ok) {
        throw new Error('Error al obtener publicaciones');
      }

      return res.json();
    })
    .then(function(data) {
      networkDataReceived = true;

      console.log('From web', data);

      var dataArray = [];

      if (data) {
        for (var key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            dataArray.push(data[key]);
          }
        }
      }

      updateUI(dataArray);
      return dataArray;
    })
    .catch(function(err) {
      console.log('Error al obtener datos de Firebase:', err);
    });
}

// Carga inicial desde red y sincronización pendiente
loadPostsFromNetwork();
syncPendingPosts();


// ========================================
// SINCRONIZACION MANUAL DE POSTS PENDIENTES
// ========================================

function syncPendingPosts() {
  if ('indexedDB' in window) {
    readAllData('sync-posts')
      .then(function(data) {
        if (data && data.length > 0) {
          console.log('[Sync] Posts pendientes encontrados:', data.length);
          data.forEach(function(dt) {
            fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                id: dt.id,
                title: dt.title,
                location: dt.location,
                image: dt.image || imageUrl
              })
            })
            .then(function(res) {
              if (res.ok) {
                console.log('[Sync] Post sincronizado:', dt.id);
                deleteItemFromData('sync-posts', dt.id);
                loadPostsFromNetwork();
              }
            })
            .catch(function(err) {
              console.log('[Sync] Error al sincronizar:', err);
            });
          });
        }
      });
  }
}


// ========================================
// DETECTAR ESTADO DE CONEXION (ONLINE / OFFLINE)
// ========================================

window.addEventListener('offline', function() {
  console.log('Sin conexión a internet');
  showNotification('Sin conexión a internet. Mostrando contenido en caché.');
});

window.addEventListener('online', function() {
  console.log('Conexión recuperada');
  showNotification('Conexión reestablecida. Sincronizando datos...');
  // Sincronizar posts pendientes si se guardaron offline
  syncPendingPosts();
  // Carga instantánea de publicaciones e imágenes sin recargar la página
  loadPostsFromNetwork();
});


// ========================================
// OBTENER PUBLICACIONES INDEXEDDB
// ========================================

if ('indexedDB' in window) {
  readAllData('posts')
    .then(function(data) {
      if (!networkDataReceived) {
        console.log('From cache', data);
        updateUI(data);
      }
    })
    .catch(function(err) {
      console.log('Error al leer IndexedDB:', err);
    });
}


// ========================================
// ENVIAR PUBLICACION FIREBASE
// ========================================

function sendData() {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      id: new Date().toISOString(),
      title: titleInput.value,
      location: locationInput.value,
      image: imageUrl
    })
  })
  .then(function(res) {
    if (!res.ok) {
      throw new Error('Error al enviar los datos');
    }

    return res.json();
  })
  .then(function(data) {
    console.log('Sent data', data);
    window.location.reload();
  })
  .catch(function(err) {
    console.log('Error al enviar datos:', err);
  });
}


// ========================================
// ENVIAR FORMULARIO
// ========================================

form.addEventListener('submit', function(event) {
  event.preventDefault();

  if (titleInput.value.trim() === '' ||
      locationInput.value.trim() === '') {

    alert('Por favor, ingresa un título y una ubicación.');
    return;
  }

  var post = {
    id: new Date().toISOString(),
    title: titleInput.value.trim(),
    location: locationInput.value.trim(),
    image: imageUrl
  };

  closeCreatePostModal();

  // ========================================
  // BACKGROUND SYNC
  // ========================================

  if ('serviceWorker' in navigator &&
      'SyncManager' in window &&
      'indexedDB' in window) {

    navigator.serviceWorker.ready
      .then(function(sw) {

        if (!sw.sync) {
          throw new Error('Background Sync no disponible');
        }

        return writeData('sync-posts', post)
          .then(function() {
            return sw.sync.register('sync-new-posts');
          })
          .then(function() {
            showNotification('Tu publicación se ha guardado para sincronizar.');
            console.log('Publicación guardada para sincronizar');
          });
      })
      .catch(function(err) {
        console.log('Error en SyncManager, guardando en IndexedDB:', err);
        writeData('sync-posts', post).then(function() {
          showNotification('Sin conexión: se enviará automáticamente al reconectarse.');
        });
      });

  } else if (!navigator.onLine && 'indexedDB' in window) {
    writeData('sync-posts', post)
      .then(function() {
        showNotification('Sin conexión: guardado localmente para enviar al volver la red.');
      });
  } else {
    sendData();
  }
});
