const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/views/StorefrontView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Inject the import
if (!content.includes('generateProductSlug')) {
    content = content.replace(
        "import { StoreData, Product, OrderItem, CustomerInfo } from '@/types';",
        "import { StoreData, Product, OrderItem, CustomerInfo } from '@/types';\nimport { generateProductSlug } from '@/utils/slug';"
    );
}

// 2. Replace all instances of `/product/${product.id}` with `/product/${generateProductSlug(product)}`
// They are usually written as `/product/${p.id}` or `/product/${product.id}` or `/product/${item.product.id}`

content = content.replace(/\/product\/\$\{([^}]+)\.id\}/g, (match, p1) => {
    // If it's something like store.id, ignore. But we only match `/product/...`
    return `/product/\${generateProductSlug(${p1})}`;
});
content = content.replace(/\/product\/\` \+ ([a-zA-Z]+)\.id/g, (match, p1) => {
    return `/product/\` + generateProductSlug(${p1})`;
});

// 3. Update the param parsing in StorefrontView.tsx
// It usually relies on location.pathname or useParams splat to get productId.
// Let's replace the route parsing block.
content = content.replace(
    /const isProductDetail = splat\?\.startsWith\('product\/'\);[\s\S]*?const selectedProductDetails =[^;]+;/,
    `const isProductDetail = splat?.startsWith('product/');
    const productSlugOrId = isProductDetail ? splat?.replace('product/', '') : null;
    
    // Support matching by the new slug AND falling back to the raw ID for backward compatibility
    const selectedProductDetails = productSlugOrId ? allProducts.find(p => p.id === productSlugOrId || generateProductSlug(p) === productSlugOrId || generateProductSlug(p).includes(productSlugOrId) || productSlugOrId.includes(p.id.split('-')[0])) : null;`
);

// Fallback in case the exact block wasn't matched but we can catch it:
// Let's do a strict replacement for selectedProductDetails if it's found
const matchSelectedProductDetails = content.match(/const selectedProductDetails[^;]+;/);
if (matchSelectedProductDetails) {
    if (!matchSelectedProductDetails[0].includes('generateProductSlug')) {
       content = content.replace(matchSelectedProductDetails[0], 
       `const productSlugOrId = splat?.replace('product/', '');
       const selectedProductDetails = productSlugOrId ? allProducts.find(p => p.id === productSlugOrId || generateProductSlug(p) === productSlugOrId) : null;`);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('StorefrontView.tsx slug routing updated successfully.');
