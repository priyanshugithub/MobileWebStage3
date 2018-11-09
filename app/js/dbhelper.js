const RESTAURANTS = "restaurants";
const REVIEWS = "reviews";
const OFFLINE_REVIEWS = "offline-reviews";
const OFFLINE_FAVORITES = "offline-favourites";
const port = 1337; // Change this to your server port

/**
 * Common database helper functions.
 */
class DBHelper {
  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    return `http://localhost:${port}/restaurants`;
  }

  static get RESTAURANT_REVIEW_URL() {
    return `http://localhost:${port}/reviews?restaurant_id=`;
  }

  static get POST_REVIEW_URL() {
    return `http://localhost:${port}/reviews/`;
  }
  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    showCachedRestaurants(callback).then(() => {
      fetch(this.DATABASE_URL)
        .then(response => {
          if (response.status !== 200) {
            callback("API call failed", null);
            return;
          }
          response
            .json()
            .then(data => {
              updateCache(data);
              callback(null, data);
            })
            .catch(error => callback(error, null));
        })
        .catch(error => callback(error, null));
    });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) {
          // Got the restaurant
          callback(null, restaurant);
        } else {
          // Restaurant does not exist in the database
          callback("Restaurant does not exist", null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(
    cuisine,
    neighborhood,
    callback
  ) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants;
        if (cuisine != "all") {
          // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != "all") {
          // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map(
          (v, i) => restaurants[i].neighborhood
        );
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter(
          (v, i) => neighborhoods.indexOf(v) == i
        );
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter(
          (v, i) => cuisines.indexOf(v) == i
        );
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return `./restaurant.html?id=${restaurant.id}`;
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    let image = restaurant.photograph ? restaurant.photograph : "default";
    let imagePath = `/img/${image}`;
    let imgExtension = "jpg";
    let imageSuffix = "_2x.";

    //fetch 1x images for lower resolution devices
    if (window) {
      imageSuffix = window.innerWidth < 500 ? "_1x." : "_2x.";
    }

    return imagePath + imageSuffix + imgExtension;
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker
    const marker = new L.marker(
      [restaurant.latlng.lat, restaurant.latlng.lng],
      {
        title: restaurant.name,
        alt: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant)
      }
    );
    marker.addTo(newMap);
    return marker;
  }

  static getCachedReviews(id) {
    return getDBPromise().then(db => {
      let index = db
        .transaction(REVIEWS)
        .objectStore(REVIEWS)
        .index("updatedAt");

      if (!index) return;

      return index
        .getAll()
        .then(
          reviews =>
            reviews && reviews.filter(review => review.restaurant_id === id)
        )
        .then(reviews => new Promise(resolve => resolve(reviews)));
    });
  }

  static fetchRestaurantReviews(restaurantId) {
    return fetch(this.RESTAURANT_REVIEW_URL + restaurantId)
      .then(response => response.json())
      .then(reviews => {
        updateReviewsCache(reviews);
        return reviews;
      })
      .catch(error => new Promise((resolve, reject) => reject(error)));
  }

  static postReview(review) {
    return fetch(this.POST_REVIEW_URL, {
      method: "POST",
      body: JSON.stringify(review)
    });
  }

  static toggleFavorite({ restaurantId, isFavorite }) {
    return fetch(
      `${this.DATABASE_URL}/${restaurantId}?is_favorite=${isFavorite}`,
      {
        method: "PUT"
      }
    );
  }

  static postOfflineReviews() {
    return getDBPromise().then(db => {
      if (!db) return;

      let offlineReviewsStore = db
        .transaction(OFFLINE_REVIEWS, "readwrite")
        .objectStore(OFFLINE_REVIEWS);

      offlineReviewsStore
        .getAll()
        .then(reviews => {
          reviews.map(review => DBHelper.postReview(review));
        })
        .then(() => offlineReviewsStore.clear());
    });
  }

  static saveOfflineReview(review) {
    if (!review) return;

    return getDBPromise().then(db => {
      let offlineReviewsStore = db
        .transaction(OFFLINE_REVIEWS, "readwrite")
        .objectStore(OFFLINE_REVIEWS);
      offlineReviewsStore.put(review);
    });
  }

  static saveOfflineFavorites(restaurant) {
    console.log(restaurant);
    return getDBPromise().then(db => {
      let favoriteRestaurantsStore = db
        .transaction(OFFLINE_FAVORITES, "readwrite")
        .objectStore(OFFLINE_FAVORITES);
      favoriteRestaurantsStore.put(restaurant);
    });
  }

  static updateFavoriteRestaurants() {
    return getDBPromise().then(db => {
      if (!db) return;

      let favStore = db
        .transaction(OFFLINE_FAVORITES, "readwrite")
        .objectStore(OFFLINE_FAVORITES);

      favStore
        .getAll()
        .then(restaurants => {
          restaurants.map(restaurant => DBHelper.toggleFavorite(restaurant));
        })
        .then(() => favStore.clear());
    });
  }
}

/* Index Db start */

updateCache = restaurants => {
  if (!restaurants) {
    console.log("No data to update");
  }

  getDBPromise().then(db => {
    let tx = db.transaction(RESTAURANTS, "readwrite");
    let store = tx.objectStore(RESTAURANTS);
    restaurants.map(data => store.put(data));

    //Delete old restaurants data
    store
      .index("updatedAt")
      .openCursor(null, "prev")
      .then(cursor => {
        if (!cursor) return;
        return cursor.advance(30);
      })
      .then(function deleteRest(cursor) {
        if (!cursor) return;

        console.log("Deleting data", cursor);
        cursor.delete();
        return cursor.continue().then(deleteRest);
      });
  });
};

getDBPromise = () => {
  //Making sure serviceWorker is supported by the browser
  if (!navigator.serviceWorker || !("indexedDB" in window)) {
    return Promise.resolve();
  }

  return idb.open("restaurants-db", 12, upgradeDB => {
    if (!upgradeDB.objectStoreNames.contains(RESTAURANTS)) {
      let store = upgradeDB.createObjectStore(RESTAURANTS, { keyPath: "id" });
      store.createIndex("updatedAt", "updatedAt");
    }
    if (!upgradeDB.objectStoreNames.contains(REVIEWS)) {
      let reviewsStore = upgradeDB.createObjectStore(REVIEWS, {
        keyPath: ["restaurant_id", "id"]
      });
      reviewsStore.createIndex("updatedAt", "updatedAt");
    }
    if (!upgradeDB.objectStoreNames.contains(OFFLINE_REVIEWS)) {
      let reviewsStore = upgradeDB.createObjectStore(OFFLINE_REVIEWS, {
        keyPath: ["restaurant_id", "name"]
      });
    }
    if (!upgradeDB.objectStoreNames.contains(OFFLINE_FAVORITES)) {
      let favouritesStore = upgradeDB.createObjectStore(OFFLINE_FAVORITES, {
        keyPath: "restaurantId"
      });
    }
  });
};

showCachedRestaurants = callback => {
  return getDBPromise().then(db => {
    let index = db
      .transaction(RESTAURANTS)
      .objectStore(RESTAURANTS)
      .index("updatedAt");
    return index.getAll().then(restaurants => {
      if (restaurants && restaurants.length > 0) {
        callback(null, restaurants);
      }
    });
  });
};

updateReviewsCache = reviews => {
  if (!reviews) return;

  getDBPromise().then(db => {
    let reviewsStore = db
      .transaction(REVIEWS, "readwrite")
      .objectStore(REVIEWS);
    reviews.map(review => reviewsStore.put(review));
  });
};

/* Index Db end */
