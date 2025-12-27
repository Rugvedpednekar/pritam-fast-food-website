// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const menuGrid = document.getElementById('menuGrid');
const searchInput = document.getElementById('searchInput');
const noResults = document.getElementById('noResults');
const chips = document.querySelectorAll('.chip');
const sortSelect = document.getElementById('sortSelect');

let activeFilter = "all";
let searchTerm = "";
let sortMode = "none";

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const n = Number(String(priceStr).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function prettyCategory(cat) {
  const map = {
    "dosa": "Dosa",
    "uttappa": "Uttappa",
    "special-dosa": "Special Dosa",
    "dosa-extras": "Dosa Extras",
    "fruit-salad": "Fruit Salad",
    "other-drinks": "Other Drinks",
    "pizza": "Pizza",
    "burger": "Burger",
    "papad": "Papad",
    "salad-raita": "Salad / Raita",
    "soup": "Soup",
    "paneer": "Paneer",
    "veg-subji": "Veg Subji",
    "beverages": "Beverages",
    "idli": "Idli",
    "special-idli": "Special Idli",
    "vada": "Vada",
    "snacks": "Other Snacks",
  };
  return map[cat] || "Menu";
}

const MENU_ITEMS = [
  // ========= DOSA =========
  { name: "Sada Dosa", price: "₹99", category: "dosa" },
  { name: "Masala Dosa", price: "₹121", category: "dosa" },
  { name: "Cheese Sada Dosa", price: "₹143", category: "dosa" },
  { name: "Rava Dosa", price: "₹121", category: "dosa" },
  { name: "Rava Masala Dosa", price: "₹132", category: "dosa" },
  { name: "Onion Rava Dosa", price: "₹121", category: "dosa" },
  { name: "Onion Rava Masala Dosa", price: "₹148", category: "dosa" },
  { name: "Mysore Sada Dosa (Red Chutni)", price: "₹121", category: "dosa" },
  { name: "Mysore Masala Dosa (Red Chutni + Aloo Bhaji)", price: "₹143", category: "dosa" },
  { name: "Paper Sada Dosa", price: "₹198", category: "dosa" },
  { name: "Paper Masala Dosa", price: "₹231", category: "dosa" },
  { name: "Schezwan Dosa", price: "₹143", category: "dosa" },
  { name: "Cheese Masala Dosa", price: "₹165", category: "dosa" },

  // ========= UTTAPPA =========
  { name: "Uttappa", price: "₹110", category: "uttappa" },
  { name: "Onion Uttappa", price: "₹143", category: "uttappa" },
  { name: "Tomato Uttappa", price: "₹137", category: "uttappa" },
  { name: "Onion Tomato Uttappa", price: "₹137", category: "uttappa" },
  { name: "Masala Uttappa", price: "₹154", category: "uttappa" },
  { name: "Cheese Uttappa", price: "₹154", category: "uttappa" },

  // ========= SPECIAL DOSA =========
  { name: "Banana Dosa", price: "₹154", category: "special-dosa" },
  { name: "Chikoo Dosa", price: "₹154", category: "special-dosa" },
  { name: "Cookie Dosa (Pritam Special)", price: "₹209", category: "special-dosa" },
  { name: "Davit Uttappa", price: "₹154", category: "special-dosa" },
  { name: "Green Dosa", price: "₹187", category: "special-dosa" },
  { name: "Methi Dosa", price: "₹187", category: "special-dosa" },
  { name: "Spring Dosa", price: "₹187", category: "special-dosa" },
  { name: "Methi Uttappa", price: "₹165", category: "special-dosa" },

  // ========= DOSA EXTRAS =========
  { name: "Butter / Ghee (Extra)", price: "₹25", category: "dosa-extras" },
  { name: "Cheese (Extra)", price: "₹55", category: "dosa-extras" },

  // ========= FRUIT SALAD =========
  { name: "Fruit Salad", price: "₹220", category: "fruit-salad" },
  { name: "Fruit Salad with Ice Cream", price: "₹242", category: "fruit-salad" },
  { name: "Fruit Salad with Jelly", price: "₹242", category: "fruit-salad" },
  { name: "Fruit Salad with Jelly & Ice Cream", price: "₹275", category: "fruit-salad" },
  { name: "Gadbad Ice Cream", price: "₹352", category: "fruit-salad" },
  { name: "Jelly with Ice Cream", price: "₹220", category: "fruit-salad" },
  { name: "Jelly Plain", price: "₹220", category: "fruit-salad" },
  { name: "Aam Ras", price: "₹220", category: "fruit-salad" },

  // ========= OTHER DRINKS =========
  { name: "Sweet Lassi", price: "₹110", category: "other-drinks" },
  { name: "Salted Lassi", price: "₹110", category: "other-drinks" },
  { name: "Mango Lassi", price: "₹154", category: "other-drinks" },
  { name: "Dahi Curd", price: "₹85", category: "other-drinks" },
  { name: "Butter Milk", price: "₹82", category: "other-drinks" },
  { name: "Ginger Lemon", price: "₹99", category: "other-drinks" },
  { name: "Ginger Lemon Soda", price: "₹95", category: "other-drinks" },
  { name: "Fresh Lime Soda", price: "₹99", category: "other-drinks" },
  { name: "Fresh Lime Water", price: "₹88", category: "other-drinks" },
  { name: "Sinkanji Been Sarabat", price: "₹88", category: "other-drinks" },

  // ========= PIZZA =========
  { name: "Veg Cheese Pizza", price: "₹231", category: "pizza" },
  { name: "Only Cheese Pizza", price: "₹231", category: "pizza" },
  { name: "Jain Veg Cheese Pizza", price: "₹231", category: "pizza" },
  { name: "Mushroom Pizza", price: "₹264", category: "pizza" },
  { name: "Pritam Special Pizza", price: "₹286", category: "pizza" },

  // ========= BURGER =========
  { name: "Veg Burger", price: "₹165", category: "burger" },
  { name: "Veg Cheese Burger", price: "₹198", category: "burger" },
  { name: "Only Cheese Burger", price: "₹187", category: "burger" },

  // ========= PAPAD =========
  { name: "Roasted Papad", price: "₹31", category: "papad" },
  { name: "Fried Papad", price: "₹52", category: "papad" },
  { name: "Masala Papad", price: "₹73", category: "papad" },

  // ========= SALAD / RAITA =========
  { name: "Green Salad", price: "₹115", category: "salad-raita" },
  { name: "Veg Raita", price: "₹115", category: "salad-raita" },
  { name: "Pineapple Raita", price: "₹126", category: "salad-raita" },
  { name: "Bhundi Raita", price: "₹126", category: "salad-raita" },

  // ========= SOUP =========
  { name: "Tomato Soup", price: "₹198", category: "soup" },
  { name: "Veg Clear Soup", price: "₹198", category: "soup" },
  { name: "Veg Sweet Corn Soup", price: "₹209", category: "soup" },
  { name: "Paneer Sweet Corn Soup", price: "₹242", category: "soup" },
  { name: "Veg Hot & Sour Soup", price: "₹198", category: "soup" },
  { name: "Veg Manchow Soup", price: "₹198", category: "soup" },
  { name: "Veg Noodle Soup", price: "₹198", category: "soup" },
  { name: "Mushroom Soup", price: "₹198", category: "soup" },
  { name: "Palak Soup", price: "₹187", category: "soup" },

  // ========= PANEER =========
  { name: "Paneer Methi", price: "₹269", category: "paneer" },
  { name: "Paneer Mus BBCN Masala", price: "₹297", category: "paneer" },
  { name: "Paneer Burji", price: "₹319", category: "paneer" },
  { name: "Paneer Butter Masala", price: "₹269", category: "paneer" },
  { name: "Paneer Channa Masala", price: "₹269", category: "paneer" },
  { name: "Paneer Do Pyaza", price: "₹269", category: "paneer" },
  { name: "Paneer Handi", price: "₹280", category: "paneer" },
  { name: "Paneer Hydrbadi", price: "₹269", category: "paneer" },
  { name: "Paneer Jalfrazi", price: "₹269", category: "paneer" },
  { name: "Paneer Kadai", price: "₹275", category: "paneer" },
  { name: "Paneer Kolhapuri", price: "₹269", category: "paneer" },
  { name: "Paneer Makhanwala", price: "₹269", category: "paneer" },
  { name: "Paneer Masala", price: "₹269", category: "paneer" },
  { name: "Paneer Mushroom Masala", price: "₹297", category: "paneer" },
  { name: "Paneer Mutter", price: "₹269", category: "paneer" },
  { name: "Paneer Nawabi", price: "₹308", category: "paneer" },
  { name: "Paneer Palak", price: "₹269", category: "paneer" },
  { name: "Paneer Shahi Kurma", price: "₹297", category: "paneer" },

  // ========= VEG SUBJI =========
  { name: "Simla Mutter", price: "₹209", category: "veg-subji" },
  { name: "Simla Paneer Barta", price: "₹253", category: "veg-subji" },
  { name: "Simla Stuff", price: "₹253", category: "veg-subji" },
  { name: "Tomato Barta", price: "₹209", category: "veg-subji" },
  { name: "Tomato Burji", price: "₹220", category: "veg-subji" },
  { name: "Tomato Fry", price: "₹209", category: "veg-subji" },
  { name: "Tomato Gobi Masala", price: "₹209", category: "veg-subji" },
  { name: "Tomato Mutter", price: "₹209", category: "veg-subji" },
  { name: "Tomato Paneer Barta", price: "₹253", category: "veg-subji" },
  { name: "Tomato Stuff", price: "₹253", category: "veg-subji" },
  { name: "Veg Handi", price: "₹220", category: "veg-subji" },
  { name: "Veg Hyderabadi", price: "₹275", category: "veg-subji" },
  { name: "Veg Jaipur", price: "₹234", category: "veg-subji" },
  { name: "Veg Jalfraizi", price: "₹231", category: "veg-subji" },
  { name: "Veg Kadhai", price: "₹264", category: "veg-subji" },
  { name: "Veg Kolhapuri", price: "₹220", category: "veg-subji" },
  { name: "Veg Kurma", price: "₹209", category: "veg-subji" },
  { name: "Veg Lasuni", price: "₹209", category: "veg-subji" },
  { name: "Simla Baigan", price: "₹209", category: "veg-subji" },
  { name: "Simla Gobi", price: "₹209", category: "veg-subji" },
  { name: "Simla Makhanwala", price: "₹209", category: "veg-subji" },

  // ========= BEVERAGES =========
  { name: "Tea", price: "₹53", category: "beverages" },
  { name: "Special Tea", price: "₹68", category: "beverages" },
  { name: "Nescafe", price: "₹68", category: "beverages" },
  { name: "Bournvita", price: "₹79", category: "beverages" },
  { name: "No Sugar Tea", price: "₹55", category: "beverages" },

  // ========= IDLI =========
  { name: "Steam Idli", price: "₹85", category: "idli" },
  { name: "Fried Idli", price: "₹115", category: "idli" },
  { name: "Butter Idli", price: "₹125", category: "idli" },
  { name: "Dahi Idli", price: "₹135", category: "idli" },
  { name: "Idli Vada", price: "₹95", category: "idli" },

  // ========= SPECIAL IDLI =========
  { name: "Schezwan Idli", price: "₹189", category: "special-idli" },
  { name: "Idli Chilly", price: "₹189", category: "special-idli" },
  { name: "Green Idli", price: "₹189", category: "special-idli" },

  // ========= VADA =========
  { name: "Patato Vada", price: "₹95", category: "vada" },
  { name: "Medu Vada", price: "₹95", category: "vada" },
  { name: "Dahi Vada", price: "₹126", category: "vada" },

  // ========= OTHER SNACKS =========
  { name: "Punjabi Samosa", price: "₹95", category: "snacks" },
  { name: "Veg Cutlet", price: "₹105", category: "snacks" },
  { name: "Veg Pakoda", price: "₹126", category: "snacks" },
  { name: "Paneer Pakoda", price: "₹195", category: "snacks" },
  { name: "Cheese Pakoda", price: "₹178", category: "snacks" },
  { name: "Puri Bhaji", price: "₹136", category: "snacks" },
  { name: "Sheera (Morning)", price: "₹84", category: "snacks" },
  { name: "Upma (Morning)", price: "₹84", category: "snacks" },
  { name: "Misal Pav (2 Pav)", price: "₹131", category: "snacks" },
  { name: "Usal Pav (2 Pav)", price: "₹100", category: "snacks" },
  { name: "Dahi Misal Pav (2 Pav)", price: "₹152", category: "snacks" },
];

function renderMenu(items) {
  if (!menuGrid) return;

  menuGrid.innerHTML = items.map((item) => {
    return `
      <div class="menu-item" data-category="${item.category}">
        <div class="menu-top">
          <div>
            <div class="menu-name">${item.name}</div>
            <div class="menu-meta">
              <span class="tag">${prettyCategory(item.category)}</span>
            </div>
          </div>
          <div class="price">${item.price || ""}</div>
        </div>
      </div>
    `;
  }).join("");
}

function applyFilters() {
  let filtered = MENU_ITEMS.filter((item) => {
    const matchCategory = (activeFilter === "all") ? true : item.category === activeFilter;
    const matchSearch = (searchTerm.trim() === "")
      ? true
      : item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  // SORT
  if (sortMode === "low" || sortMode === "high") {
    filtered = filtered.slice().sort((a, b) => {
      const pa = parsePrice(a.price);
      const pb = parsePrice(b.price);

      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;

      return sortMode === "low" ? (pa - pb) : (pb - pa);
    });
  }

  renderMenu(filtered);

  if (noResults) {
    if (filtered.length === 0) noResults.classList.remove("hidden");
    else noResults.classList.add("hidden");
  }
}

// Chips
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter || "all";
    applyFilters();
  });
});

// Search
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value || "";
    applyFilters();
  });
}

// Sort
if (sortSelect) {
  sortSelect.addEventListener("change", (e) => {
    sortMode = e.target.value || "none";
    applyFilters();
  });
}

// Init
applyFilters();
