let restaurant;
var newMap;

window.addEventListener("load", () => {
  if (navigator.onLine) {
    DBHelper.postOfflineReviews();
  }
  window.addEventListener("online", e => DBHelper.postOfflineReviews());
});

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener("DOMContentLoaded", event => {
  initMap();
});

/**
 * Initialize leaflet map
 */
initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      if (self.newMap) {
        self.newMap.off();
        self.newMap.remove();
      }

      self.newMap = L.map("map", {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
        scrollWheelZoom: false
      });
      L.tileLayer(
        "https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken" +
          "}",
        {
          mapboxToken:
            "pk.eyJ1IjoicHJpeWFuc2h1dHlhZ2kiLCJhIjoiY2pqNm9tcGRjMGpzZjNxbWc5cXE3ZGdwcCJ9.GcVUIBv7Q" +
            "XYvdlj15DuVEw",
          maxZoom: 18,
          attribution:
            'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contr' +
            'ibutors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>,' +
            ' Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
          id: "mapbox.streets"
        }
      ).addTo(newMap);
      fillBreadcrumb();
      initReviewForm();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  });
};

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = callback => {
  if (self.restaurant) {
    // restaurant already fetched!
    callback(null, self.restaurant);
    return;
  }
  const id = getParameterByName("id");
  if (!id) {
    // no id found in URL
    error = "No restaurant id in URL";
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant);
    });
  }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById("restaurant-name");
  name.innerHTML = restaurant.name;

  const address = document.getElementById("restaurant-address");
  address.innerHTML = restaurant.address;

  const image = document.getElementById("restaurant-img");
  image.className = "restaurant-img";
  image.setAttribute("alt", restaurant.name);
  image.src = DBHelper.imageUrlForRestaurant(restaurant);

  const cuisine = document.getElementById("restaurant-cuisine");
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fetchRestaurantReviews();
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (
  operatingHours = self.restaurant.operating_hours
) => {
  const hours = document.getElementById("restaurant-hours");
  hours.innerHTML = "";
  for (let key in operatingHours) {
    const row = document.createElement("tr");

    const day = document.createElement("td");
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement("td");
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
};

fetchRestaurantReviews = () => {
  let restaurantId = self.restaurant.id;
  // Display the cached reviews when available
  DBHelper.getCachedReviews(restaurantId).then(reviews => {
    reviews.length > 1 && fillReviewsHTML(reviews);
  });
  // Fetch new reviews from the API
  DBHelper.fetchRestaurantReviews(self.restaurant.id).then(reviews => {
    fillReviewsHTML(reviews);
  });
};

fillReviewsHTML = reviews => {
  const container = document.getElementById("reviews-container");
  const title = document.getElementById("reviews-title");
  title.innerHTML = "Reviews";
  if (!reviews) {
    const noReviews = document.createElement("p");
    noReviews.innerHTML = "No reviews yet!";
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById("reviews-list");
  if (ul.innerHTML) ul.innerHTML = "";
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
};

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = review => {
  const li = document.createElement("li");

  const reviewHeader = document.createElement("div");
  reviewHeader.setAttribute("class", "review-header");

  const name = document.createElement("p");
  name.innerHTML = review.name;
  reviewHeader.appendChild(name);

  const date = document.createElement("p");
  date.innerHTML = new Date(review.updatedAt).toDateString();
  reviewHeader.appendChild(date);
  li.appendChild(reviewHeader);

  const rating = document.createElement("p");
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement("p");
  comments.innerHTML = review.comments;
  li.appendChild(comments);
  return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant = self.restaurant) => {
  const restaurantNav = document.getElementById("restaurant-label");
  restaurantNav.innerHTML = restaurant.name;
};

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
};

initReviewForm = () => {
  let reviewForm = document.getElementById("review-form");
  reviewForm.onsubmit = event => {
    event.preventDefault();
    let review = {
      restaurant_id: self.restaurant.id,
      name: event.target.name.value,
      rating: event.target.rating.value,
      comments: event.target.review.value
    };

    if (navigator.onLine) {
      DBHelper.postReview(review)
        .then(() => addNewReview(review))
        .then(() => reviewForm.reset())
        .catch(error => {
          console.log("error posting review", review);
          DBHelper.saveOfflineReview(review).then(() => {
            addNewReview(review);
            reviewForm.reset();
          });
        });
    } else {
      DBHelper.saveOfflineReview(review).then(() => {
        addNewReview(review);
        reviewForm.reset();
      });
    }
  };
};

addNewReview = review => {
  const ul = document.getElementById("reviews-list");
  ul.appendChild(createReviewHTML(review));
};
