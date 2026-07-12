const GLAMPING_ICONS = [
  "wifi", "bed", "bed-double", "bed-single", "bath", "shower-head", "droplets", "flame", "trees", "tree-pine",
  "mountain", "mountain-snow", "tent", "home", "key", "car", "parking-circle", "parking-square", "paw-print",
  "dog", "tv", "monitor", "speaker", "coffee", "utensils", "utensils-crossed", "refrigerator", "microwave",
  "fan", "snowflake", "wind", "thermometer", "sun", "moon", "star", "waves", "fish", "compass", "map",
  "map-pin", "heart", "check-circle", "shield-check", "sofa", "glass-water", "wine", "beer", "cup-soda",
  "music", "radio", "baby", "rocking-chair", "cigarette-off", "bus", "train", "plane", "bike", "footprints",
  "camera", "image", "video", "book", "book-open", "gamepad-2", "puzzle", "shopping-bag", "shopping-cart"
];

// If we are in Node.js (for backend defaults), export it
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GLAMPING_ICONS;
} else if (typeof window !== 'undefined') {
  window.GLAMPING_ICONS = GLAMPING_ICONS;
}
