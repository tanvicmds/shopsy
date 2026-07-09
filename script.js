function fetchProducts(limit = 15, skip = 0, searchQuery = "") {
    const url = searchQuery
        ? `https://dummyjson.com/products/search?q=${searchQuery}&limit=${limit}&skip=${skip}`
        : `https://dummyjson.com/products?limit=${limit}&skip=${skip}`;

    return fetch(url)
        .then(res => {
            if (!res.ok) {
                throw new Error("Could not fetch products");
            }

            return res.json();
        });
}

function fetchProductById(id) {
    return fetch(`https://dummyjson.com/products/${id}`)
        .then(res => {
            if (!res.ok) {
                return null;
            }

            return res.json();
        });
}

function renderProducts(products) {
    product_grid.innerHTML = "";
    state.currentProducts = products;
    for (const product of products) {
        const productObj = {
            item_id: product.id,
            item_img: product.thumbnail,
            item_name: product.title,
            item_price: product.price,
            item_desc: product.description,
            item_rating: product.rating
        };
        loadCard(productObj);
    }
}

function loadProducts() {
    return fetchProducts(state.limit, state.skip, state.searchQuery)
        .then(data => {
            const apiProducts = applyLocalChanges(data.products);
            const localProducts = getMatchingLocalProducts();
            const isIdSearch = state.searchQuery && !Number.isNaN(Number(state.searchQuery));

            if (!isIdSearch) {
                state.total = data.total + localProducts.length;
                renderProducts([...localProducts, ...apiProducts]);
                updatePagination();
                return;
            }

            return fetchProductById(Number(state.searchQuery))
                .then(productById => {
                    const products = [...localProducts, ...apiProducts];

                    if (
                        productById &&
                        !state.deletedProductIds.includes(productById.id) &&
                        !products.some(product => product.id === productById.id)
                    ) {
                        products.unshift(state.updatedProducts[productById.id] || productById);
                    }

                    state.total = products.length;
                    renderProducts(products);
                    updatePagination();
                });
        });
}



function loadCategories() {
    return fetch("https://dummyjson.com/products/categories")
        .then(res => {
            if (!res.ok) {
                throw new Error("Could not fetch categories");
            }

            return res.json();
        })
        .then(data => {
            const filtersArea = document.getElementById("categoryFilters");
            for (const category of data) {
                state.categories.push(category);
                const label = document.createElement("div");
                label.className = "categoryFilter";
                label.innerHTML = `
                <input type="checkbox" id="${category.slug}" value="${category.url}">
                <label for="${category.slug}">${category.name}</label>
                `
                filtersArea.appendChild(label);
            }
        })
        .then(() => {
            const categories = document.querySelectorAll(".categoryFilter input");
            for (const i of categories) {
                i.addEventListener("change", handleCategoryChange);
            }
        });
}

function loadCard(cardObj) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.dataset.id = cardObj.item_id;
    card.innerHTML = `
       <p class="product-id">ITEM ID: ${cardObj.item_id}</p>
        <img src="${cardObj.item_img}" alt="${cardObj.item_name}" class="product-img">
        <h3 class="product-name">${cardObj.item_name}</h3>
        <p class="product-desc">${cardObj.item_desc}</p>
        <p class="product-price">&#8377;${cardObj.item_price}</p>
        <p class="product-rating">Rating: ${cardObj.item_rating}</p>
        <div class="card-actions">
            <button class="detail-btn" type="button" data-id="${cardObj.item_id}">
                View Details
            </button>
        </div>
    `;
    const admin_txt = `
        <button class="edit-btn" type="button" data-id="${cardObj.item_id}">
            <i class="fa-solid fa-pencil"></i>
        </button>
        <button class="delete-btn" type="button" data-id="${cardObj.item_id}">
            <i class="fa-solid fa-trash"></i>
        </button>
    `
    const user_txt = `
        <button class="cart-btn" type="button" data-id="${cardObj.item_id}">
            <i class="fa-solid fa-cart-shopping"></i>
        </button>
    `
    if (document.body.classList.contains("admin")) {
        card.querySelector(".card-actions").innerHTML += admin_txt;
        card.querySelector(".edit-btn").addEventListener("click", handleEditProduct);
        card.querySelector(".delete-btn").addEventListener("click", handleDeleteProduct);
    }
    if (document.body.classList.contains("user")) {
        card.querySelector(".card-actions").innerHTML += user_txt;
        card.querySelector(".cart-btn").addEventListener("click", handlecartButtonClick);

    }
    card.querySelector(".detail-btn").addEventListener("click", handledetailButtonClick);
    product_grid.appendChild(card);
}

function handlecartButtonClick(event) {
    const id = Number(event.currentTarget.dataset.id);
    const product = state.currentProducts.find(p => p.id === id) || state.localProducts.find(p => p.id === id);
    if (product) {
        addToCart(product);
    }
}

function handledetailButtonClick(event) {
    const id = Number(event.currentTarget.dataset.id);
    const product = state.currentProducts.find(p => p.id === id) || state.localProducts.find(p => p.id === id);
    if (product) {
        showProductDetails(product);
    }
}

function showProductDetails(product) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const isUser = document.body.classList.contains("user");
    const cartButtonHTML = isUser ?
        `<button class="modal-btn modal-confirm cart-btn-large" data-id="${product.id}">
            <i class="fa-solid fa-cart-shopping"></i> Add to Cart
        </button>` : "";
    const stockHTML = product.stock !== undefined ? `<span class="details-badge ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}">${product.stock > 0 ? 'In Stock (' + product.stock + ')' : 'Out of Stock'}</span>` : "";
    const brandHTML = product.brand ? `<p class="details-meta"><strong>Brand:</strong> ${product.brand}</p>` : "";
    const tagsHTML = (product.tags && product.tags.length) ? product.tags.map(tag => `<span class="details-tag">${tag}</span>`).join("") : "";
    let priceHTML = `<span class="new-price">₹${product.price}</span>`;
    if (product.discountPercentage) {
        const originalPrice = (product.price / (1 - (product.discountPercentage / 100))).toFixed(2);
        priceHTML = `<span class="old-price">₹${originalPrice}</span> <span class="new-price">₹${product.price}</span> <span class="discount-badge">-${product.discountPercentage}%</span>`;
    }
    const extraInfoHTML = product.shippingInformation || product.warrantyInformation || product.returnPolicy ? `
        <div class="details-extra">
            ${product.shippingInformation ? `<p><i class="fa-solid fa-truck"></i> ${product.shippingInformation}</p>` : ""}
            ${product.warrantyInformation ? `<p><i class="fa-solid fa-shield-halved"></i> ${product.warrantyInformation}</p>` : ""}
            ${product.returnPolicy ? `<p><i class="fa-solid fa-rotate-left"></i> ${product.returnPolicy}</p>` : ""}
        </div>
    ` : "";
    overlay.innerHTML = `
        <div class="modal-box details-modal-box">
            <button class="modal-close">&times;</button>
            
            <div class="details-content">
                <img src="${product.thumbnail}" alt="${product.title}" class="details-img">
                
                <div class="details-info">
                    <div style="display:flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <p class="details-id">ID: ${product.id} | Category: ${product.category || 'N/A'}</p>
                            ${brandHTML}
                        </div>
                        ${stockHTML}
                    </div>
                    
                    <h2 class="details-title">${product.title}</h2>
                    <div>${tagsHTML}</div>
                    
                    <p class="details-price">${priceHTML}</p>
                    <p class="details-rating">⭐ Rating: ${product.rating} ${product.reviews ? `(${product.reviews.length} reviews)` : ""}</p>
                    
                    <p class="details-desc">${product.description}</p>
                    
                    ${extraInfoHTML}
                </div>
            </div>
            
            <div class="modal-actions details-actions">
                ${cartButtonHTML}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector(".modal-close");
    const closeModal = () => document.body.removeChild(overlay);
    closeBtn.addEventListener("click", closeModal);

    if (isUser) {
        overlay.querySelector(".cart-btn-large").onclick = () => {
            addToCart(product);
            overlay.remove();
        };
    }
}

function showCartModal() {
    const cart = JSON.parse(localStorage.getItem("shopsy_cart")) || [];
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    let total = 0;
    const cartItemsHTML = cart.length === 0
        ? '<p class="cart-empty">Your cart is empty.</p>'
        : cart.map(item => {
            total += item.price * item.quantity;
            return `
            <div class="cart-item-row" style="align-items: center;">
                <div class="cart-item-info-wrap" style="align-items: center;">
                    <!-- The new Trash Button -->
                    <button class="cart-remove-btn" data-id="${item.id}" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:18px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    <img src="${item.thumbnail}" class="cart-item-img">
                    <div>
                        <p class="cart-item-title">${item.title}</p>
                        <p class="cart-item-meta">₹${item.price} x ${item.quantity}</p>
                    </div>
                </div>
                <div class="cart-item-price">₹${(item.price * item.quantity).toFixed(2)}</div>
            </div>`;
        }).join("");

    overlay.innerHTML = `
        <div class="modal-box details-modal-box">
            <button class="modal-close">&times;</button>
            <h2 class="modal-title cart-title">Your Shopping Cart</h2>
            
            <div class="cart-list-container">
                ${cartItemsHTML}
            </div>
            
            ${cart.length > 0 ? `<h3 class="cart-total">Total: ₹${total.toFixed(2)}</h3>` : ""}
            
            <div class="modal-actions details-actions">
                <button class="modal-btn modal-cancel" id="closeCartBtn">Continue Shopping</button>
                ${cart.length > 0 ? `<button class="modal-btn modal-confirm cart-btn-large" id="checkoutBtn">Checkout</button>` : ""}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    const closeModal = () => overlay.remove();
    overlay.querySelector(".modal-close").onclick = closeModal;
    document.getElementById("closeCartBtn").onclick = closeModal;
    const removeBtns = overlay.querySelectorAll(".cart-remove-btn");
    removeBtns.forEach(btn => {
        btn.onclick = (e) => {
            const id = Number(e.currentTarget.dataset.id);
            removeFromCart(id);
            closeModal();
            showCartModal();
        };
    });
    const checkoutBtn = document.getElementById("checkoutBtn");
    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            alert("Checkout successful! Thank you for shopping with Shopsy.");
            localStorage.setItem("shopsy_cart", JSON.stringify([]));
            closeModal();
        };
    }
}

function addToCart(product) {
    const cart = JSON.parse(localStorage.getItem("shopsy_cart")) || [];
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    localStorage.setItem("shopsy_cart", JSON.stringify(cart));
    alert(`Added ${product.title} to cart!`);
}

function removeFromCart(id) {
    let cart = JSON.parse(localStorage.getItem("shopsy_cart")) || [];
    cart = cart.filter(item => item.id !== id);
    localStorage.setItem("shopsy_cart", JSON.stringify(cart));
}

function loadAddProductCard() {
    const addCard = document.createElement("div");
    addCard.className = "product-card add-product-card";
    addCard.innerHTML = `
        <button id="openAddForm" type="button" class="add-product-btn">Add Product</button>
        <div id="productFormArea"></div>
    `;
    product_grid.appendChild(addCard);
    document.getElementById("openAddForm").addEventListener("click", () => {
        state.editingProductId = null;
        document.getElementById("openAddForm").style.display = "none";
        showProductForm();
    });
}

function showProductForm(product = {}) {
    document.getElementById("formModalOverlay").style.display = "flex";
    document.getElementById("formTitle").innerText = state.editingProductId ? "Edit Product" : "Add Product";
    const formArea = document.getElementById("productFormArea");
    const selectedCategory = String(product.category || "").trim().toLowerCase();
    const txt = state.categories.map(category => {
        const categoryValue = category.slug;
        const categoryName = category.name;
        const isSelected = selectedCategory === categoryValue.toLowerCase() || selectedCategory === categoryName.toLowerCase();

        return `<option value="${categoryValue}" ${isSelected ? "selected" : ""}>${categoryName}</option>`;
    }).join("");

    formArea.innerHTML = `
        <form id="productForm" class="product-form" novalidate>
            <label for="productTitle">Title</label>
            <input id="productTitle" type="text" placeholder="Enter Title..." value="${product.title || ""}">
            <label for="productPrice">Price</label>
            <input id="productPrice" type="number" placeholder="Enter Price..." value="${product.price || ""}">
            <label for="productThumbnail">Image URL</label>
            <input id="productThumbnail" type="text" placeholder="Enter Image URL..." value="${product.thumbnail || ""}">
            <label for="productRating">Rating</label>
            <input id="productRating" type="number" step="0.1" placeholder="Enter Rating..." value="${product.rating || ""}">
            <label for="productDescription">Description</label>
            <textarea id="productDescription" placeholder="Enter Description...">${product.description || ""}</textarea>
            <label for="category">Category</label>
            <select name="category" id="category">
            <option value="">Select Category</option>
            ${txt}
            </select>
            <button type="submit">${state.editingProductId ? "Update" : "Add"}</button>
            <p id="formError" class="form-error"></p>
        </form>
    `;

    document.getElementById("productForm").addEventListener("submit", handleProductFormSubmit);
}

function validateProductForm(productData) {
    if (!productData.title || !productData.price || productData.price <= 0
        || !productData.thumbnail || !productData.description || !productData.category
    ) {
        return "Add Valid Inputs.";
    }

    if (!productData.rating || productData.rating < 0 || productData.rating > 5) {
        return "Rating must be between 0 and 5.";
    }

    return "";
}

function handleProductFormSubmit(event) {
    event.preventDefault();
    const productData = {
        title: document.getElementById("productTitle").value.trim(),
        price: Number(document.getElementById("productPrice").value),
        thumbnail: document.getElementById("productThumbnail").value.trim(),
        rating: Number(document.getElementById("productRating").value),
        description: document.getElementById("productDescription").value.trim(),
        category: document.getElementById("category").value.trim()
    };
    const errorMessage = validateProductForm(productData);
    const formError = document.getElementById("formError");
    if (errorMessage) {
        formError.textContent = errorMessage;
        return;
    }

    formError.textContent = "";
    if (state.editingProductId) {
        updateProduct(state.editingProductId, productData);
    } else {
        addProduct(productData);
    }
    document.getElementById("formModalOverlay").style.display = "none";
}

function handleCategoryChange(event) {
    if (event?.type === "change") {
        state.skip = 0;
    }
    const filteredCategories = document.querySelectorAll("#categoryFilters input:checked");
    if (filteredCategories.length === 0) {
        loadProducts();
        return;
    }
    const categoryRequests = Array.from(filteredCategories).map(label => {
        const filterUrl = label.value;

        return fetch(filterUrl)
            .then(res => {
                if (!res.ok) {
                    throw new Error("Could not fetch category products");
                }
                return res.json();
            });
    });
    Promise.all(categoryRequests)
        .then(results => {
            let filteredProducts = applyLocalChanges(results.flatMap(result => result.products));
            filteredProducts = [
                ...filteredProducts,
                ...getMatchingLocalProducts().filter(product =>
                    product.category &&
                    Array.from(filteredCategories).some(label => label.id === product.category.toLowerCase())
                )
            ];
            if (state.searchQuery) {
                filteredProducts = filteredProducts.filter(product =>
                    product.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                    String(product.id).includes(state.searchQuery)
                );
            }
            state.total = filteredProducts.length;
            const pageProducts = filteredProducts.slice(state.skip, state.skip + state.limit);
            renderProducts(pageProducts);
            updatePagination();
        })
        .catch(error => console.error(error));
}

function updatePagination() {
    const currentPage = Math.floor(state.skip / state.limit) + 1;
    const totalPages = Math.ceil(state.total / state.limit) || 1;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = state.skip === 0;
    nextPageBtn.disabled = state.skip + state.limit >= state.total;
}

function debounce(callback, delay = 500) {
    let timerId;
    return function () {
        clearTimeout(timerId);
        timerId = setTimeout(() => {
            callback();
        }, delay);
    };
}

function applyLocalChanges(products) {
    return products
        .filter(product => !state.deletedProductIds.includes(product.id))
        .map(product => state.updatedProducts[product.id] || product);
}

function getMatchingLocalProducts() {
    if (!state.searchQuery) {
        return state.localProducts;
    }

    return state.localProducts.filter(product =>
        product.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        String(product.id).includes(state.searchQuery)
    );
}

function addProduct(productData) {
    return fetch("https://dummyjson.com/products/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData)
    })
        .then(res => res.json())
        .then(newProduct => {
            state.localProducts.unshift(newProduct);
            savetoLocalStorage();
            state.skip = 0;
            loadProducts();
            alert(`Product "${newProduct.title}" added successfully!`);
        })
        .catch(error => console.error(error));
}

function updateProduct(id, productData) {
    const normalizedProductData = { ...productData, id };
    const isLocalProduct = state.localProducts.some(product => product.id === id);

    if (isLocalProduct) {
        state.localProducts = state.localProducts.map(product =>
            product.id === id ? { ...product, ...normalizedProductData } : product
        );
    } else {
        const existingProduct = state.currentProducts.find(product => product.id === id) || state.updatedProducts[id] || {};
        state.updatedProducts[id] = { ...existingProduct, ...normalizedProductData };
    }
    state.editingProductId = null;
    savetoLocalStorage();
    alert(`Product updated successfully!`);
    loadProducts();

    return fetch(`https://dummyjson.com/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData)
    })
        .then(res => res.json())
        .catch(error => console.error(error));
}

function deleteProduct(id) {
    return fetch(`https://dummyjson.com/products/${id}`, {
        method: "DELETE"
    })
        .then(res => res.json())
        .then(() => {
            state.localProducts = state.localProducts.filter(product => product.id !== id);
            state.deletedProductIds.push(id);
            savetoLocalStorage();
            loadProducts();
            alert(`Product deleted successfully!`);
        })
        .catch(error => console.error(error));
}

function handleEditProduct(event) {
    const id = Number(event.currentTarget.dataset.id);
    const product = state.currentProducts.find(product => product.id === id);
    if (!product) {
        return;
    }
    state.editingProductId = id;
    showProductForm(product);
}

// function handleDeleteProduct(event) {
//     const id = Number(event.currentTarget.dataset.id);
//     deleteProduct(id);
// }

function handleDeleteProduct(event) {
    const id = Number(event.currentTarget.dataset.id);
    showCustomConfirm(
        "Are you sure?",
        "Are you sure you want to delete this product? This action cannot be undone.",
        "Delete",
        () => {
            deleteProduct(id);
        }
    );
}


function showCustomConfirm(title, message, confirmBtnText, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
        <div class="modal-box">
            <button class="modal-close">&times;</button>
            <h3 class="modal-title">${title}</h3>
            <p class="modal-message">${message}</p>
            <div class="modal-actions">
                <button class="modal-btn modal-cancel">Cancel</button>
                <button class="modal-btn modal-confirm">${confirmBtnText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    const closeBtn = overlay.querySelector(".modal-close");
    const cancelBtn = overlay.querySelector(".modal-cancel");
    const confirmBtn = overlay.querySelector(".modal-confirm");
    const closeModal = () => {
        document.body.removeChild(overlay);
    }
    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    confirmBtn.addEventListener("click", () => {
        onConfirm();
        closeModal();
    });
}


function savetoLocalStorage() {
    localStorage.setItem(storage_key, JSON.stringify({
        localProducts: state.localProducts,
        updatedProducts: state.updatedProducts,
        deletedProductIds: state.deletedProductIds,
        history: state.history
    }));
}

const storage_key = "shopsy_data";
function loadLocalStorage() {
    const savedData = localStorage.getItem(storage_key);
    if (!savedData) {
        return null;
    } else {
        return JSON.parse(savedData);
    }
}

const product_grid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");
const cartBtns = document.getElementsByClassName("cart-btn");
const detailBtns = document.getElementsByClassName("detail-btn");



const savedLocalData = loadLocalStorage();
const state = {
    limit: 15,
    skip: 0,
    searchQuery: "",
    total: 0,
    currentProducts: [],
    editingProductId: null,
    localProducts: savedLocalData?.localProducts ?? [],
    updatedProducts: savedLocalData?.updatedProducts ?? {},
    deletedProductIds: savedLocalData?.deletedProductIds ?? [],
    categories: [],
    history: savedLocalData?.history ?? [],
};

Promise.all([loadProducts(), loadCategories()])
    .then(() => {
        console.log("Products and categories loaded");
    })
    .catch(error => {
        console.error(error);
    });

prevPageBtn.addEventListener("click", () => {
    if (state.skip === 0) return;
    state.skip -= state.limit;
    const checkedCategories = document.querySelectorAll("#categoryFilters input:checked");
    if (checkedCategories.length > 0) {
        handleCategoryChange();
    } else {
        loadProducts();
    }
});

nextPageBtn.addEventListener("click", () => {
    if (state.skip + state.limit >= state.total) return;
    state.skip += state.limit;
    const checkedCategories = document.querySelectorAll("#categoryFilters input:checked");
    if (checkedCategories.length > 0) {
        handleCategoryChange();
    } else {
        loadProducts();
    }
});


const handleSearch = debounce(() => {
    state.searchQuery = searchInput.value.trim();
    state.skip = 0;
    const checkedCategories = document.querySelectorAll("#categoryFilters input:checked");
    if (checkedCategories.length > 0) {
        handleCategoryChange();
    } else {
        loadProducts();
    }
}, 500);

searchInput.addEventListener("input", handleSearch);
if (document.body.classList.contains("admin")) {
    const undoAllBtn = document.getElementById("undoAllBtn");
    if (undoAllBtn) {
        undoAllBtn.addEventListener("click", () => {
            showCustomConfirm(
                "Are you sure?",
                "Are you sure you want to undo ALL local changes? This action cannot be undone.",
                "Undo All",
                () => {
                    state.localProducts = [];
                    state.updatedProducts = {};
                    state.deletedProductIds = [];
                    state.history = [];
                    savetoLocalStorage();
                    loadProducts();
                }
            );
        });
    }
}

if (document.body.classList.contains("admin")) {
    const openAddFormBtn = document.getElementById("openAddFormBtn");
    if (openAddFormBtn) {
        openAddFormBtn.addEventListener("click", () => {
            state.editingProductId = null;
            showProductForm();
        });
    }
    const closeFormBtn = document.getElementById("closeFormBtn");
    if (closeFormBtn) {
        closeFormBtn.addEventListener("click", () => {
            document.getElementById("formModalOverlay").style.display = "none";
        });
    }
}

if (document.body.classList.contains("user")) {
    const cartNavBtn = document.getElementById("cartNavBtn");
    if (cartNavBtn) {
        cartNavBtn.addEventListener("click", (e) => {
            e.preventDefault();
            showCartModal();
        });
    }
}





