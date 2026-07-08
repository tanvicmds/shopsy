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
    loadAddProductCard();
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
            <button class="edit-btn" type="button" data-id="${cardObj.item_id}">
                <i class="fa-solid fa-pencil"></i>
            </button>
            <button class="delete-btn" type="button" data-id="${cardObj.item_id}">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
    card.querySelector(".edit-btn").addEventListener("click", handleEditProduct);
    card.querySelector(".delete-btn").addEventListener("click", handleDeleteProduct);
    product_grid.appendChild(card);
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
            state.skip = 0;
            loadProducts();
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
            loadProducts();
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

function handleDeleteProduct(event) {
    const id = Number(event.currentTarget.dataset.id);
    deleteProduct(id);
}

const product_grid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");

const state = {
    limit: 15,
    skip: 0,
    searchQuery: "",
    total: 0,
    currentProducts: [],
    editingProductId: null,
    localProducts: [],
    updatedProducts: {},
    deletedProductIds: [],
    categories: []
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




