var newMap;
var markers = [];
var observer;

window.addEventListener("load", () => {
  if (navigator.onLine) {
    DBHelper.updateFavoriteRestaurants();
  }

  window.addEventListener("online", e => DBHelper.updateFavoriteRestaurants());
});

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener("DOMContentLoaded", event => {
  initMap(); // added
  fetchNeighborhoods();
  fetchCuisines();
  lazyLoading();
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) {
      // Got an error
      console.warn(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
};

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById("neighborhoods-select");
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement("option");
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) {
      // Got an error!
      console.warn(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
};

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById("cuisines-select");

  cuisines.forEach(cuisine => {
    const option = document.createElement("option");
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
};

/**
 * Initialize leaflet map, called from HTML.
 */
initMap = () => {
  self.newMap = L.map("map", {
    center: [40.722216, -73.987501],
    zoom: 12,
    scrollWheelZoom: false
  });
  L.tileLayer(
    "https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken" +
      "}",
    {
      mapboxToken:
        "pk.eyJ1IjoicHJpeWFuc2h1dHlhZ2kiLCJhIjoiY2pqNm9tcGRjMGpzZjNxbWc5cXE3ZGdwcCJ9.GcVUIBv7QXYv" +
        "dlj15DuVEw",
      maxZoom: 18,
      attribution:
        'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contr' +
        'ibutors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>,' +
        ' Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      id: "mapbox.streets"
    }
  ).addTo(newMap);

  updateRestaurants();
};

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById("cuisines-select");
  const nSelect = document.getElementById("neighborhoods-select");

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(
    cuisine,
    neighborhood,
    (error, restaurants) => {
      if (error) {
        // Got an error!
        console.log(error);
      } else {
        resetRestaurants(restaurants);
        fillRestaurantsHTML();
      }
    }
  );
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = restaurants => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById("restaurants-list");
  ul.innerHTML = "";

  // Remove all map markers
  if (self.markers) {
    self.markers.forEach(marker => marker.remove());
  }
  self.markers = [];
  self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById("restaurants-list");
  restaurants.forEach(restaurant => {
    observer.observe();
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
  addFavoriteClickListener();
};

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = restaurant => {
  const li = document.createElement("li");

  const image = document.createElement("img");
  image.className = "restaurant-img";
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.setAttribute("alt", restaurant.name);
  image.setAttribute("class", "lozad");
  li.append(image);

  const span = document.createElement("span");
  span.className = "restaurant-title";

  const favImage = document.createElement("img");
  favImage.className = "fav";
  favImage.src =
    restaurant.is_favorite == "true"
      ? "img/favorite.svg"
      : "img/make_favorite.svg";
  favImage.setAttribute("alt", "Add this to favorites");
  favImage.setAttribute("data-id", restaurant.id);
  favImage.setAttribute("data-favorite", restaurant.is_favorite);

  const name = document.createElement("h2");
  name.innerHTML = restaurant.name;

  span.append(name);
  span.append(favImage);
  li.append(span);

  const neighborhood = document.createElement("p");
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement("p");
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement("a");
  more.innerHTML = "View Details";
  more.href = DBHelper.urlForRestaurant(restaurant);
  more.setAttribute("role", "button");
  li.append(more);

  return li;
};

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.newMap);
    marker.on("click", onClick);
    function onClick() {
      window.location.href = marker.options.url;
    }
    self.markers.push(marker);
  });
};

lazyLoading = () => {
  observer = lozad(".lozad", {
    threshold: 0.1
  });
  observer.observe();
};

addFavoriteClickListener = () => {
  const favImages = document.getElementsByClassName("fav");

  if (favImages) {
    Array.from(favImages).forEach(img =>
      img.addEventListener("click", e => {
        let image = e.target;
        let restaurantId = image.getAttribute("data-id");
        let isFavorite = image.getAttribute("data-favorite") != "true";
        const restaurant = {
          restaurantId,
          isFavorite
        };

        if (navigator.onLine) {
          DBHelper.toggleFavorite(restaurant)
            .then(() => updateFavoriteIcon(img, isFavorite))
            .catch(error => {
              DBHelper.saveOfflineFavorites(restaurant).then(() =>
                updateFavoriteIcon(img, isFavorite)
              );
            });
        } else {
          DBHelper.saveOfflineFavorites(restaurant).then(() =>
            updateFavoriteIcon(img, isFavorite)
          );
        }
      })
    );
  }
};

updateFavoriteIcon = (img, isFavorite) => {
  img.src = isFavorite ? "img/favorite.svg" : "img/make_favorite.svg";
  img.setAttribute("data-favorite", isFavorite);
};
