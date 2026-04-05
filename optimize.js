const fs = require('fs');
const path = require('path');

function optimizeFile(fileRelativePath) {
    const filePath = path.join(process.cwd(), fileRelativePath);
    if (!fs.existsSync(filePath)) {
        console.log("NOT FOUND: " + filePath);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Images optimization (Native web performance)
    content = content.replace(/<img(?![^>]*loading=)([^>]*)>/g, '<img loading="lazy" decoding="async"$1>');
    
    // 2. High Contrast Colors (Accessibility)
    content = content.replace(/text-gray-300/g, 'text-gray-500');
    content = content.replace(/text-gray-400/g, 'text-gray-600');

    // 3. Known icon buttons lacking aria-label
    content = content.replace(/(<button[^>]*onClick=\{\(\) => setShowAuthModal\(false\)\}[^>]*)>/g, '$1 aria-label="Fermer">');
    content = content.replace(/(<button[^>]*onClick=\{\(\) => setIsSearchOpen\(false\)\}[^>]*)>/g, '$1 aria-label="Fermer la recherche">');
    content = content.replace(/(<button[^>]*onClick=\{\(\) => setIsImageModalOpen\(false\)\}[^>]*)>/g, '$1 aria-label="Fermer l image">');
    content = content.replace(/(<button[^>]*onClick=\{\(\) => setShowPropulseModal\(false\)\}[^>]*)>/g, '$1 aria-label="Fermer propulser">');
    
    // Generic empty or icon-only buttons (mostly absolute positioned close buttons)
    content = content.replace(/<button([^>]+className="[^"]*absolute[^"]*")>/g, function(match, attributes) {
        if (!attributes.includes('aria-label')) {
            return '<button' + attributes + ' aria-label="Fermer">';
        }
        return match;
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Optimized: ' + fileRelativePath);
}

optimizeFile('src/views/StorefrontView.tsx');
optimizeFile('src/components/ProductCard.tsx');
